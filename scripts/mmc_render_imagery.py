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
    out=[]
    for x in channels:
        values=x[np.isfinite(x)&valid_mask]
        if values.size<16:values=x[np.isfinite(x)]
        if values.size<16:raise ValueError("Image bands contain insufficient real pixels")
        lo,hi=np.percentile(values,[2,98]);hi=max(lo+1e-5,hi)
        out.append(np.clip((x-lo)/(hi-lo)*255,0,255).astype(np.uint8))
    return Image.fromarray(np.stack(out,axis=2),'RGB')

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

def generate(ten,twenty,output,plot,date):
    with rio_open(ten) as ds10,rio_open(twenty) as ds20:
        if ds10.crs is None or ds20.crs is None:raise ValueError("Source TIFF has no CRS")
        if ds10.count<4 or ds20.count<7:raise ValueError("Input TIFF missing required bands")
        scale=min(1.0,MAX_DIM/max(ds20.width,ds20.height))
        w=max(2,round(ds20.width*scale));h=max(2,round(ds20.height*scale))
        target=ds20.transform*Affine.scale(ds20.width/w,ds20.height/h)
        def read10(name,i):
            with WarpedVRT(ds10,crs=ds20.crs,transform=target,width=w,height=h,resampling=Resampling.bilinear) as vt:
                return vt.read(bands(ds10,name,i),masked=False).astype(np.float32)
        def read20(name,i,how=Resampling.bilinear):
            return ds20.read(bands(ds20,name,i),out_shape=(h,w),resampling=how).astype(np.float32)
        b2,b3,b4,b8=(read10("B2",1),read10("B3",2),read10("B4",3),read10("B8",4))
        b5,b8a,b11=(read20("B5",1),read20("B8A",4),read20("B11",5))
        scl=read20("SCL",7,Resampling.nearest)
        if not np.isfinite(scl).any():raise ValueError("SCL has no finite pixels")
        good=np.isfinite(scl)&np.isin(scl,SCL_GOOD)&np.isfinite(b2)&np.isfinite(b3)&np.isfinite(b4)&np.isfinite(b8)&np.isfinite(b11)
        valid_pixels=int(good.sum())
        if valid_pixels<2:raise ValueError("No SCL-valid pixels available")
        mode_images={
            "true_color":stretched_rgb([b4,b3,b2],good),
            "false_color":stretched_rgb([b8,b4,b3],good),
            "ndvi":colorize(index(b8,b4),good,"ndvi"),
            "ndre":colorize(index(b8a,b5),good,"ndre"),
            "ndmi":colorize(index(b8a,b11),good,"ndmi"),
            "ndwi":colorize(index(b3,b8),good,"ndwi"),
            "mndwi":colorize(index(b3,b11),good,"mndwi"),
            "bsi":colorize(index(b11+b4,b8+b2),good,"bsi")
        }
        output=Path(output);output.mkdir(parents=True,exist_ok=True)
        assets={}
        for mode,img in mode_images.items():
            ext="webp" if mode in ("true_color","false_color") else "png"
            f=output/f"{mode}.{ext}"
            if ext=="webp":img.save(f,"WEBP",quality=85,method=4)
            else:img.save(f,"PNG",optimize=True)
            assets[mode]="./imagery/"+plot+"/"+date+"/"+f.name
        left,bottom,right,top=transform_bounds(ds20.crs,"EPSG:4326",*ds20.bounds,densify_pts=21)
        return {
            "plot":plot,"date":date,"source":"generated","modes":list(assets),
            "assets":assets,"bounds":[[bottom,left],[top,right]],
            "source_bands":"Sentinel-2 B2/B3/B4/B8 native 10m, 20m B5/B8A/B11/SCL",
            "display_grid":"20m-georeferenced preview grid; true/false-color 10m source bands reprojected for overlay",
            "source_resolution_m":{"rgb":10,"spectral_index_20m":20},
            "scaling":{"rgb":"per-scene p2–p98 on valid pixel mask","index":"fixed ramps in code; full -1 to +1 range"},
            "qa_note":"Input date is AUTO_VALID in previous PDD analysis; maps include transparent invalid SCL pixels; preview-only not certification",
            "valid_preview_pixels":valid_pixels,"width":w,"height":h
        }

def candidates_from_result(result,plot):
    valid=[x for x in result["scenes"] if x["plot"]==plot and x["analysis_status"]=="AUTO_VALID"]
    valid.sort(key=lambda x:x["date"])
    if not valid:return []
    # At most earliest + latest; before-after is meaningful only with plot-level QA.
    take=[valid[0]]
    if valid[-1]["date"]!=valid[0]["date"]:take.append(valid[-1])
    return take

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
    assigned=[p for i,p in enumerate(plots) if i%args.shards==args.shard]
    previous=json_read(BASE/"docs"/"mangrove-monitoring"/"imagery_manifest.json")
    existing_dates={(entry["plot"],entry["date"]) for entry in
                    previous.get("items",[])+previous.get("generated_items",[])}
    # Important: plots with old archive previews can have newer QA-valid scene dates.
    # Only skip a *plot-date* that already has an image, not the entire plot.
    out=Path(args.out)
    docs=out/"imagery"
    images=[];errors=[]
    for plot in assigned:
        for scene in candidates_from_result(data,plot):
            date=scene["date"]
            if (plot,date) in existing_dates:continue
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
                entry=generate(paths[0],paths[1],docs/plot/date,plot,date)
                entry["qa_valid_pct"]=scene["qa_valid_pct"]
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
    if count<1:raise RuntimeError("Zero new rendered satellite imagery; not publishing empty products")
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
    b=cmd.add_parser("merge")
    b.add_argument("--shards",type=int,default=8);b.add_argument("--parts",required=True)
    args=parser.parse_args()
    (run_shard if args.cmd=="render" else merge)(args)
