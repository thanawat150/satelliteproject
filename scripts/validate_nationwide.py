#!/usr/bin/env python3
"""Check published canonical PDD scope and full-process batch data (no hidden approximations)."""
import json,math
from pathlib import Path
D=Path(__file__).resolve().parents[1]/'docs'/'data'/'nationwide'
def data(n):return json.loads((D/n).read_text(encoding='utf-8'))
geo=data('boundaries_pdd_136.geojson');scope=data('pdd_scope_136.json')
s=data('batch_01_results.json');foot=data('batch_01_features.geojson');pre=data('batch_01_previews.json')
keys=[f['properties']['plot'] for f in geo['features']]
assert len(keys)==len(set(keys))==136,'Expected 136 canonical distinct PDD polygons'
assert all(f['properties']['source_group'] in ('MOC_1','MOC_2','Standard') for f in geo['features'])
assert scope['requested_target_count']==136 and len(scope['plots'])==136
assert len(scope['batches'])==14 and len(scope['batches'][-1]['plots'])==6
queued=[p for b in scope['batches'] for p in b['plots']]
assert len(queued)==136 and len(set(queued))==136 and set(queued)==set(keys),'Missing or duplicate plots in queue'
assert len(s['plots'])==10 and set(s['plots'])==set(scope['batches'][0]['plots'])
assert len(s['scenes'])==20 and all(r['plot'] in s['plots'] for r in s['scenes'])
good=[r for r in s['scenes'] if r['analysis_status']=='AUTO_VALID']
bad=[r for r in s['scenes'] if r['analysis_status']=='NO_DATA']
assert len(good)==13 and len(bad)==7
for r in s['scenes']:
 assert 0<=r['qa_valid_pct']<=100
 assert r['original_tif10'] and r['original_tif20']
 if r['analysis_status']=='AUTO_VALID':
  assert r['qa_valid_pct']>=70 and r['water_rai'] is not None
  for k in ('ndvi','ndre','ndmi','mndwi','ndwi','bsi','savi','evi','gli'):
   assert r[k] is not None and math.isfinite(r[k]),(r['plot'],r['date'],k)
 if r['analysis_status']=='NO_DATA':
  assert r['qa_valid_pct']<20 and r['water_rai'] is None and r['bsi'] is None
for f in foot['features']:
 assert f['properties']['plot'] in s['plots']
 assert f['properties']['class'] in ('water','vegetation','bare_soil','wetness')
assert len(pre['images'])==20
assert all(x['src'].startswith('data:image/webp;base64,') for x in pre['images'])
print('NATIONWIDE DATA PASS: 136 canonical plots, 14 batches, 10 completed plots, 20 dates, 13 QA valid, 7 no data, indices + vector layers + real previews')
