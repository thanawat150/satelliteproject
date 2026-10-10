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
    # Every processed Sentinel-2 date must have eight real image files after
    # the display-only backfill; scientific QA is still limited to AUTO_VALID.
    source_dates={(x["plot"],x["date"]):x["analysis_status"]
                  for x in results.get("scenes",[])}
    for key,status in source_dates.items():
        item=generated.get(key)
        if item is None:
            bad_files.append([key[0],key[1],"all","NO_RASTER_PREVIEW_FOR_SOURCE_DATE"])
        elif not MODES.issubset(set(item.get("assets",{}))):
            bad_files.append([key[0],key[1],"all","MISSING_SOME_OF_EIGHT_SOURCE_IMAGE_MODES"])
    for (plot,date),item in sorted(generated.items()):
        issues=[]
        if item.get("rgb_renderer_version")!=RENDERER:issues.append("LEGACY_RGB_RENDERER")
        available=set(item.get("assets",{}))
        visual_only=item.get("preview_kind")=="VISUAL_ONLY_NON_QA"
        if visual_only:
            if not MODES.issubset(available):issues.append("INCOMPLETE_8_REAL_TIFF_MODES")
            issues.append("DISPLAY_ONLY_NOT_SCIENTIFIC_QA")
        elif not MODES.issubset(available):issues.append("INCOMPLETE_8_MODES")
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
                        if (item.get("rgb_renderer_version")==RENDERER
                            and (item.get("rgb_invalid_pct") or 0)>0
                            and img.mode!="RGBA"):
                            issues.append("RGB_ALPHA_NOT_PRESERVED")
            except Exception as exc:bad_files.append([plot,date,mode,str(exc)[:160]])
        if item.get("rgb_display_warning"):issues.append("RGB_NEAR_WHITE")
        if (item.get("rgb_invalid_pct") or 0)>=30:issues.append("RGB_NODATA_HIGH")
        if (item.get("rgb_unclassified_scl_pct") or 0)>=20:issues.append("SCL_UNCLASSIFIED_HIGH")
        if item.get("rgb_plot_sample_pixels",999)<30:issues.append("SMALL_RGB_SAMPLE")
        if (plot,date) not in valid and not visual_only:issues.append("NO_QA_VALID_MATCH")
        if visual_only and (plot,date) in valid:issues.append("WRONG_VISUAL_ONLY_QA_VALID_DATE")
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
            "non_qa_dates_with_visual_only_rgb":sum(v.get("preview_kind")=="VISUAL_ONLY_NON_QA" for v in generated.values()),
            "non_qa_dates_in_source":sum(x.get("analysis_status")!="AUTO_VALID" for x in results.get("scenes",[])),
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
    # Independent spectral-index audit: compare the 20m PDD pixel means
    # behind rendered PNGs to published nationwide metrics, plus cross-check
    # NDRE/NDMI/MNDWI against the TIFF's own embedded index bands.
    index_modes=("ndvi","ndre","ndmi","mndwi","ndwi","bsi")
    index_entries=[];flagged=[];mode_counter=Counter()
    old_rows={(x["plot"],x["date"]):x for x in results.get("scenes",[])}
    for (plot,date),item in sorted(generated.items()):
        if item.get("preview_kind")=="VISUAL_ONLY_NON_QA":
            continue  # RGB-only cloudy scene; do not assert six source-derived indices.
        all_stats=item.get("index_stats") or {}
        parity=item.get("index_parity") or {}
        failures=[]
        for mode in index_modes:
            stat=all_stats.get(mode)
            if stat is None:
                failures.append(mode+":NO_SOURCE_VALIDATION")
                mode_counter[mode+":NO_SOURCE_VALIDATION"]+=1
                continue
            mn=stat.get("plot_mean")
            legacy=old_rows.get((plot,date),{}).get(mode)
            if mn is None:
                failures.append(mode+":NO_VALID_PIXELS")
                mode_counter[mode+":NO_VALID_PIXELS"]+=1
            if mn is not None and legacy is not None and abs(mn-legacy)>0.03:
                failures.append(mode+":PUBLISHED_MEAN_MISMATCH")
                mode_counter[mode+":PUBLISHED_MEAN_MISMATCH"]+=1
            if stat.get("embedded_tif_match") is False:
                failures.append(mode+":EMBEDDED_TIFF_MISMATCH")
                mode_counter[mode+":EMBEDDED_TIFF_MISMATCH"]+=1
            if (stat.get("plot_min") is not None and stat.get("plot_max") is not None
               and (stat["plot_min"] < -1.01 or stat["plot_max"] > 1.01)):
                failures.append(mode+":OUTSIDE_RANGE")
                mode_counter[mode+":OUTSIDE_RANGE"]+=1
        row={
            "plot":plot,"date":date,"index_renderer_version":item.get("index_renderer_version"),
            "index_values":{m:{"computed":all_stats.get(m,{}).get("plot_mean"),
                               "published":old_rows.get((plot,date),{}).get(m),
                               "samples":all_stats.get(m,{}).get("sample_pixels"),
                               "tif_rmse":all_stats.get(m,{}).get("source_band_rmse"),
                               "formula":all_stats.get(m,{}).get("formula")} for m in index_modes},
            "issues":failures
        }
        index_entries.append(row)
        if failures:flagged.append(row)
    index_report={
      "report_type":"MMC_ORIGINAL_TIFF_INDEX_PARITY_NOT_ECOLOGICAL_CERTIFICATION",
      "method":"Original 10m/20m TIFF bands, same 20m PDD mask; legacy chart may use different border/nodata treatment",
      "note":"NDMI uses B8A/B11 variant matching TIFF precomputed NDMI; McFeeters NDWI uses B3/B8; no vegetation-loss inference from negative NDWI",
      "summary":{
        "qa_valid_dates":len(valid),
        "checked_generated_dates":len(index_entries),
        "with_index_stats":sum(bool(x.get("index_stats")) for x in generated.values()),
        "index_flagged_plot_dates":len(flagged),
        "index_issue_counts":dict(mode_counter)
      },
      "flagged_plot_dates":flagged,
      "items":index_entries,
      "limitations":["Original TIFF index bands are not necessarily resampled with the same border rules as preview indices",
                     "PDD pixel averages are not evidence of flood, vegetation growth, erosion or site quality",
                     "NDMI B8A variant is retained to match source metadata and numerical time series"]
    }
    (HOME/"index_quality_audit.json").write_text(json.dumps(index_report,ensure_ascii=False,indent=2),encoding="utf-8")
    print("MMC_INDEX_SOURCE_AUDIT",json.dumps(index_report["summary"],ensure_ascii=False),flush=True)
    if bad_files:raise RuntimeError(f"{len(bad_files)} corrupted or missing published preview assets")
    return report

if __name__=="__main__":audit()
