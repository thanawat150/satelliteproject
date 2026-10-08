#!/usr/bin/env python3
"""Analyze a new Sentinel-2 TIFF pair once per source-file version.

Run after staging original 10 m and 20 m TIFFs locally:
  python scripts/derive_daily_monitoring.py --plot 13-STC --date 2026-10-09 \
    --tif10 /data/scene_10m.tif --tif20 /data/scene_20m.tif

Scientific constraints:
- Use official verified plot geometry for the clip. Do not invent per-tree crowns.
- Mask clouds/shadows with SCL; mark incomplete scenes PARTIAL/NO_DATA.
- Class thresholds are preliminary screening rules, not validated ecological classes.
- Never overwrite manually VERIFIED rows or PDFs.
- Compute new-water hotspots only in the intersection of both dates' clear coverage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import geometry_mask, shapes
from rasterio.warp import reproject
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "data"
ALGORITHM = "office-monitor-v1.0"
GOOD_SCL = (2, 4, 5, 6, 7)
MIN_HOTSPOT_RAI = 0.5


def read_json(name: str, fallback):
    path = DATA / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def save_json(name: str, item):
    path = DATA / name
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(item, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def band(ds, name, default=None):
    descriptions = [str(s).upper() if s else "" for s in ds.descriptions]
    target = name.upper()
    pos = descriptions.index(target) + 1 if target in descriptions else default
    if pos is None or pos > ds.count:
        raise ValueError(f"Required {target} band unavailable in {ds.name}")
    data = ds.read(pos).astype("float32")
    if ds.nodata is not None and np.isfinite(ds.nodata):
        data[data == ds.nodata] = np.nan
    data[data == -9999] = np.nan
    return data


def same_grid(src, data, dst, resampling=Resampling.bilinear):
    out = np.full((dst.height, dst.width), np.nan, dtype="float32")
    reproject(source=data, destination=out, src_transform=src.transform,
              src_crs=src.crs, src_nodata=np.nan, dst_transform=dst.transform,
              dst_crs=dst.crs, dst_nodata=np.nan, resampling=resampling)
    return out


def safe_index(a, b):
    denominator = a + b
    return np.divide(a - b, denominator, out=np.full(a.shape, np.nan, dtype="float32"),
                     where=np.isfinite(denominator) & (np.abs(denominator) > 1e-6))


def clean_shape(geom):
    try:
        if not geom.is_valid:
            geom = geom.buffer(0)
    except Exception:
        geom = geom.buffer(0)
    return geom


def mask_to_geometry(mask, affine):
    pieces = [clean_shape(shape(g)) for g, value in shapes(mask.astype("uint8"), mask=mask, transform=affine) if value == 1]
    pieces = [p for p in pieces if not p.is_empty]
    return clean_shape(unary_union(pieces)) if pieces else None


def change_feature(geom, current_crs, plot, date, other_props):
    if geom is None or geom.is_empty:
        return None
    conv = Transformer.from_crs(current_crs, "EPSG:4326", always_xy=True)
    out = transform(conv.transform, clean_shape(geom))
    return {"type": "Feature", "geometry": mapping(out), "properties": {"plot": plot, "date": date, **other_props}}


def make_feature(mask, affine, crs, plot, date, cls, valid_px, source):
    geom = mask_to_geometry(mask, affine)
    if geom is None:
        return None
    area_rai = float(mask.sum() * abs(affine.a * affine.e) / 1600.0)
    return change_feature(geom, crs, plot, date, {
        "class": cls, "area_rai": round(area_rai, 3), "valid_pct": round(valid_px, 2),
        "analysis_status": source,
        "method": "screening thresholds; positional uncertainty at Sentinel-2 grid resolution",
        "algorithm_version": ALGORITHM
    })


def upsert_feature(fc, f, identity):
    if f is None:
        return
    props = f["properties"]
    fc.setdefault("features", [])[:] = [x for x in fc.get("features", []) if
      tuple(x.get("properties", {}).get(k) for k in identity) != tuple(props.get(k) for k in identity)]
    fc["features"].append(f)


def percent_finite(a, valid):
    vals = a[valid & np.isfinite(a)]
    return round(float(vals.mean()), 4) if vals.size else None


def geoms_as_crs(feature, crs):
    if feature is None:
        return None
    proj = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    return clean_shape(transform(proj.transform, shape(feature["geometry"])))


def analyze(plot: str, date: str, tif10: Path, tif20: Path, allow_verified=False):
    scenes = read_json("analysis_jobs.json", {"algorithm": ALGORITHM, "processed": {}})
    fingerprint = hashlib.sha256((ALGORITHM + "|" + hash_file(tif10) + "|" + hash_file(tif20)).encode()).hexdigest()
    key = plot + "|" + date
    if scenes["processed"].get(key) == fingerprint:
        return {"status": "SKIPPED_UNCHANGED", "plot": plot, "date": date}
    history = read_json("analysis_history.json", {"schema_version": "1.0", "plots": {}})
    old_rows = history.setdefault("plots", {}).setdefault(plot, [])
    manual = next((x for x in old_rows if x.get("date") == date and x.get("analysis_status") == "VERIFIED"), None)
    if manual and not allow_verified:
        return {"status": "SKIPPED_VERIFIED", "plot": plot, "date": date}

    bounds = read_json("boundaries.geojson", {"features": []})
    boundary = next((f for f in bounds["features"] if f.get("properties", {}).get("plot") == plot), None)
    if not boundary or boundary.get("properties", {}).get("boundary_quality") != "verified":
        raise ValueError(f"No verified project polygon: {plot}")
    with rasterio.open(tif10) as ten, rasterio.open(tif20) as twenty:
        if ten.crs is None or twenty.crs is None:
            raise ValueError("Input GeoTIFF lacks CRS")
        projected = clean_shape(transform(
            Transformer.from_crs("EPSG:4326", twenty.crs, always_xy=True).transform, shape(boundary["geometry"])))
        inside = geometry_mask([mapping(projected)], transform=twenty.transform,
                               out_shape=(twenty.height, twenty.width), invert=True, all_touched=False)
        if not inside.any():
            raise ValueError("Polygon does not intersect Sentinel-2 raster")
        # Read known exported stacks when band descriptions are missing.
        scl = band(twenty, "SCL", 7)
        mndwi = band(twenty, "MNDWI", 12)
        ndre = band(twenty, "NDRE", 10)
        ndmi = band(twenty, "NDMI", 11)
        b11 = band(twenty, "B11", 5)
        b2 = same_grid(ten, band(ten, "B2", 1), twenty)
        b4 = same_grid(ten, band(ten, "B4", 3), twenty)
        b8 = same_grid(ten, band(ten, "B8", 4), twenty)
        # Sentinel-2 L2A reflectance bands use the same scale; avoid normalizing each band separately.
        ndvi = safe_index(b8, b4)
        bsi = safe_index(b11 + b4, b8 + b2)
        # QA pixels must be valid for water; extra spectral indices can be missing separately.
        clear = inside & np.isin(scl, GOOD_SCL) & np.isfinite(mndwi) & (np.abs(mndwi) <= 1.05)
        valid_pct = round(100 * float(clear.sum()) / float(inside.sum()), 2)
        status = "AUTO_VALID" if valid_pct >= 70 else "PARTIAL" if valid_pct >= 20 else "NO_DATA"
        area_factor = abs(twenty.transform.a * twenty.transform.e) / 1600
        water_mask = clear & (mndwi > 0)
        observed_water_rai = round(float(water_mask.sum()) * area_factor, 3)
        water_total_pct = round(float(water_mask.sum()) / float(inside.sum()) * 100, 2)
        observed_water_pct_of_valid = round(float(water_mask.sum()) / float(clear.sum()) * 100, 2) if clear.any() else None
        row = {
            "date": date, "role": "auto_current" if status == "AUTO_VALID" else "qa_partial",
            "analysis_status": status, "valid_pct": valid_pct,
            "water_rai": observed_water_rai if status == "AUTO_VALID" else None,
            "water_pct": water_total_pct if status == "AUTO_VALID" else None,
            "observed_water_rai": observed_water_rai if status == "PARTIAL" else None,
            "observed_water_pct_of_valid": observed_water_pct_of_valid if status == "PARTIAL" else None,
            "ndvi": percent_finite(ndvi, clear) if status == "AUTO_VALID" else None,
            "ndre": percent_finite(ndre, clear) if status == "AUTO_VALID" else None,
            "ndmi": percent_finite(ndmi, clear) if status == "AUTO_VALID" else None,
            "mndwi": percent_finite(mndwi, clear) if status == "AUTO_VALID" else None,
            "bsi": percent_finite(bsi, clear) if status == "AUTO_VALID" else None,
            "change_water_rai": None, "new_water_rai": None, "lost_water_rai": None,
            "source": "sentinel2_raster_automated",
            "algorithm_version": ALGORITHM, "source_fingerprint": fingerprint
        }
        # Separate geometry products from manual VERIFIED baseline PDFs; never rewrite them.
        water_fc = read_json("water_history.geojson", {"type": "FeatureCollection", "features": []})
        cover_fc = read_json("landcover_history.geojson", {"type": "FeatureCollection", "features": []})
        valid_fc = read_json("valid_coverage_history.geojson", {"type": "FeatureCollection", "features": []})
        hotspots = read_json("monitoring_hotspots.geojson", {"type": "FeatureCollection", "features": []})
        if status != "NO_DATA":
            waterf = make_feature(water_mask, twenty.transform, twenty.crs, plot, date,
                                  "water", valid_pct, status)
            if waterf:
                waterf["properties"]["derived_water_rai"] = observed_water_rai
                waterf["properties"]["threshold"] = "MNDWI > 0"
                upsert_feature(water_fc, waterf, ["plot", "date"])
            valid_f = make_feature(clear, twenty.transform, twenty.crs, plot, date,
                                   "valid_coverage", valid_pct, status)
            upsert_feature(valid_fc, valid_f, ["plot", "date"])
            # Exclusive base classes: water takes precedence over vegetation, then bare soil.
            veg = clear & ~water_mask & np.isfinite(ndvi) & (ndvi >= 0.35)
            soil = clear & ~water_mask & ~veg & np.isfinite(ndvi) & np.isfinite(bsi) & (ndvi < 0.25) & (bsi > 0)
            wet = clear & ~water_mask & np.isfinite(ndmi) & (ndmi > 0.3)
            # Wet is an overlapping status layer, not an additional base-class area.
            for cls, mask in [("vegetation", veg), ("bare_soil", soil), ("wetness", wet)]:
                upsert_feature(cover_fc, make_feature(mask, twenty.transform, twenty.crs,
                    plot, date, cls, valid_pct, status), ["plot", "date", "class"])
            # Change polygons are produced only if both dates have stored valid-coverage geometries.
            trusted_prev = sorted(
                [r for r in old_rows if r.get("date", "") < date and
                 r.get("analysis_status") in ("VERIFIED", "AUTO_VALID") and
                 (r.get("valid_pct") is None or r.get("valid_pct") >= 70)],
                key=lambda r: r["date"])
            if trusted_prev and status == "AUTO_VALID":
                before = trusted_prev[-1]["date"]
                prev_cov = next((f for f in valid_fc["features"] if
                    f["properties"].get("plot") == plot and f["properties"].get("date") == before), None)
                prev_water = next((f for f in water_fc["features"] if
                    f["properties"].get("plot") == plot and f["properties"].get("date") == before), None)
                if prev_cov and prev_water:
                    overlap = geoms_as_crs(prev_cov, twenty.crs).intersection(geoms_as_crs(valid_f, twenty.crs))
                    before_w = geoms_as_crs(prev_water, twenty.crs)
                    now_w = mask_to_geometry(water_mask, twenty.transform)
                    if now_w is not None and not overlap.is_empty:
                        new_area = clean_shape(now_w.difference(before_w).intersection(overlap))
                        loss_area = clean_shape(before_w.difference(now_w).intersection(overlap))
                        row["new_water_rai"] = round(float(new_area.area / 1600), 3)
                        row["lost_water_rai"] = round(float(loss_area.area / 1600), 3)
                        row["change_water_rai"] = round(float((new_area.area - loss_area.area) / 1600), 3)
                        # A change is an office screening event, not confirmed flood damage.
                        if new_area.area >= MIN_HOTSPOT_RAI * 1600:
                            feature = change_feature(new_area, twenty.crs, plot, date, {
                                "date_a": before, "date_b": date, "event_type": "น้ำเพิ่มใหม่",
                                "priority": "P2", "area_rai": round(float(new_area.area/1600), 3),
                                "reason_th": "เดิมไม่ใช่น้ำ ปัจจุบันเป็นน้ำในพื้นที่ที่มีข้อมูลใช้ได้ทั้งสองวัน; ควรตรวจภาพและระดับน้ำขึ้นน้ำลงประกอบ",
                                "confidence": "candidate", "analysis_status": status,
                                "algorithm_version": ALGORITHM
                            })
                            upsert_feature(hotspots, feature, ["plot", "date", "event_type"])
        old_rows[:] = [r for r in old_rows if r.get("date") != date]
        old_rows.append(row)
        old_rows.sort(key=lambda r: r["date"])
        history["generated_at"] = datetime.now(timezone.utc).isoformat()
        # Commit output files only after successful read and raster analysis.
        save_json("analysis_history.json", history)
        save_json("water_history.geojson", water_fc)
        save_json("landcover_history.geojson", cover_fc)
        save_json("valid_coverage_history.geojson", valid_fc)
        save_json("monitoring_hotspots.geojson", hotspots)
        scenes.setdefault("processed", {})[key] = fingerprint
        scenes["algorithm"] = ALGORITHM
        save_json("analysis_jobs.json", scenes)
        return {"status": status, "plot": plot, "date": date,
                "valid_pct": valid_pct, "water_rai": row["water_rai"],
                "observed_water_rai": observed_water_rai,
                "new_water_rai": row["new_water_rai"], "lost_water_rai": row["lost_water_rai"]}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--plot", required=True)
    ap.add_argument("--date", required=True, help="YYYY-MM-DD (satellite acquisition date)")
    ap.add_argument("--tif10", required=True, type=Path, help="Local GeoTIFF 10m")
    ap.add_argument("--tif20", required=True, type=Path, help="Local GeoTIFF 20m")
    ns = ap.parse_args()
    if len(ns.date) != 10 or ns.date[4] != "-" or ns.date[7] != "-":
        ap.error("--date must be YYYY-MM-DD")
    for path in [ns.tif10, ns.tif20]:
        if not path.is_file():
            ap.error(f"Missing TIFF: {path}")
    result = analyze(ns.plot, ns.date, ns.tif10, ns.tif20)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
