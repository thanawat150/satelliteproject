#!/usr/bin/env python3
"""Retry nationwide Sentinel-2 monitoring without losing previously published QA results.

Discovery uses gdown folder metadata only (skip_download=True); downloads JUST
paired 10m/20m TIFF files by Drive file ID, not whole folders or 60m assets.
Never substitute thumbnails, annual composites, or artificial index values.
"""
from __future__ import annotations
import argparse
import json
import re
import shutil
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data" / "nationwide"

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def save(p, obj):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")

def norm_date(p):
    s = str(p)
    m = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", s)
    return "".join(m.groups()) if m else None

def identify_resolution(name):
    m = re.search(r"_(10m|20m)(?:[_\.]|$)", name, re.I)
    return m.group(1).lower() if m else None

def discover(gdown, plot, folder):
    """Return exact-Drive-ID pairs discovered from original per-plot folder."""
    files = gdown.download_folder(
        id=folder["folder_id"], output=str(Path("inventory") / plot),
        skip_download=True, quiet=True, use_cookies=False, timeout=50
    )
    if not files:
        return []
    by_dir = defaultdict(dict)
    for f in files:
        path = Path(f.path)
        if not re.search(r"\.tiff?$", path.name, re.I):
            continue
        resolution = identify_resolution(path.name)
        date = norm_date(path.name) or norm_date(path.parent.name)
        if not resolution or not date:
            continue
        # Same parent path and acquisition date: never mix source folders.
        key = (str(path.parent), date)
        by_dir[key][resolution] = {
            "id": f.id, "name": path.name, "source_folder": folder["folder_id"],
            "date": date
        }
    result = []
    for (parent, date), pair in by_dir.items():
        if "10m" in pair and "20m" in pair:
            result.append((plot, date, pair["10m"], pair["20m"]))
    return result

def validate_pair(p10, p20):
    import rasterio
    import numpy as np
    with rasterio.open(p10) as ds10, rasterio.open(p20) as ds20:
        if ds10.count < 4 or ds20.count < 7:
            raise ValueError("Missing required multispectral 10m/20m bands")
        if not ds10.crs or not ds20.crs or ds10.crs != ds20.crs:
            raise ValueError("Missing CRS or 10m/20m CRS mismatch")
        names = [(x or "").strip().upper() for x in ds20.descriptions]
        idx = names.index("SCL")+1 if "SCL" in names else 7
        # Ground the SCL band by descriptions when provided.
        v = ds20.read(idx, masked=True).compressed()
        v = v[np.isfinite(v) & (v != -9999)]
        if not v.size:
            raise ValueError("SCL has no finite source pixels")
        good = np.isclose(v, np.rint(v), atol=0.0001) & (v >= 0) & (v <= 11)
        if np.mean(good) < 0.95:
            raise ValueError("Band metadata SCL fails class validation")
        if min(ds10.width, ds10.height, ds20.width, ds20.height) < 2:
            raise ValueError("Empty raster window")

def process(args):
    import gdown
    import nationwide_process as engine
    previous = load(DATA / "nationwide_results.json")
    target = set(load(DATA / "pdd_scope_136.json")["plots"][i]["code"]
                 for i in range(136))
    # Include plots with no valid date, but never overwrite prior good QA scenes.
    pending = [p for p in sorted(target)
               if previous["plots"].get(p, {}).get("qa_valid_dates", 0) == 0]
    chosen = [p for i,p in enumerate(pending) if i % args.shards == args.shard]
    sources = defaultdict(list)
    for x in load(DATA / "source_plot_folders.json")["folders"]:
        sources[x["plot"]].append(x)
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    errors = []; original={}; discovered = 0
    with tempfile.TemporaryDirectory(prefix="nationwide-retry-") as temp:
        ready = Path(temp) / "pairs"; ready.mkdir()
        for plot in chosen:
            options=defaultdict(list)
            for folder in sources.get(plot, []):
                try:
                    items=discover(gdown, plot, folder)
                    for _,date,a,b in items:
                        options[date].append((a,b))
                except Exception as e:
                    errors.append({"plot":plot,"folder":folder["folder_id"],"phase":"list","error":str(e)[:400]})
            discovered += len(options)
            # Favor two historical images and recent acquisitions. Limit bulk
            # download so one plot cannot starve the national processing queue.
            all_dates = sorted(options)
            sample = set(all_dates[:2]+all_dates[-4:])
            done=0
            for date in all_dates:
                if date not in sample: continue
                for ten,twenty in options[date]:
                    p10=Path(temp)/("src-"+re.sub(r"[^A-Za-z0-9-]","_",plot)+"-"+date+"-10m.tif")
                    p20=Path(temp)/("src-"+re.sub(r"[^A-Za-z0-9-]","_",plot)+"-"+date+"-20m.tif")
                    try:
                        for src,local in ((ten,p10),(twenty,p20)):
                            if local.exists(): local.unlink()
                            downloaded=gdown.download(
                                id=src["id"], output=str(local), quiet=True,
                                retries=3, timeout=90, use_cookies=False
                            )
                            if not downloaded or not local.is_file() or local.stat().st_size<1024:
                                raise ValueError("File empty or inaccessible: "+src["name"])
                        validate_pair(p10,p20)
                        dest10=ready/f"{plot}_S2_{date}_10m.tif"
                        dest20=ready/f"{plot}_S2_{date}_20m.tif"
                        shutil.copy2(p10,dest10); shutil.copy2(p20,dest20)
                        original[(plot,f"{date[:4]}-{date[4:6]}-{date[6:]}")]={
                            "original_tif10":ten["name"],"original_tif20":twenty["name"],
                            "source_folder_id":ten["source_folder"],
                            "original_tif10_file_id":ten["id"],
                            "original_tif20_file_id":twenty["id"]
                        }
                        done+=1
                        break
                    except Exception as e:
                        errors.append({"plot":plot,"date":date,"phase":"download/QA","file_ids":[ten["id"],twenty["id"]],"error":str(e)[:450]})
            print("RETRY_SOURCE",plot,"available_dates",len(options),"validated_pairs",done,flush=True)
        results=engine.run(DATA/"boundaries_pdd_136.geojson",ready,chosen,out)
    for row in results["scenes"]:
        row.update(original.get((row["plot"],row["date"]),{}))
    results["errors"].extend(errors)
    results["retry_shard"]=args.shard
    results["selected_plots"]=chosen
    results["discovered_dates"]=discovered
    results["totals"]["errors"]=len(results["errors"])
    save(out/"results.json",results)
    print("RETRY_SHARD_DONE",args.shard,results["totals"],flush=True)

def merge(args):
    base=load(DATA/"nationwide_results.json")
    original_status=load(DATA/"nationwide_run_status.json")
    geo=load(DATA/"nationwide_features.geojson")
    files=sorted(Path(args.parts).glob("shard-*/results.json"))
    if len(files)!=args.shards:
        raise RuntimeError(f"Need {args.shards} shards, received {len(files)}")
    seen={(r["plot"],r["date"]) for r in base["scenes"]}
    seen_geom={(f["properties"]["plot"],f["properties"]["date"],f["properties"]["class"])
               for f in geo["features"]}
    added=0; qa_added=0
    error_count=0; attempted=set()
    for file in files:
        batch=load(file)
        attempted.update(batch["selected_plots"])
        additions=set()
        for r in batch["scenes"]:
            key=(r["plot"],r["date"])
            if key in seen:continue
            seen.add(key); additions.add(key)
            base["scenes"].append(r)
            added+=1
            if r["analysis_status"]=="AUTO_VALID":qa_added+=1
        extra=load(file.with_name("features.geojson"))
        for f in extra["features"]:
            key=(f["properties"]["plot"],f["properties"]["date"])
            gt=(key[0],key[1],f["properties"]["class"])
            if key in additions and gt not in seen_geom:
                seen_geom.add(gt);geo["features"].append(f)
        for ch in batch["changes"]:
            if (ch["plot"],ch["date_b"]) in additions:
                base["changes"].append(ch)
        base["errors"].extend(batch.get("errors",[]))
        error_count+=len(batch.get("errors",[]))
    # Compute actual plot status from all retained + appended scenes.
    groups=defaultdict(list)
    for r in base["scenes"]:groups[r["plot"]].append(r)
    for plot in attempted:
        if plot not in base["plots"]:
            raise ValueError("Processed plot absent from published 136 PDD scope")
        history=sorted(groups.get(plot,[]),key=lambda x:x["date"])
        record=base["plots"][plot]
        record["selected_dates"]=[x["date"] for x in history]
        record["completed_dates"]=len(history)
        record["qa_valid_dates"]=sum(x["analysis_status"]=="AUTO_VALID" for x in history)
        record["processing_status"]="DONE" if history else "NO_SOURCE_SCENES"
    rows=base["scenes"]
    totals={
        "target_plots":136,
        "plots_with_source_scenes":sum(x.get("completed_dates",0)>0 for x in base["plots"].values()),
        "processed_dates":len(rows),
        "qa_valid_dates":sum(x["analysis_status"]=="AUTO_VALID" for x in rows),
        "partial_dates":sum(x["analysis_status"]=="PARTIAL" for x in rows),
        "no_data_dates":sum(x["analysis_status"]=="NO_DATA" for x in rows),
        "date_changes":len(base["changes"]),
        "errors":len(base["errors"])
    }
    if totals["plots_with_source_scenes"]<original_status["processed_plots"] or totals["qa_valid_dates"]<original_status["totals"]["qa_valid_dates"]:
        raise RuntimeError("Regression detected: published valid data would decrease")
    base["totals"]=totals
    base["last_retry"]={
        "at":datetime.now(timezone.utc).isoformat(),
        "attempted_plots":len(attempted),"new_scenes":added,"new_qa_scenes":qa_added,
        "new_errors":error_count
    }
    status={
        "requested_plots":136,
        "processed_plots":totals["plots_with_source_scenes"],
        "plots_without_usable_source":[p for p,v in base["plots"].items() if not v.get("completed_dates")],
        "plots_with_qa_valid_dates":sum(v.get("qa_valid_dates",0)>0 for v in base["plots"].values()),
        "totals":totals,
        "last_retry":base["last_retry"],
        "provenance":"original TIFF file IDs from dated Google Drive folders; PDD canonical 136; previous QA preserved",
        "status":"RESULTS_QA_CHECKED_NOT_ALL_VERIFIED"
    }
    save(Path(args.out)/"nationwide_results.json",base)
    save(Path(args.out)/"nationwide_features.geojson",geo)
    save(Path(args.out)/"nationwide_run_status.json",status)
    print("RETRY_MERGE",json.dumps(status,ensure_ascii=False),flush=True)
    if added==0:
        raise RuntimeError("No new valid TIFF pairs processed. Refusing to publish unchanged data.")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest="command",required=True)
    a=sub.add_parser("process");a.add_argument("--shard",type=int,required=True);a.add_argument("--shards",type=int,default=8);a.add_argument("--out",required=True)
    b=sub.add_parser("merge");b.add_argument("--parts",required=True);b.add_argument("--shards",type=int,default=8);b.add_argument("--out",required=True)
    args=p.parse_args()
    (process if args.command=="process" else merge)(args)
