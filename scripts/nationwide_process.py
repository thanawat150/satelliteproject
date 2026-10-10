#!/usr/bin/env python3
"""Nationwide forestry/RS batch pipeline. Only original TIFF pixels are used.

Usage: python nationwide_process.py --inputs DIRECTORY --boundaries boundaries_pdd_all.geojson
       --plots 1-VSD 2-VSD ... --output OUTPUT_DIRECTORY
Original GeoTIFF files must contain the 10m B2,B3,B4,B8 and the 20m B5,B8A,B11,
SCL stacks, in the same Sentinel-2 acquisition. Any missing pairing is recorded as
skipped; no missing metric is estimated from image previews.
"""
import argparse,json,hashlib,glob,re,math,base64,io
from pathlib import Path
from datetime import datetime,timezone
from collections import defaultdict
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.features import geometry_mask, shapes
from shapely.geometry import shape,mapping
from shapely.ops import transform,unary_union
from pyproj import Transformer
from PIL import Image

GOOD_SCL=(2,4,5,6,7)
BAD_SCL=(0,1,3,8,9,10,11)
MIN_QA=70
ALG='pdd-full-monitor-v1.3-mndwi-avg-staging'

def safe_index(a,b):
 den=a+b
 with np.errstate(divide='ignore',invalid='ignore'):
  return np.divide(a-b,den,out=np.full(den.shape,np.nan,dtype=np.float32),where=np.isfinite(den)&(np.abs(den)>1.e-8))

def band(ds,name,default=None):
 ds_names=[str(x).upper() if x else '' for x in ds.descriptions]
 pos=(ds_names.index(name.upper())+1) if name.upper() in ds_names else default
 if not pos or pos>ds.count:raise ValueError(f'{name} missing in {ds.name}')
 out=ds.read(pos).astype(np.float32)
 if ds.nodata is not None:out[out==ds.nodata]=np.nan
 out[out==-9999]=np.nan
 return out

def regrid(src,data,dst,how=Resampling.bilinear):
 out=np.full((dst.height,dst.width),np.nan,dtype=np.float32)
 reproject(data,out,src_transform=src.transform,src_crs=src.crs,src_nodata=np.nan,
           dst_transform=dst.transform,dst_crs=dst.crs,dst_nodata=np.nan,resampling=how)
 return out

def mean(a,mask):
 values=a[mask&np.isfinite(a)]
 return round(float(np.mean(values)),5) if values.size else None

def geom_mask_to_shape(mask,ds,inside_geom):
 polygons=[shape(g) for g,v in shapes(mask.astype(np.uint8),mask=mask,transform=ds.transform) if int(v)==1]
 if not polygons:return None
 g=unary_union(polygons)
 if not g.is_valid:g=g.buffer(0)
 try:g=g.intersection(inside_geom)
 except Exception:g=g.buffer(0).intersection(inside_geom.buffer(0))
 return g if not g.is_empty else None

def to_lonlat(geom,source_crs):
 if geom is None:return None
 g=transform(Transformer.from_crs(source_crs,'EPSG:4326',always_xy=True).transform,geom)
 return mapping(g)

def local_preview(ds10,inside_20,ds20,low_res_mask=True):
 try:
  b2,b3,b4=[band(ds10,b,n) for b,n in [('B2',1),('B3',2),('B4',3)]]
  dest=[]
  for source in (b4,b3,b2):
   layer=regrid(ds10,source,ds20)
   v=layer[np.isfinite(layer)&inside_20]
   if v.size<3:v=layer[np.isfinite(layer)]
   if not v.size:return None
   lo,hi=np.percentile(v,[2,98]);hi=max(hi,lo+1)
   dest.append(np.nan_to_num(np.clip((layer-lo)/(hi-lo)*255,0,255),nan=0,posinf=0,neginf=0).astype(np.uint8))
  rgba=np.stack([*dest,(inside_20.astype('uint8')*255)],axis=-1)
  im=Image.fromarray(rgba,'RGBA')
  im.thumbnail((420,420))
  out=io.BytesIO();im.save(out,'WEBP',quality=78)
  return 'data:image/webp;base64,'+base64.b64encode(out.getvalue()).decode()
 except Exception:return None

def prepare_input_files(root,plots):
 out=defaultdict(dict)
 for f in root.rglob('*.tif*'):
  if not f.is_file():continue
  m=re.search(r'(\d+(?:\(1\))?-(?:VSD|STC)).*?(20\d{6}).*?_(10m|20m)(?:_|\.)',f.name,re.I)
  if not m:continue
  plot,date,res=m.groups();date=f'{date[:4]}-{date[4:6]}-{date[6:8]}'
  if plot not in plots:continue
  key=(plot,date)
  if res in out[key]:
   # Prefer non-empty original TIFF, reject ambiguous duplicate if equal sized but different.
   if f.stat().st_size<out[key][res].stat().st_size:continue
  out[key][res]=f
 return out

def one_scene(plot,date,files,geom_ll,meta):
 f10,f20=files['10m'],files['20m']
 with rasterio.open(f10) as ds10,rasterio.open(f20) as ds20:
  if not ds10.crs or not ds20.crs:raise ValueError('missing GeoTIFF CRS')
  clip=transform(Transformer.from_crs('EPSG:4326',ds20.crs,always_xy=True).transform,geom_ll)
  if not clip.is_valid:clip=clip.buffer(0)
  inside=geometry_mask([mapping(clip)],transform=ds20.transform,out_shape=(ds20.height,ds20.width),invert=True,all_touched=False)
  if not inside.any():raise ValueError('PDD shape is outside this raster; inspect source scene')
  scl=band(ds20,'SCL',7)
  b2=regrid(ds10,band(ds10,'B2',1),ds20)
  b3=regrid(ds10,band(ds10,'B3',2),ds20)
  b4=regrid(ds10,band(ds10,'B4',3),ds20)
  b8=regrid(ds10,band(ds10,'B8',4),ds20)
  b5=band(ds20,'B5',1)
  b8a=band(ds20,'B8A',4)
  b11=band(ds20,'B11',5)
  ndvi=safe_index(b8,b4)
  ndre=safe_index(b8a,b5)
  ndmi=safe_index(b8a,b11)
  mndwi=safe_index(regrid(ds10,band(ds10,'B3',2),ds20,how=Resampling.average),b11)
  ndwi=safe_index(b3,b8)
  bsi=safe_index(b11+b4,b8+b2)
  savi=np.divide(1.5*(b8-b4),(b8+b4+0.5*10000),out=np.full_like(b8,np.nan),where=np.isfinite(b8+b4))
  r,g,blue,nir=b4/10000,b3/10000,b2/10000,b8/10000
  evi=np.divide(2.5*(nir-r),nir+6*r-7.5*blue+1,out=np.full_like(nir,np.nan),where=np.isfinite(nir+6*r-7.5*blue+1)&(np.abs(nir+6*r-7.5*blue+1)>1e-6))
  gli=np.divide(2*g-r-blue,2*g+r+blue,out=np.full_like(g,np.nan),where=np.isfinite(g)&np.isfinite(r)&np.isfinite(blue)&(np.abs(2*g+r+blue)>1e-6))
  clear=inside&np.isin(scl,GOOD_SCL)&np.isfinite(mndwi)&(np.abs(mndwi)<=1.05)&np.isfinite(b2)&np.isfinite(b4)&np.isfinite(b8)&np.isfinite(b11)
  total_pixels=int(inside.sum());valid_pixels=int(clear.sum());valid_pct=100*valid_pixels/total_pixels
  qual='AUTO_VALID' if valid_pct>=70 else 'PARTIAL' if valid_pct>=20 else 'NO_DATA'
  water=clear&(mndwi>0)
  veg=clear&~water&(ndvi>=0.35)
  soil=clear&~water&~veg&(bsi>0)&(ndvi<0.25)
  other=clear&~water&~veg&~soil
  wet=clear&(ndmi>0.3)
  # Clip each land-cover class consistently to the actual PDD polygon.
  # A full pixel near a boundary must not be counted as an entire in-plot pixel.
  class_masks={'water':water,'vegetation':veg,'bare_soil':soil,'other':other,'wetness':wet}
  class_geoms={name:geom_mask_to_shape(mask,ds20,clip) for name,mask in class_masks.items()}
  class_areas={name:round((g.area if g is not None else 0)/1600,3) for name,g in class_geoms.items()}
  clear_geom=geom_mask_to_shape(clear,ds20,clip)
  usable_area_rai=round((clear_geom.area if clear_geom is not None else 0)/1600,3)
  water_area=class_areas['water']
  area_total=clip.area/1600
  cell_rai=abs(ds20.transform.a*ds20.transform.e)/1600
  indices=dict(ndvi=mean(ndvi,clear),ndre=mean(ndre,clear),ndmi=mean(ndmi,clear),mndwi=mean(mndwi,clear),ndwi=mean(ndwi,clear),bsi=mean(bsi,clear),savi=mean(savi,clear),evi=mean(evi,clear),gli=mean(gli,clear))
  categories={'water':int(water.sum()),'vegetation':int(veg.sum()),'bare_soil':int(soil.sum()),'other':int(other.sum()),'wetness':int(wet.sum())}
  row=dict(plot=plot,province=meta['province'],date=date,status=qual,analysis_status=qual,qa_valid_pct=round(valid_pct,2),usable_pixels=valid_pixels,total_pixels=total_pixels,pdd_area_rai=round(area_total,4),original_tif10=f10.name,original_tif20=f20.name,algorithm=ALG,qa_rule='SCL 2,4,5,6,7; require finite original B2 B4 B8 B11 and MNDWI',classification_rule='water MNDWI>0 (B3 averaged to 20m); veg NDVI>=0.35 and not water; soil BSI>0 and NDVI<0.25 and not water/veg')
  row.update(indices if qual=='AUTO_VALID' else {k:None for k in indices})
  row.update({'partial_indices':indices if qual=='PARTIAL' else None})
  row.update({k+'_rai':class_areas[k] if qual=='AUTO_VALID' else None for k in categories})
  row['observed_area_rai_partial']=water_area if qual=='PARTIAL' else None
  row['water_rai']=water_area if qual=='AUTO_VALID' else None
  row['water_pct']=round(100*water_area/area_total,2) if qual=='AUTO_VALID' and area_total>0 else None
  # Water, vegetation, soil, other are mutually exclusive; wetness overlaps.
  row['qa_usable_area_rai']=usable_area_rai
  row['class_area_sum_rai']=round(sum(class_areas[k] for k in ('water','vegetation','bare_soil','other')),3) if qual=='AUTO_VALID' else None
  row['area_balance_error_rai']=round(row['class_area_sum_rai']-usable_area_rai,3) if qual=='AUTO_VALID' else None
  # The polygons are per-date observations, not automatically verified flooding.
  features=[]
  for cls in ('water','vegetation','bare_soil','wetness'):
   g=class_geoms[cls]
   if g is not None:
    features.append(dict(type='Feature',geometry=to_lonlat(g,ds20.crs),properties={'plot':plot,'province':meta['province'],'date':date,'class':cls,'analysis_status':qual,'qa_valid_pct':round(valid_pct,2),'area_rai':round(g.area/1600,3),'source':'original Sentinel-2 GeoTIFF, clipped to native PDD MultiPolygon'}))
  preview=local_preview(ds10,inside,ds20)
  result={'row':row,'features':features,'preview':preview,'boundary_projected':clip,'grid':{'crs':str(ds20.crs),'transform':tuple(ds20.transform)[:6],'height':ds20.height,'width':ds20.width},'arrays':{'valid':clear.astype('uint8'),'water':water.astype('uint8'),'vegetation':veg.astype('uint8'),'bare_soil':soil.astype('uint8')}}
  return result

def aligned_mask(ref,new_grid,key):
 p=ref['grid'];a=ref['arrays'][key]
 out=np.zeros((new_grid['height'],new_grid['width']),dtype='uint8')
 reproject(a,out,src_transform=rasterio.Affine(*p['transform']),src_crs=p['crs'],src_nodata=255,
           dst_transform=rasterio.Affine(*new_grid['transform']),dst_crs=new_grid['crs'],dst_nodata=255,resampling=Resampling.nearest)
 return out.astype(bool)

def clipped_change_area(mask, grid, polygon):
 """Area inside actual plot boundary, not an unweighted full-pixel count."""
 if not np.any(mask):
  return 0.0
 class Grid:
  transform=rasterio.Affine(*grid['transform'])
 grid_shape=Grid()
 geom=geom_mask_to_shape(mask,grid_shape,polygon)
 return (geom.area/1600.0) if geom is not None else 0.0

def change_summary(past,current):
 new=current['arrays'];pre={key:aligned_mask(past,current['grid'],key) for key in past['arrays']}
 overlap=(pre['valid']&new['valid'].astype(bool))
 boundary=current['boundary_projected']
 if past['grid']['crs']!=current['grid']['crs']:
  # Common pixels are in the current-date grid; intersect both boundary versions.
  past_boundary=transform(Transformer.from_crs(past['grid']['crs'],current['grid']['crs'],always_xy=True).transform,past['boundary_projected'])
 else:
  past_boundary=past['boundary_projected']
 boundary=boundary.intersection(past_boundary)
 comparable_area=clipped_change_area(overlap,current['grid'],boundary)
 area_pdd=boundary.area/1600.0 if not boundary.is_empty else 0.0
 data={'date_a':past['row']['date'],'date_b':current['row']['date'],
       'common_clear_pixels':int(overlap.sum()),'common_clear_rai':round(comparable_area,3),
       'common_clear_pct_of_plot':round(100*comparable_area/area_pdd,2) if area_pdd else 0,
       'area_method':'polygon-clipped common valid mask on current 20m grid',
       'tide_normalized':False,'season_normalized':False,
       'interpretation':'SCREENING_ONLY_NO_TIDAL_OR_FIELD_VALIDATION'}
 if not overlap.any() or comparable_area<=0:return {**data,'status':'NO_COMPARABLE_CLEAR_PIXELS'}
 for name in ['water','vegetation','bare_soil']:
  a=pre[name]&overlap;b=new[name].astype(bool)&overlap
  new_area=clipped_change_area(~a&b&overlap,current['grid'],boundary)
  lost_area=clipped_change_area(a&~b&overlap,current['grid'],boundary)
  data[name+'_new_rai']=round(new_area,3)
  data[name+'_lost_rai']=round(lost_area,3)
  data[name+'_net_change_rai']=round(new_area-lost_area,3)
 data['comparison_review']='SMALL_OVERLAP_REVIEW' if data['common_clear_pct_of_plot']<50 or int(overlap.sum())<30 else 'TIDE_SEASON_FIELD_REVIEW'
 data['status']='AUTO_VALID' if min(past['row']['qa_valid_pct'],current['row']['qa_valid_pct'])>=70 else 'PARTIAL'
 return data

def run(boundaries,filesdir,plots,outputdir):
 b=json.loads(Path(boundaries).read_text(encoding='utf8'))
 fs={f['properties']['plot']:f for f in b['features']}
 files=prepare_input_files(Path(filesdir),set(plots))
 result={'algorithm':ALG,'source':'Original Sentinel-2 L2A 10m+20m GeoTIFF / PDD MultiPolygon','generated_at':datetime.now(timezone.utc).isoformat(),'batch_size':len(plots),'plots':{},'scenes':[],'changes':[],'errors':[]}
 geometries=[];previews=[]
 for plot in plots:
  if plot not in fs:
   result['errors'].append({'plot':plot,'error':'No native PDD polygon'});continue
  source=fs[plot];geom=shape(source['geometry']);items=[]
  available=sorted(((date,scenes) for (p,date),scenes in files.items() if p==plot),key=lambda x:x[0]);valid_pairs=[]
  for date,scene in available:
   if '10m' not in scene or '20m' not in scene:
    result['errors'].append({'plot':plot,'date':date,'error':'Missing 10m/20m pair'});continue
   try:
    item=one_scene(plot,date,scene,geom,source['properties'])
    result['scenes'].append(item['row']);items.append(item)
    geometries.extend(item['features'])
    if item['preview']:previews.append({'plot':plot,'province':source['properties']['province'],'date':date,'resolution':'20m clip from true-color 10m bands','src':item['preview']})
    print(plot,date,item['row']['status'],'QA',item['row']['qa_valid_pct'],'water_rai',item['row']['water_rai'],'NDVI',item['row']['ndvi'],'BSI',item['row']['bsi'],flush=True)
   except Exception as e:
    result['errors'].append({'plot':plot,'date':date,'error':str(e)});print('ERROR',plot,date,e,flush=True)
  # Pair consecutive QA-valid observations, even if cloudy/NO_DATA dates
  # intervene in the calendar. Never synthesize pixel-level changes from means.
  qa_items=[item for item in items if item['row']['status']=='AUTO_VALID']
  for a,b in zip(qa_items,qa_items[1:]):
   result['changes'].append({'plot':plot,'province':source['properties']['province'],**change_summary(a,b)})
  result['plots'][plot]={'province':source['properties']['province'],'pdd_geometry_parts':source['properties']['geometry_parts'],'pdd_area_rai':source['properties']['geometry_area_rai'],'selected_dates':[x['row']['date'] for x in items],'completed_dates':len(items),'qa_valid_dates':sum(x['row']['status']=='AUTO_VALID' for x in items),'processing_status':'DONE' if items else 'NO_SOURCE_SCENES'}
 result['totals']={'target_plots':len(plots),'plots_with_source_scenes':sum(v['completed_dates']>0 for v in result['plots'].values()),'processed_dates':len(result['scenes']),'qa_valid_dates':sum(x['status']=='AUTO_VALID' for x in result['scenes']),'partial_dates':sum(x['status']=='PARTIAL' for x in result['scenes']),'no_data_dates':sum(x['status']=='NO_DATA' for x in result['scenes']),'date_changes':len(result['changes']),'errors':len(result['errors'])}
 outputdir=Path(outputdir);outputdir.mkdir(parents=True,exist_ok=True)
 for name,value in [('results.json',result),('features.geojson',{'type':'FeatureCollection','features':geometries}),('previews.json',{'images':previews})]:
  (outputdir/name).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf8')
 print('TOTAL',result['totals']);print('OUTPUT',str(outputdir))
 return result

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--inputs',required=True);parser.add_argument('--boundaries',required=True);parser.add_argument('--output',required=True);parser.add_argument('--plots',nargs='+',required=True)
 args=parser.parse_args();run(args.boundaries,args.inputs,args.plots,args.output)
