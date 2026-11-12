#!/usr/bin/env python3
"""Regenerate non-classification Rayong plot metadata from QA-qualified history.

The original 2026-10-08 plots.json was imported as verified-report metadata (not generated
by any remaining script). This backfill is the maintained source-side replacement.
Do not persist HIGH/WATCH/NORMAL/NO_DATA/WAIT_BASELINE: docs/status-engine.js
derives those from analysis_history.json at every portal load.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PLOTS=ROOT/"docs/data/plots.json"
HISTORY=ROOT/"docs/data/analysis_history.json"

def qa(row):
    if not isinstance(row,dict) or row.get("analysis_status") not in {"VERIFIED","AUTO_VALID"}:
        return False
    q=row.get("valid_pct")
    return type(q) in (int,float) and q>=70 and type(row.get("water_rai")) in (int,float)

def normalize(payload, history):
    for p in payload["plots"]:
        p.pop("status",None)
        rows=sorted((r for r in history["plots"].get(p["plot"],[]) if qa(r)),key=lambda x:x["date"])
        area=p.get("area_rai")
        if not isinstance(area,(float,int)) or area<=0:
            raise ValueError(f"{p['plot']}: invalid official PDD area")
        # Two separate concepts: water/total PDD plot vs water/valid observed area.
        # For 14(1)-STC 2.20 rai / 12.47 rai = 17.64%, not 80%.
        dates={r["date"].replace("-",""):r for r in rows}
        b=dates.get(p["baseline"])
        c=dates.get(p["current"])
        p["water_before_pct"]=round(float(b["water_rai"])/area*100,2) if b else None
        p["water_current_pct"]=round(float(c["water_rai"])/area*100,2) if c else None
        p["water_change_pp"]=round(p["water_current_pct"]-p["water_before_pct"],2) if b and c else None
        if not c:
            p["water_current_rai"]=None
        if not b:
            p["water_before_rai"]=None
        # Retain historic verified new-water polygon and metadata where sourced;
        # no new-water geometries are fabricated.
        if c:
            p["water_current_rai"]=c["water_rai"]
        if b:
            p["water_before_rai"]=b["water_rai"]
    return payload

def main():
    data=json.loads(PLOTS.read_text("utf8"))
    hist=json.loads(HISTORY.read_text("utf8"))
    normalized=normalize(data,hist)
    new=json.dumps(normalized,ensure_ascii=False,indent=2,allow_nan=False)+"\n"
    if PLOTS.read_text("utf8")!=new:
        PLOTS.write_text(new,encoding="utf8")
        print("REGENERATED_RAYONG_PLOT_METADATA",len(normalized["plots"]))
    else:
        print("RAYONG_PLOT_METADATA_UNCHANGED")
if __name__=="__main__":
    main()
