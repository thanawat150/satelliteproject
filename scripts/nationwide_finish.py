#!/usr/bin/env python3
"""Process all remaining PDD plots from actual dated Sentinel-2 GeoTIFFs on Drive.

Downloads public source folders listed in source_plot_folders.json; never estimates
indices from thumbnails. Each 10m/20m pair must be from the same dated folder.
Existing batch_01 results remain authoritative and are not overwritten.
"""
from __future__ import annotations
import argparse
import json
import re
import shutil
import tempfile
from collections import defaultdict
from pathlib import Path

D = Path(__file__).resolve().parents[1] / "docs" / "data" / "nationwide"
ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")


def scene_date(p):
    for candidate in (p.name, p.parent.name):
        a = re.search(r"(20\d{2})(\d{2})(\d{2})", candidate)
        if a:
            return "".join(a.groups())
        b = re.search(r"(20\d{2})-(\d{2})-(\d{2})", candidate)
        if b:
            return "".join(b.groups())
    return None


def inspect_pairs(folder, plot):
    """Require both resolutions from one exact directory (same acquisition)."""
    pairs = []
    for d in [folder] + sorted(x for x in folder.rglob("*") if x.is_dir()):
        tifs = [x for x in d.iterdir() if x.is_file() and re.search(r"\.tiff?$", x.name, re.I)]
        ten = [x for x in tifs if re.search(r"_10m(?:[_.])", x.name, re.I)]
        twenty = [x for x in tifs if re.search(r"_20m(?:[_.])", x.name, re.I)]
        if not ten or not twenty:
            continue
        one = max(ten, key=lambda p: p.stat().st_size)
        two = max(twenty, key=lambda p: p.stat().st_size)
        date1, date2 = scene_date(one), scene_date(two)
        if not date1 or date1 != date2:
            continue
        pairs.append((date1, one, two))
    return pairs


def qa_bands(p10, p20):
    import numpy as np
    import rasterio
    with rasterio.open(p10) as a, rasterio.open(p20) as b:
        if not a.crs or not b.crs or a.count < 4 or b.count < 7:
            raise ValueError("Missing CRS or required 10m/20m bands")
        if a.crs != b.crs:
            raise ValueError("10m/20m CRS mismatch")
        # Some original stacks omit descriptions but follow B2/B3/B4/B8 and
        # B5/B6/B7/B8A/B11/B12/SCL positional ordering.
        x = b.read(7, masked=True)
        valid = np.asarray(x.compressed())
        if valid.size == 0:
            raise ValueError("Missing SCL pixels")
        near_int = np.isclose(valid, np.rint(valid), atol=0.001)
        classes = (valid >= 0) & (valid <= 11)
        if float((near_int & classes).mean()) < 0.98:
            raise ValueError("20m band 7 does not resemble Sentinel-2 SCL")
        # Avoid accidentally treating pure blank imagery as valid observations.
        if a.width < 2 or a.height < 2 or b.width < 2 or b.height < 2:
            raise ValueError("Empty image grid")


def process(args):
    import gdown
    import nationwide_process as engine
    scope = load(D / "pdd_scope_136.json")
    all_plots = [p["code"] for p in scope["plots"]]
    first = set(load(D / "batch_01_results.json")["plots"])
    remaining = [p for p in all_plots if p not in first]
    chosen = [p for i, p in enumerate(remaining) if i % args.shards == args.shard]
    mapping = defaultdict(list)
    for row in load(D / "source_plot_folders.json")["folders"]:
        mapping[row["plot"]].append(row)
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    errors, origin = [], {}
    with tempfile.TemporaryDirectory(prefix="national-tif-") as td:
        work = Path(td)
        ready = work / "paired"
        ready.mkdir()
        for plot in chosen:
            candidates = {}
            for j, info in enumerate(mapping.get(plot, [])):
                dest = work / "drive" / re.sub(r"[^A-Za-z0-9_-]", "_", plot) / str(j)
                dest.parent.mkdir(parents=True, exist_ok=True)
                try:
                    fetched = gdown.download_folder(
                        id=info["folder_id"], output=str(dest),
                        quiet=True, remaining_ok=True, use_cookies=False
                    )
                    if fetched is None:
                        raise RuntimeError("Public folder download returned no files")
                    for date, p10, p20 in inspect_pairs(dest, plot):
                        try:
                            qa_bands(p10, p20)
                        except Exception as e:
                            errors.append({"plot": plot, "date": date, "folder": info["folder_id"], "error": str(e)})
                            continue
                        key = (plot, date)
                        weight = p10.stat().st_size + p20.stat().st_size
                        if key not in candidates or weight > candidates[key][0]:
                            candidates[key] = (weight, p10, p20, info["folder_id"])
                except Exception as e:
                    errors.append({"plot": plot, "folder": info["folder_id"], "error": str(e)[:350]})
            for (pl, date), (_, ten, twenty, folderid) in sorted(candidates.items()):
                p10 = ready / f"{pl}_S2_{date}_10m.tif"
                p20 = ready / f"{pl}_S2_{date}_20m.tif"
                shutil.copy2(ten, p10)
                shutil.copy2(twenty, p20)
                origin[(pl, f"{date[:4]}-{date[4:6]}-{date[6:]}")] = {
                    "original_tif10": ten.name, "original_tif20": twenty.name,
                    "source_folder_id": folderid,
                }
            print("SOURCE", plot, len(candidates), "matched days", flush=True)
        result = engine.run(
            D / "boundaries_pdd_136.geojson", ready, chosen, output
        )
    for r in result["scenes"]:
        ref = origin.get((r["plot"], r["date"]), {})
        r.update(ref)
    result["errors"].extend(errors)
    result["totals"]["errors"] = len(result["errors"])
    result["source_policy"] = "Only original matching 10m/20m dated TIFF pairs; native canonical PDD 136; SCL QA"
    write(output / "results.json", result)
    write(output / "source_issues.json", {"shard": args.shard, "plots": chosen, "errors": result["errors"]})
    print("CHUNK_COMPLETE", args.shard, "plots", len(chosen), "scenes", len(result["scenes"]), "errors", len(result["errors"]), flush=True)


def merge(args):
    original = load(D / "batch_01_results.json")
    inputs = sorted(Path(args.parts).glob("shard-*/results.json"))
    if not inputs:
        raise RuntimeError("No shard results to merge")
    if len(inputs) != args.shards:
        raise RuntimeError(f"Expected {args.shards} shards, found {len(inputs)}; refusing partial publication")
    all_plots = load(D / "pdd_scope_136.json")["plots"]
    base = dict(original)
    base["plots"] = dict(original["plots"])
    base["scenes"] = list(original["scenes"])
    base["changes"] = list(original["changes"])
    base["errors"] = list(original.get("errors", []))
    base["algorithm"] = original["algorithm"]
    base["source"] = "Original Sentinel-2 GeoTIFF from Google Drive / PDD canonical 136"
    geo = load(D / "batch_01_features.geojson")
    by_code = set(base["plots"])
    for file in inputs:
        batch = load(file)
        extras = load(file.with_name("features.geojson"))
        collision = by_code.intersection(batch["plots"])
        if collision:
            raise RuntimeError(f"Duplicate processed plot IDs: {sorted(collision)}")
        by_code.update(batch["plots"])
        base["plots"].update(batch["plots"])
        base["scenes"].extend(batch["scenes"])
        base["changes"].extend(batch["changes"])
        base["errors"].extend(batch.get("errors", []))
        geo["features"].extend(extras["features"])
    target = {p["code"] for p in all_plots}
    if by_code != target:
        raise RuntimeError(f"Scope mismatch, missing={sorted(target-by_code)}")
    # Keep real NO_DATA, never convert to zero or invent trends.
    records = list(base["scenes"])
    base["batch_size"] = len(target)
    base["totals"] = {
        "target_plots": len(target),
        "plots_with_source_scenes": sum(v.get("completed_dates", 0) > 0 for v in base["plots"].values()),
        "processed_dates": len(records),
        "qa_valid_dates": sum(r["analysis_status"] == "AUTO_VALID" for r in records),
        "partial_dates": sum(r["analysis_status"] == "PARTIAL" for r in records),
        "no_data_dates": sum(r["analysis_status"] == "NO_DATA" for r in records),
        "date_changes": len(base["changes"]),
        "errors": len(base["errors"])
    }
    status = {
        "requested_plots": len(target),
        "processed_plots": base["totals"]["plots_with_source_scenes"],
        "plots_without_usable_source": [
            k for k, v in base["plots"].items() if not v.get("completed_dates")
        ],
        "plots_with_qa_valid_dates": sum(v.get("qa_valid_dates", 0) > 0 for v in base["plots"].values()),
        "totals": base["totals"],
        "provenance": "source_plot_folders.json; canonical boundaries_pdd_136.geojson; batch_01 retained",
        "status": "RESULTS_QA_CHECKED_NOT_ALL_VERIFIED",
    }
    dest = Path(args.out)
    write(dest / "nationwide_results.json", base)
    write(dest / "nationwide_features.geojson", geo)
    write(dest / "nationwide_run_status.json", status)
    print("MERGE_COMPLETE", json.dumps(status, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="operation", required=True)
    one = sub.add_parser("process")
    one.add_argument("--shard", type=int, required=True)
    one.add_argument("--shards", type=int, default=8)
    one.add_argument("--out", required=True)
    two = sub.add_parser("merge")
    two.add_argument("--parts", required=True)
    two.add_argument("--shards", type=int, default=8)
    two.add_argument("--out", required=True)
    cfg = ap.parse_args()
    process(cfg) if cfg.operation == "process" else merge(cfg)
