#!/usr/bin/env python3
"""Build explicitly partial, provenance-preserving nationwide audit products.

The current Drive connector crawl is a checkpoint, not a complete Drive export.
This utility labels every product IN_PROGRESS and never treats names as proof
that two plot folders or polygons are identical.
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/data/nationwide/audit_20261012"
MANIFEST = OUT / "satellite_inventory.partial.jsonl"
CHECKPOINT = OUT / "verified_checkpoint_current.json"
BOUNDARIES = ROOT / "docs/data/nationwide/boundaries_pdd_all.geojson"
PDD = ROOT / "docs/data/nationwide/boundaries_pdd_136.geojson"


def read_jsonl(path: Path):
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def write_csv(path: Path, rows, fields):
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def date_from_name(name: str):
    # Capture-date evidence only; upload timestamps are never used as scene date.
    m = re.search(r"(?:S2_|S1_|)(20\d{6})(?=_|\b)", name)
    if not m:
        m = re.search(r"(?<!\d)(20\d{2})[-_](\d{2})[-_](\d{2})(?!\d)", name)
        if m:
            try:
                return datetime.strptime("".join(m.groups()), "%Y%m%d").date().isoformat()
            except ValueError:
                return None
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y%m%d").date().isoformat()
        except ValueError:
            return None
    return None


def main():
    records = read_jsonl(MANIFEST)
    cp = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    tiffs = [r for r in records if "tiff" in (r.get("mime_type") or "").lower() or
             str(r.get("title", "")).lower().endswith((".tif", ".tiff"))]
    asset_rows = []
    for r in records:
        name = r.get("title") or ""
        date = date_from_name(name)
        resolution = re.search(r"(?:^|[_-])(10|20|60)m(?:[_-]|\.)", name, re.I)
        scene_code = re.search(r"(?:RYF__)?([0-9]+(?:\([^)]*\))?(?:[_-][0-9]+)?-(?:STC|VSD))", name, re.I)
        satellite = re.search(r"Sentinel[-_ ]?([12])", name, re.I)
        prov = r.get("province") or None
        path = r.get("path") or ""
        asset_rows.append({
            "audit_status": "IN_PROGRESS", "drive_file_id": r.get("id"),
            "source_file_id": r.get("id"), "unique_scene_key": f"drive_asset:{r.get('id')}",
            "parent_folder_id": r.get("parent_folder_id"), "source_path": path,
            "filename": name, "mime_type": r.get("mime_type"),
            "byte_size": r.get("size"), "created_time": r.get("created_time"),
            "modified_time": r.get("modified_time"), "province_candidate": prov,
            "source_plot_code_candidate": scene_code.group(1) if scene_code else None,
            "scene_date": date, "scene_date_source": "filename" if date else None,
            "satellite": f"Sentinel-{satellite.group(1)}" if satellite else None,
            "resolution_m": int(resolution.group(1)) if resolution else None,
            "bands": None, "crs": None, "valid_coverage_pct": None,
            "cloud_coverage_pct": None, "checksum_sha256": None,
            "qa_status": "NOT_RUN", "metadata_qa": "DISCOVERED",
            "processing_status": "DISCOVERED", "preview_status": "NOT_CHECKED",
            "ingestion_timestamp": None, "raster_qa": "NOT_RUN", "plot_id": None,
        })
    fields = list(asset_rows[0]) if asset_rows else []
    write_csv(OUT / "satellite_inventory.csv", asset_rows, fields)

    registry = {"audit_status": "IN_PROGRESS", "generated_at": cp.get("date"),
                "crawl_checkpoint": cp, "scene_identity_note": "One record per discovered Drive asset. No content checksum or confirmed plot association is available yet.",
                "assets": asset_rows}
    (OUT / "satellite_scene_registry.json").write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")

    boundary = json.loads(BOUNDARIES.read_text(encoding="utf-8"))
    pdd = json.loads(PDD.read_text(encoding="utf-8"))
    pdd_codes = {f["properties"].get("plot") for f in pdd.get("features", [])}
    plot_rows = []
    for i, f in enumerate(boundary.get("features", [])):
        prop = f.get("properties", {})
        code = prop.get("plot")
        conflict = code in {"9-STC", "66-STC"}
        plot_rows.append({"plot_id": f"gis:{i+1:04d}", "legacy_plot_code": code,
                          "province": prop.get("province"), "source_path": prop.get("source_path"),
                          "boundary_source": prop.get("boundary_source"), "boundary_role": prop.get("boundary_role"),
                          "pdd_verified_geometry": prop.get("pdd_verified_geometry"),
                          "pdd_base_member": code in pdd_codes, "geometry_conflict": conflict,
                          "identity_status": "SOURCE_FEATURE_REQUIRES_VERSION_REVIEW" if conflict else "SOURCE_FEATURE_RETAINED_NO_ALIAS_MERGE"})
    source_boundary_rows = list(plot_rows)
    # The current 160-code STC/VSD roster explicitly retains 66(1)-STC while
    # repository boundaries contain a separate 66-STC source feature. Never alias them.
    plot_rows.append({"plot_id": "registry:66(1)-STC", "legacy_plot_code": "66(1)-STC",
                      "province": None, "source_path": None, "boundary_source": "repository monitoring registry",
                      "boundary_role": "missing", "pdd_verified_geometry": False, "pdd_base_member": False,
                      "geometry_conflict": True, "identity_status": "REGISTERED_NO_CONFIRMED_GEOMETRY_KEEP_SEPARATE_FROM_66-STC"})
    write_csv(OUT / "plot_registry.csv", plot_rows, list(plot_rows[0]) if plot_rows else [])

    geometry_codes = {r["legacy_plot_code"] for r in plot_rows if r["boundary_role"] != "missing"}
    requested_candidates = {
        "1-STC": "Chanthaburi", "10-STC": "Chanthaburi", "10-VSD": "Chanthaburi",
        "56(1)-STC": "Krabi", "57(1)-STC": "Krabi", "58(1)-STC": "Krabi",
        "60(1)-STC": "Krabi", "101(1)-VSD": "Krabi", "105-VSD": "Krabi",
        "66(1)-STC": "unresolved",
    }
    by_code = defaultdict(list)
    for row in source_boundary_rows:
        by_code[row["legacy_plot_code"]].append(row)
    candidate_rows = []
    for code, expected_province in requested_candidates.items():
        matches = by_code.get(code, [])
        candidate_rows.append({"candidate_plot_code": code, "expected_province": expected_province,
                               "boundary_feature_count": len(matches),
                               "pdd_136_member": any(x["pdd_base_member"] for x in matches),
                               "source_geometry_verified": any(x["pdd_verified_geometry"] is True for x in matches),
                               "source_paths": ";".join(str(x["source_path"] or "") for x in matches),
                               "status": "BOUNDARY_FEATURE_RETAINED_SEPARATELY" if matches else "NO_MATCHING_FEATURE_IN_REPOSITORY_BOUNDARY_SOURCE"})
    write_csv(OUT / "candidate_plot_boundary_check.csv", candidate_rows,
              ["candidate_plot_code", "expected_province", "boundary_feature_count", "pdd_136_member",
               "source_geometry_verified", "source_paths", "status"])
    unmapped = sorted({r["source_plot_code_candidate"] for r in asset_rows
                       if r["source_plot_code_candidate"] and r["source_plot_code_candidate"] not in geometry_codes} |
                      {code for code in requested_candidates if code not in geometry_codes})
    write_csv(OUT / "unmapped_plots.csv", [{"candidate_plot_code": x, "status": "BOUNDARY_NOT_CONFIRMED"} for x in unmapped],
              ["candidate_plot_code", "status"])

    by_name = defaultdict(list)
    for r in asset_rows:
        by_name[(r["filename"] or "").casefold()].append(r)
    duplicates = [{"filename": name, "drive_file_ids": ";".join(x["drive_file_id"] or "" for x in group),
                   "count": len(group), "duplicate_basis": "same filename only; checksum not computed"}
                  for name, group in by_name.items() if name and len(group) > 1]
    write_csv(OUT / "duplicate_files.csv", duplicates,
              ["filename", "drive_file_ids", "count", "duplicate_basis"])
    write_csv(OUT / "qa_failures.csv", [], ["drive_file_id", "source_path", "qa_stage", "reason"])

    asset_tiffs = [r for r in asset_rows if "tiff" in (r.get("mime_type") or "").lower() or
                   str(r.get("filename", "")).lower().endswith((".tif", ".tiff"))]
    province_counts = Counter(r["province_candidate"] or "UNRESOLVED" for r in asset_rows)
    province_tiffs = Counter(r["province_candidate"] or "UNRESOLVED" for r in asset_tiffs)
    year_counts = Counter(r["scene_date"][:4] if r["scene_date"] else "NO_CAPTURE_DATE" for r in asset_tiffs)
    latest_by_province = {}
    for r in asset_tiffs:
        prov, day = r["province_candidate"] or "UNRESOLVED", r["scene_date"]
        if day and day > latest_by_province.get(prov, ""):
            latest_by_province[prov] = day
    status = {"status": "IN_PROGRESS", "checkpoint": cp, "discovered_file_metadata_count": len(asset_rows),
              "discovered_tiff_metadata_count": len(tiffs), "unique_drive_file_ids": len({r["drive_file_id"] for r in asset_rows}),
              "scanned_folder_count": cp.get("scanned_folders"), "pending_folder_count": cp.get("pending_folders"),
              "folder_listing_error_count": cp.get("listing_errors"), "pagination_verified": False,
              "inventory_complete": False, "tiff_binary_qa_complete": False, "source_drive_mutations": 0,
              "dates_by_filename_year": dict(year_counts), "files_by_province_candidate": dict(province_counts),
              "tiffs_by_province_candidate": dict(province_tiffs),
              "latest_filename_capture_date_by_province_candidate": latest_by_province,
              "note": "Metadata checkpoint only. Cloud access, checksums, complete pagination, all-file raster QA, geometry match, and ingestion are not complete."}
    (OUT / "ingestion_status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = ["# Nationwide Satellite Audit — IN PROGRESS", "",
               f"Checkpoint timestamp (UTC): {cp.get('date')}",
               f"Scanned folder listings: {cp.get('scanned_folders')}; pending distinct folders: {cp.get('pending_folders')}; listing errors: {cp.get('listing_errors')}; cap hits: {cp.get('saturated_folders')}.",
               f"Discovered metadata rows: {len(asset_rows)}; TIFF MIME/name rows: {len(tiffs)}; unique Drive IDs in this partial crawl: {len({r['drive_file_id'] for r in asset_rows})}.",
               "", "## Coverage limits", "", "This is a resumable partial checkpoint, not a completed nationwide inventory. Folder listing pagination is not exposed by the current connector, and pending subfolders remain. Capture dates are extracted only from filenames when recognized; created/modified timestamps remain separate metadata. TIFF bytes have not been read/QA'd except for one manual sample. No new scenes have been ingested into production.",
               "", "## Current candidate file counts by province", "", "| Province candidate | TIFF metadata rows |", "|---|---:|"]
    summary += [f"| {p} | {n} |" for p, n in sorted(province_tiffs.items())]
    summary += ["", "## Latest capture date seen by province candidate", "", "| Province candidate | Latest filename date |", "|---|---|"]
    summary += [f"| {p} | {d} |" for p, d in sorted(latest_by_province.items())]
    summary += ["", "## Outstanding acceptance criteria", "", "Complete Drive crawl and pagination proof; checksums and duplicate confirmation; full GeoTIFF QA and scene-date reconciliation; boundary identity reconciliation; new-scene processing and idempotent sync; production dashboard/report integration; UI/mobile/PDF export verification; CI/CD and deployment verification.", ""]
    (OUT / "nationwide_audit_summary.md").write_text("\n".join(summary), encoding="utf-8")
    print(json.dumps({"status": "IN_PROGRESS", "files": len(asset_rows), "tiff": len(tiffs),
                      "plots_in_boundary_source": len(plot_rows), "pdd_base_codes": len(pdd_codes),
                      "unmapped_candidate_codes": len(unmapped), "duplicate_filename_groups": len(duplicates)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

