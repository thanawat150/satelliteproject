#!/usr/bin/env python3
"""Idempotently ingest a verified Drive plot archive into MMC."""
import argparse,csv,hashlib,json,re,sys,tempfile
from collections import defaultdict
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import rasterio,gdown

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"docs/data/nationwide"; AUDIT=DATA/"audit_20261013"; MMC=ROOT/"docs/mangrove-monitoring"
def read(p): return json.loads(p.read_text(encoding="utf-8"))
def write(p,x):
 p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+".tmp");t.write_text(json.dumps(x,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");t.replace(p)
def digest(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(1048576),b""):h.update(b)
 return h.hexdigest()
def download(fid,p):
 got=gdown.download(id=fid,output=str(p),quiet=True,timeout=120,retries=3,use_cookies=False)
 if not got or not p.is_file() or p.stat().st_size<1024:raise RuntimeError("Drive download unavailable or incomplete")
 with rasterio.open(p) as d:
  if not d.crs or not d.width or not d.height or not d.count:raise RuntimeError("Unreadable TIFF")
  valid=int(np.count_nonzero(d.dataset_mask()))
  return {"crs":d.crs.to_string(),"width":d.width,"height":d.height,"pixel_size":[abs(d.transform.a),abs(d.transform.e)],"bands":d.count,"band_descriptions":[x or "" for x in d.descriptions],"nodata":d.nodata,"valid_coverage_pct":round(100*valid/(d.width*d.height),4)}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--plot",default="10-STC");a=ap.parse_args();plot=a.plot
 if plot!="10-STC":raise SystemExit("This ingestion is pinned to 10-STC")
 with (AUDIT/"10stc_drive_inventory.csv").open(encoding="utf-8-sig",newline="") as f:assets=list(csv.DictReader(f))
 groups=defaultdict(dict)
 for x in assets:
  m=re.search(r"_S2_(20\d{6})_(10|20|60)m_",x["filename"],re.I)
  if x["plot"]!=plot or x["province"]!="จันทบุรี" or not m or datetime.strptime(m[1],"%Y%m%d").date().isoformat()!=x["capture_date"]:raise SystemExit("Inventory identity/date mismatch")
  if m[2] in groups[x["capture_date"]]:raise SystemExit("Duplicate resolution")
  groups[x["capture_date"]][m[2]]=x
 if len(assets)!=588 or len(groups)!=196 or any(set(v)!={"10","20","60"} for v in groups.values()):raise SystemExit("Incomplete 10/20/60 archive")
 registry=read(DATA/"boundaries_pdd_all.geojson");features=[f for f in registry["features"] if f.get("properties",{}).get("plot")=="10-STC" and f.get("properties",{}).get("pdd_verified_geometry")]
 if len(features)!=1:raise SystemExit("Expected one GIS-verified PDD geometry")
 feature=features[0];props=feature["properties"];geom=feature["geometry"]
 sys.path.insert(0,str(ROOT/"scripts"));from mmc_render_imagery import generate,generate_visual_only
 mp=MMC/"imagery_manifest.json";manifest=read(mp);generated={(x.get("plot"),x.get("date")):x for x in manifest.get("generated_items",[])}
 rp=DATA/"nationwide_results.json";results=read(rp);scenes={(x.get("plot"),x.get("date")):x for x in results.get("scenes",[])}
 failures=[];qa=[];dups=[];seen={};stamp=datetime.now(timezone.utc).isoformat()
 with tempfile.TemporaryDirectory(prefix="mmc-10stc-") as td:
  for date in sorted(groups):
   files=groups[date];tmp=Path(td)/date;tmp.mkdir(parents=True);paths={};meta={};checks={}
   try:
    for res in ("10","20","60"):
     p=tmp/(res+"m.tif");meta[res]=download(files[res]["drive_file_id"],p);paths[res]=p;checks[res]=digest(p)
     if checks[res] in seen:dups.append({"sha256":checks[res],"date":date,"resolution_m":res,"file_id":files[res]["drive_file_id"],"duplicate_of":seen[checks[res]]})
     else:seen[checks[res]]=files[res]["drive_file_id"]
    out=MMC/"imagery"/plot/date
    try:
     image=generate(paths["10"],paths["20"],out,plot,date,geom);image["source_qa_status"]="QA_REVIEWED";image["cloud_qa_status"]="SCL_REVIEWED";image["index_validity_status"]="PER_SCENE_INDEX_STATS_AVAILABLE"
    except Exception as err:
     image=generate_visual_only(paths["10"],out,plot,date,geom,twenty=paths["20"]);image["index_stats"]={};image["source_qa_status"]="UNPROCESSED";image["cloud_qa_status"]="NOT_REVIEWED";image["index_validity_status"]="NOT_AVAILABLE";image["analysis_warning"]="Visual-only preview; index QA unavailable: "+str(err)[:200]
    image.update({"plot":plot,"date":date,"scene_key":"Sentinel-2|"+plot+"|"+date,"satellite":"Sentinel-2","source":"generated","status":"PARTIAL","analysis_status":"PARTIAL","processing_status":"PARTIAL","preview_status":"AVAILABLE_FOR_VISUAL_REVIEW","data_integrity_status":"TIFF_READABLE","visual_usability_status":"AVAILABLE_FOR_VISUAL_REVIEW","radiometry_status":"PROCESSING_BASELINE_AND_BOA_OFFSETS_UNVERIFIED","cross_date_comparison_status":"NOT_APPROVED_PENDING_RADIOMETRIC_METADATA","analysis_warning":image.get("analysis_warning","Archive omits processing baseline/BOA offsets; no cross-date change or flood estimate is approved. Cloudy images remain viewable."),"original_tif10":files["10"]["filename"],"original_tif20":files["20"]["filename"],"original_tif60":files["60"]["filename"],"original_tif10_file_id":files["10"]["drive_file_id"],"original_tif20_file_id":files["20"]["drive_file_id"],"original_tif60_file_id":files["60"]["drive_file_id"],"source_file_ids":[files[k]["drive_file_id"] for k in ("10","20","60")],"source_paths":[files[k]["source_folder_path"]+"/"+files[k]["filename"] for k in ("10","20","60")],"source_folder_id":files["10"]["source_folder_id"],"source_folder_path":files["10"]["source_folder_path"],"source_raster_metadata":meta,"source_checksum":checks,"source_file_created_times":[files[k]["created_time"] for k in ("10","20","60")],"source_file_modified_times":[files[k]["modified_time"] for k in ("10","20","60")],"ingestion_timestamp":stamp})
    generated[(plot,date)]=image;stats=image.get("index_stats",{});q=image.get("plot_qa",{})
    row={"plot":plot,"plot_id":"gis:0037","province":"จันทบุรี","date":date,"scene_key":image["scene_key"],"satellite":"Sentinel-2","status":"PARTIAL","analysis_status":"PARTIAL","qa_valid_pct":image.get("qa_valid_pct"),"cloud_coverage_pct":q.get("cloud_pct"),"shadow_coverage_pct":q.get("shadow_pct"),"unclassified_pct":q.get("unclassified_pct"),"total_pixels":q.get("pixel_count"),"usable_pixels":sum(q.get("scl_counts",{}).get(str(k),0) for k in (2,4,5,6)),"pdd_area_rai":props.get("pdd_area_rai"),"geometry_area_rai":props.get("geometry_area_rai"),"original_tif10":files["10"]["filename"],"original_tif20":files["20"]["filename"],"original_tif60":files["60"]["filename"],"original_tif10_file_id":files["10"]["drive_file_id"],"original_tif20_file_id":files["20"]["drive_file_id"],"original_tif60_file_id":files["60"]["drive_file_id"],"source_file_ids":[files[k]["drive_file_id"] for k in ("10","20","60")],"source_paths":[files[k]["source_folder_path"]+"/"+files[k]["filename"] for k in ("10","20","60")],"source_folder_id":files["10"]["source_folder_id"],"source_folder_path":files["10"]["source_folder_path"],"source_file_created_times":[files[k]["created_time"] for k in ("10","20","60")],"source_file_modified_times":[files[k]["modified_time"] for k in ("10","20","60")],"source_index_stats":stats,"source_checksums":checks,"data_integrity_status":"TIFF_READABLE","cloud_qa_status":image["cloud_qa_status"],"index_validity_status":image["index_validity_status"],"visual_usability_status":image["visual_usability_status"],"radiometry_status":image["radiometry_status"],"cross_date_comparison_status":image["cross_date_comparison_status"],"processing_status":"PARTIAL","preview_status":"AVAILABLE_FOR_VISUAL_REVIEW","analysis_warning":image["analysis_warning"],"ingestion_timestamp":stamp}
    for k in ("ndvi","evi","savi","gli","ndre","ndmi","ndwi","mndwi","bsi"):row[k]=stats.get(k,{}).get("plot_mean")
    scenes[(plot,date)]=row;qa.append({"plot":plot,"scene_date":date,"status":"PARTIAL","qa_valid_pct":row["qa_valid_pct"],"cloud_pct":row["cloud_coverage_pct"],"shadow_pct":row["shadow_coverage_pct"],"index_count":len(stats),"visual_review":image["preview_status"],"reason":image["analysis_warning"]})
    print("SCENE",date,"indices",len(stats),flush=True)
   except Exception as err:failures.append({"plot":plot,"date":date,"error":str(err)[:400]});print("ERROR",date,str(err)[:160],flush=True)
 selected=sorted(groups);plotmeta={"province":"จันทบุรี","plot_id":"gis:0037","pdd_geometry_parts":props.get("geometry_parts",1),"pdd_area_rai":props.get("pdd_area_rai"),"geometry_area_rai":props.get("geometry_area_rai"),"boundary_source":props.get("boundary_source")+" · "+props.get("source_path"),"boundary_verified":True,"pdd_base_member":False,"selected_dates":selected,"completed_dates":len([d for d in selected if (plot,d) in generated]),"qa_valid_dates":0,"processing_status":"PARTIAL","source_tiff_count":len(assets)}
 manifest["generated_items"]=sorted(generated.values(),key=lambda x:(x.get("plot",""),x.get("date","")));manifest["version"]="2026-10-13-10stc-archive-v1";write(mp,manifest)
 results["scenes"]=sorted(scenes.values(),key=lambda x:(x.get("plot",""),x.get("date","")));results.setdefault("plots",{})[plot]=plotmeta;results["generated_at"]=stamp;write(rp,results)
 fields={"plot","plot_id","province","date","scene_key","satellite","status","analysis_status","qa_valid_pct","cloud_coverage_pct","shadow_coverage_pct","unclassified_pct","total_pixels","usable_pixels","pdd_area_rai","geometry_area_rai","original_tif10","original_tif20","original_tif60","original_tif10_file_id","original_tif20_file_id","original_tif60_file_id","source_folder_id","source_folder_path","source_index_stats","ndvi","evi","savi","gli","ndre","ndmi","ndwi","mndwi","bsi","data_integrity_status","cloud_qa_status","index_validity_status","visual_usability_status","radiometry_status","cross_date_comparison_status","processing_status","preview_status","analysis_warning","source_checksums","ingestion_timestamp"}
 rows=[{k:v for k,v in x.items() if k in fields} for x in results["scenes"] if x.get("plot")==plot]
 write(DATA/"plots"/"10-STC.json",{"plot":plot,"plot_registry":plotmeta,"scene_count":len(rows),"generated_at":stamp,"scenes":rows})
 AUDIT.mkdir(parents=True,exist_ok=True);write(AUDIT/"10stc_processing_status.json",{"plot":plot,"province":"จันทบุรี","plot_id":"gis:0037","inventory_files":len(assets),"inventory_dates":len(groups),"processed":len(rows),"errors":failures,"status":"PARTIAL","generated_at":stamp})
 for name,items,fields in [("10stc_qa_review.csv",qa,None),("10stc_duplicate_files.csv",dups,["sha256","date","resolution_m","file_id","duplicate_of"])]:
  with (AUDIT/name).open("w",encoding="utf-8-sig",newline="") as f:
   cols=fields or (list(items[0]) if items else ["scene_date"]);w=csv.DictWriter(f,fieldnames=cols);w.writeheader();w.writerows(items)
 summary="# 10-STC archive integration audit\n\n- Drive location: Nationwide Archive / Chanthaburi / 10-STC.\n- GIS identity: gis:0037 / 10-STC, Chanthaburi; verified native PDD geometry.\n- Inventory: 588 TIFFs in 196 dates, complete 10m/20m/60m sets.\n- Acquisition dates: "+selected[0]+" through "+selected[-1]+" (from filenames; upload timestamps retained separately).\n- Scenes with readable TIFFs and generated records: "+str(len(rows))+"/"+str(len(groups))+"; errors: "+str(len(failures))+".\n- Duplicate checksums: "+str(len(dups))+". All scenes remain PARTIAL pending radiometric metadata; no cross-date quantitative change or flood area is inferred. Original Drive files were read only.\n"
 (AUDIT/"10stc_completion_summary.md").write_text(summary,encoding="utf-8")
 print(json.dumps({"plot":plot,"files":len(assets),"dates":len(groups),"processed":len(rows),"errors":len(failures)},ensure_ascii=False))
 if failures:raise SystemExit(1)
if __name__=="__main__":main()
