#!/usr/bin/env python3
"""Backfill all eight genuine Sentinel-2 TIFF-derived preview modes for archive-only days.

The four dates were previously available as seven-mode legacy PNG previews:
the legacy generic_preview was NOT NDWI. We never substitute that layer.

Only display previews are produced; archived dates are NOT present in the
published scene QA table. Consequently NO index mean, water area, flood status
or change event is inferred or inserted.

Source pairs were identified by listing the user's plot/date Google Drive
folders. New previews are saved to the static MMC imagery asset folder.
"""
from __future__ import annotations
import json
import shutil
import tempfile
from pathlib import Path

from mmc_render_imagery import (
    DATA, MODES, download_source_tiff, generate_visual_only, json_read, json_write
)

BASE = Path(__file__).resolve().parents[1]
HOME = BASE / "docs" / "mangrove-monitoring"
SRC = {
    ("13-STC", "2026-10-02"): (
        "1W62EIqfDmBJqp3ZgislhMRELD5B3Vddq",
        "1sxVdkTua61AftlxzY7cwCQMEK2GXRyOO"),
    ("13-STC", "2026-10-07"): (
        "1gZqqXLwgOt5ArjsnSJkaMo3deEK5bRiG",
        "1PsUYH2YKjSC1xb3wNzzylKIrY0luCk5H"),
    ("14-VSD", "2026-10-02"): (
        "1oiogDsdmhgsFNtoZE-qyFXsLtz3mEr3v",
        "12_lVLdVhMy9XhW6Ab76Vz-NSeGKmhDeu"),
    ("14-VSD", "2026-10-07"): (
        "1nwxJKVudLL6O-o0Hrg5J5Wj17jbO7h8K",
        "1nlqHhAsjhw5iuDUtAQNIsnReD7rZ-h6X")
}

def assess(manifest):
    generated={(x["plot"],x["date"]):x for x in manifest.get("generated_items",[])}
    missing={}
    for x in manifest.get("items",[]):
        key=(x["plot"],x["date"])
        new=generated.get(key)
        if new:
            absent=set(MODES)-set(new.get("assets",{}))
        else:
            absent=set(MODES)-set(x.get("modes",[]))
        if absent:
            missing[key]=sorted(absent)
    return missing

def main():
    import gdown
    manifest_path=HOME/"imagery_manifest.json"
    manifest=json_read(manifest_path)
    raw=json_read(DATA/"boundaries_pdd_136.geojson")
    boundaries={f["properties"]["plot"]:f["geometry"] for f in raw["features"]}
    missing=assess(manifest)
    unexpected={key for key in missing if key not in SRC}
    if unexpected:
        raise RuntimeError(f"Unmapped missing original TIFF dates: {sorted(unexpected)}")
    completed=[]
    for (plot,date),(id10,id20) in SRC.items():
        if (plot,date) not in missing:
            continue
        if (plot,date) not in {(x["plot"],x["date"]) for x in manifest["items"]}:
            raise RuntimeError(f"Not an original archive date: {plot} {date}")
        with tempfile.TemporaryDirectory(prefix="mmc-legacy-") as temp:
            td=Path(temp)
            p10=download_source_tiff(gdown,id10,td/"10m.tif",4)
            p20=download_source_tiff(gdown,id20,td/"20m.tif",7)
            out=HOME/"imagery"/plot/date
            old_created=set(out.iterdir()) if out.exists() else set()
            entry=generate_visual_only(p10,out,plot,date,boundaries[plot],twenty=p20)
            for name in MODES:
                asset=out/(name+".webp" if name in ("true_color","false_color") else name+".png")
                if not asset.is_file() or asset.stat().st_size<=40:
                    raise RuntimeError(f"Missing generated real TIFF asset {plot} {date} {name}")
            entry.update({
                "algorithm":"ORIGINAL_SENTINEL2_TIFF_ARCHIVE_DISPLAY_ONLY",
                "source_qa_status":"UNPROCESSED",
                "qa_valid_pct":None,
                "original_tif10_file_id":id10,
                "original_tif20_file_id":id20,
                "archive_backfill":True,
                "original_archive_has_ndwi":False,
                "qa_note":"ARCHIVE ONLY: source-TIFF-based RGB and 6 indices, no SCL analysis approval; not valid for water/forest change statistics"
            })
            generated={(x["plot"],x["date"]):x for x in manifest.get("generated_items",[])}
            generated[(plot,date)]=entry
            manifest["generated_items"]=list(generated.values())
            completed.append(f"{plot} {date}")
            print("ARCHIVE_REAL_TIFF_RENDERED",plot,date,len(entry["assets"]),flush=True)
    remaining=assess(manifest)
    if remaining:
        raise RuntimeError(f"Archive image coverage still incomplete: {remaining}")
    if len(manifest.get("generated_items",[]))<466:
        raise RuntimeError("Expected 462 published PDD dates plus 4 archive-only dates")
    manifest["archive_backfill_qa"]={
        "source":"original matching 10m+20m TIFF pairs in plot/date Drive folders",
        "date_count":len(SRC),
        "rendered_this_run":len(completed),
        "legacy_missing_ndwi_replaced_with_source_computation":True,
        "scientific_status":"VISUAL_ONLY_NOT_QUALITY_VALIDATED",
        "archive_missing_modes":0
    }
    json_write(manifest_path,manifest)
    print("ALL_ARCHIVED_IMAGE_MODES_VERIFIED",len(manifest["items"]),
          "archive entries",len(manifest["generated_items"]),"generated dates",flush=True)

if __name__=="__main__":
    main()
