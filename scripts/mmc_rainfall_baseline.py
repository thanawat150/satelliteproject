#!/usr/bin/env python3
"""Historical NASA POWER PRECTOTCORR seasonal comparison for actual PDD scene dates.

Uses 2016-2025 COMPLETE UTC daily rain data, excludes 2026 (the evaluation year).
Empirical reference = +/- 15 calendar days around the same month/day in each
baseline year. Computes one prior-day and three prior-day totals; no gauges or
hydrological flood confirmation. No synthetic values.
"""
import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from mmc_environmental_context import (ROOT,DATA,coordinate_map,read_json,power_daily,safe_rain)

DEST=ROOT/"docs/mangrove-monitoring/environmental_rain_baselines.json"
BASELINE_START="2015-12-28"
BASELINE_END="2025-12-31"
YEARS=list(range(2016,2026))

def quartile(values,prob):
    values=sorted(values)
    if not values:return None
    a=prob*(len(values)-1)
    lo=int(math.floor(a));hi=int(math.ceil(a))
    return round(values[lo]+(values[hi]-values[lo])*(a-lo),3)

def ref_samples(values,mmdd,n):
    # Precisely comparable season: +/-15 days in every reference year.
    out=[]
    for year in YEARS:
        try:day=dt.date.fromisoformat(f"{year}-{mmdd}")
        except ValueError:continue
        for offset in range(-15,16):
            ref=day+dt.timedelta(days=offset)
            window=[safe_rain(values.get((ref-dt.timedelta(days=i)).strftime("%Y%m%d")))
                    for i in range(1,n+1)]
            if all(v is not None for v in window):
                out.append(round(sum(window),4))
    return out

def compare(target,reference):
    if target is None or len(reference)<100:
        return {"status":"INSUFFICIENT_CLIMATOLOGY","sample_count":len(reference),
                "percentile":None,"reference_median_mm":None,"reference_p80_mm":None,
                "reference_p95_mm":None,"relative_status":"UNKNOWN"}
    t=float(target)
    rank=100*sum(v<=t for v in reference)/len(reference)
    category=("VERY_HIGH" if rank>=95 else "HIGH" if rank>=80 else
              "NEAR_TYPICAL" if rank>=20 else "LOW")
    return {"status":"SEASONAL_REFERENCE_READY","sample_count":len(reference),
            "percentile":round(rank,2),
            "reference_median_mm":quartile(reference,.50),
            "reference_p80_mm":quartile(reference,.80),
            "reference_p95_mm":quartile(reference,.95),
            "relative_status":category}

def process_plot(plot,coord,rain_rows):
    lat,lon=coord
    vals,url=power_daily(lat,lon,"20151228","20251231",retries=2)
    result={}
    for row in rain_rows:
        day=row["date"]
        mmdd=day[5:]
        checks={}
        for n,key in [(1,"rain_prev_1_utc_day_mm"),(3,"rain_prev_3_utc_days_mm")]:
            obs=row.get(key) if row.get("data_quality")=="COMPLETE" else None
            checks[key]=compare(obs,ref_samples(vals,mmdd,n))
        result[day]=checks
    return {"plot":plot,"latitude":lat,"longitude":lon,
            "baseline_years":"2016–2025",
            "season_reference":"same day-of-year +/- 15 days for each historical year",
            "day_boundary":"UTC complete days preceding scene date, NOT rolling 24h/72h",
            "source":"NASA_POWER_PRECTOTCORR","source_url":url,
            "reference_not_station_gauge":True,"results":result}

def run(limit=12):
    rain=read_json(ROOT/"docs/mangrove-monitoring/environmental_context.json")
    geo=coordinate_map(read_json(DATA/"boundaries_pdd_136.geojson"))
    existing=read_json(DEST) if DEST.exists() else {}
    prior=existing.get("plots",{})
    # Prefer the actual screenshot plot first.
    queue=sorted((x for x in rain["plots"] if x in geo),
                 key=lambda x:(x!="13-STC",x!="16-STC",x))
    todo=[x for x in queue if x not in prior][:limit]
    errors=[]
    for plot in todo:
        try:
            record=process_plot(plot,geo[plot],rain["plots"][plot]["scenes"])
            complete=sum(all(x["status"]=="SEASONAL_REFERENCE_READY" for x in y.values())
                         for y in record["results"].values())
            if complete==0:raise ValueError("No comparable seasonal reference")
            prior[plot]=record
            print("CLIMATE_BASELINE_REAL",plot,len(record["results"]),"dates",complete,"complete",flush=True)
        except Exception as exc:
            errors.append({"plot":plot,"error":str(exc)[:180]})
            print("CLIMATE_BASELINE_ERROR",plot,str(exc)[:150],flush=True)
    output={
        "schema_version":"mmc-seasonal-rain-v1",
        "source":"NASA POWER PRECTOTCORR",
        "baseline_years":"2016-2025",
        "window":"previous 1 and 3 complete UTC days, compared with a +/-15-day seasonal window",
        "comparison_rule":"Empirical percentile over reference samples; high >=80th, very high >=95th",
        "not_flood_confirmation":True,
        "plots_with_reference":len(prior),
        "plots_without_reference":len(set(queue)-set(prior)),
        "errors":errors,
        "plots":prior
    }
    DEST.parent.mkdir(parents=True,exist_ok=True)
    DEST.write_text(json.dumps(output,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")
    if not prior:raise RuntimeError("No verified seasonal climatology from API")
    return output

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--max-plots",type=int,default=12);a=p.parse_args()
    if a.max_plots<1:raise SystemExit("max-plots must be >0")
    run(a.max_plots)
