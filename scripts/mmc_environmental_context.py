#!/usr/bin/env python3
"""Fetch NASA POWER daily precipitation for real Sentinel-2 PDD plot/date records.

Rain is previous *complete UTC calendar days*, NOT rolling 24h/72h before
Sentinel-2 acquisition; source files do not yet identify UTC capture times.
No fabricated data, no flood diagnoses, no independent tidal calibration.
"""
import argparse
import datetime as dt
import json
import math
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from shapely.geometry import shape

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"docs"/"data"/"nationwide"
TARGET=ROOT/"docs"/"mangrove-monitoring"/"environmental_context.json"
API="https://power.larc.nasa.gov/api/temporal/daily/point"
IMPORTANT=["16-STC","14-STC","92-STC","15-STC","24-VSD","30-STC","66-STC","70-STC","13-STC"]
VERSION="mmc-environmental-context-v1"

def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def scene_date(day):
    return dt.date.fromisoformat(day)

def preceding_days(day,n):
    d=scene_date(day)
    return [(d-dt.timedelta(days=i)).strftime("%Y%m%d") for i in range(1,n+1)]

def safe_rain(value):
    if isinstance(value,bool) or not isinstance(value,(int,float)):
        return None
    if not math.isfinite(value) or value<0 or value>1000:
        return None
    return round(float(value),3)

def summarize(day,values):
    one=preceding_days(day,1);three=preceding_days(day,3)
    one_values=[safe_rain(values.get(k)) for k in one]
    three_values=[safe_rain(values.get(k)) for k in three]
    return {
        "date":day,"rain_prev_1_utc_day_mm":round(sum(one_values),3) if all(x is not None for x in one_values) else None,
        "rain_prev_3_utc_days_mm":round(sum(three_values),3) if all(x is not None for x in three_values) else None,
        "data_quality":"COMPLETE" if all(x is not None for x in three_values) else "MISSING_DAILY_VALUES",
        "window_dates_utc": {"one_day":one,"three_days":list(reversed(three))},
        "observation_time_utc":None,
        "time_alignment":"COMPLETE_UTC_DAYS_BEFORE_SCENE_DATE_NOT_ACQUISITION_RELATIVE",
        "tide":{"status":"NOT_CONNECTED","level_m":None,"datum":None,"station_code":None}
    }

def power_url(lat,lon,start,end):
    args={"parameters":"PRECTOTCORR","community":"AG","latitude":round(lat,6),
          "longitude":round(lon,6),"start":start,"end":end,"format":"JSON",
          "time-standard":"UTC"}
    return API+"?"+urllib.parse.urlencode(args)

def power_daily(lat,lon,start,end,retries=3):
    url=power_url(lat,lon,start,end)
    err=None
    for attempt in range(retries):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"MMC-Environmental-Context/1.0"})
            with urllib.request.urlopen(req,timeout=65) as res:
                payload=json.load(res)
            values=payload.get("properties",{}).get("parameter",{}).get("PRECTOTCORR")
            if not isinstance(values,dict):
                raise ValueError("NASA POWER missing PRECTOTCORR")
            return values,url
        except Exception as exc:
            err=exc
            if attempt+1<retries:time.sleep(2*(attempt+1))
    raise RuntimeError("NASA POWER unavailable: "+str(err)[:180])

def coordinate_map(features):
    places={}
    for f in features["features"]:
        p=f.get("properties",{})
        code=p.get("plot")
        if code and f.get("geometry"):
            point=shape(f["geometry"]).representative_point()
            if -180<=point.x<=180 and -90<=point.y<=90:
                places[code]=(round(point.y,6),round(point.x,6))
    return places

def run(output=TARGET,max_plots=10,all_plots=False):
    src=read_json(DATA/"nationwide_results.json")
    coords=coordinate_map(read_json(DATA/"boundaries_pdd_136.geojson"))
    previous=read_json(output) if Path(output).exists() else {}
    retained=previous.get("plots",{}) if previous.get("schema_version")==VERSION else {}
    grouped={}
    for row in src.get("scenes",[]):
        if row.get("analysis_status")=="AUTO_VALID" and row.get("plot") in coords:
            grouped.setdefault(row["plot"],set()).add(row["date"])
    codes=sorted(grouped,key=lambda c:(c not in IMPORTANT,IMPORTANT.index(c) if c in IMPORTANT else c))
    def remaining(code):
        current=retained.get(code,{})
        past={s["date"] for s in current.get("scenes",[])
              if s.get("data_quality")=="COMPLETE"}
        return len(grouped[code]-past)
    pending=[c for c in codes if remaining(c)>0]
    selected=pending if all_plots else pending[:max_plots]
    if not selected and Path(output).exists():
        print('NO_NEW_RAIN_SCENES_KEEP_LAST_VERIFIED_DATA',len(retained),flush=True)
        return previous
    errors=[];updated=0
    for code in selected:
        lat,lon=coords[code]
        dates=sorted(grouped[code])
        start=(scene_date(dates[0])-dt.timedelta(days=3)).strftime("%Y%m%d")
        end=(scene_date(dates[-1])-dt.timedelta(days=1)).strftime("%Y%m%d")
        try:
            vals,url=power_daily(lat,lon,start,end)
            # Verify response structure with real daily data; do not infer missing days.
            rows=[summarize(date,vals) for date in dates]
            complete=sum(x["data_quality"]=="COMPLETE" for x in rows)
            if not complete:
                errors.append({"plot":code,"reason":"NO_COMPLETE_RAIN_WINDOWS"})
                continue
            retained[code]={
                "plot":code,"latitude":lat,"longitude":lon,
                "sample_geometry":"interior_point_of_PDD_polygon_WGS84",
                "rain_source":"NASA_POWER_PRECTOTCORR",
                "rain_source_type":"MODEL_OR_ASSIMILATED_DAILY_ESTIMATE_NOT_RAIN_GAUGE_OR_GPM_IMERG",
                "api_url":url,"units":"mm","time_standard":"UTC",
                "scenes":rows}
            updated+=1
            print("RAIN_FETCH_OK",code,len(rows),"complete",complete,flush=True)
        except Exception as exc:
            errors.append({"plot":code,"reason":str(exc)[:260]})
            print("RAIN_FETCH_FAILED",code,str(exc)[:120],flush=True)
    complete_total=sum(sum(s.get("data_quality")=="COMPLETE" for s in x.get("scenes",[]))
                       for x in retained.values())
    result={
        "schema_version":VERSION,
        "generated_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
        "source":"NASA POWER Daily API",
        "source_documentation":"https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
        "parameter":"PRECTOTCORR","units":"mm",
        "rain_window_definition":"Prior 1 and 3 complete UTC calendar days; NOT exact rolling 24/72 hours before overpass",
        "data_restriction":"Historical daily estimates; not point rain gauge measurements or IMERG",
        "gpm_imerg":{"status":"NOT_CONNECTED_REQUIRES_EARTH_ENGINE_AUTH"},
        "tide":{"status":"NOT_CONNECTED_REQUIRES_VERIFIED_STATION_AND_API_KEY",
                "provider":"IOC Sea Level Monitoring Facility",
                "source_documentation":"https://api.ioc-sealevelmonitoring.org/v2/doc",
                "water_level_m":None,"datum":None},
        "plot_count":len(retained),"scenes_with_complete_rain":complete_total,
        "target_qa_plots":len(codes),"pending_qa_plots":sum(remaining(c)>0 for c in codes),
        "updated_plots":updated,"errors":errors,
        "plots":retained
    }
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    Path(output).write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")
    print("RAIN_CONTEXT_SUMMARY",updated,"PLOTS_UPDATED",complete_total,"COMPLETE_SCENES",
          len(errors),"ERRORS",flush=True)
    return result

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--output",default=str(TARGET))
    p.add_argument("--max-plots",type=int,default=10)
    p.add_argument("--all",action="store_true")
    a=p.parse_args()
    if a.max_plots<1:raise SystemExit("max-plots must be positive")
    r=run(a.output,a.max_plots,a.all)
    if not r["scenes_with_complete_rain"]:
        raise SystemExit("No real NASA rainfall data verified; abort publish")
