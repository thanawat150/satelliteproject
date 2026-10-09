import json,glob,re,collections
from pathlib import Path
import fiona
from shapely.geometry import shape,mapping,MultiPolygon,Polygon
from shapely.ops import transform
from pyproj import Transformer

MOC=Path('/mnt/data/moc_work/MOC')
OUTPUT=Path('/mnt/data/nationwide_work');OUTPUT.mkdir(exist_ok=True)
files=[]
for path in glob.glob(str(MOC/'**/*.shp'),recursive=True):
 p=Path(path)
 if 'Shapefile' not in p.parts or 'Point' in str(p) or not ('STC PDD' in str(p) or 'VSD PDD' in str(p)) or '/VSD PDD/' not in str(p) and '/STC PDD/' not in str(p):continue
 files.append(p)

choices=collections.defaultdict(list)
for file in files:
 with fiona.open(file) as src:
  crs=src.crs.to_string()
  for ft in src:
   props=dict(ft['properties'])
   code=props.get('Code_Name') or props.get('Name_Code')
   prov=props.get('Province')
   if not code or not prov:continue
   geom=shape(ft['geometry'])
   if geom.is_empty:continue
   if not geom.is_valid:geom=geom.buffer(0)
   declared=props.get('Area_rai') or props.get('Area_Rai')
   try:declared=float(str(declared).replace(',',''))
   except:declared=None
   filebase=file.name.lower()
   # The source collection has old and revised copies: record all, never silently merge.
   is_revision=('ใช้งาน' in file.stem or 'ใหม่' in file.stem)
   standard=('Standard' in file.stem)
   mocnum=re.search(r'(?i)(?:MOC[_ ]?)(\d)',file.stem)
   rank=(10 if is_revision else 0)+(2 if standard else 0)+(int(mocnum.group(1)) if mocnum else 0)
   choices[(str(code).strip(),str(prov).strip())].append(dict(geom=geom,crs=crs,source=str(file.relative_to(MOC)),declared=declared,rank=rank))

features=[];inventory=[]
for (code,prov),opts in sorted(choices.items(),key=lambda kv:(kv[0][1],kv[0][0])):
 chosen=sorted(opts,key=lambda x:x['rank'],reverse=True)[0]
 g=chosen['geom'];conv=Transformer.from_crs(chosen['crs'],'EPSG:4326',always_xy=True)
 lonlat=transform(conv.transform,g)
 f={'type':'Feature','geometry':mapping(lonlat),'properties':{'plot':code,'province':prov,'pdd_area_rai':chosen['declared'],'geometry_area_rai':round(g.area/1600,4),'boundary_source':'MOC.zip native PDD shapefile','source_path':chosen['source'],'source_crs':chosen['crs'],'geometry_parts':len(g.geoms) if g.geom_type=='MultiPolygon' else 1,'boundary_role':'primary','pdd_verified_geometry':True}}
 features.append(f)
 variants=[{'source_path':o['source'],'area_rai':round(o['geom'].area/1600,4)} for o in opts]
 inventory.append(dict(plot=code,province=prov,selected_source=chosen['source'],versions=variants,geometry_parts=f['properties']['geometry_parts']))

with (OUTPUT/'boundaries_pdd_all.geojson').open('w') as w:json.dump({'type':'FeatureCollection','name':'MOC PDD candidate pool 159','features':features},w,ensure_ascii=False,separators=(',',':'))
with (OUTPUT/'pdd_source_inventory.json').open('w') as w:json.dump({'source':'MOC.zip','candidate_count':len(features),'requested_scope_count':136,'scope_status':'CANDIDATES_PENDING_136_MASTER_LIST_RECONCILIATION','plots':inventory},w,ensure_ascii=False,indent=2)
print('PDD source geometries',len(features),'candidate formats',(set(f['geometry']['type'] for f in features)))
print('source geometry file bytes',(OUTPUT/'boundaries_pdd_all.geojson').stat().st_size)
print('10 pilot plots:')
for n in [f'{i}-VSD' for i in range(1,9)]+['13-STC','14-VSD']:
 f=next((f for f in features if f['properties']['plot']==n),None)
 print(n, f['properties']['province'] if f else 'MISSING',f['properties']['geometry_parts'] if f else '',f['properties']['source_crs'] if f else '')
