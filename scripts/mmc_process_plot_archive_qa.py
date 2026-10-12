#!/usr/bin/env python3
"""Reprocess a locally staged plot archive against its verified registry polygon.

Inputs are untouched source 10m/20m TIFFs named tmp_<plot>_<date>_{10m,20m}.tif.
The script updates only preview assets and that plot's imagery manifest entries.
"""
from __future__ import annotations
import argparse, hashlib, json, sys
import re
import csv
from datetime import datetime, timezone
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/"scripts"))
from mmc_render_imagery import generate

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--plot",required=True)
    ap.add_argument("--source-dir",type=Path,default=BASE)
    ap.add_argument("--dry-run",action="store_true")
    args=ap.parse_args()
    manifest_path=BASE/"docs/mangrove-monitoring/imagery_manifest.json"
    registry_path=BASE/"docs/data/nationwide/boundaries_pdd_all.geojson"
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    registry=json.loads(registry_path.read_text(encoding="utf-8"))
    features=[f for f in registry["features"] if f.get("properties",{}).get("plot")==args.plot]
    if len(features)!=1 or not features[0].get("properties",{}).get("pdd_verified_geometry"):
        raise SystemExit(f"Expected one verified PDD geometry for {args.plot}; found {len(features)}")
    geometry=features[0]["geometry"]
    rows=[x for x in manifest["generated_items"] if x.get("plot")==args.plot]
    errors=[]; done=[]
    for row in sorted(rows,key=lambda x:x["date"]):
        date=row["date"]
        prefix=re.sub(r"[^a-z0-9]","",args.plot.lower())
        p10=args.source_dir/f"tmp_{prefix}_{date}_10m.tif"
        p20=args.source_dir/f"tmp_{prefix}_{date}_20m.tif"
        if not p10.is_file() or not p20.is_file():
            errors.append({"plot":args.plot,"date":date,"error":"missing local 10m/20m source TIFF"})
            continue
        outdir=BASE/"docs/mangrove-monitoring/imagery"/args.plot/date
        try:
            result=generate(p10,p20,outdir,args.plot,date,geometry)
            qa=result["plot_qa"]
            # Archive TIFFs do not carry SAFE product metadata/BOA offsets in
            # their tags. Per-scene DNs support displayed ratios, but cross-date
            # radiometric comparability remains unverified.
            valid=qa["qa_valid_pct"]
            row.update(result)
            row.pop("plot",None); row.pop("date",None); row.pop("source",None)
            row["plot"]=args.plot;row["date"]=date
            row["source"]="generated"
            row["algorithm"]="ORIGINAL_SENTINEL2_TIFF_ARCHIVE_QA_REVIEW"
            row["preview_kind"]="SOURCE_TIFF_QA_REVIEW"
            row["source_qa_status"]="QA_REVIEWED"
            row["analysis_status"]="PARTIAL"
            row["qa_valid_pct"]=valid
            row["cloud_coverage_pct"]=qa["cloud_pct"]
            row["shadow_coverage_pct"]=qa["shadow_pct"]
            row["data_integrity_status"]="TIFF_READABLE"
            row["cloud_qa_status"]="SCL_REVIEWED"
            row["index_validity_status"]="PER_SCENE_INDEX_STATS_AVAILABLE"
            row["visual_usability_status"]="AVAILABLE_FOR_VISUAL_REVIEW"
            row["radiometry_status"]="PROCESSING_BASELINE_AND_BOA_OFFSETS_UNVERIFIED"
            row["cross_date_comparison_status"]="NOT_APPROVED_PENDING_RADIOMETRIC_METADATA"
            row["analysis_warning"]="Per-scene index statistics use source TIFF band ratios and SCL classes 2,4,5,6. Source product baseline/BOA offsets are absent; do not infer quantitative cross-date change or flood extent. Cloudy pixels remain viewable in RGB."
            row["processing_status"]="PARTIAL"
            row["ingestion_timestamp"]=datetime.now(timezone.utc).isoformat()
            row["source_checksum"]={"10m_sha256":hashlib.sha256(p10.read_bytes()).hexdigest(),
                                    "20m_sha256":hashlib.sha256(p20.read_bytes()).hexdigest()}
            done.append({"plot":args.plot,"date":date,"valid_pct":valid,
                         "cloud_pct":qa["cloud_pct"],"shadow_pct":qa["shadow_pct"],
                         "index_pixel_counts":{k:v["sample_pixels"] for k,v in result["index_stats"].items()}})
            print(f"OK {date} valid={valid}% cloud={qa['cloud_pct']}%",flush=True)
        except Exception as exc:
            errors.append({"plot":args.plot,"date":date,"error":str(exc)})
            print(f"ERROR {date}: {exc}",flush=True)
    if not args.dry_run:
        manifest["version"]="2026-10-12-1stc-qa2"
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
        report=BASE/"docs/data/nationwide/audit_20261012/1stc_processing_status.json"
        report.parent.mkdir(parents=True,exist_ok=True)
        report.write_text(json.dumps({"plot":args.plot,"total":len(rows),"processed":len(done),"errors":errors,"scenes":done},ensure_ascii=False,indent=2),encoding="utf-8")
        with (report.parent/"1stc_qa_review.csv").open("w",encoding="utf-8-sig",newline="") as f:
            w=csv.writer(f);w.writerow(["plot","scene_date","qa_valid_pct","cloud_pct","shadow_pct","unclassified_pct","index_pixels","review_reason"])
            for scene in done:
                if scene["valid_pct"] is None or scene["valid_pct"]<60:
                    w.writerow([args.plot,scene["date"],scene["valid_pct"],scene["cloud_pct"],scene["shadow_pct"],
                                next((r["plot_qa"]["unclassified_pct"] for r in rows if r["date"]==scene["date"]),""),
                                json.dumps(scene["index_pixel_counts"],separators=(",",":")),"Valid SCL pixels below 60%; inspect before quantitative use"])
        match={m:sum(x.get("index_stats",{}).get(m,{}).get("embedded_tif_match") is True for x in rows)
               for m in ("ndre","ndmi","mndwi")}
        summary=(f"# 1-STC Satellite Index QA\n\n"
                 f"- Source: paired original Google Drive 10m/20m GeoTIFFs; source checksum saved per scene.\n"
                 f"- Verified boundary: PDD registry feature `1-STC` (EPSG:32647 source geometry); index mask: polygon.\n"
                 f"- Scenes processed: {len(done)}/{len(rows)}; failures: {len(errors)}.\n"
                 f"- Date range: {min((x['date'] for x in done),default='—')} to {max((x['date'] for x in done),default='—')}.\n"
                 f"- Per-scene pixel statistics produced: six indices per scene; SCL primary classes 2,4,5,6.\n"
                 f"- Embedded TIFF parity (RMSE <= 0.03): NDRE {match['ndre']}/{len(done)}, NDMI {match['ndmi']}/{len(done)}, MNDWI {match['mndwi']}/{len(done)}.\n"
                 f"- SCL cloud/shadow inside polygon: cloud classes 8,9,10; shadow class 3; report percentages are separate from valid-data percentage.\n"
                 f"- {sum((x['valid_pct'] or 0)<60 for x in done)} scenes have <60% SCL-valid pixels; see `1stc_qa_review.csv`. These remain viewable.\n"
                 f"- All scenes remain `PARTIAL`: archive TIFFs omit processing baseline and BOA offsets. Do not compare cross-date index values or infer inundated area until radiometric metadata is verified.\n"
                 f"- RGB and false color retain all source-valid pixels, including SCL cloud/unclassified classes, for visual review.\n")
        (report.parent/"1stc_qa_summary.md").write_text(summary,encoding="utf-8")
    print(json.dumps({"total":len(rows),"processed":len(done),"errors":len(errors)},ensure_ascii=False))
    if errors:raise SystemExit(1)
if __name__=="__main__":main()
