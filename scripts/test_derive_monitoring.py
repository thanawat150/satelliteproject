#!/usr/bin/env python3
"""Exercise the actual monitoring processor on synthetic Sentinel-2 TIFF grids.

All output is written to a temporary cloned data directory, never the live portal.
"""
import importlib.util
import math
import shutil
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.transform import from_origin
from shapely.geometry import shape
from shapely.ops import transform

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="monitor_test_") as td:
    tmp = Path(td)
    (tmp / "scripts").mkdir()
    (tmp / "docs" / "data").mkdir(parents=True)
    shutil.copy2(root / "scripts" / "derive_daily_monitoring.py", tmp / "scripts" / "derive_daily_monitoring.py")
    for name in ["boundaries.geojson", "analysis_history.json"]:
        shutil.copy2(root / "docs" / "data" / name, tmp / "docs" / "data" / name)
    spec = importlib.util.spec_from_file_location("monitor_processor", tmp / "scripts" / "derive_daily_monitoring.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    data = mod.read_json("boundaries.geojson", {})
    feat = next(f for f in data["features"] if f["properties"]["plot"] == "13-STC")
    proj = Transformer.from_crs("EPSG:4326", "EPSG:32647", always_xy=True)
    boundary = transform(proj.transform, shape(feat["geometry"]))
    minx, miny, maxx, maxy = boundary.bounds
    x0 = math.floor((minx-80) / 20) * 20
    y0 = math.ceil((maxy+80) / 20) * 20
    w20 = math.ceil((maxx+80-x0) / 20)
    h20 = math.ceil((y0-(miny-80)) / 20)
    w10, h10 = w20 * 2, h20 * 2
    tr20, tr10 = from_origin(x0, y0, 20, 20), from_origin(x0, y0, 10, 10)
    ten_path = tmp / "ten.tif"
    twenty_path = tmp / "twenty.tif"
    with rasterio.open(ten_path, "w", driver="GTiff", height=h10, width=w10, count=4,
                       dtype="float32", crs="EPSG:32647", transform=tr10) as dst:
        for i, (label, value) in enumerate([("B2", .08), ("B3", .09), ("B4", .08), ("B8", .30)], start=1):
            dst.write(np.full((h10,w10), value, dtype="float32"), i)
            dst.set_band_description(i, label)
    def write_twenty(shift):
        bands=["B5","B6","B7","B8A","B11","B12","SCL","MSK_CLDPRB","QA20","NDRE","NDMI","MNDWI"]
        with rasterio.open(twenty_path, "w", driver="GTiff", height=h20, width=w20,
                           count=len(bands), dtype="float32", crs="EPSG:32647", transform=tr20) as dst:
            values=[.10,.12,.13,.30,.06,.04,4,0,0,.25,.30,-.40]
            for i,(label,value) in enumerate(zip(bands,values),start=1):
                arr=np.full((h20,w20), value,dtype="float32")
                if label=="MNDWI":
                    if shift==0:arr[:,:w20//3]=.4
                    else:arr[:,w20//3:2*w20//3]=.4
                dst.write(arr,i)
                dst.set_band_description(i,label)
    write_twenty(0)
    first=mod.analyze("13-STC","2026-11-01",ten_path,twenty_path)
    assert first["status"]=="AUTO_VALID" and first["valid_pct"]>=99, first
    assert first["water_rai"]>0,first
    skipped=mod.analyze("13-STC","2026-11-01",ten_path,twenty_path)
    assert skipped["status"]=="SKIPPED_UNCHANGED",skipped
    write_twenty(1)
    second=mod.analyze("13-STC","2026-11-04",ten_path,twenty_path)
    assert second["status"]=="AUTO_VALID",second
    assert second["new_water_rai"] is not None and second["new_water_rai"]>0,second
    assert second["lost_water_rai"] is not None and second["lost_water_rai"]>0,second
    features=mod.read_json("monitoring_hotspots.geojson",{"features":[]})["features"]
    assert any(f["properties"]["plot"]=="13-STC" and f["properties"]["date"]=="2026-11-04" for f in features),features
    print("MONITOR ENGINE TEST PASS",first,second,"hotspots:",len(features))
