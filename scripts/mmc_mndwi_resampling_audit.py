#!/usr/bin/env python3
"""Independent *screening* of MNDWI grid resampling against an embedded TIFF index.

It is diagnostic only. The lowest RMSE is not proof of scientifically correct
georegistration, and this utility never changes source pixels or published data.
"""
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.features import geometry_mask
from shapely.geometry import mapping
from shapely.ops import transform
from pyproj import Transformer

def _band(ds,name,default):
    names=[(x or "").upper() for x in ds.descriptions]
    i=names.index(name.upper())+1 if name.upper() in names else default
    if i is None or i>ds.count:
        raise ValueError("Missing source band: "+name)
    a=ds.read(i).astype(np.float32)
    if ds.nodata is not None:a[a==ds.nodata]=np.nan
    a[a==-9999]=np.nan
    return a

def audit(p10,p20,geometry_4326):
    with rasterio.open(p10) as ds10,rasterio.open(p20) as ds20:
        names=[(x or "").upper() for x in ds20.descriptions]
        if "MNDWI" not in names:
            return {"status":"EMBEDDED_MNDWI_NOT_AVAILABLE","methods":{}}
        embedded=_band(ds20,"MNDWI",None)
        b11=_band(ds20,"B11",5)
        b3=_band(ds10,"B3",2)
        scl=_band(ds20,"SCL",7)
        local_geom=transform(
            Transformer.from_crs("EPSG:4326",ds20.crs,always_xy=True).transform,
            geometry_4326)
        inside=geometry_mask([mapping(local_geom)],out_shape=(ds20.height,ds20.width),
                             transform=ds20.transform,invert=True,all_touched=False)
        mask=inside&np.isin(scl,[2,4,5,6,7])&np.isfinite(embedded)&np.isfinite(b11)
        results={}
        for name,method in [("nearest",Resampling.nearest),
                            ("bilinear",Resampling.bilinear),
                            ("average",Resampling.average),
                            ("cubic",Resampling.cubic)]:
            dest=np.full((ds20.height,ds20.width),np.nan,dtype=np.float32)
            reproject(b3,dest,src_transform=ds10.transform,src_crs=ds10.crs,
                      src_nodata=np.nan,dst_transform=ds20.transform,dst_crs=ds20.crs,
                      dst_nodata=np.nan,resampling=method)
            den=dest+b11
            with np.errstate(divide="ignore",invalid="ignore"):
                value=np.where(np.abs(den)>1.e-8,(dest-b11)/den,np.nan)
            valid=mask&np.isfinite(value)&(np.abs(value)<=1.05)
            n=int(valid.sum())
            if n<3:
                results[name]={"sample_pixels":n,"rmse":None,"bias":None}
                continue
            d=value[valid]-embedded[valid]
            results[name]={"sample_pixels":n,
                           "rmse":round(float(np.sqrt(np.mean(d*d))),6),
                           "bias":round(float(np.mean(d)),6),
                           "mean_abs_error":round(float(np.mean(abs(d))),6)}
        choices={k:v["rmse"] for k,v in results.items() if v["rmse"] is not None}
        best=min(choices,key=choices.get) if choices else None
        return {"status":"DIAGNOSTIC_ONLY","methods":results,
                "lowest_rmse_method":best,
                "original_bilinear_rmse":choices.get("bilinear"),
                "screening_flag":bool(choices.get("bilinear",0)>0.03),
                "note":"Compare embedded TIFF index with 10m B3 reprojection methods; no source correction or tide validation."}
