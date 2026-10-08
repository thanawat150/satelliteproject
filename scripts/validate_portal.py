#!/usr/bin/env python3
import json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
plots=json.loads((ROOT/"docs/data/plots.json").read_text(encoding="utf-8"))
bounds=json.loads((ROOT/"docs/data/boundaries.geojson").read_text(encoding="utf-8"))
new_water=json.loads((ROOT/"docs/data/new_water.geojson").read_text(encoding="utf-8"))
sat_parts=json.loads((ROOT/"docs/data/satellite_parts.json").read_text(encoding="utf-8"))

errors=[]
items=plots.get("plots",[])
if len(items)!=19:
    errors.append(f"expected 19 plots, got {len(items)}")

allowed={"HIGH","WATCH","NORMAL","NO_DATA"}
names=[]
for p in items:
    name=p.get("plot")
    names.append(name)
    for key in ("plot","area_rai","status","report_url","lat","lon"):
        if p.get(key) in (None,""):
            errors.append(f"{name}: missing {key}")
    if p.get("status") not in allowed:
        errors.append(f"{name}: invalid status {p.get('status')}")
    if p.get("status")!="NO_DATA":
        for key in ("water_before_pct","water_current_pct","water_change_pp","new_water_rai"):
            if p.get(key) is None:
                errors.append(f"{name}: missing {key}")
if len(set(names))!=len(names):
    errors.append("duplicate plot names in plots.json")

features=bounds.get("features",[])
bnames=[f.get("properties",{}).get("plot") for f in features]
if set(bnames)!=set(names):
    errors.append(f"boundary/plot mismatch: only_data={sorted(set(names)-set(bnames))}, only_boundary={sorted(set(bnames)-set(names))}")
for f in features:
    p=f.get("properties",{})
    name=p.get("plot")
    geom=f.get("geometry") or {}
    if geom.get("type") not in ("Polygon","MultiPolygon"):
        errors.append(f"{name}: boundary is not polygonal ({geom.get('type')})")
    if p.get("boundary_quality")!="verified":
        errors.append(f"{name}: boundary_quality is not verified")
    ga=p.get("geometry_area_rai")
    oa=p.get("area_rai")
    if ga and oa:
        diff=abs(ga-oa)/oa
        if diff>0.01:
            errors.append(f"{name}: geometry area differs from official area by {diff:.2%}")

nw_features=new_water.get("features",[])
nw_names=[f.get("properties",{}).get("plot") for f in nw_features]
if len(set(nw_names))!=len(nw_names):
    errors.append("duplicate plot names in new_water.geojson")
valid_water_names={p["plot"] for p in items if p.get("status")!="NO_DATA" and (p.get("new_water_rai") or 0)>0}
if set(nw_names)!=valid_water_names:
    errors.append(f"new-water mismatch: missing={sorted(valid_water_names-set(nw_names))}, extra={sorted(set(nw_names)-valid_water_names)}")
for f in nw_features:
    p=f.get("properties",{})
    name=p.get("plot")
    geom=f.get("geometry") or {}
    if geom.get("type") not in ("Polygon","MultiPolygon"):
        errors.append(f"{name}: new-water geometry is not polygonal ({geom.get('type')})")
    expected=next((x.get("new_water_rai") for x in items if x.get("plot")==name),None)
    stated=p.get("new_water_rai")
    if expected is not None and stated is not None and abs(float(expected)-float(stated))>0.05:
        errors.append(f"{name}: new-water property differs from plots.json ({stated} vs {expected})")

# Satellite library manifests
sat_files=[]
for part in sat_parts.get("parts",[]):
    part_path=ROOT/"docs/data"/part["file"]
    if not part_path.exists():
        errors.append(f"missing satellite manifest part: {part['file']}")
        continue
    rows=json.loads(part_path.read_text(encoding="utf-8"))
    sat_files.extend(rows)
known=set(names)
sat_ids=set()
for row in sat_files:
    rid=row.get("id")
    if not rid:
        errors.append("satellite row missing id")
    elif rid in sat_ids:
        errors.append(f"duplicate satellite file id: {rid}")
    sat_ids.add(rid)
    if row.get("plot") not in known:
        errors.append(f"satellite row references unknown plot: {row.get('plot')}")
    if not row.get("date"):
        errors.append(f"{row.get('plot')}: satellite row missing date")
    if not row.get("url") or not row.get("preview_url"):
        errors.append(f"{row.get('plot')}: satellite row missing Drive URL")

# Existing TIFF gallery: every listed source file must have a browser-ready WebP.
display_ready=0
for i, part in enumerate(sat_parts.get("parts",[]), start=1):
    display_path=ROOT/"docs/data"/f"existing_display_part_{i}.json"
    if not display_path.exists():
        errors.append(f"Missing image previews for satellite part {i}")
        continue
    previews=json.loads(display_path.read_text(encoding="utf-8")).get("files",{})
    source_path=ROOT/"docs/data"/part["file"]
    if not source_path.exists():
        continue
    for row in json.loads(source_path.read_text(encoding="utf-8")):
        name=row.get("title")
        image=previews.get(name,{})
        if not image.get("src","").startswith("data:image/webp;base64,"):
            errors.append(f"Missing image preview: {name}")
        elif image.get("kind") is None or not image.get("width") or not image.get("height"):
            errors.append(f"Invalid image metadata: {name}")
        else:
            display_ready+=1

# Full-resolution display layers generated from source GeoTIFFs.
full_layers=[]
for i in range(1,11):
    pth=ROOT/"docs/data"/f"full_preview_part_{i}.json"
    if not pth.exists():
        errors.append(f"Missing full preview layer part {i}")
        continue
    block=json.loads(pth.read_text(encoding="utf-8"))
    full_layers.extend(block.get("layers",[]))
full_modes={}
for row in full_layers:
    full_modes[row.get("mode")]=full_modes.get(row.get("mode"),0)+1
    if row.get("plot") not in set(names):
        errors.append(f"Full preview references unknown plot: {row.get('plot')}")
    if not row.get("src","").startswith(("data:image/jpeg;base64,","data:image/png;base64,")):
        errors.append(f"Full preview has invalid image data: {row.get('plot')} {row.get('date')} {row.get('mode')}")
for mode in ("true_color","false_color","ndvi","ndre","ndmi","mndwi","bsi"):
    if full_modes.get(mode,0) < 66:
        errors.append(f"Full preview mode {mode} incomplete: {full_modes.get(mode,0)}/66")

# Map Studio: compact real-raster spectral views
studio=json.loads((ROOT/"docs/data/visual_layers.json").read_text(encoding="utf-8"))
map_modes={"false","ndvi","ndre","ndmi","mndwi","bsi"}
view_ids=set()
for v in studio.get("layers",[]):
    name=v.get("plot")
    if name not in known:
        errors.append(f"Map Studio: unknown plot {name}")
    if v.get("mode") not in map_modes:
        errors.append(f"Map Studio: invalid mode {v.get('mode')}")
    ident=(name,v.get("date"),v.get("mode"))
    if ident in view_ids:
        errors.append(f"Map Studio: duplicate scene {ident}")
    view_ids.add(ident)
    size=v.get("size",[])
    p=v.get("pixels","")
    expected=(3 if v.get("mode")=="false" else 1)
    if len(size)!=2 or not all(isinstance(n,int) and 1<=n<=512 for n in size):
        errors.append(f"Map Studio: invalid size {ident}")
        continue
    if len(p)!=size[0]*size[1]*expected:
        errors.append(f"Map Studio: pixel length invalid {ident}")
    if not all(c in "0123456789abcdefx" for c in p):
        errors.append(f"Map Studio: invalid quantized pixels {ident}")
    bounds=v.get("bounds")
    if not (isinstance(bounds,list) and len(bounds)==2 and all(len(x)==2 for x in bounds)):
        errors.append(f"Map Studio: missing georeference {ident}")

if errors:
    print("PORTAL VALIDATION FAILED")
    for e in errors: print(" -",e)
    sys.exit(1)

print(f"PORTAL VALIDATION OK: {len(items)} plots, {len(features)} verified boundaries, {len(nw_features)} new-water overlays, {len(sat_files)} satellite files, {display_ready} ready web previews, {len(full_layers)} full spectral previews, {len(view_ids)} map studio spectral layers")
