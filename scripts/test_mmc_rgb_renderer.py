#!/usr/bin/env python3
"""Regression tests for geospatial RGB preview rendering."""
import importlib.util
from pathlib import Path
import numpy as np

spec=importlib.util.spec_from_file_location("mmc_render",Path(__file__).with_name("mmc_render_imagery.py"))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

mask=np.array([[True,True,False],[True,True,False]],dtype=bool)
# Vegetation-like reflectance: Green > Red and Blue, not white.
b4=np.array([[500,850,-9999],[500,850,-9999]],dtype=np.float32)
b3=np.array([[1050,1250,-9999],[1050,1250,-9999]],dtype=np.float32)
b2=np.array([[350,550,-9999],[350,550,-9999]],dtype=np.float32)
img=mod.stretched_rgb([b4,b3,b2],mask)
pix=np.asarray(img)
assert img.mode=="RGBA",img.mode
assert pix[0,0,1]>pix[0,0,0]>pix[0,0,2],pix[0,0]
assert np.max(pix[mask,:3])<235, "Healthy vegetation should not become white through stretch"
assert pix[0,2,3]==0 and pix[1,2,3]==0,"NoData is transparent, not black"
assert pix[0,0,3]==255
img2=mod.stretched_rgb([b4*1.02,b3*1.02,b2*1.02],mask)
assert np.max(np.abs(pix[:2,:2,:3].astype(int)-np.asarray(img2)[:2,:2,:3].astype(int)))<15
bright=mod.stretched_rgb([np.full((2,3),6000.0)]*3,np.ones((2,3),dtype=bool))
assert np.all(np.asarray(bright)[...,:3]==255),"Real bright reflectance is not silently recolored"
print("MMC_RGB_DISPLAY_QA_PASS stable shared reflectance display, natural vegetation, no-data transparency")

# Non-QA RGB must still display real cloudy pixels without inventing index maps.
import tempfile
import rasterio
from rasterio.transform import from_origin
with tempfile.TemporaryDirectory() as td:
    src=Path(td)/"S2_20261007_10m.tif"
    with rasterio.open(src,"w",driver="GTiff",width=4,height=4,count=4,
             dtype="float32",crs="EPSG:32647",transform=from_origin(500000,1500000,10,10),
             nodata=-9999) as ds:
        for i,name in enumerate(("B2","B3","B4","B8"),1):
            a=np.full((4,4),[7000,7200,7400,8100][i-1],dtype=np.float32)
            a[0,0]=-9999
            ds.write(a,i)
            ds.set_band_description(i,name)
    out=mod.generate_visual_only(src,Path(td)/"imagery","VISUAL-STC","2026-10-07")
    assert out["preview_kind"]=="VISUAL_ONLY_NON_QA"
    assert set(out["modes"])=={"true_color","false_color"}
    assert not out["index_stats"] and not out["index_parity"]
    assert out["rgb_native_width"]==4 and out["rgb_native_height"]==4
    from PIL import Image
    with Image.open(Path(td)/"imagery"/"true_color.webp") as preview:
        rgba=np.asarray(preview.convert("RGBA"))
        assert rgba[0,0,3]==0,"NoData must be transparent"
        assert rgba[1,1,3]==255,"Bright or cloudy real pixels must remain visible"
    p20=Path(td)/"S2_20261007_20m.tif"
    with rasterio.open(p20,"w",driver="GTiff",width=2,height=2,count=7,
            dtype="float32",crs="EPSG:32647",transform=from_origin(500000,1500000,20,20),
            nodata=-9999) as ds:
        for i in range(1,8):
            ds.write(np.full((2,2),2000+300*i,dtype=np.float32),i)
        for i,name in [(1,"B5"),(4,"B8A"),(5,"B11"),(7,"SCL")]:
            ds.set_band_description(i,name)
    full=mod.generate_visual_only(src,Path(td)/"imagery8","VISUAL-STC","2026-10-07",twenty=p20)
    assert full["preview_kind"]=="VISUAL_ONLY_NON_QA"
    assert len(full["modes"])==8,full["modes"]
    assert not full["index_stats"] and not full["index_parity"]
    assert full["mode_bounds"]["ndvi"] and full["mode_dimensions"]["indices_20m"]==[2,2]
    for mode in ("ndvi","ndre","ndmi","mndwi","bsi","ndwi"):
        path=Path(td)/"imagery8"/(mode+".png")
        assert path.exists(),path
        with Image.open(path) as im:
            assert im.size==(2,2)
            assert np.any(np.asarray(im.convert("RGBA"))[...,3]==255)
print("MMC_NONQA_VISUAL_RGB_PASS all 8 source images for cloudy display-only scenes; no unvalidated index stats")
