"""Select the canonical 136 PDD plots: MOC 1, MOC 2, Standard, excluding new MOC 3."""
import json,collections,glob
from pathlib import Path
import fiona
from shapely.geometry import shape,mapping
from shapely.ops import transform
from pyproj import Transformer
from datetime import datetime,timezone

SOURCE=Path('/mnt/data/moc_work/MOC')
OUT=Path('/mnt/data/nationwide_work')
source_layers={'MOC_1.shp','MOC_2.shp','Standard.shp'}
features=[]
for path in sorted(glob.glob(str(SOURCE/'**/*.shp'),recursive=True)):
 p=Path(path)
 if p.name not in source_layers or 'Shapefile' not in p.parts or 'Point' in str(p) or not ('STC PDD/' in str(p) or 'VSD PDD/' in str(p)):continue
 with fiona.open(p) as src:
  for ft in src:
   prop=dict(ft['properties'])
   code=prop.get('Code_Name') or prop.get('Name_Code')
   province=prop.get('Province')
   if not code or not province:continue
   code=str(code).strip();province=str(province).strip()
   g=shape(ft['geometry'])
   if not g.is_valid:g=g.buffer(0)
   crs=src.crs.to_string()
   geo=transform(Transformer.from_crs(crs,'EPSG:4326',always_xy=True).transform,g)
   try:area=float(str(prop.get('Area_rai') or prop.get('Area_Rai')).replace(',',''))
   except:area=None
   features.append(dict(type='Feature',geometry=mapping(geo),properties=dict(plot=code,province=province,source_group=p.name.removesuffix('.shp'),source_path=str(p.relative_to(SOURCE)),source_crs=crs,pdd_area_rai=area,geometry_area_rai=round(g.area/1600,4),geometry_parts=len(g.geoms) if g.geom_type=='MultiPolygon' else 1,boundary_role='primary',pdd_verified_geometry=True)))
ids=[f['properties']['plot'] for f in features]
if len(features)!=136 or len(set(ids))!=136:raise RuntimeError('Expected exactly 136 unique MOC 1+2+Standard PDD plots; got '+str(len(features))+' unique '+str(len(set(ids))))
features.sort(key=lambda f:(f['properties']['province'],f['properties']['plot']))
fc={'type':'FeatureCollection','name':'Canonical 136 PDD plots MOC1+MOC2+Standard','source':'Native MOC.zip PDD shapefiles excluding MOC3','features':features}
(OUT/'boundaries_pdd_136.geojson').write_text(json.dumps(fc,ensure_ascii=False,separators=(',',':')),encoding='utf8')
first=[f'{i}-VSD' for i in range(1,9)]+['13-STC','14-VSD']
remaining=[f['properties']['plot'] for f in features if f['properties']['plot'] not in first]
assert len(remaining)==126
batches=[{'id':'batch_01','plots':first,'status':'PROCESSED'}]+[{'id':f'batch_{i+2:02d}','plots':remaining[i*10:(i+1)*10],'status':'QUEUED_SOURCE_TIFF_QA'} for i in range((len(remaining)+9)//10)]
cohort={'requested_target_count':136,'source_plot_count':136,'source_groups':['MOC_1','MOC_2','Standard'],'excluded_incremental_group':'MOC_3','excluded_candidate_count':23,'geometry_role':'PDD MultiPolygon primary','generated_at':datetime.now(timezone.utc).isoformat(),'plots':[dict(code=f['properties']['plot'],province=f['properties']['province'],source=f['properties']['source_path'],geometry_parts=f['properties']['geometry_parts']) for f in features],'batches':batches}
(OUT/'pdd_scope_136.json').write_text(json.dumps(cohort,ensure_ascii=False,indent=2),encoding='utf8')
print('Canonical',len(features),'total batches',len(batches),'remaining',len(remaining))
for b in batches:print(b['id'],len(b['plots']),b['plots'][:3],b['status'])
