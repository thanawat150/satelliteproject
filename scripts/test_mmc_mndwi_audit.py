#!/usr/bin/env python3
"""Synthetic georeferenced regression for MNDWI TIFF-parity diagnostics."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from shapely.geometry import box
from shapely.ops import transform
from pyproj import Transformer

spec=importlib.util.spec_from_file_location("audit",Path(__file__).with_name("mmc_mndwi_resampling_audit.py"))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestMNDWI(unittest.TestCase):
    def test_native_embedded_grid_reconstruction(self):
        with tempfile.TemporaryDirectory() as tmp:
            p10=Path(tmp)/"source_10m.tif";p20=Path(tmp)/"source_20m.tif"
            crs="EPSG:32647"
            tr10=from_origin(500000,1000,10,10)
            tr20=from_origin(500000,1000,20,20)
            values=np.array([[1100,2100,1900,3400],
                             [1500,2300,2700,3900],
                             [1600,2700,1700,2500],
                             [1900,2800,2300,3200]],dtype=np.float32)
            with rasterio.open(p10,"w",driver="GTiff",width=4,height=4,
                               count=4,dtype="float32",crs=crs,transform=tr10) as ds:
                for i,name in enumerate(["B2","B3","B4","B8"],start=1):
                    ds.write(values if name=="B3" else values*.8,i)
                    ds.set_band_description(i,name)
            resampled=np.full((2,2),np.nan,dtype=np.float32)
            reproject(values,resampled,src_transform=tr10,src_crs=crs,
                      dst_transform=tr20,dst_crs=crs,resampling=Resampling.bilinear)
            embedded=(resampled-2000)/(resampled+2000)
            with rasterio.open(p20,"w",driver="GTiff",width=2,height=2,
                               count=12,dtype="float32",crs=crs,transform=tr20) as ds:
                for i in range(1,13):ds.write(np.full((2,2),3000,dtype=np.float32),i)
                ds.write(np.full((2,2),2000,dtype=np.float32),5)
                ds.write(np.full((2,2),4,dtype=np.float32),7)
                ds.write(embedded,12)
                for i,name in [(5,"B11"),(7,"SCL"),(12,"MNDWI")]:ds.set_band_description(i,name)
            geom=transform(Transformer.from_crs(crs,"EPSG:4326",always_xy=True).transform,
                           box(500000,960,500040,1000))
            result=mod.audit(p10,p20,geom)
            self.assertEqual(result["status"],"DIAGNOSTIC_ONLY")
            self.assertEqual(result["methods"]["bilinear"]["sample_pixels"],4)
            self.assertAlmostEqual(result["methods"]["bilinear"]["rmse"],0,places=5)
            self.assertFalse(result["screening_flag"])

if __name__=="__main__":unittest.main()
