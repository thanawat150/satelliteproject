#!/usr/bin/env python3
"""Generate *real* map-aligned RGB and spectral index previews from source S2 GeoTIFFs.

Input is the original Google Drive 10m/20m Sentinel-2 pair, never a thumbnail.
No pseudo color index product is emitted when SCL/QA is invalid.
Designed for incremental/parallel GitHub Actions and a read-only GitHub Pages UI.
"""
from __future__ import annotations
import argparse, io, json, math, re, shutil, tempfile, traceback
from collections import defaultdict
from pathlib import Path
import numpy as np
from PIL import Image
from rasterio import open as rio_open
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.transform import Affine
from rasterio.warp import transform_bounds

BASE=Path(__file__).resolve().parents[1]
DATA=BASE/"docs"/"data"/"nationwide"
MODES=("true_color","false_color","ndvi","ndre","ndmi","mndwi","bsi","ndwi")
SCL_GOOD=(2,4,5,6,7)
MAX_DIM=400

def json_read(path):return json.loads(Path(path).read_text(encoding="utf-8"))
def json_write(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")

def bands(ds,name,fallback):
    labels=[str(x or "").strip().upper() for x in ds.descriptions]
    if name in labels:return labels.index(name)+1
    if ds.count < fallback:raise ValueError(f"Expected {name} at band {fallback}, got {ds.count} bands")
    return fallback

def index(x,y):
    z=x+y
    with np.errstate(divide="ignore",invalid="ignore"):
        return np.divide(x-y,z,out=np.full_like(x,np.nan,dtype=np.float32),where=np.isfinite(z)&(np.abs(z)>1.e-8))

def stretched_rgb(channels,valid_mask):
    """Reproducible natural-color RGB; never stretch each small band to 0..255.

    Input Sentinel-2 SR reflectance is scaled x10000 in source TIFFs.
    Per-scene p2/p98 made flat/dark vegetation appear as white noise on
    tiny rectangles and let -9999/0 NoData become black or white stripes.
    Use one fixed physical reflectance display interval for all R/G/B,
    and retain invalid pixels as transparent (not manufactured imagery).
    """
    mask=np.asarray(valid_mask,dtype=bool)
    rgb=np.zeros((*mask.shape,4),dtype=np.uint8)
    for i,raw in enumerate(channels):
        x=np.asarray(raw,dtype=np.float32)/10000.0
        # 0.01..0.30 reflectance; single range preserves channel balance.
        scaled=np.clip((x-0.01)/(0.30-0.01),0,1)
        # Subtle shared gamma, never histogram-equalize each band.
        with np.errstate(invalid="ignore"):
            rgb[...,i]=(255*np.power(scaled,0.9)).astype(np.uint8)
    rgb[...,3]=np.where(mask,255,0).astype(np.uint8)
    return Image.fromarray(rgb,"RGBA")

def colorize(x,mask,mode):
    # Fixed scientific display stretches; color scale shown in associated metadata.
    if mode in ("ndvi","ndre","ndmi"):
        points=[(-1,(132,73,52)),(-.3,(194,122,70)),(0,(245,220,128)),(.3,(155,196,96)),(.65,(45,134,85)),(1,(7,73,53))]
    elif mode in ("ndwi","mndwi"):
        points=[(-1,(157,92,53)),(-.2,(228,188,103)),(0,(234,224,189)),(.15,(111,194,196)),(.45,(40,128,187)),(1,(14,46,117))]
    else: # BSI
        points=[(-1,(30,102,75)),(-.35,(81,156,83)),(0,(224,205,128)),(.3,(185,126,77)),(1,(118,61,37))]
    finite=np.isfinite(x)&mask
    rgb=np.zeros((*x.shape,4),dtype=np.uint8)
    for ch in range(3):
        rgb[...,ch]=np.interp(np.nan_to_num(x,nan=-1),[p[0] for p in points],[p[1][ch] for p in points]).astype(np.uint8)
    rgb[...,3]=np.where(finite,255,0).astype(np.uint8)
    return Image.fromarray(rgb,'RGBA')

def generate(ten,twenty,output,plot,date,geometry4326=None):
    """RGB uses the actual native 10 m pixel grid; indices retain a 20 m grid."""
    from rasterio.features import geometry_mask
    from rasterio.warp import transform_geom
    with rio_open(ten) as ds10, rio_open(twenty) as ds20:
        if ds10.crs is None or ds20.crs is None:
            raise ValueError("Source TIFF has no CRS")
        if ds10.count < 4 or ds20.count < 7:
            raise ValueError("Input TIFF missing required bands")
        scale20=min(1.0,MAX_DIM/max(ds20.width,ds20.height))
        w=max(2,round(ds20.width*scale20)); h=max(2,round(ds20.height*scale20))
        grid20=ds20.transform*Affine.scale(ds20.width/w,ds20.height/h)

        def read10_to20(name,i):
            with WarpedVRT(ds10,crs=ds20.crs,transform=grid20,width=w,height=h,
                           resampling=Resampling.bilinear) as vt:
                return vt.read(bands(ds10,name,i),masked=True).astype(np.float32).filled(np.nan)

        def read20(name,i,how=Resampling.bilinear):
            return ds20.read(bands(ds20,name,i),out_shape=(h,w),
                             resampling=how,masked=True).astype(np.float32).filled(np.nan)

        b2,b3,b4,b8=(read10_to20("B2",1),read10_to20("B3",2),
                     read10_to20("B4",3),read10_to20("B8",4))
        b5,b8a,b11=(read20("B5",1),read20("B8A",4),read20("B11",5))
        scl=read20("SCL",7,Resampling.nearest)
        if not np.isfinite(scl).any():raise ValueError("SCL has no finite pixels")
        good=np.isfinite(scl)&np.isin(scl,SCL_GOOD)&np.isfinite(b2)&np.isfinite(b3)&np.isfinite(b4)&np.isfinite(b8)&np.isfinite(b11)&(b2>0)&(b3>0)&(b4>0)&(b8>0)&(b11>0)
        valid_pixels=int(good.sum())
        if valid_pixels<2:raise ValueError("No SCL-valid pixels available")

        # Use native Sentinel-2 10m samples for RGB; prior preview had resampled
        # the four 10m bands to the 20m grid, making tiny plots appear as 5x7px.
        scale10=min(1.0,MAX_DIM/max(ds10.width,ds10.height))
        w10=max(2,round(ds10.width*scale10));h10=max(2,round(ds10.height*scale10))
        grid10=ds10.transform*Affine.scale(ds10.width/w10,ds10.height/h10)
        def read10_native(name,i):
            return ds10.read(bands(ds10,name,i),out_shape=(h10,w10),
                             resampling=Resampling.bilinear,masked=True).astype(np.float32).filled(np.nan)
        n2,n3,n4,n8=(read10_native("B2",1),read10_native("B3",2),
                     read10_native("B4",3),read10_native("B8",4))
        with WarpedVRT(ds20,crs=ds10.crs,transform=grid10,width=w10,height=h10,
                       resampling=Resampling.nearest) as qa10:
            scl10=qa10.read(bands(ds20,"SCL",7),masked=True).astype(np.float32).filled(np.nan)
        usable10=(np.isfinite(n2)&np.isfinite(n3)&np.isfinite(n4)&
                  np.isfinite(n8)&np.isin(scl10,SCL_GOOD)&
                  (n2>0)&(n3>0)&(n4>0)&(n8>0))
        native_valid=int(usable10.sum())
        if native_valid<2:
            raise ValueError("Native 10m RGB has no SCL-valid source pixels")
        # Prevent invalid/NoData source pixels from dominating per-band stretching.
        true_image=stretched_rgb([n4,n3,n2],usable10)
        false_image=stretched_rgb([n8,n4,n3],usable10)

        # Radiometric *display* check is separate from the SCL acceptance rule.
        # A large amount of near-white RGB is suspicious, but never proof of cloud.
        plotmask=np.ones((h10,w10),dtype=bool)
        mask_scope="raster_rectangle"
        if geometry4326 is not None:
            try:
                localgeom=transform_geom("EPSG:4326",ds10.crs,geometry4326)
                pm=geometry_mask([localgeom],out_shape=(h10,w10),transform=grid10,invert=True)
                if pm.any():
                    plotmask=pm
                    mask_scope="plot_polygon"
            except Exception as ex:
                print("RGB_PLOT_MASK_WARNING",plot,date,str(ex)[:150],flush=True)
        sample=usable10&plotmask
        rgb_np=np.asarray(true_image)
        near_white=(np.min(rgb_np[...,:3],axis=2)>=235)&sample
        n_sample=int(sample.sum())
        white_pct=round(100*int(near_white.sum())/n_sample,1) if n_sample else None
        # Compute indices ONCE: both map colors and plotted QA statistics
        # derive from the same per-pixel grid, bands and scientific formulas.
        indices={
            "ndvi":index(b8,b4),
            "ndre":index(b8a,b5),
            # B8A variant matches the source TIFF's embedded NDMI band.
            # Do not mislabel as the conventional B8 / B11 variant.
            "ndmi":index(b8a,b11),
            "ndwi":index(b3,b8),
            "mndwi":index(b3,b11),
            "bsi":index(b11+b4,b8+b2)
        }
        source_formulas={
            "ndvi":"(B8-B4)/(B8+B4)",
            "ndre":"(B8A-B5)/(B8A+B5)",
            "ndmi":"(B8A-B11)/(B8A+B11), B8A variant",
            "ndwi":"(B3-B8)/(B3+B8) McFeeters",
            "mndwi":"(B3-B11)/(B3+B11)",
            "bsi":"((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2))"
        }
        inside20=None
        if geometry4326 is not None:
            try:
                geom20=transform_geom("EPSG:4326",ds20.crs,geometry4326)
                inside20=geometry_mask([geom20],out_shape=(h,w),
                                       transform=grid20,invert=True)
            except Exception as ex:
                print("INDEX_PLOT_MASK_WARNING",plot,date,str(ex)[:150],flush=True)
        if inside20 is None or not inside20.any():
            # No valid polygon = no trustworthy plot-wise index mean;
            # images may still exist for visualization.
            inside20=np.zeros((h,w),dtype=bool)
        index_stats={}
        for mode,a in indices.items():
            eligible=inside20&good&np.isfinite(a)&(a>=-1.001)&(a<=1.001)
            vals=a[eligible]
            index_stats[mode]={
                "formula":source_formulas[mode],
                "sample_pixels":int(vals.size),
                "plot_mean":round(float(np.mean(vals)),5) if vals.size else None,
                "plot_median":round(float(np.median(vals)),5) if vals.size else None,
                "plot_min":round(float(np.min(vals)),5) if vals.size else None,
                "plot_max":round(float(np.max(vals)),5) if vals.size else None
            }
        # The TIFF already includes scientific index bands: cross-check them
        # independently of the legacy nationwide summary and image palette.
        for mode,name,ds in [("ndre","NDRE",ds20),("ndmi","NDMI",ds20),("mndwi","MNDWI",ds20)]:
            if name not in [str(x or "").upper() for x in ds.descriptions]:continue
            stored=ds.read(bands(ds,name,1),out_shape=(h,w),
                           resampling=Resampling.nearest,masked=True).filled(np.nan)
            mask=inside20&good&np.isfinite(indices[mode])&np.isfinite(stored)
            if mask.any():
                delta=indices[mode][mask]-stored[mask]
                index_stats[mode]["source_band_rmse"]=round(float(np.sqrt(np.mean(delta**2))),5)
                index_stats[mode]["source_band_max_abs"]=round(float(np.max(abs(delta))),5)
                index_stats[mode]["embedded_tif_match"] = bool(np.sqrt(np.mean(delta**2))<=0.03)
        mode_images={"true_color":true_image,"false_color":false_image}
        for mode,a in indices.items():
            mode_images[mode]=colorize(a,good,mode)
        output=Path(output);output.mkdir(parents=True,exist_ok=True)
        assets={}
        for mode,img in mode_images.items():
            ext="webp" if mode in ("true_color","false_color") else "png"
            file=output/f"{mode}.{ext}"
            if ext=="webp":img.save(file,"WEBP",quality=90,method=4)
            else:img.save(file,"PNG",optimize=True)
            assets[mode]="./imagery/"+plot+"/"+date+"/"+file.name
        left,bottom,right,top=transform_bounds(ds20.crs,"EPSG:4326",*ds20.bounds,densify_pts=21)
        left10,bottom10,right10,top10=transform_bounds(ds10.crs,"EPSG:4326",*ds10.bounds,densify_pts=21)
        bounds20=[[bottom,left],[top,right]]
        bounds10=[[bottom10,left10],[top10,right10]]
        # This is *not* proof of cloud: flags a suspiciously white visual result.
        rgb_warning=bool(white_pct is not None and white_pct>=30)
        alpha_pct=round(100*(1-n_sample/max(1,int(plotmask.sum()))),1)
        unclassified_n=int(np.count_nonzero((scl10==7)&sample))
        unclassified_pct=round(100*unclassified_n/n_sample,1) if n_sample else None
        raw_rgb_stats={
            name:{"p02":round(float(np.percentile(arr[sample],[2])[0]),1),
                  "median":round(float(np.median(arr[sample])),1),
                  "p98":round(float(np.percentile(arr[sample],[98])[0]),1)}
            for name,arr in [("B4",n4),("B3",n3),("B2",n2)] if n_sample
        }
        return {
            "plot":plot,"date":date,"source":"generated","modes":list(assets),
            "assets":assets,"bounds":bounds20,
            "mode_bounds":{"true_color":bounds10,"false_color":bounds10},
            "mode_dimensions":{"true_color":[w10,h10],"false_color":[w10,h10],
                               "indices_20m":[w,h]},
            "source_bands":"Sentinel-2 B2/B3/B4/B8 native 10m, 20m B5/B8A/B11/SCL",
            "display_grid":"RGB = 10m native source grid; indices = 20m grid, not higher-resolution spectral measurements",
            "source_resolution_m":{"rgb":10,"spectral_index_20m":20},
            "scaling":{"rgb":"fixed 0.01-0.30 reflectance, gamma 0.9, identical across R/G/B; invalid alpha=0",
                       "index":"fixed ramps in code, full -1 to +1 range"},
            "qa_note":"SCL QA from previous PDD analysis; RGB radiometric QC is a separate warning, not a cloud classification",
            "valid_preview_pixels":valid_pixels,"width":w,"height":h,
            "rgb_native_width":w10,"rgb_native_height":h10,
            "rgb_plot_sample_pixels":n_sample,"rgb_quality_scope":mask_scope,
            "rgb_near_white_pct":white_pct,"rgb_invalid_pct":alpha_pct,
            "rgb_unclassified_scl_pct":unclassified_pct,
            "rgb_raw_dn_stats":raw_rgb_stats,
            "rgb_display_warning":rgb_warning,
            "rgb_renderer_version":"mmc-rgb-fixed-reflectance-v2",
            "index_renderer_version":"mmc-index-source-verified-v1",
            "index_stats":index_stats,
            "rgb_quality_note":"Fixed cross-band reflectance display with source-nodata transparency. White or SCL-unclassified areas warrant review, not automatic cloud removal."
        }


def generate_visual_only(ten,output,plot,date,geometry4326=None):
    """Display actual native RGB for non-QA scenes, including clouds.

    Only source NoData is transparent.  Never create index layers, analytical
    classification, or claim cloud/scene quality approval from these pixels.
    """
    from rasterio.features import geometry_mask
    from rasterio.warp import transform_geom
    with rio_open(ten) as ds:
        if not ds.crs or ds.count<4:
            raise ValueError("No source CRS or four 10m bands")
        scale=min(1.0,MAX_DIM/max(ds.width,ds.height))
        w=max(2,round(ds.width*scale));h=max(2,round(ds.height*scale))
        transform10=ds.transform*Affine.scale(ds.width/w,ds.height/h)
        def read(name,i):
            return ds.read(bands(ds,name,i),out_shape=(h,w),
                    resampling=Resampling.bilinear,masked=True).astype(np.float32).filled(np.nan)
        b2,b3,b4,b8=(read("B2",1),read("B3",2),read("B4",3),read("B8",4))
        visible=(np.isfinite(b2)&np.isfinite(b3)&np.isfinite(b4)&np.isfinite(b8)&
                 (b2>0)&(b3>0)&(b4>0)&(b8>0))
        if visible.sum()<2:
            raise ValueError("No finite four-band RGB pixels in original 10m TIFF")
        plotmask=np.ones((h,w),dtype=bool)
        mask_scope="raster_rectangle"
        if geometry4326:
            local=transform_geom("EPSG:4326",ds.crs,geometry4326)
            p=geometry_mask([local],out_shape=(h,w),transform=transform10,invert=True)
            if p.any():plotmask=p;mask_scope="plot_polygon"
        sample=visible&plotmask
        rgb=stretched_rgb([b4,b3,b2],visible)
        false=stretched_rgb([b8,b4,b3],visible)
        n=int(sample.sum())
        near_white=int(np.count_nonzero((np.min(np.asarray(rgb)[...,:3],axis=2)>=235)&sample))
        white_pct=round(100*near_white/n,1) if n else None
        invalid_pct=round(100*(1-n/max(1,int(plotmask.sum()))),1)
        out=Path(output);out.mkdir(parents=True,exist_ok=True)
        files={}
        for mode,image in [("true_color",rgb),("false_color",false)]:
            name=mode+".webp";image.save(out/name,"WEBP",quality=90,method=4)
            files[mode]="./imagery/"+plot+"/"+date+"/"+name
        left,bottom,right,top=transform_bounds(ds.crs,"EPSG:4326",*ds.bounds,densify_pts=21)
        bounds=[[bottom,left],[top,right]]
        return {
            "plot":plot,"date":date,"source":"generated",
            "preview_kind":"VISUAL_ONLY_NON_QA",
            "modes":["true_color","false_color"],"assets":files,
            "bounds":bounds,"mode_bounds":{"true_color":bounds,"false_color":bounds},
            "mode_dimensions":{"true_color":[w,h],"false_color":[w,h]},
            "rgb_native_width":w,"rgb_native_height":h,"width":w,"height":h,
            "source_resolution_m":{"rgb":10},
            "rgb_renderer_version":"mmc-rgb-fixed-reflectance-v2",
            "rgb_visual_only_version":"mmc-visual-only-cloud-preserved-v1",
            "rgb_quality_scope":mask_scope,"rgb_plot_sample_pixels":n,
            "rgb_near_white_pct":white_pct,"rgb_invalid_pct":invalid_pct,
            "rgb_unclassified_scl_pct":None,
            "rgb_display_warning":bool(white_pct is not None and white_pct>=30),
            "index_stats":{},"index_parity":{},"index_parity_warnings":[],
            "display_grid":"Original 10m RGB grid; may include clouds, haze and water",
            "qa_note":"DISPLAY_ONLY: NO_DATA/PARTIAL; clouds visible, only NoData transparent; no index interpretation",
            "source_bands":"Original Sentinel-2 10m B2/B3/B4/B8"
        }


def candidates_from_result(result,plot):
    """Render every individually QA-valid Sentinel-2 scene, not only first/latest.

    Missing/no-data dates must NOT be synthesized. De-duplicate acquisitions by
    plot/date so the manifest corresponds to actual TIFF dates.
    """
    valid=[x for x in result["scenes"] if x["plot"]==plot and x["analysis_status"]=="AUTO_VALID"]
    valid.sort(key=lambda x:x["date"])
    dates={}
    for scene in valid:
        dates[scene["date"]]=scene
    return list(dates.values())

def from_folder(gdown,plot,scene,folder_records):
    """Resolve exact 10m and 20m file IDs for an existing analyzed date."""
    target=scene["date"].replace("-","")
    for f in folder_records:
        if f["plot"]!=plot:continue
        files=gdown.download_folder(id=f["folder_id"],output="inventory/"+plot,
                    skip_download=True,quiet=True,use_cookies=False,timeout=45)
        if not files:continue
        groups=defaultdict(dict)
        for obj in files:
            filename=Path(obj.path).name
            z=re.search(r"(20\d{6}).*?_(10m|20m)(?:[_.]|$)",filename,re.I)
            if not z or z.group(1)!=target:continue
            groups[str(Path(obj.path).parent)][z.group(2).lower()]=(obj.id,filename)
        for pair in groups.values():
            if "10m" in pair and "20m" in pair:return (pair["10m"],pair["20m"])
    raise RuntimeError("Matching same-folder date/10m/20m file IDs not found")

def run_shard(args):
    import gdown
    data=json_read(DATA/"nationwide_results.json")
    folder_index=json_read(DATA/"source_plot_folders.json")["folders"]
    canon=json_read(DATA/"pdd_scope_136.json")["plots"]
    plots=sorted([p["code"] for p in canon],key=lambda x:x)
    boundaries=json_read(DATA/"boundaries_pdd_136.geojson")
    geoms={feat["properties"]["plot"]:feat["geometry"] for feat in boundaries["features"]}
    assigned=[p for i,p in enumerate(plots) if i%args.shards==args.shard]
    previous=json_read(BASE/"docs"/"mangrove-monitoring"/"imagery_manifest.json")
    existing_dates={(entry["plot"],entry["date"]) for entry in
                    previous.get("items",[])+previous.get("generated_items",[])}
    previous_generated={(entry["plot"],entry["date"]):entry for entry in previous.get("generated_items",[])}
    # Existing v1 previews are NOT adequate: some were rendered using
    # per-channel p2/p98, causing white and black artifacts on small rasters.
    renderer_version="mmc-index-source-verified-v1"
    refresh_plots={x.strip() for x in (args.refresh_plots or "").split(",") if x.strip()}
    # Important: plots with old archive previews can have newer QA-valid scene dates.
    # Only skip a *plot-date* that already has an image, not the entire plot.
    out=Path(args.out)
    docs=out/"imagery"
    images=[];errors=[]
    for plot in assigned:
        for scene in candidates_from_result(data,plot):
            date=scene["date"]
            force=plot in refresh_plots or "ALL" in refresh_plots
            old=previous_generated.get((plot,date))
            # Upgrade every QA-valid scene exactly once to the audited renderer.
            # Even archive-backed dates need new proper RGB and alpha masks.
            already_current=bool(old and old.get("index_renderer_version")==renderer_version)
            if already_current and not force:continue
            local=out/"tmp"/plot/date
            local.mkdir(parents=True,exist_ok=True)
            try:
                ids=None
                if scene.get("original_tif10_file_id") and scene.get("original_tif20_file_id"):
                    ids=((scene["original_tif10_file_id"],scene.get("original_tif10","10m.tif")),(scene["original_tif20_file_id"],scene.get("original_tif20","20m.tif")))
                else:
                    ids=from_folder(gdown,plot,scene,folder_index)
                # source file IDs may refer to raw TIFF with large size; never cache in repo
                paths=[]
                for k,(id,filename) in enumerate(ids):
                    path=local/("10m.tif" if k==0 else "20m.tif")
                    got=gdown.download(id=id,output=str(path),quiet=True,timeout=120,retries=3,use_cookies=False)
                    if not got or not path.exists() or path.stat().st_size<1024:
                        raise ValueError("Original TIFF inaccessible: "+filename)
                    paths.append(path)
                entry=generate(paths[0],paths[1],docs/plot/date,plot,date,geoms.get(plot))
                entry["qa_valid_pct"]=scene["qa_valid_pct"]
                parity={}
                for mode,stat in entry["index_stats"].items():
                    reported=scene.get(mode)
                    computed=stat["plot_mean"]
                    if reported is not None and computed is not None:
                        delta=round(float(computed-reported),5)
                        parity[mode]={"published_mean":reported,
                                      "source_mean":computed,
                                      "difference":delta,
                                      "within_0_03":abs(delta)<=0.03}
                entry["index_parity"]=parity
                entry["index_parity_warnings"]=[mode for mode,v in parity.items() if not v["within_0_03"]]
                for mode,stat in entry["index_stats"].items():
                    if stat.get("embedded_tif_match") is False and mode not in entry["index_parity_warnings"]:
                        entry["index_parity_warnings"].append(mode)
                entry["algorithm"]=scene.get("algorithm")
                entry["original_tif10_file_id"]=ids[0][0]
                entry["original_tif20_file_id"]=ids[1][0]
                images.append(entry)
                print("RENDER_OK",plot,date,entry["width"],entry["height"],flush=True)
            except Exception as e:
                errors.append({"plot":plot,"date":date,"error":str(e)[:300]})
                print("RENDER_ERROR",plot,date,str(e)[:150],flush=True)
            finally:
                shutil.rmtree(local,ignore_errors=True)
    json_write(out/"generated_shard.json",{"shard":args.shard,"plots":assigned,"items":images,"errors":errors})
    print("SHARD_END",args.shard,"plots",len(assigned),"image_dates",len(images),"errors",len(errors),flush=True)

def merge(args):
    p=Path(args.parts)
    shards=list(p.glob("shard-*/generated_shard.json"))
    if len(shards)!=args.shards:raise RuntimeError(f"Expected {args.shards} shards, found {len(shards)}")
    base=BASE/"docs"/"mangrove-monitoring"
    manifest=json_read(base/"imagery_manifest.json")
    old={(x["plot"],x["date"]):x for x in manifest.get("generated_items",[])}
    count=0;errors=[]
    for sh in shards:
        payload=json_read(sh)
        for item in payload["items"]:
            key=(item["plot"],item["date"])
            old[key]=item
            plot,date=item["plot"],item["date"]
            src=sh.parent/"imagery"/plot/date
            dst=base/"imagery"/plot/date
            if not src.is_dir():raise RuntimeError("Missing generated RGB/index assets for "+plot+" "+date)
            dst.mkdir(parents=True,exist_ok=True)
            for path in src.iterdir():
                shutil.copy2(path,dst/path.name)
            count+=1
        errors.extend(payload["errors"])
    if count<1:
        if errors:raise RuntimeError("No new imagery was rendered; inspect Drive/source errors")
        print("RENDER_NOOP_ALL_EXISTING_PREVIEWS_CURRENT",flush=True)
        return
    manifest["generated_items"]=list(old.values())
    manifest["render_status"]={
        "rendered_image_dates":count,
        "generated_plot_count":len({x["plot"] for x in old.values()}),
        "new_errors":len(errors),
        "preserved_existing_19_plots":True,
        "product_note":"Original Sentinel-2 10m/20m GeoTIFF via matching Drive IDs; render QA-valid dates only"
    }
    json_write(base/"imagery_manifest.json",manifest)
    json_write(base/"imagery_render_errors.json",{"errors":errors})
    print("MERGED_IMAGE_DATES",count,"GENERATED_PLOTS",manifest["render_status"]["generated_plot_count"],"ERRORS",len(errors),flush=True)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    cmd=parser.add_subparsers(dest="cmd",required=True)
    a=cmd.add_parser("render")
    a.add_argument("--shard",type=int,required=True);a.add_argument("--shards",type=int,default=8);a.add_argument("--out",required=True)
    a.add_argument("--refresh-plots",default="",help="Force regeneration of QA-valid dates for comma-separated plot IDs")
    b=cmd.add_parser("merge")
    b.add_argument("--shards",type=int,default=8);b.add_argument("--parts",required=True)
    args=parser.parse_args()
    (run_shard if args.cmd=="render" else merge)(args)
