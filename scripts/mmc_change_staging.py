#!/usr/bin/env python3
"""Run read-only TIFF-backed change staging; never modify published results.
Samples exact plot/date pairs from indexed QA-valid scenes and downloads source IDs.
Artifacts, not auto-published values, are the deliverable.
"""
import argparse
import json
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"docs"/"data"/"nationwide"
sys.path.insert(0,str(ROOT/"scripts"))

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,v):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")

def choose(rows,plot,max_dates):
    good=sorted([r for r in rows if r["plot"]==plot and r.get("analysis_status")=="AUTO_VALID"],key=lambda r:r["date"])
    return good[-max_dates:]

def stage(plots,out,max_dates):
    import gdown
    import nationwide_process as engine
    old=load(DATA/"nationwide_results.json")
    boundaries=DATA/"boundaries_pdd_136.geojson"
    folder=load(DATA/"source_plot_folders.json")
    folder_index=defaultdict(list)
    for x in folder["folders"]:folder_index[x["plot"]].append(x)
    manifest=load(ROOT/"docs"/"mangrove-monitoring"/"imagery_manifest.json")
    generated={(x["plot"],x["date"]):x for x in manifest.get("generated_items",[])}
    report={"type":"MMC_CHANGE_STAGING_NOT_PUBLISHED","engine":engine.ALG,
            "requested_plots":plots,"max_dates_per_plot":max_dates,
            "plot_results":[],"errors":[],"provenance":"original TIFF Drive ID from scene or generated manifest",
            "publish_allowed":False,
            "limitations":["No tide or seasonal normalization","No field or independent classification validation",
                           "This pilot does not reprocess all 136 PDD plots"]}
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mmc-stage-") as td:
        inputs=Path(td)/"inputs";inputs.mkdir()
        ready=[]
        for plot in plots:
            selected=choose(old["scenes"],plot,max_dates)
            for row in selected:
                src=generated.get((plot,row["date"]),{})
                id10=row.get("original_tif10_file_id") or src.get("original_tif10_file_id")
                id20=row.get("original_tif20_file_id") or src.get("original_tif20_file_id")
                if not (id10 and id20):
                    report["errors"].append({"plot":plot,"date":row["date"],"reason":"SOURCE_FILE_ID_MISSING"})
                    continue
                date=row["date"].replace("-","")
                pair=[]
                for resolution,source_id in (("10m",id10),("20m",id20)):
                    dest=inputs/f"{plot}_S2_{date}_{resolution}.tif"
                    try:
                        result=gdown.download(id=source_id,output=str(dest),quiet=True,
                                              use_cookies=False,retries=3,timeout=120)
                        if not result or not dest.exists() or dest.stat().st_size<200:
                            raise ValueError("Empty download")
                        pair.append(dest)
                    except Exception as exc:
                        report["errors"].append({"plot":plot,"date":row["date"],
                                                 "resolution":resolution,"reason":str(exc)[:200]})
                if len(pair)==2:ready.append((plot,row["date"]))
                else:
                    for p in pair:p.unlink(missing_ok=True)
        plot_ready=sorted({p for p,_ in ready})
        if not plot_ready:
            write(out/"staging_report.json",report)
            raise RuntimeError("No verified TIFF pairs available; staging stopped without publication")
        analysis=engine.run(boundaries,inputs,plot_ready,out/"engine")
        actual={(x["plot"],x["date"]):x for x in analysis["scenes"]}
        old_scenes={(x["plot"],x["date"]):x for x in old["scenes"]}
        for plot,date in ready:
            r=actual.get((plot,date));baseline=old_scenes[(plot,date)]
            if not r:
                report["errors"].append({"plot":plot,"date":date,"reason":"ENGINE_SCENE_NOT_PROCESSED"})
                continue
            fields=["ndvi","ndre","ndmi","ndwi","mndwi","bsi","water_rai","vegetation_rai","bare_soil_rai"]
            diff={k:{"old":baseline.get(k),"staging":r.get(k),
                     "delta":round(r[k]-baseline[k],5) if isinstance(r.get(k),(float,int)) and isinstance(baseline.get(k),(float,int)) else None}
                  for k in fields}
            report["plot_results"].append({"plot":plot,"date":date,"qa_old":baseline.get("analysis_status"),
                                           "qa_staging":r.get("analysis_status"),
                                           "index_and_area_differences":diff,
                                           "area_balance_error_rai":r.get("area_balance_error_rai")})
        area_review=[]
        for item in report["plot_results"]:
            for key in ("water_rai","vegetation_rai","bare_soil_rai"):
                delta=item["index_and_area_differences"][key]["delta"]
                if delta is not None and abs(delta)>=0.25:
                    area_review.append({"plot":item["plot"],"date":item["date"],
                        "metric":key,"difference_rai":delta,
                        "reason":"PUBLISHED_VS_POLYGON_CLIPPED_AREA_DIFFERENCE"})
        # Review priority depends on magnitude and plot area, not a universal
        # declaration that the boundary clipping alone explains every change.
        plot_areas={k:float(v.get("pdd_area_rai") or 0)
                    for k,v in old.get("plots",{}).items()}
        for flag in area_review:
            area=plot_areas.get(flag["plot"],0)
            flag["pdd_area_rai"]=round(area,4) if area else None
            flag["pct_of_plot"]=round(100*abs(flag["difference_rai"])/area,2) if area else None
            flag["review_category"]="AREA_METHOD_OR_PIXEL_MASK_DISCREPANCY"
            flag["review_status"]="UNRESOLVED_REQUIRES_INDEPENDENT_GIS_CHECK"
        report["area_review_flags"]=area_review
        report["area_review_count"]=len(area_review)
        report["review_required"]=bool(area_review or report["errors"])
        report["approval_status"]="REVIEW_REQUIRED" if report["review_required"] else "NOT_APPROVED"
        report["staged_changes"]=analysis["changes"]
        report["comparison_count"]=len(analysis["changes"])
        report["pairs_downloaded"]=len(ready)
        report["pass_for_publication"]=False
        write(out/"staging_report.json",report)
        print("STAGING_FINISHED",len(ready),"TIFF_PAIRS",len(analysis["changes"]),"CHANGES",len(report["errors"]),"ERRORS",len(area_review),"AREA_REVIEW_FLAGS")
        if report["errors"]:print("STAGING_REVIEW_REQUIRED",len(report["errors"]))
    return report

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--plots",nargs="+",default=["66-STC","70-STC","15-STC"])
    p.add_argument("--max-dates",type=int,default=3)
    p.add_argument("--output",default="work/mmc-change-staging")
    args=p.parse_args()
    if not 2<=args.max_dates<=6:raise SystemExit("max-dates must be 2-6")
    stage(args.plots,args.output,args.max_dates)
