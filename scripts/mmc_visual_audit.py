#!/usr/bin/env python3
"""Audits all public MMC raster previews; never infers missing imagery.

The audit is about display integrity, not proof of cloud-free land cover.
RGB uses 10 m georeferenced pixels; spectral indices use 20 m data.
"""
import json
from pathlib import Path
from collections import Counter
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
HOME=ROOT/"docs"/"mangrove-monitoring"
NATION=ROOT/"docs"/"data"/"nationwide"
RENDERER="mmc-rgb-fixed-reflectance-v2"
MODES={"true_color","false_color","ndvi","ndre","ndmi","mndwi","bsi","ndwi"}

def load(p):return json.loads(p.read_text(encoding="utf-8"))

def audit():
    manifest=load(HOME/"imagery_manifest.json")
    results=load(NATION/"nationwide_results.json")
    original={(x["plot"],x["date"]) for x in manifest.get("items",[])}
    generated={(x["plot"],x["date"]):x for x in manifest.get("generated_items",[])}
    valid={(x["plot"],x["date"]) for x in results.get("scenes",[]) if x.get("analysis_status")=="AUTO_VALID"}
    entries=[];bad_files=[];totals=Counter()
    for (plot,date),item in sorted(generated.items()):
        issues=[]
        if item.get("rgb_renderer_version")!=RENDERER:issues.append("LEGACY_RGB_RENDERER")
        available=set(item.get("assets",{}))
        if not MODES.issubset(available):issues.append("INCOMPLETE_8_MODES")
        for mode,url in item.get("assets",{}).items():
            if not str(url).startswith("./imagery/"):
                bad_files.append([plot,date,mode,"unsafe preview path"]);continue
            f=HOME/url.removeprefix("./")
            try:
                with Image.open(f) as img:
                    img.verify()
                with Image.open(f) as img:
                    if img.width<2 or img.height<2:raise ValueError("invalid dimensions")
                    if mode in ("true_color","false_color"):
                        dims=(item.get("rgb_native_width"),item.get("rgb_native_height"))
                        if all(isinstance(d,int) for d in dims) and img.size!=dims:
                            issues.append("RGB_WRONG_PIXEL_GRID")
                        if item.get("rgb_renderer_version")==RENDERER and img.mode!="RGBA":
                            issues.append("RGB_ALPHA_NOT_PRESERVED")
            except Exception as exc:bad_files.append([plot,date,mode,str(exc)[:160]])
        if item.get("rgb_display_warning"):issues.append("RGB_NEAR_WHITE")
        if (item.get("rgb_invalid_pct") or 0)>=30:issues.append("RGB_NODATA_HIGH")
        if (item.get("rgb_unclassified_scl_pct") or 0)>=20:issues.append("SCL_UNCLASSIFIED_HIGH")
        if item.get("rgb_plot_sample_pixels",999)<30:issues.append("SMALL_RGB_SAMPLE")
        if (plot,date) not in valid:issues.append("NO_QA_VALID_MATCH")
        for issue in set(issues):totals[issue]+=1
        entries.append({
            "plot":plot,"date":date,"renderer":item.get("rgb_renderer_version","legacy"),
            "scl_valid_pct":item.get("qa_valid_pct"),
            "rgb_near_white_pct":item.get("rgb_near_white_pct"),
            "rgb_invalid_pct":item.get("rgb_invalid_pct"),
            "rgb_unclassified_scl_pct":item.get("rgb_unclassified_scl_pct"),
            "rgb_plot_sample_pixels":item.get("rgb_plot_sample_pixels"),
            "rgb_image_dimensions":[item.get("rgb_native_width"),item.get("rgb_native_height")],
            "issues":sorted(set(issues)),
            "image_assets":len(available)
        })
    v2={k for k,v in generated.items() if v.get("rgb_renderer_version")==RENDERER}
    missing_v2=sorted(valid-v2)
    report={
        "report_type":"MMC_RASTER_DISPLAY_QA_NOT_CLOUD_CERTIFICATION",
        "renderer_target":RENDERER,
        "summary":{
            "total_qa_valid_dates":len(valid),
            "qa_valid_with_new_rgb":len(valid&v2),
            "qa_valid_pending_new_rgb":len(missing_v2),
            "published_generated_dates":len(generated),
            "archived_date_pairs":len(original),
            "rendered_files_with_errors":len(bad_files),
            "visual_review_flag_counts":dict(totals),
        },
        "qa_valid_not_upgraded":[{"plot":x[0],"date":x[1]} for x in missing_v2],
        "file_errors":[{"plot":x[0],"date":x[1],"mode":x[2],"detail":x[3]} for x in bad_files],
        "items":entries,
        "limitations":["SCL percentage is not proof of a cloud-free image",
                       "Cloud-bright scenes cannot be cleaned by preview color correction",
                       "Only Sentinel-2 source acquisitions with source GeoTIFFs can be rendered"]
    }
    out=HOME/"rgb_quality_audit.json"
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print("MMC_RGB_VISUAL_AUDIT",json.dumps(report["summary"],ensure_ascii=False),flush=True)
    if bad_files:raise RuntimeError(f"{len(bad_files)} corrupted or missing published preview assets")
    return report

if __name__=="__main__":audit()
