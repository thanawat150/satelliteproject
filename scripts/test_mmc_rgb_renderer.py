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
