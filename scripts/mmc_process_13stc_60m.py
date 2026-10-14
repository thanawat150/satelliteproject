#!/usr/bin/env python3
"""Process the 60 m auxiliary Sentinel-2 archive for 13-STC.

The source contains B1/B9 and quality masks, not an RGB band triplet. This
creates honest single-band B1/B9 and QA60 review layers plus per-file QA
metadata; it does not synthesize True Color or a surface-change result.
"""
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import geometry_mask
from rasterio.warp import transform_bounds, transform_geom

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/data/nationwide/audit_20261012"
INVENTORY = AUDIT / "13stc_drive_inventory.json"
MANIFEST_PATH = ROOT / "docs/mangrove-monitoring/imagery_manifest.json"
PARTITION_PATH = ROOT / "docs/data/nationwide/plots/13-STC.json"
BOUNDARIES = ROOT / "docs/data/nationwide/boundaries_pdd_all.geojson"
RAW = ROOT / "tmp_13stc_raw"
OUTPUT = ROOT / "docs/mangrove-monitoring/imagery/13-STC"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def pct(n: int, d: int):
    return round(100 * n / d, 2) if d else None


def gray_layer(array: np.ndarray, valid: np.ndarray) -> Image.Image:
    """Common fixed DN stretch for source reflectance bands; nodata transparent."""
    scaled = np.clip((array.astype(np.float32) / 10000.0 - 0.01) / 0.29, 0, 1)
    with np.errstate(invalid="ignore"):
        level = (255 * np.power(scaled, 0.9)).astype(np.uint8)
    rgba = np.zeros((*array.shape, 4), dtype=np.uint8)
    rgba[..., 0] = level
    rgba[..., 1] = level
    rgba[..., 2] = level
    rgba[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    return Image.fromarray(rgba)


def main() -> None:
    inventory = read_json(INVENTORY)
    assets = {f["capture_date"]: f for f in inventory["files"] if f.get("resolution_m") == 60}
    if len(assets) != 104:
        raise SystemExit(f"Expected 104 60m source TIFFs; got {len(assets)}")
    feature = next(f for f in read_json(BOUNDARIES)["features"] if f["properties"].get("plot") == "13-STC")
    if feature["properties"].get("pdd_verified_geometry") is not True:
        raise SystemExit("13-STC boundary is not source verified")
    geometry = feature["geometry"]
    manifest = read_json(MANIFEST_PATH)
    rows_by_date = {r["date"]: r for r in manifest.get("generated_items", []) if r.get("plot") == "13-STC"}
    partition = read_json(PARTITION_PATH)
    scenes = {r["date"]: r for r in partition.get("scenes", []) if r.get("plot") == "13-STC"}
    qa_rows = []
    ingestion_time = datetime.now(timezone.utc).isoformat()

    for n, date in enumerate(sorted(assets), 1):
        source = assets[date]
        path = RAW / f"tmp_13stc_{date}_60m.tif"
        if not path.is_file():
            raise SystemExit(f"Missing local 60m TIFF: {path.name}")
        if path.stat().st_size != int(source["size_bytes"]):
            raise SystemExit(f"Drive inventory size mismatch: {source['filename']}")
        with rasterio.open(path) as ds:
            if ds.crs is None:
                raise SystemExit(f"Missing CRS: {path.name}")
            labels = [str(v or "").strip().upper() for v in ds.descriptions]
            if "B1" not in labels or "B9" not in labels:
                raise SystemExit(f"Expected B1 and B9 bands: {path.name}: {labels}")
            geom = transform_geom("EPSG:4326", ds.crs, geometry)
            inside = geometry_mask([geom], out_shape=(ds.height, ds.width), transform=ds.transform, invert=True)
            total_inside = int(inside.sum())
            data: dict[str, np.ndarray] = {}
            band_stats = {}
            for i, label in enumerate(labels, 1):
                arr = ds.read(i, masked=True).astype(np.float32).filled(np.nan)
                data[label] = arr
                valid = np.isfinite(arr)
                in_valid = inside & valid
                values = arr[in_valid]
                band_stats[label] = {
                    "valid_pixels_total": int(valid.sum()),
                    "valid_coverage_pct": pct(int(valid.sum()), ds.width * ds.height),
                    "valid_plot_pixels": int(in_valid.sum()),
                    "valid_plot_coverage_pct": pct(int(in_valid.sum()), total_inside),
                    "plot_min": round(float(values.min()), 3) if values.size else None,
                    "plot_mean": round(float(values.mean()), 3) if values.size else None,
                    "plot_max": round(float(values.max()), 3) if values.size else None,
                }
            qa = data.get("QA60")
            qa_scene_valid = np.isfinite(qa) if qa is not None else np.zeros(inside.shape, bool)
            qa_valid = inside & qa_scene_valid
            qa_uint = np.where(qa_scene_valid, np.maximum(qa, 0), 0).astype(np.uint32) if qa is not None else np.zeros(inside.shape, np.uint32)
            opaque = (qa_uint & (1 << 10)) != 0
            cirrus = (qa_uint & (1 << 11)) != 0
            opaque_layer = data.get("MSK_CLASSI_OPAQUE")
            cirrus_layer = data.get("MSK_CLASSI_CIRRUS")
            snow_layer = data.get("MSK_CLASSI_SNOW_ICE")
            qa60 = {
                "valid_plot_pixels": int(qa_valid.sum()),
                "valid_plot_coverage_pct": pct(int(qa_valid.sum()), total_inside),
                "opaque_cloud_bit10_pct_of_qa_valid": pct(int((qa_valid & opaque).sum()), int(qa_valid.sum())),
                "cirrus_bit11_pct_of_qa_valid": pct(int((qa_valid & cirrus).sum()), int(qa_valid.sum())),
                "opaque_class_mask_pct": pct(int((inside & np.isfinite(opaque_layer) & (opaque_layer > 0)).sum()), total_inside) if opaque_layer is not None else None,
                "cirrus_class_mask_pct": pct(int((inside & np.isfinite(cirrus_layer) & (cirrus_layer > 0)).sum()), total_inside) if cirrus_layer is not None else None,
                "snow_ice_class_mask_pct": pct(int((inside & np.isfinite(snow_layer) & (snow_layer > 0)).sum()), total_inside) if snow_layer is not None else None,
                "caveat": "QA60 and MSK_CLASSI flags are reported as source QA indicators; they do not determine whether the scene is retained or visually available.",
            }
            bounds = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds, densify_pts=21)
            bounds_ll = [[bounds[1], bounds[0]], [bounds[3], bounds[2]]]
            metadata = {
                "crs": ds.crs.to_string(), "width": ds.width, "height": ds.height,
                "transform": list(ds.transform)[:6], "pixel_size": [abs(ds.transform.a), abs(ds.transform.e)],
                "band_count": ds.count, "band_descriptions": list(ds.descriptions),
                "nodata": ds.nodata, "bounds": bounds_ll, "polygon_pixel_count": total_inside,
            }
            mode_files = {
                "b1_60m": gray_layer(data["B1"], np.isfinite(data["B1"])),
                "b9_60m": gray_layer(data["B9"], np.isfinite(data["B9"])),
            }
            # Cloud-only overlay: red where QA60 bit 10 or 11 is set; transparent elsewhere.
            cloud = (opaque | cirrus) & qa_scene_valid
            cloud_rgba = np.zeros((*cloud.shape, 4), np.uint8)
            cloud_rgba[..., 0] = 255
            cloud_rgba[..., 1] = 85
            cloud_rgba[..., 2] = 30
            cloud_rgba[..., 3] = np.where(cloud, 220, 0).astype(np.uint8)
            mode_files["qa60_cloud_60m"] = Image.fromarray(cloud_rgba)

        folder = OUTPUT / date
        folder.mkdir(parents=True, exist_ok=True)
        urls = {}
        for mode, image in mode_files.items():
            name = mode + ".png"
            image.save(folder / name, "PNG", optimize=True)
            urls[mode] = f"./imagery/13-STC/{date}/{name}"

        item = rows_by_date[date]
        item.setdefault("assets", {}).update(urls)
        item["modes"] = sorted(set(item.get("modes", [])) | set(urls))
        item.setdefault("mode_bounds", {}).update({mode: bounds_ll for mode in urls})
        item.setdefault("mode_dimensions", {}).update({"auxiliary_60m": [metadata["width"], metadata["height"]]})
        item.setdefault("source_resolution_m", {}).update({"auxiliary": 60})
        item["source_tif60_file_id"] = source["drive_file_id"]
        item["source_tif60_filename"] = source["filename"]
        item.setdefault("source_file_ids", [])
        if source["drive_file_id"] not in item["source_file_ids"]:
            item["source_file_ids"].append(source["drive_file_id"])
        item.setdefault("source_file_names", [])
        added_source = source["filename"] not in item["source_file_names"]
        if added_source:
            item["source_file_names"].append(source["filename"])
        item.setdefault("source_paths", [])
        sp = source["source_folder_path"] + "/" + source["filename"]
        if sp not in item["source_paths"]:
            item["source_paths"].append(sp)
        item.setdefault("source_file_created_times", [])
        item.setdefault("source_file_modified_times", [])
        if added_source:
            item["source_file_created_times"].append(source["created_time"])
            item["source_file_modified_times"].append(source["modified_time"])
        item.setdefault("source_checksums_sha256", {})["60"] = sha256(path)
        item.setdefault("source_tiff_metadata", {})["60"] = metadata
        item["qa60_60m"] = qa60
        item["auxiliary_60m_visual_note"] = "60m source has B1/B9 plus QA masks, not an RGB triplet. B1/B9 and QA60 are displayed as separate native-band review layers; no 60m True Color is fabricated."

        scene = scenes[date]
        scene["source_tif60_file_id"] = source["drive_file_id"]
        scene["source_tif60_filename"] = source["filename"]
        scene["source_file_ids"] = item["source_file_ids"]
        scene["source_paths"] = item["source_paths"]
        scene["source_checksums"]["60"] = item["source_checksums_sha256"]["60"]
        scene.setdefault("source_tiff_metadata", {})["60"] = metadata
        scene["qa60_60m"] = qa60
        qa_rows.append({
            "plot": "13-STC", "date": date, "drive_file_id": source["drive_file_id"],
            "filename": source["filename"], "byte_size": path.stat().st_size,
            "sha256": item["source_checksums_sha256"]["60"], "crs": metadata["crs"],
            "width": metadata["width"], "height": metadata["height"],
            "pixel_size_x": metadata["pixel_size"][0], "pixel_size_y": metadata["pixel_size"][1],
            "band_count": metadata["band_count"], "bands": ";".join(str(x or "") for x in metadata["band_descriptions"]),
            "valid_plot_pixels": qa60["valid_plot_pixels"], "qa60_valid_plot_pct": qa60["valid_plot_coverage_pct"],
            "opaque_cloud_bit10_pct": qa60["opaque_cloud_bit10_pct_of_qa_valid"],
            "cirrus_bit11_pct": qa60["cirrus_bit11_pct_of_qa_valid"],
            "opaque_class_mask_pct": qa60["opaque_class_mask_pct"], "cirrus_class_mask_pct": qa60["cirrus_class_mask_pct"],
            "snow_ice_class_mask_pct": qa60["snow_ice_class_mask_pct"],
            "data_integrity": "PASSED", "visual_layers": ";".join(urls),
        })
        if n % 20 == 0 or n == len(assets):
            print(f"processed 60m {n}/{len(assets)}", flush=True)

    manifest["version"] = "2026-10-14-13stc-all-resolutions-v1"
    manifest["generated_items"] = [rows_by_date.get(r.get("date"), r) if r.get("plot") == "13-STC" else r for r in manifest.get("generated_items", [])]
    atomic_json(MANIFEST_PATH, manifest)
    partition["generated_at"] = ingestion_time
    partition["scenes"] = [scenes.get(r.get("date"), r) if r.get("plot") == "13-STC" else r for r in partition.get("scenes", [])]
    atomic_json(PARTITION_PATH, partition)
    with (AUDIT / "13stc_60m_qa.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(qa_rows[0]))
        writer.writeheader(); writer.writerows(qa_rows)
    summary_path = AUDIT / "13stc_processing_summary.md"
    marker = "## 60m auxiliary-band processing"
    summary = summary_path.read_text(encoding="utf-8") if summary_path.exists() else "# 13-STC Processing Audit\n"
    summary = summary.split(marker)[0].rstrip() + f"\n\n{marker}\n\n- 60m source TIFFs: {len(qa_rows)}/{len(assets)} checked and processed; the remaining {106-len(qa_rows)} acquisition dates have no 60m source file in Drive.\n- Native review layers: {len(qa_rows)} B1 Coastal Aerosol, {len(qa_rows)} B9 Water Vapour and {len(qa_rows)} QA60 cloud/cirrus layers; these are separate layers, not synthetic RGB.\n- Per-file CRS, transform, pixel size, band descriptions, NoData, polygon valid coverage, QA60 bit 10/11 and MSK_CLASSI summaries are in `13stc_60m_qa.csv`.\n- QA60 is an auxiliary source flag only; cloudy scenes remain in the archive and visual review.\n"
    summary_path.write_text(summary, encoding="utf-8")
    print(f"complete: {len(qa_rows)} 60m source TIFFs processed; {len(qa_rows)*3} native review layers")


if __name__ == "__main__":
    main()
