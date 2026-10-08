#!/usr/bin/env python3
import json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
plots=json.loads((ROOT/"docs/data/plots.json").read_text(encoding="utf-8"))
bounds=json.loads((ROOT/"docs/data/boundaries.geojson").read_text(encoding="utf-8"))
new_water=json.loads((ROOT/"docs/data/new_water.geojson").read_text(encoding="utf-8"))

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

if errors:
    print("PORTAL VALIDATION FAILED")
    for e in errors: print(" -",e)
    sys.exit(1)

print(f"PORTAL VALIDATION OK: {len(items)} plots, {len(features)} verified boundaries, {len(nw_features)} new-water overlays")
