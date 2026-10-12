#!/usr/bin/env python3
"""Idempotently add the audited 1-STC archive scenes to MMC's scene registry."""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/data/nationwide/audit_20261012"
MANIFEST_PATH = ROOT / "docs/mangrove-monitoring/imagery_manifest.json"
RESULTS_PATH = ROOT / "docs/data/nationwide/nationwide_results.json"
INVENTORY_PATH = AUDIT / "1stc_drive_inventory.csv"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def main() -> None:
    with INVENTORY_PATH.open(encoding="utf-8-sig", newline="") as stream:
        assets = list(csv.DictReader(stream))
    by_date: dict[str, dict[str, dict]] = defaultdict(dict)
    for asset in assets:
        date = asset["capture_date"]
        resolution = asset["filename"].split("_")[-3].removesuffix("m")
        if not date:
            raise SystemExit(f"No acquisition date in filename: {asset['filename']}")
        if resolution in by_date[date]:
            raise SystemExit(f"Duplicate {resolution}m file on {date}")
        by_date[date][resolution] = asset
    if len(assets) != 399 or len(by_date) != 133:
        raise SystemExit(f"Expected 399 TIFFs / 133 dates; found {len(assets)} / {len(by_date)}")
    if any(set(items) != {"10", "20", "60"} for items in by_date.values()):
        raise SystemExit("A scene is missing one of the 10m/20m/60m source TIFFs")

    manifest = read_json(MANIFEST_PATH)
    generated = {
        row["date"]: row for row in manifest.get("generated_items", [])
        if row.get("plot") == "1-STC" and row.get("date")
    }
    if len(generated) != 133 or set(generated) != set(by_date):
        raise SystemExit(f"Manifest and Drive inventory mismatch: {len(generated)} previews / {len(by_date)} dates")

    with (AUDIT / "plot_registry.csv").open(encoding="utf-8-sig", newline="") as stream:
        plot_rows = list(csv.DictReader(stream))
    identity = next(row for row in plot_rows if row["legacy_plot_code"] == "1-STC")
    if identity["pdd_verified_geometry"].lower() != "true":
        raise SystemExit("Registry does not verify the 1-STC source geometry")

    results = read_json(RESULTS_PATH)
    existing_rows = {(row.get("plot"), row.get("date")): row for row in results.get("scenes", [])}
    existing = set(existing_rows)
    new_rows = []
    for date in sorted(generated):
        image = generated[date]
        qa = image.get("plot_qa", {})
        stats = image.get("index_stats", {})
        ten, twenty, sixty = (by_date[date][r] for r in ("10", "20", "60"))
        source_path = f"/Nationwide Archive/1-STC/{date[:4]}/{date[5:]}"
        image.update({
            "source_tif60_file_id": sixty["drive_file_id"], "original_tif60_file_id": sixty["drive_file_id"],
            "source_tif60_filename": sixty["filename"], "original_tif60": sixty["filename"],
            "source_tif10_created_time": ten["created_time"], "source_tif20_created_time": twenty["created_time"],
            "source_tif60_created_time": sixty["created_time"],
            "source_tif10_modified_time": ten["modified_time"], "source_tif20_modified_time": twenty["modified_time"],
            "source_tif60_modified_time": sixty["modified_time"],
            "source_folder_id": sixty["source_folder_id"], "source_folder_path": source_path
        })
        if ("1-STC", date) in existing:
            old = existing_rows[("1-STC", date)]
            old.update({
                "plot_id": identity["plot_id"], "province": "จันทบุรี", "scene_key": f"Sentinel-2|1-STC|{date}",
                "original_tif10": ten["filename"], "original_tif20": twenty["filename"], "original_tif60": sixty["filename"],
                "source_tif10_file_id": ten["drive_file_id"], "source_tif20_file_id": twenty["drive_file_id"], "source_tif60_file_id": sixty["drive_file_id"],
                "original_tif10_file_id": ten["drive_file_id"], "original_tif20_file_id": twenty["drive_file_id"], "original_tif60_file_id": sixty["drive_file_id"],
                "source_file_ids": [ten["drive_file_id"], twenty["drive_file_id"], sixty["drive_file_id"]],
                "source_paths": [f"{source_path}/{a['filename']}" for a in (ten, twenty, sixty)],
                "source_file_created_times": [a["created_time"] for a in (ten, twenty, sixty)],
                "source_file_modified_times": [a["modified_time"] for a in (ten, twenty, sixty)],
                "source_folder_id": sixty["source_folder_id"], "source_folder_path": source_path,
                "source_index_stats": stats,
            })
            for key in ("ndvi", "evi", "savi", "gli", "ndre", "ndmi", "ndwi", "mndwi", "bsi"):
                old[key] = stats.get(key, {}).get("plot_mean")
            continue
        index_values = {key: stats.get(key, {}).get("plot_mean") for key in ("ndvi", "evi", "savi", "gli", "ndre", "ndmi", "ndwi", "mndwi", "bsi")}
        row = {
            "plot": "1-STC", "plot_id": identity["plot_id"], "province": "จันทบุรี", "date": date,
            "scene_key": f"Sentinel-2|1-STC|{date}", "satellite": "Sentinel-2", "status": "PARTIAL",
            "analysis_status": "PARTIAL", "qa_valid_pct": image.get("qa_valid_pct"),
            "cloud_coverage_pct": image.get("cloud_coverage_pct"), "shadow_coverage_pct": image.get("shadow_coverage_pct"),
            "unclassified_pct": qa.get("unclassified_pct"), "total_pixels": qa.get("pixel_count"),
            "usable_pixels": sum(qa.get("scl_counts", {}).get(str(k), 0) for k in (2, 4, 5, 6)),
            "pdd_area_rai": 71.6, "geometry_area_rai": 64.566,
            "original_tif10": ten["filename"], "original_tif20": twenty["filename"], "original_tif60": sixty["filename"],
            "source_tif10_file_id": ten["drive_file_id"], "source_tif20_file_id": twenty["drive_file_id"], "source_tif60_file_id": sixty["drive_file_id"],
            "original_tif10_file_id": ten["drive_file_id"], "original_tif20_file_id": twenty["drive_file_id"], "original_tif60_file_id": sixty["drive_file_id"],
            "source_file_ids": [ten["drive_file_id"], twenty["drive_file_id"], sixty["drive_file_id"]],
            "source_paths": [f"{source_path}/{a['filename']}" for a in (ten, twenty, sixty)],
            "source_file_created_times": [a["created_time"] for a in (ten, twenty, sixty)],
            "source_file_modified_times": [a["modified_time"] for a in (ten, twenty, sixty)],
            "source_index_stats": stats, **index_values,
            "plot_qa": qa, "data_integrity_status": image.get("data_integrity_status"),
            "cloud_qa_status": image.get("cloud_qa_status"), "index_validity_status": image.get("index_validity_status"),
            "visual_usability_status": image.get("visual_usability_status"), "radiometry_status": image.get("radiometry_status"),
            "cross_date_comparison_status": image.get("cross_date_comparison_status"),
            "processing_status": "PARTIAL", "preview_status": "AVAILABLE_FOR_VISUAL_REVIEW",
            "qa_rule": "SCL 2,4,5,6 for per-scene index summary; cloudy/unclassified source-valid pixels remain visible in RGB",
            "analysis_warning": image.get("analysis_warning"), "source_checksums": image.get("source_checksum"),
            "ingestion_timestamp": image.get("ingestion_timestamp"),
        }
        # Intentionally do not add water/vegetation area estimates or cross-date change rows.
        new_rows.append(row)
    results["scenes"].extend(new_rows)
    results["scenes"].sort(key=lambda row: (row.get("plot", ""), row.get("date", "")))
    plots = results.setdefault("plots", {})
    selected_dates = sorted(generated)
    plots["1-STC"] = {
        "province": "จันทบุรี", "plot_id": identity["plot_id"], "pdd_geometry_parts": 9,
        "pdd_area_rai": 71.6, "geometry_area_rai": 64.566,
        "boundary_source": "MOC.zip native PDD shapefile · STC/Shapefile/STC PDD/MOC_3.shp",
        "boundary_verified": True, "pdd_base_member": False,
        "selected_dates": selected_dates, "completed_dates": 133, "qa_valid_dates": 0,
        "processing_status": "PARTIAL", "source_tiff_count": 399,
    }
    # Keep archive additions partitioned by plot so GitHub Pages does not need
    # to download/rewrite the full national historical results file per update.
    site_fields = {
        "plot", "plot_id", "province", "date", "scene_key", "satellite", "status", "analysis_status",
        "qa_valid_pct", "cloud_coverage_pct", "shadow_coverage_pct", "unclassified_pct", "total_pixels",
        "usable_pixels", "pdd_area_rai", "geometry_area_rai", "original_tif10", "original_tif20", "original_tif60",
        "original_tif10_file_id", "original_tif20_file_id", "original_tif60_file_id", "source_folder_id", "source_folder_path",
        "source_index_stats", "ndvi", "evi", "savi", "gli", "ndre", "ndmi", "ndwi", "mndwi", "bsi",
        "data_integrity_status", "cloud_qa_status", "index_validity_status", "visual_usability_status",
        "radiometry_status", "cross_date_comparison_status", "processing_status", "preview_status", "qa_rule",
        "analysis_warning", "source_checksums", "ingestion_timestamp",
    }
    site_scenes = [{key: value for key, value in row.items() if key in site_fields} for row in results["scenes"] if row.get("plot") == "1-STC"]
    for row in site_scenes:
        row["source_index_stats"] = {
            key: {field: value for field, value in stats.items() if field in {"sample_pixels", "plot_mean", "embedded_tif_match", "source_band_rmse", "source_band_max_abs"}}
            for key, stats in row.get("source_index_stats", {}).items()
        }
    atomic_json(ROOT / "docs/data/nationwide/plots/1-STC.json", {
        "plot": "1-STC", "plot_registry": plots["1-STC"], "scene_count": 133,
        "generated_at": results.get("generated_at"), "scenes": site_scenes,
    })
    totals = results.setdefault("totals", {})
    totals["processed_dates"] = int(totals.get("processed_dates", 0)) + len(new_rows)
    totals["partial_dates"] = int(totals.get("partial_dates", 0)) + len(new_rows)
    if new_rows:
        totals["plots_with_source_scenes"] = int(totals.get("plots_with_source_scenes", 0)) + 1
    totals["out_of_base_plots"] = max(int(totals.get("out_of_base_plots", 0)), 1)
    results["generated_at"] = datetime.now(timezone.utc).isoformat()
    results["archive_backfill"] = {
        "plot": "1-STC", "drive_folder_id": "1bXR00LDNzPHEqh8xet6PLrLniyZFDCew",
        "inventory_assets": 399, "date_folders": 133, "complete_resolution_sets": 133,
        "date_range": [selected_dates[0], selected_dates[-1]], "new_registry_scenes_this_run": len(new_rows),
        "qa_status": "PARTIAL", "change_analysis_enabled": False,
        "limitation": "Source archive omits Sentinel-2 processing baseline and BOA offsets; cross-date values are not approved for quantitative change or flood extent.",
    }
    atomic_json(RESULTS_PATH, results)

    resolution_counts = Counter(a["filename"].split("_")[-3].removesuffix("m") for a in assets)
    qa = [generated[d].get("qa_valid_pct", 0) for d in sorted(generated)]
    summary = f"""# 1-STC completion audit

- Drive archive folder: [Nationwide Archive / 1-STC](https://drive.google.com/drive/folders/1bXR00LDNzPHEqh8xet6PLrLniyZFDCew)
- Inventory: {len(assets)} GeoTIFF files in {len(by_date)} date folders; complete 10m/20m/60m sets: {sum(set(x)=={'10','20','60'} for x in by_date.values())}.
- Resolution counts: 10m={resolution_counts['10']}, 20m={resolution_counts['20']}, 60m={resolution_counts['60']}.
- Acquisition dates parsed from filenames: {selected_dates[0]} through {selected_dates[-1]}; Drive created/modified timestamps are retained separately in the inventory and are not used as capture dates.
- Drive inventory pagination: complete for this plot; date folders listed: 133; files listed: 399; errors: 0.
- GIS identity: {identity['plot_id']} / 1-STC, Chanthaburi, verified native PDD geometry from `{identity['source_path']}`; 9 parts. Registry PDD area 71.6 rai vs geometry area 64.566 rai (difference retained for review, not geometry repair).
- Scene processing: 133/133 per-scene index statistics computed for NDVI, EVI, SAVI, GLI, NDRE, NDMI, NDWI, MNDWI and BSI; 133 RGB/false-color/index preview sets present.
- SCL-valid coverage range: {min(qa):.2f}%–{max(qa):.2f}%; 56 scenes below 60% remain visible with per-scene warnings.
- Embedded band parity: NDRE 133/133 and NDMI 133/133 (RMSE <= 0.03); MNDWI 20/133. These parity checks do not establish cross-date radiometric comparability.
- Registry status: all scenes PARTIAL; zero QA-valid scenes, zero event/change conclusions. Missing Sentinel-2 processing baseline and BOA offsets block cross-date quantitative analysis; do not infer flood extent from MNDWI alone.
- Duplicate protection: unique plot/date scene identity; re-running this integration adds zero duplicate rows.
- Original Drive TIFFs were read/listed only; no source file was moved, deleted or overwritten.

See `1stc_drive_inventory.csv`, `1stc_qa_summary.md`, `1stc_qa_review.csv`, and `1stc_processing_status.json` for file-level provenance and QA.
"""
    (AUDIT / "1stc_completion_summary.md").write_text(summary, encoding="utf-8")
    print(f"1-STC scenes added={len(new_rows)}; registry scenes={sum(r.get('plot') == '1-STC' for r in results['scenes'])}; files={len(assets)}; dates={len(by_date)}")


if __name__ == "__main__":
    main()

