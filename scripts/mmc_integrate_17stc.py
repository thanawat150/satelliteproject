#!/usr/bin/env python3
"""Process every archived 17-STC Sentinel-2 TIFF into the MMC registry.

Drive TIFFs are read-only inputs. All downloaded originals stay in the local
ignored staging directory; only derived PNG/WebP previews and QA metadata are
written to the repository. Same-date alternate crops are QA-processed and
retained in the audit but never counted as another acquisition date.
"""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import geometry_mask
from rasterio.warp import transform_bounds, transform_geom

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/data/nationwide/audit_20261014"
INVENTORY = AUDIT / "17stc_drive_inventory.json"
MANIFEST_PATH = ROOT / "docs/mangrove-monitoring/imagery_manifest.json"
RESULTS_PATH = ROOT / "docs/data/nationwide/nationwide_results.json"
PARTITION_PATH = ROOT / "docs/data/nationwide/plots/17-STC.json"
BOUNDARIES = ROOT / "docs/data/nationwide/boundaries_pdd_all.geojson"
RAW = ROOT / "tmp_17stc_raw"
OUTPUT = ROOT / "docs/mangrove-monitoring/imagery/17-STC"
PLOT = "17-STC"
SCL_GOOD = (2, 4, 5, 6)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def pct(n: int, d: int):
    return round(100 * n / d, 2) if d else None


def local_file(row: dict) -> Path:
    return RAW / f"{row['drive_file_id']}__{row['filename']}"


def image_bands(ds):
    return [str(x or "").strip().upper() for x in ds.descriptions]


def source_metadata(path: Path, geometry4326: dict, resolution: int) -> dict:
    with rasterio.open(path) as ds:
        if ds.crs is None:
            raise ValueError("TIFF has no CRS")
        geom = transform_geom("EPSG:4326", ds.crs, geometry4326)
        inside = geometry_mask([geom], out_shape=(ds.height, ds.width), transform=ds.transform, invert=True)
        total = int(inside.sum())
        valid_any = np.zeros((ds.height, ds.width), dtype=bool)
        bands = image_bands(ds)
        for i in range(1, ds.count + 1):
            a = ds.read(i, masked=True)
            valid_any |= ~np.ma.getmaskarray(a)
        valid_inside = inside & valid_any
        scl_summary = None
        if "SCL" in bands:
            scl = ds.read(bands.index("SCL") + 1, masked=True).astype(np.float32).filled(np.nan)
            scl_summary = {str(c): int(np.count_nonzero(inside & np.isfinite(scl) & (scl == c))) for c in range(12)}
            scl_summary["cloud_pct"] = pct(sum(scl_summary[str(c)] for c in (8, 9, 10)), total)
            scl_summary["shadow_pct"] = pct(scl_summary["3"], total)
        bounds = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds, densify_pts=21)
        return {
            "crs": ds.crs.to_string(), "width": ds.width, "height": ds.height,
            "transform": list(ds.transform)[:6], "pixel_size": [abs(ds.transform.a), abs(ds.transform.e)],
            "band_count": ds.count, "band_descriptions": list(ds.descriptions), "nodata": ds.nodata,
            "bounds": [[bounds[1], bounds[0]], [bounds[3], bounds[2]]],
            "polygon_pixel_count": total, "valid_plot_pixels": int(valid_inside.sum()),
            "valid_plot_coverage_pct": pct(int(valid_inside.sum()), total), "resolution_m": resolution,
            "scl_distribution_inside_plot": scl_summary,
        }


def gray_layer(array: np.ndarray, valid: np.ndarray) -> Image.Image:
    scaled = np.clip((array.astype(np.float32) / 10000.0 - 0.01) / 0.29, 0, 1)
    with np.errstate(invalid="ignore"):
        level = (255 * np.power(scaled, 0.9)).astype(np.uint8)
    rgba = np.zeros((*array.shape, 4), dtype=np.uint8)
    rgba[..., :3] = level[..., None]
    rgba[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    return Image.fromarray(rgba)


def process_60m(row: dict, date: str, geometry: dict, destination: Path) -> tuple[dict, dict]:
    path = local_file(row)
    meta = source_metadata(path, geometry, 60)
    with rasterio.open(path) as ds:
        labels = image_bands(ds)
        data = {label: ds.read(i, masked=True).astype(np.float32).filled(np.nan)
                for i, label in enumerate(labels, 1)}
        inside = geometry_mask([transform_geom("EPSG:4326", ds.crs, geometry)],
                               out_shape=(ds.height, ds.width), transform=ds.transform, invert=True)
        qa = data.get("QA60")
        qa_valid = inside & np.isfinite(qa) if qa is not None else np.zeros(inside.shape, bool)
        qa_uint = np.where(np.isfinite(qa), np.maximum(qa, 0), 0).astype(np.uint32) if qa is not None else np.zeros(inside.shape, np.uint32)
        opaque, cirrus = (qa_uint & (1 << 10)) != 0, (qa_uint & (1 << 11)) != 0
        band_stats = {}
        for label, arr in data.items():
            valid = inside & np.isfinite(arr)
            vals = arr[valid]
            band_stats[label] = {"valid_plot_pixels": int(valid.sum()), "valid_plot_coverage_pct": pct(int(valid.sum()), int(inside.sum())),
                                 "plot_min": round(float(vals.min()), 3) if vals.size else None,
                                 "plot_mean": round(float(vals.mean()), 3) if vals.size else None,
                                 "plot_max": round(float(vals.max()), 3) if vals.size else None}
        qa_summary = {
            "valid_plot_pixels": int(qa_valid.sum()), "valid_plot_coverage_pct": pct(int(qa_valid.sum()), int(inside.sum())),
            "opaque_cloud_bit10_pct_of_qa_valid": pct(int((qa_valid & opaque).sum()), int(qa_valid.sum())),
            "cirrus_bit11_pct_of_qa_valid": pct(int((qa_valid & cirrus).sum()), int(qa_valid.sum())),
            "caveat": "QA60 flags are descriptive only; the source scene remains in the visual archive.",
        }
        if "B1" not in data or "B9" not in data:
            raise ValueError(f"60m file lacks B1/B9; found {labels}")
        files = {"b1_60m": gray_layer(data["B1"], np.isfinite(data["B1"])),
                 "b9_60m": gray_layer(data["B9"], np.isfinite(data["B9"]))}
        cloud = (opaque | cirrus) & np.isfinite(qa) if qa is not None else np.zeros(inside.shape, bool)
        overlay = np.zeros((*cloud.shape, 4), np.uint8)
        overlay[..., 0:3] = (255, 85, 30)
        overlay[..., 3] = np.where(cloud, 220, 0).astype(np.uint8)
        files["qa60_cloud_60m"] = Image.fromarray(overlay)
        bounds = meta["bounds"]
    destination.mkdir(parents=True, exist_ok=True)
    urls = {}
    for mode, img in files.items():
        img.save(destination / f"{mode}.png", "PNG", optimize=True)
        urls[mode] = f"./imagery/{PLOT}/{date}/{mode}.png"
    meta["sha256"] = sha256(path)
    meta["qa60"] = qa_summary
    meta["band_stats"] = band_stats
    meta["display_bounds"] = bounds
    return meta, urls


def main() -> None:
    inventory = read_json(INVENTORY)
    if inventory.get("plot") != PLOT or inventory.get("total_tiff_files") != 345:
        raise SystemExit("17-STC Drive inventory changed; review before processing")
    registry = read_json(BOUNDARIES)
    features = [f for f in registry["features"] if f.get("properties", {}).get("plot") == PLOT]
    if len(features) != 1 or features[0]["properties"].get("pdd_verified_geometry") is not True:
        raise SystemExit(f"Expected exactly one verified GIS boundary for {PLOT}")
    feature = features[0]
    prop, geometry = feature["properties"], feature["geometry"]
    with (AUDIT.parent / "audit_20261012" / "plot_registry.csv").open(encoding="utf-8-sig", newline="") as f:
        identity = next(r for r in csv.DictReader(f) if r["legacy_plot_code"] == PLOT)
    if identity["plot_id"] != "gis:0124" or identity["pdd_verified_geometry"].lower() != "true":
        raise SystemExit("17-STC identity does not match the source GIS registry")

    grouped: dict[str, dict[int, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for item in inventory["files"]:
        date, resolution = item.get("capture_date"), int(item.get("resolution_m") or 0)
        if not date or resolution not in (10, 20, 60):
            raise SystemExit(f"Unparsed/unsupported source file: {item.get('filename')}")
        grouped[date][resolution].append(item)
    if len(grouped) != 114 or any(any(not versions for versions in grouped[d].values()) or
                                   not {10, 20, 60}.issubset(grouped[d]) for d in grouped):
        raise SystemExit("Expected 114 complete dates (10m/20m/60m) plus alternate date variants")
    # Audit each individual TIFF, including the same-date alternate crops.
    for item in inventory["files"]:
        path = local_file(item)
        expected = int(item.get("size_bytes") or 0)
        if not path.is_file() or (expected and path.stat().st_size != expected):
            raise SystemExit(f"Missing or size-mismatched TIFF in full inventory: {path.name}")
        item["sha256"] = sha256(path)
        item["raster_metadata"] = source_metadata(path, feature["geometry"], int(item["resolution_m"]))
        item["data_integrity_status"] = "PASSED"
        item["polygon_intersection"] = bool(item["raster_metadata"]["polygon_pixel_count"])
    # Monthly archive paths are canonical; YYYY-MM-DD folders are retained as alternate source variants.
    def preferred(items):
        return sorted(items, key=lambda x: (x["source_folder_path"].rstrip("/").endswith("/" + x["capture_date"]),
                                             x["source_folder_path"], x["drive_file_id"]))[0]
    primary = {date: {res: preferred(rows) for res, rows in per_res.items()} for date, per_res in grouped.items()}

    spec = importlib.util.spec_from_file_location("mmc_render_imagery", ROOT / "scripts/mmc_render_imagery.py")
    renderer = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(renderer)

    manifest = read_json(MANIFEST_PATH)
    previous = {r["date"]: r for r in manifest.get("generated_items", []) if r.get("plot") == PLOT}
    old_results = read_json(RESULTS_PATH)
    old_by_date = {r["date"]: r for r in old_results.get("scenes", []) if r.get("plot") == PLOT}
    ingestion_time = datetime.now(timezone.utc).isoformat()
    processed, scenes, status_rows, qa_rows, sixty_rows = {}, [], [], [], []
    alternate_rows = []

    for i, date in enumerate(sorted(primary), 1):
        assets = primary[date]
        paths = {res: local_file(assets[res]) for res in (10, 20, 60)}
        source_meta, checksums = {}, {}
        for res, path in paths.items():
            expected = int(assets[res].get("size_bytes") or 0)
            if not path.is_file() or (expected and path.stat().st_size != expected):
                raise SystemExit(f"Missing or size-mismatched source TIFF: {path.name}")
            source_meta[str(res)] = source_metadata(path, geometry, res)
            checksums[str(res)] = sha256(path)

        try:
            row = renderer.generate(paths[10], paths[20], OUTPUT / date, PLOT, date, geometry)
            visual_only = False
        except ValueError as exc:
            if "No SCL-valid pixels available" not in str(exc):
                raise
            row = renderer.generate_visual_only(paths[10], OUTPUT / date, PLOT, date, geometry, twenty=paths[20])
            row["qa_note"] += "; indices are visual-only because the SCL-valid pixel set is empty"
            visual_only = True

        m60, urls60 = process_60m(assets[60], date, geometry, OUTPUT / date)
        row.setdefault("assets", {}).update(urls60)
        row["modes"] = sorted(set(row.get("modes", [])) | set(urls60))
        row.setdefault("mode_bounds", {}).update({mode: m60["bounds"] for mode in urls60})
        row.setdefault("source_resolution_m", {}).update({"auxiliary": 60})
        row.update({
            "plot_id": identity["plot_id"], "province": prop["province"],
            "source_file_ids": [assets[r]["drive_file_id"] for r in (10, 20, 60)],
            "original_tif10_file_id": assets[10]["drive_file_id"], "original_tif20_file_id": assets[20]["drive_file_id"],
            "original_tif60_file_id": assets[60]["drive_file_id"],
            "original_tif10": assets[10]["filename"], "original_tif20": assets[20]["filename"], "original_tif60": assets[60]["filename"],
            "source_file_names": [assets[r]["filename"] for r in (10, 20, 60)],
            "source_paths": [assets[r]["source_path"] for r in (10, 20, 60)],
            "source_folder_ids": [assets[r].get("source_folder_id") for r in (10, 20, 60)],
            "source_folder_path": assets[10]["source_folder_path"],
            "source_file_created_times": [assets[r].get("created_time") for r in (10, 20, 60)],
            "source_file_modified_times": [assets[r].get("modified_time") for r in (10, 20, 60)],
            "source_checksums_sha256": checksums, "source_tiff_metadata": {**source_meta, "60": m60},
            "source_resolutions_available": [10, 20, 60], "ingestion_timestamp": ingestion_time,
            "source_qa_status": "QA_REVIEWED", "processing_status": "PARTIAL",
            "preview_status": "AVAILABLE_FOR_VISUAL_REVIEW",
            "data_integrity_status": "PASSED", "cloud_qa_status": "SCL_REVIEWED",
            "index_validity_status": "PER_SCENE_VALID_PIXELS_ONLY" if row.get("index_stats") else "VISUAL_ONLY_NO_SCL_VALID_PIXELS",
            "visual_usability_status": "AVAILABLE_FOR_VISUAL_REVIEW",
            "radiometry_status": "PROCESSING_BASELINE_AND_BOA_OFFSETS_UNVERIFIED",
            "cross_date_comparison_status": "NOT_APPROVED_PENDING_RADIOMETRIC_METADATA",
            "qa60_60m": m60["qa60"],
            "auxiliary_60m_visual_note": "B1/B9 and QA60 are separate native 60m review layers; the source file has no RGB triplet.",
            "analysis_warning": "Per-scene indices are retained with cloud QA. Source product processing baseline/BOA offsets are absent; do not infer cross-date change or flood extent from these values.",
            "status": "PARTIAL", "analysis_status": "PARTIAL",
        })
        # If SCL yields no valid sample, publish unfiltered source-raster means with an explicit warning.
        # This gives the user per-scene values without presenting cloud pixels as QA-approved.
        if visual_only:
            row["index_stats"] = unfiltered_index_stats(paths[10], paths[20], geometry)
            row["index_validity_status"] = "UNFILTERED_SOURCE_VALID_PIXELS_PARTIAL"
            row["qa_note"] += "; statistics use all source-valid pixels without SCL filtering"
            scl_counts = source_meta["20"].get("scl_distribution_inside_plot") or {str(k): 0 for k in range(12)}
            polygon_pixels = source_meta["20"].get("polygon_pixel_count") or 0
            qa_pixels = sum(scl_counts.get(str(k), 0) for k in SCL_GOOD)
            cloud_pixels = sum(scl_counts.get(str(k), 0) for k in (8, 9, 10))
            row["qa_valid_pct"] = pct(qa_pixels, polygon_pixels)
            row["cloud_coverage_pct"] = pct(cloud_pixels, polygon_pixels)
            row["shadow_coverage_pct"] = pct(scl_counts.get("3", 0), polygon_pixels)
            row["plot_qa"] = {"pixel_count": polygon_pixels, "qa_valid_pct": row["qa_valid_pct"],
                               "source_data_valid_pct": source_meta["20"]["valid_plot_coverage_pct"],
                               "cloud_pct": row["cloud_coverage_pct"], "shadow_pct": row["shadow_coverage_pct"],
                               "unclassified_pct": pct(scl_counts.get("7", 0), polygon_pixels),
                               "scl_counts": {str(k): scl_counts.get(str(k), 0) for k in range(12)},
                               "note": "No SCL classes 2/4/5/6 available in polygon; unfiltered scene indices shown as PARTIAL."}

        row["alternate_source_variants"] = []
        alt_groups: dict[str, dict[int, dict]] = defaultdict(dict)
        for res in (10, 20, 60):
            variants = [x for x in grouped[date][res] if x["drive_file_id"] != assets[res]["drive_file_id"]]
            for v in variants:
                p = local_file(v)
                alt_meta = source_metadata(p, geometry, res)
                alt_hash = sha256(p)
                folder = v["source_folder_path"]
                alt_groups[folder][res] = v
                alt_item = {"drive_file_id": v["drive_file_id"], "filename": v["filename"], "source_path": v["source_path"],
                            "resolution_m": res, "size_bytes": p.stat().st_size, "sha256": alt_hash,
                            "metadata": alt_meta, "same_date_variant": True, "exact_checksum_duplicate": alt_hash == checksums[str(res)]}
                row["alternate_source_variants"].append(alt_item)
                alternate_rows.append({"plot": PLOT, "date": date, **{k: alt_item[k] for k in ("drive_file_id", "filename", "source_path", "resolution_m", "size_bytes", "sha256")},
                                       "canonical_file_id": assets[res]["drive_file_id"], "exact_checksum_duplicate": alt_hash == checksums[str(res)],
                                       "scl_distribution_inside_plot": alt_meta.get("scl_distribution_inside_plot"),
                                       "grid_alignment": "same CRS; compare transform/extent before mosaicking", "disposition": "retained_and_qa_reviewed; not counted as another acquisition date"})
        for folder, variant in alt_groups.items():
            if {10, 20, 60}.issubset(variant):
                raw_stats = unfiltered_index_stats(local_file(variant[10]), local_file(variant[20]), geometry)
                alt60, _ = process_60m(variant[60], date + "-alternate", geometry,
                                       RAW / "derived_alternate" / date / variant[60]["drive_file_id"])
                for item in alternate_rows:
                    if item["date"] == date and item["source_path"].startswith(folder + "/"):
                        item["alternate_index_stats_unfiltered"] = raw_stats if item["resolution_m"] in (10, 20) else None
                        item["alternate_qa60"] = alt60["qa60"] if item["resolution_m"] == 60 else None
                        item["alternate_processing"] = "TIFF metadata + checksum + SCL/QA60 + unfiltered scene indices"
                row["alternate_source_variants"].append({"source_folder_path": folder,
                    "unfiltered_index_stats": raw_stats, "qa60": alt60["qa60"],
                    "processing_status": "PARTIAL", "disposition": "same-date grid variant; kept out of default timeline"})

        # Populate cloud QA for every scene, not only the visual-only fallback.
        # Otherwise valid SCL summaries were omitted from the audit tables and
        # appeared as zero coverage even when classes 2/4/5/6 covered the plot.
        scl_counts = source_meta["20"].get("scl_distribution_inside_plot") or {str(k): 0 for k in range(12)}
        polygon_pixels = source_meta["20"].get("polygon_pixel_count") or 0
        qa_pixels = sum(scl_counts.get(str(k), 0) for k in SCL_GOOD)
        cloud_pixels = sum(scl_counts.get(str(k), 0) for k in (8, 9, 10))
        shadow_pixels = scl_counts.get("3", 0)
        row["qa_valid_pct"] = pct(qa_pixels, polygon_pixels)
        row["cloud_coverage_pct"] = pct(cloud_pixels, polygon_pixels)
        row["shadow_coverage_pct"] = pct(shadow_pixels, polygon_pixels)
        row["plot_qa"] = {**(row.get("plot_qa") or {}), "pixel_count": polygon_pixels,
                           "qa_valid_pct": row["qa_valid_pct"], "cloud_pct": row["cloud_coverage_pct"],
                           "shadow_pct": row["shadow_coverage_pct"],
                           "unclassified_pct": pct(scl_counts.get("7", 0), polygon_pixels),
                           "scl_counts": {str(k): scl_counts.get(str(k), 0) for k in range(12)}}
        processed[date] = row
        qa = row.get("plot_qa", {})
        cloud, shadow = qa.get("cloud_pct"), qa.get("shadow_pct")
        scene = {
            "plot": PLOT, "plot_id": identity["plot_id"], "province": prop["province"], "date": date,
            "scene_key": f"Sentinel-2|{identity['plot_id']}|{date}", "satellite": "Sentinel-2",
            "status": "PARTIAL", "analysis_status": "PARTIAL", "processing_status": "PARTIAL",
            "preview_status": "AVAILABLE_FOR_VISUAL_REVIEW", "qa_valid_pct": row.get("qa_valid_pct"),
            "cloud_coverage_pct": cloud, "shadow_coverage_pct": shadow,
            "unclassified_pct": qa.get("unclassified_pct"), "total_pixels": qa.get("pixel_count"),
            "usable_pixels": sum(qa.get("scl_counts", {}).get(str(k), 0) for k in SCL_GOOD),
            "source_index_stats": row.get("index_stats", {}),
            "original_tif10": row["original_tif10"], "original_tif20": row["original_tif20"], "original_tif60": row["original_tif60"],
            "original_tif10_file_id": row["original_tif10_file_id"], "original_tif20_file_id": row["original_tif20_file_id"],
            "original_tif60_file_id": row["original_tif60_file_id"], "source_file_ids": row["source_file_ids"],
            "source_paths": row["source_paths"], "source_checksums": checksums, "source_tiff_metadata": row["source_tiff_metadata"],
            "source_resolutions_available": [10, 20, 60], "data_integrity_status": "PASSED",
            "cloud_qa_status": "REVIEW_ONLY", "index_validity_status": row["index_validity_status"],
            "visual_usability_status": "AVAILABLE_FOR_VISUAL_REVIEW", "radiometry_status": "BASELINE_UNVERIFIED",
            "cross_date_comparison_status": "NOT_APPROVED", "qa60_60m": m60["qa60"],
            "analysis_warning": row["analysis_warning"], "ingestion_timestamp": ingestion_time,
        }
        for key, stat in row.get("index_stats", {}).items():
            scene[key] = stat.get("plot_mean")
        old = old_by_date.get(date)
        if old:
            old.update(scene)
            scene = old
        scenes.append(scene)
        status_rows.append({"plot": PLOT, "plot_id": identity["plot_id"], "date": date, "scene_key": scene["scene_key"],
                            "source_file_ids": ";".join(row["source_file_ids"]), "source_tiff_count": 3,
                            "source_integrity": "PASSED", "indices_computed": bool(row.get("index_stats")),
                            "preview_asset_count": len(row.get("modes", [])), "processing_status": "PARTIAL",
                            "qa_valid_pct": row.get("qa_valid_pct"), "cloud_pct": cloud, "shadow_pct": shadow,
                            "reason": row["analysis_warning"]})
        qa_rows.append({"plot": PLOT, "date": date, "plot_id": identity["plot_id"], "data_integrity": "PASSED",
                        "source_valid_10m_pct": source_meta["10"]["valid_plot_coverage_pct"],
                        "source_valid_20m_pct": source_meta["20"]["valid_plot_coverage_pct"],
                        "scl_valid_pct": row.get("qa_valid_pct"), "cloud_pct": cloud, "shadow_pct": shadow,
                        "unclassified_pct": qa.get("unclassified_pct"), "polygon_pixels": qa.get("pixel_count"),
                        "index_validity": row["index_validity_status"], "visual_review": "AVAILABLE",
                        "processing_status": "PARTIAL", "source_resolutions": "10;20;60", "missing_60m": False})
        sixty_rows.append({"plot": PLOT, "date": date, "drive_file_id": assets[60]["drive_file_id"], "filename": assets[60]["filename"],
                           "byte_size": source_meta["60"]["width"] and paths[60].stat().st_size, "sha256": checksums["60"],
                           "crs": source_meta["60"]["crs"], "width": source_meta["60"]["width"], "height": source_meta["60"]["height"],
                           "pixel_size_x": source_meta["60"]["pixel_size"][0], "pixel_size_y": source_meta["60"]["pixel_size"][1],
                           "band_count": source_meta["60"]["band_count"], "bands": ";".join(str(x or "") for x in source_meta["60"]["band_descriptions"]),
                           "valid_plot_pixels": m60["qa60"]["valid_plot_pixels"], "qa60_valid_plot_pct": m60["qa60"]["valid_plot_coverage_pct"],
                           "opaque_cloud_bit10_pct": m60["qa60"]["opaque_cloud_bit10_pct_of_qa_valid"],
                           "cirrus_bit11_pct": m60["qa60"]["cirrus_bit11_pct_of_qa_valid"], "data_integrity": "PASSED",
                           "visual_layers": ";".join(urls60)})
        if i % 20 == 0 or i == len(primary):
            print(f"processed 10m/20m/60m {i}/{len(primary)} dates", flush=True)

    old_manifest = {(r.get("plot"), r.get("date")): r for r in manifest.get("generated_items", [])}
    for date, row in processed.items():
        old_manifest[(PLOT, date)] = row
    manifest["generated_items"] = list(old_manifest.values())
    manifest["version"] = "2026-10-14-17stc-all-scenes-v1"
    manifest["source"] = "Original Google Drive Sentinel-2 GeoTIFF archive; per-plot incremental processing"
    manifest["plot_count"] = len({r.get("plot") for r in manifest["generated_items"]})
    manifest["image_dates"] = len({(r.get("plot"), r.get("date")) for r in manifest["generated_items"]})
    atomic_json(MANIFEST_PATH, manifest)

    plot_meta = {"province": prop["province"], "plot_id": identity["plot_id"],
                 "pdd_geometry_parts": prop.get("geometry_parts"), "pdd_area_rai": prop.get("pdd_area_rai"),
                 "geometry_area_rai": prop.get("geometry_area_rai"), "boundary_source": prop.get("boundary_source"),
                 "boundary_verified": True, "selected_dates": sorted(primary), "completed_dates": len(primary),
                 "qa_valid_dates": sum((x.get("qa_valid_pct") or 0) >= 60 for x in processed.values()),
                 "processing_status": "PARTIAL", "source_tiff_count": len(inventory["files"]),
                 "unique_scene_count": len(primary), "source_variant_count": sum(len(v) for x in grouped.values() for v in x.values()) - len(primary) * 3,
                 "radiometry_status": "PROCESSING_BASELINE_AND_BOA_OFFSETS_UNVERIFIED"}
    partition_rows = []
    for row in scenes:
        partition_rows.append(row)
    atomic_json(PARTITION_PATH, {"plot": PLOT, "plot_registry": plot_meta, "scene_count": len(scenes),
                                 "generated_at": ingestion_time, "scenes": partition_rows})

    with (AUDIT / "17stc_drive_inventory.csv").open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["drive_file_id", "filename", "capture_date", "resolution_m", "mime_type", "size_bytes", "created_time", "modified_time", "source_folder_id", "source_folder_path", "source_path", "source_url", "crs", "width", "height", "pixel_size", "band_count", "band_descriptions", "nodata", "valid_plot_coverage_pct", "polygon_intersection", "local_sha256"]
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for item in inventory["files"]:
            path = local_file(item)
            meta = item.get("raster_metadata", {})
            row = {**item, **{k: meta.get(k) for k in ("crs", "width", "height", "pixel_size", "band_count", "band_descriptions", "nodata", "valid_plot_coverage_pct")},
                   "local_sha256": item.get("sha256", "MISSING")}
            writer.writerow({k: row.get(k) for k in fields})
    for filename, rows in (("17stc_processing_status.csv", status_rows), ("17stc_qa_review.csv", qa_rows), ("17stc_60m_qa.csv", sixty_rows)):
        with (AUDIT / filename).open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    with (AUDIT / "17stc_duplicate_files.csv").open("w", encoding="utf-8-sig", newline="") as f:
        fields = list(alternate_rows[0]) if alternate_rows else ["plot", "date", "drive_file_id", "filename", "disposition"]
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader(); writer.writerows(alternate_rows)
    with (AUDIT / "17stc_qa_failures.csv").open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["plot", "date", "qa_valid_pct", "cloud_pct", "shadow_pct", "unclassified_pct", "reason", "review_note"]
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for row in qa_rows:
            if not row["scl_valid_pct"] or row["scl_valid_pct"] < 60:
                writer.writerow({"plot": PLOT, "date": row["date"], "qa_valid_pct": row["scl_valid_pct"],
                                 "cloud_pct": row["cloud_pct"], "shadow_pct": row["shadow_pct"],
                                 "unclassified_pct": row["unclassified_pct"], "reason": "SCL 2/4/5/6 valid coverage is below 60%",
                                 "review_note": "Scene retained; source-valid unfiltered per-scene indices are PARTIAL and available for visual review."})
    with (AUDIT / "17stc_plot_registry.csv").open("w", encoding="utf-8-sig", newline="") as out:
        with (AUDIT.parent / "audit_20261012" / "plot_registry.csv").open(encoding="utf-8-sig", newline="") as source:
            match = [row for row in csv.DictReader(source) if row.get("legacy_plot_code") == PLOT]
        writer = csv.DictWriter(out, fieldnames=list(match[0])); writer.writeheader(); writer.writerows(match)

    checksum_groups: dict[str, list[dict]] = defaultdict(list)
    for item in inventory["files"]:
        checksum_groups[item["sha256"]].append(item)
    inventory["exact_checksum_duplicate_groups"] = [
        {"sha256": digest, "file_ids": [x["drive_file_id"] for x in members], "filenames": [x["filename"] for x in members]}
        for digest, members in checksum_groups.items() if len(members) > 1
    ]
    inventory["source_file_count_verified"] = len(inventory["files"])
    inventory["failed_source_files"] = 0
    inventory["inventory_complete"] = True
    atomic_json(INVENTORY, inventory)
    atomic_json(AUDIT / "satellite_scene_registry_17stc.json", {
        "schema_version": "1.0", "plot": PLOT, "plot_id": identity["plot_id"], "province": prop["province"],
        "generated_at": ingestion_time, "source_file_count": len(inventory["files"]), "unique_scene_count": len(scenes),
        "scenes": scenes, "files": inventory["files"], "exact_checksum_duplicate_groups": inventory["exact_checksum_duplicate_groups"]
    })

    qa_failures = [r for r in qa_rows if not r["scl_valid_pct"] or r["scl_valid_pct"] < 60]
    summary = f"""# 17-STC complete archive processing audit

- GIS identity: `{identity['plot_id']}` / `{PLOT}`, source-verified PDD boundary in {prop['province']} (`{prop['source_path']}`).
- Drive inventory: {len(inventory['files'])} original TIFF files from {len(grouped)} unique acquisition dates; 10m/20m/60m present for every date; {len(alternate_rows)} same-date alternate source files were processed and retained separately.
- Full source QA: {len(inventory['files'])}/{len(inventory['files'])} TIFFs opened and checked for CRS, transform, pixel size, dimensions, bands, NoData, polygon coverage, and SHA-256. Exact checksum duplicate groups: {len(inventory['exact_checksum_duplicate_groups'])}; same-date alternate crops: {len(alternate_rows)}.
- Acquisition dates: {min(primary)} through {max(primary)} (parsed from filenames; upload/modified times remain separate inventory fields).
- Processing: {len(processed)}/{len(primary)} dates received 10m RGB, 20m spectral index, and 60m B1/B9/QA60 processing. Source byte-size checks, TIFF open, CRS, transforms, pixel sizes, band metadata, polygon coverage, SHA-256, SCL and QA60 statistics are recorded.
- Preview layers: {sum(len(r.get('modes', [])) for r in processed.values())} scene/mode entries across 8 spectral/RGB modes and 3 60m review modes per date. All scenes remain visible for visual review regardless of SCL result.
- SCL review flags: {len(qa_failures)} date(s) have no SCL-valid pixels or less than 60% valid coverage within the plot; they remain in the catalog and are not presented as QA-approved.
- Processing and cross-date comparison remain `PARTIAL`: archive TIFFs do not establish Sentinel-2 processing baseline / BOA offsets. Do not infer cross-date change, flood extent, or recovery solely from these numeric values.
- Original TIFFs were downloaded to local staging for read-only processing. No original Drive file was moved, deleted, or overwritten.
- Idempotent scene key: `Sentinel-2|{identity['plot_id']}|<acquisition date>`.

Detailed files: `17stc_drive_inventory.csv`, `17stc_duplicate_files.csv`, `17stc_processing_status.csv`, `17stc_qa_review.csv`, `17stc_qa_failures.csv`, `17stc_60m_qa.csv`, `17stc_plot_registry.csv`, and `../plots/17-STC.json`.
"""
    (AUDIT / "17stc_processing_summary.md").write_text(summary, encoding="utf-8")
    print(f"complete: {len(processed)} dates, {len(inventory['files'])} TIFFs, {len(alternate_rows)} alternate files")


def unfiltered_index_stats(ten: Path, twenty: Path, geometry4326: dict) -> dict:
    """Compute descriptive per-scene values when SCL has no usable pixels.

    This fallback uses source-valid reflectance pixels without cloud masking;
    callers must keep the scene PARTIAL and label the output accordingly.
    """
    from rasterio.enums import Resampling
    from rasterio.vrt import WarpedVRT
    with rasterio.open(ten) as d10, rasterio.open(twenty) as d20:
        w, h = d20.width, d20.height
        def read(ds, name, index_no, warp=False):
            labels = image_bands(ds)
            idx = labels.index(name) + 1 if name in labels else index_no
            if warp:
                with WarpedVRT(d10, crs=d20.crs, transform=d20.transform, width=w, height=h,
                               resampling=Resampling.bilinear) as vrt:
                    return vrt.read(idx, masked=True).astype(np.float32).filled(np.nan)
            return ds.read(idx, masked=True).astype(np.float32).filled(np.nan)
        b2, b3, b4, b8 = (read(d10, n, i, True) for n, i in (("B2",1),("B3",2),("B4",3),("B8",4)))
        b5, b8a, b11 = (read(d20, n, i) for n, i in (("B5",1),("B8A",4),("B11",5)))
        geom = transform_geom("EPSG:4326", d20.crs, geometry4326)
        inside = geometry_mask([geom], out_shape=(h,w), transform=d20.transform, invert=True)
        valid = inside & np.isfinite(b2)&np.isfinite(b3)&np.isfinite(b4)&np.isfinite(b8)&np.isfinite(b5)&np.isfinite(b8a)&np.isfinite(b11)&(b2>0)&(b3>0)&(b4>0)&(b8>0)&(b5>0)&(b8a>0)&(b11>0)
        def ratio(a,b):
            den=a+b
            return np.divide(a-b,den,out=np.full_like(a,np.nan,dtype=np.float32),where=np.isfinite(den)&(np.abs(den)>1e-8))
        values={"ndvi":ratio(b8,b4),"ndre":ratio(b8a,b5),"ndmi":ratio(b8a,b11),
                "ndwi":ratio(b3,b8),"mndwi":ratio(b3,b11),"bsi":ratio(b11+b4,b8+b2)}
        out={}
        for name, arr in values.items():
            sample=arr[valid&np.isfinite(arr)&(arr>=-1.001)&(arr<=1.001)]
            out[name]={"formula":"source-band ratio; SCL NOT applied", "sample_pixels":int(sample.size),
                       "plot_mean":round(float(sample.mean()),5) if sample.size else None,
                       "plot_median":round(float(np.median(sample)),5) if sample.size else None,
                       "plot_min":round(float(sample.min()),5) if sample.size else None,
                       "plot_max":round(float(sample.max()),5) if sample.size else None,
                       "cloud_filter_applied":False, "use_limit":"PARTIAL visual review only"}
        return out


if __name__ == "__main__":
    main()
