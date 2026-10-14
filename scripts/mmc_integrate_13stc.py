#!/usr/bin/env python3
"""Process the audited 13-STC Drive archive and add it idempotently to MMC.

Original Drive TIFFs are read-only inputs. Derived previews and registry rows
are rebuilt from filename acquisition dates and the verified PDD boundary.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/data/nationwide/audit_20261012"
INVENTORY = AUDIT / "13stc_drive_inventory.json"
MANIFEST_PATH = ROOT / "docs/mangrove-monitoring/imagery_manifest.json"
RESULTS_PATH = ROOT / "docs/data/nationwide/nationwide_results.json"
BOUNDARIES = ROOT / "docs/data/nationwide/boundaries_pdd_all.geojson"
RAW = ROOT / "tmp_13stc_raw"
OUTPUT = ROOT / "docs/mangrove-monitoring/imagery/13-STC"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    import rasterio

    inventory = read_json(INVENTORY)
    assert inventory["plot"] == "13-STC" and inventory["total_tiff_files"] == 316
    grouped: dict[str, dict[int, dict]] = defaultdict(dict)
    for item in inventory["files"]:
        date, resolution = item.get("capture_date"), int(item.get("resolution_m") or 0)
        if not date or resolution not in (10, 20, 60):
            raise SystemExit(f"Unparsed/unsupported source record: {item['filename']}")
        if resolution in grouped[date]:
            raise SystemExit(f"Duplicate resolution {resolution}m for {date}")
        grouped[date][resolution] = item
    if len(grouped) != 106 or any(not {10, 20}.issubset(v) for v in grouped.values()):
        raise SystemExit("Expected 106 scenes with complete 10m and 20m sources")

    with (AUDIT / "plot_registry.csv").open(encoding="utf-8-sig", newline="") as stream:
        identity = next(row for row in csv.DictReader(stream) if row["legacy_plot_code"] == "13-STC")
    if identity["plot_id"] != "gis:0116" or identity["pdd_verified_geometry"].lower() != "true":
        raise SystemExit("13-STC does not have a verified GIS identity")
    geo = read_json(BOUNDARIES)
    features = [f for f in geo["features"] if f.get("properties", {}).get("plot") == "13-STC"]
    if len(features) != 1 or features[0]["properties"].get("pdd_verified_geometry") is not True:
        raise SystemExit("Expected exactly one verified 13-STC PDD boundary")
    province = features[0]["properties"]["province"]
    geometry = features[0]["geometry"]

    spec = importlib.util.spec_from_file_location("mmc_render_imagery", ROOT / "scripts/mmc_render_imagery.py")
    renderer = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(renderer)

    manifest = read_json(MANIFEST_PATH)
    prior = {row["date"]: row for row in manifest.get("generated_items", []) if row.get("plot") == "13-STC"}
    # Keep the two previously processed original-TIFF products intact.
    keep = {date for date, row in prior.items() if date in grouped and row.get("index_stats") and all(
        row["index_stats"].get(key, {}).get("sample_pixels", 0) > 0 for key in ("ndvi", "ndre", "ndmi", "mndwi", "bsi")
    )}
    processed: dict[str, dict] = {d: prior[d] for d in keep}
    status_rows, qa_rows, scene_rows = [], [], []
    ingestion_time = datetime.now(timezone.utc).isoformat()
    existing_results = read_json(RESULTS_PATH)
    old_by_date = {r["date"]: r for r in existing_results.get("scenes", []) if r.get("plot") == "13-STC"}

    for i, date in enumerate(sorted(grouped), 1):
        assets = grouped[date]
        local = {res: RAW / f"tmp_13stc_{date}_{res}m.tif" for res in (10, 20)}
        if any(not p.is_file() for p in local.values()):
            raise SystemExit(f"Missing staged TIFF pair for {date}")
        source_meta, checksums = {}, {}
        for res, path in local.items():
            expected_size = int(assets[res].get("size_bytes") or 0)
            if expected_size and path.stat().st_size != expected_size:
                raise SystemExit(f"Downloaded byte size does not match Drive inventory: {path.name}")
            with rasterio.open(path) as ds:
                if ds.crs is None or ds.count < (4 if res == 10 else 7):
                    raise SystemExit(f"TIFF integrity/band check failed: {path.name}")
                source_meta[str(res)] = {
                    "crs": ds.crs.to_string(), "width": ds.width, "height": ds.height,
                    "transform": list(ds.transform)[:6], "pixel_size": [abs(ds.transform.a), abs(ds.transform.e)],
                    "band_count": ds.count, "band_descriptions": list(ds.descriptions), "nodata": ds.nodata,
                }
            checksums[str(res)] = sha256(path)
        if date not in keep:
            try:
                rendered = renderer.generate(local[10], local[20], OUTPUT / date, "13-STC", date, geometry)
            except ValueError as exc:
                if "No SCL-valid pixels available" not in str(exc):
                    raise
                rendered = renderer.generate_visual_only(local[10], OUTPUT / date, "13-STC", date,
                                                         geometry, twenty=local[20])
                rendered["qa_note"] = "No SCL-valid pixels inside the plot; available RGB/index layers are unmasked visual review only. No per-scene index summary or quantitative analysis is approved."
            processed[date] = rendered
        row = processed[date]
        row.update({
            "plot_id": identity["plot_id"], "province": province,
            "source_file_ids": [assets[r]["drive_file_id"] for r in sorted(assets)],
            "original_tif10_file_id": assets[10]["drive_file_id"],
            "original_tif20_file_id": assets[20]["drive_file_id"],
            "original_tif60_file_id": assets.get(60, {}).get("drive_file_id"),
            "source_file_names": [assets[r]["filename"] for r in sorted(assets)],
            "source_paths": [assets[r]["source_folder_path"] + "/" + assets[r]["filename"] for r in sorted(assets)],
            "source_folder_id": assets[10].get("source_folder_id"),
            "source_folder_path": assets[10]["source_folder_path"],
            "source_file_created_times": [assets[r]["created_time"] for r in sorted(assets)],
            "source_file_modified_times": [assets[r]["modified_time"] for r in sorted(assets)],
            "source_checksums_sha256": checksums,
            "source_tiff_metadata": source_meta,
            "source_resolutions_available": sorted(assets),
            "ingestion_timestamp": ingestion_time,
            "status": "PARTIAL", "processing_status": "PARTIAL",
            "preview_status": "AVAILABLE_FOR_VISUAL_REVIEW",
            "analysis_warning": "Archive TIFF radiometric processing baseline/BOA offsets are not established; per-scene index values are for review and are not approved for cross-date change or flood extent.",
        })
        # Preserve independently processed 60m auxiliary QA layers and
        # metadata when the 10m/20m scene integration is rerun.
        old_aux = prior.get(date, {})
        for mode in ("b1_60m", "b9_60m", "qa60_cloud_60m"):
            if mode in old_aux.get("assets", {}):
                row.setdefault("assets", {})[mode] = old_aux["assets"][mode]
                row["modes"] = sorted(set(row.get("modes", [])) | {mode})
                if mode in old_aux.get("mode_bounds", {}):
                    row.setdefault("mode_bounds", {})[mode] = old_aux["mode_bounds"][mode]
        row["source_checksums_sha256"] = {**old_aux.get("source_checksums_sha256", {}), **checksums}
        row["source_tiff_metadata"] = {**old_aux.get("source_tiff_metadata", {}), **source_meta}
        for field in ("qa60_60m", "auxiliary_60m_visual_note", "source_resolution_m", "mode_dimensions"):
            if field in old_aux:
                if field in ("source_resolution_m", "mode_dimensions"):
                    row[field] = {**old_aux[field], **row.get(field, {})}
                else:
                    row[field] = old_aux[field]
        qa = row.get("plot_qa", {})
        cloud = qa.get("cloud_pct")
        shadow = qa.get("shadow_pct")
        scene = {
            "plot": "13-STC", "plot_id": identity["plot_id"], "province": province,
            "date": date, "scene_key": f"Sentinel-2|{identity['plot_id']}|{date}",
            "satellite": "Sentinel-2", "status": "PARTIAL", "analysis_status": "PARTIAL",
            "processing_status": "PARTIAL", "preview_status": "AVAILABLE_FOR_VISUAL_REVIEW",
            "qa_valid_pct": row.get("qa_valid_pct"), "cloud_coverage_pct": cloud, "shadow_coverage_pct": shadow,
            "unclassified_pct": qa.get("unclassified_pct"), "total_pixels": qa.get("pixel_count"),
            "usable_pixels": sum(qa.get("scl_counts", {}).get(str(k), 0) for k in (2, 4, 5, 6)),
            "pdd_area_rai": features[0]["properties"].get("pdd_area_rai"),
            "geometry_area_rai": features[0]["properties"].get("geometry_area_rai"),
            "source_index_stats": row.get("index_stats", {}),
            "original_tif10": assets[10]["filename"], "original_tif20": assets[20]["filename"],
            "original_tif60": assets.get(60, {}).get("filename"),
            "original_tif10_file_id": assets[10]["drive_file_id"],
            "original_tif20_file_id": assets[20]["drive_file_id"],
            "original_tif60_file_id": assets.get(60, {}).get("drive_file_id"),
            "source_file_ids": row["source_file_ids"], "source_paths": row["source_paths"],
            "source_file_created_times": row["source_file_created_times"],
            "source_file_modified_times": row["source_file_modified_times"],
            "source_checksums": checksums,
            "data_integrity_status": "PASSED", "cloud_qa_status": "REVIEW_ONLY",
            "index_validity_status": "PER_SCENE_VALID_PIXELS_ONLY",
            "visual_usability_status": "AVAILABLE_FOR_VISUAL_REVIEW",
            "radiometry_status": "BASELINE_UNVERIFIED",
            "cross_date_comparison_status": "NOT_APPROVED",
            "qa_rule": "SCL 2,4,5,6 used for per-scene index summaries; cloudy pixels remain available in visual layers",
            "analysis_warning": row["analysis_warning"], "ingestion_timestamp": ingestion_time,
        }
        for key, stat in row.get("index_stats", {}).items():
            scene[key] = stat.get("plot_mean")
        old = old_by_date.get(date)
        if old:
            old.update(scene)
            scene = old
        scene_rows.append(scene)
        files_ok = all(Path(row["assets"][mode].replace("./", "docs/mangrove-monitoring/")).is_file()
                       for mode in row.get("modes", []) if mode in row.get("assets", {}))
        status_rows.append({"plot": "13-STC", "plot_id": identity["plot_id"], "date": date,
                            "file_ids": ";".join(row["source_file_ids"]), "source_tiff_count": len(assets),
                            "source_integrity": "PASSED", "indices_computed": bool(row.get("index_stats")),
                            "preview_assets_present": files_ok, "processing_status": "PARTIAL",
                            "qa_valid_pct": row.get("qa_valid_pct"), "cloud_pct": cloud,
                            "reason": row["analysis_warning"]})
        qa_rows.append({"plot": "13-STC", "date": date, "plot_id": identity["plot_id"],
                        "data_integrity": "PASSED", "source_valid_pct": qa.get("source_data_valid_pct"),
                        "scl_valid_pct": qa.get("qa_valid_pct"), "cloud_pct": cloud,
                        "shadow_pct": shadow, "unclassified_pct": qa.get("unclassified_pct"),
                        "polygon_pixels": qa.get("pixel_count"), "index_validity": "PER_SCENE_ONLY",
                        "visual_review": "AVAILABLE", "processing_status": "PARTIAL",
                        "source_resolutions": ";".join(map(str, sorted(assets))),
                        "missing_60m": 60 not in assets})
        if i % 10 == 0 or i == len(grouped):
            print(f"processed {i}/{len(grouped)} scenes", flush=True)

    # Keep all prior non-13-STC items and replace this plot's date-keyed entries.
    old_generated = {(r.get("plot"), r.get("date")): r for r in manifest.get("generated_items", [])}
    for date, row in processed.items():
        old_generated[("13-STC", date)] = row
    manifest["generated_items"] = list(old_generated.values())
    manifest["version"] = "2026-10-14-13stc-full-archive-v1"
    manifest["source"] = "Original Google Drive Sentinel-2 GeoTIFF archive; incremental per-plot processing"
    manifest["plot_count"] = len({r.get("plot") for r in manifest["generated_items"]})
    manifest["image_dates"] = len({(r.get("plot"), r.get("date")) for r in manifest["generated_items"]})
    atomic_json(MANIFEST_PATH, manifest)

    # Partition keeps large national result payloads out of the 13-STC page load.
    plot_meta = {"province": province, "plot_id": identity["plot_id"], "pdd_geometry_parts": features[0]["properties"].get("geometry_parts"),
                 "pdd_area_rai": features[0]["properties"].get("pdd_area_rai"),
                 "geometry_area_rai": features[0]["properties"].get("geometry_area_rai"),
                 "boundary_source": features[0]["properties"].get("boundary_source"), "boundary_verified": True,
                 "selected_dates": sorted(grouped), "completed_dates": len(grouped), "qa_valid_dates": 0,
                 "processing_status": "PARTIAL", "source_tiff_count": len(inventory["files"]),
                 "unique_scene_count": len(grouped)}
    partition_rows = []
    fields = set(scene_rows[0]) if scene_rows else set()
    for row in scene_rows:
        partition_rows.append({k: v for k, v in row.items() if k in fields})
    atomic_json(ROOT / "docs/data/nationwide/plots/13-STC.json", {
        "plot": "13-STC", "plot_registry": plot_meta, "scene_count": len(scene_rows),
        "generated_at": ingestion_time, "scenes": partition_rows,
    })

    for name, rows in (("13stc_processing_status.csv", status_rows), ("13stc_qa_review.csv", qa_rows)):
        with (AUDIT / name).open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
            writer.writeheader(); writer.writerows(rows)
    summary = f"""# 13-STC Processing Audit

- Plot identity: `{identity['plot_id']}` / `13-STC`, verified PDD geometry; source `{identity['source_path']}`.
- Drive inventory: {len(inventory['files'])} GeoTIFFs, {len(grouped)} unique acquisition dates, {sum(10 in x for x in grouped.values())} 10m, {sum(20 in x for x in grouped.values())} 20m, {sum(60 in x for x in grouped.values())} 60m.
- Date range: {min(grouped)} through {max(grouped)} (parsed from image filenames; upload times retained separately).
- Scene processing: {len(scene_rows)}/{len(grouped)} dates in the per-plot registry; {sum(bool(r.get('index_stats')) for r in processed.values())} dates have per-scene SCL-filtered index statistics and {sum(r.get('preview_kind') == 'VISUAL_ONLY_NON_QA' for r in processed.values())} date(s) are visual-only because no SCL-valid pixels were available.
- Status: all {len(scene_rows)} dates remain `PARTIAL` for cross-date interpretation because archive radiometric baseline / BOA offsets are not established. Flood extent and area-change values were not inferred.
- Source files: read-only; SHA-256 checksums, Drive IDs, source paths and Drive timestamps are retained. No TIFF was moved, deleted or rewritten.
- Missing 60m: {sum(60 not in x for x in grouped.values())} dates; 10m/20m pair is present for all dates.
- Duplicate-safe key: `Sentinel-2|{identity['plot_id']}|<acquisition date>`; registry partition contains one row per date.

Detailed outputs: `13stc_drive_inventory.json`, `13stc_processing_status.csv`, `13stc_qa_review.csv`, and `13stc_60m_qa.csv`.
"""
    (AUDIT / "13stc_processing_summary.md").write_text(summary, encoding="utf-8")
    print(f"complete: {len(scene_rows)} scenes, {sum(len(r.get('modes', [])) for r in processed.values())} preview layers; manifest updated")


if __name__ == "__main__":
    main()
