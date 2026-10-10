#!/usr/bin/env python3
"""Open-Meteo Marine daily sea-level *model*, not a station tide measurement.

The model includes tidal and meteorological components. Daily extrema
cannot identify the level at Sentinel-2 overpass without exact UTC capture time.
Coastal model limitations and global mean-sea-level datum must be shown.
"""
import argparse
import datetime as dt
import json
import math
import urllib.parse
import urllib.request
import time
from pathlib import Path
from mmc_environmental_context import ROOT, DATA, coordinate_map, read_json

DEST=ROOT/"docs/mangrove-monitoring/environmental_sea_level_model.json"
ENDPOINT="https://marine-api.open-meteo.com/v1/marine"

def marine_request(lat,lon,begin,end):
    q=urllib.parse.urlencode({"latitude":lat,"longitude":lon,
        "hourly":"sea_level_height_msl","start_date":begin,"end_date":end,
        "timezone":"UTC","cell_selection":"sea"})
    url=ENDPOINT+"?"+q
    req=urllib.request.Request(url,headers={"User-Agent":"MMC-MarineContext/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=75) as response:
                data=json.load(response)
            break
        except Exception:
            if attempt==2:raise
            time.sleep(2*(attempt+1))
    if data.get("error"):raise ValueError(str(data.get("reason"))[:150])
    hourly=data.get("hourly",{})
    dates=hourly.get("time",[])
    levels=hourly.get("sea_level_height_msl",[])
    if not dates or len(dates)!=len(levels):raise ValueError("Missing synchronized marine hours")
    daily={}
    for stamp,level in zip(dates,levels):
        if isinstance(level,(int,float)) and math.isfinite(level) and -10<=level<=15:
            daily.setdefault(stamp[:10],[]).append(float(level))
    return daily,{"latitude":data.get("latitude"),"longitude":data.get("longitude")},url

def summarize(day,groups,grid):
    values=groups.get(day,[])
    valid=len(values)>=18
    return {"date":day,"model_status":"AVAILABLE" if valid else "MISSING",
        "sample_hours":len(values),
        "daily_min_m_msl":round(min(values),3) if valid else None,
        "daily_max_m_msl":round(max(values),3) if valid else None,
        "daily_mean_m_msl":round(sum(values)/len(values),3) if valid else None,
        "level_at_overpass_m":None,"overpass_utc":None,
        "model_grid":grid,"datum":"MODEL_GLOBAL_MEAN_SEA_LEVEL"}

def run(max_plots):
    rain=read_json(ROOT/"docs/mangrove-monitoring/environmental_context.json")
    coords=coordinate_map(read_json(DATA/"boundaries_pdd_136.geojson"))
    old=read_json(DEST) if DEST.exists() else {}
    plots=old.get("plots",{})
    cutoff=dt.datetime.now(dt.timezone.utc).date()-dt.timedelta(days=88)
    today=dt.datetime.now(dt.timezone.utc).date()
    queue=sorted((p for p in rain["plots"] if p in coords),
                 key=lambda p:(p!="13-STC",p!="16-STC",p))
    errors=[]
    for plot in [p for p in queue if p not in plots][:max_plots]:
        dates=[x["date"] for x in rain["plots"][plot]["scenes"]
               if cutoff<=dt.date.fromisoformat(x["date"])<=today]
        if not dates:continue
        try:
            lat,lon=coords[plot]
            groups,grid,url=marine_request(lat,lon,min(dates),max(dates))
            scenes={d:summarize(d,groups,grid) for d in dates}
            if not any(v["model_status"]=="AVAILABLE" for v in scenes.values()):
                raise ValueError("No complete coastal marine model day")
            plots[plot]={"source":"Open-Meteo Marine sea_level_height_msl",
                "url":url,"scenes":scenes}
            print("MARINE_MODEL_OK",plot,len(dates),flush=True)
        except Exception as exc:
            errors.append({"plot":plot,"reason":str(exc)[:180]})
            print("MARINE_MODEL_ERROR",plot,str(exc)[:120],flush=True)
    out={"schema_version":"mmc-sea-level-model-v1",
         "provider":"Open-Meteo Marine","type":"NUMERICAL_MODEL_NOT_TIDE_GAUGE",
         "datum":"Global mean sea level, not local chart datum",
         "limitations":"Coastal and estuary grid error; no overpass-time level without scene timestamp",
         "gauge_status":"NOT_CONNECTED_IOC_API_KEY_REQUIRED",
         "plots":plots,"errors":errors}
    DEST.write_text(json.dumps(out,ensure_ascii=False,indent=2,allow_nan=False),encoding="utf-8")
    if not plots:raise RuntimeError("No actual numerical marine model returned")
    return out

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--max-plots",type=int,default=12)
    a=p.parse_args();run(a.max_plots)
