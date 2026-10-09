# Mangrove Monitoring Center — Central Data Blueprint v1

Status: DESIGN / NOT DEPLOYED
Survey date: 2026-10-09 (Asia/Bangkok)
Scope: All STC, VSD, and EVR plots, including non-PDD plots and future additions.
Owner-facing purpose: reliable monitoring, not a fixed-size satellite-image gallery.

## 1. Verified evidence and inventory

| Source | Findings | Status |
| --- | --- | --- |
| Google Sheet "Mangrove Project", tab Data | 160 distinct plot codes: 87 STC, 73 VSD; 16 provinces | Confirmed registry source; not the only potential project |
| Google Sheet "Database โครงการปลูกป่าปี 2565 (160 แปลง)" | Planting dates, PDD/department areas, T-VER and survival survey columns; one additional duplicate source row of 66(1)-STC | Requires field/row QA |
| Google Sheet "database แปลงปลูก" | Planting areas, counts, tree species, survival rate fields and monitoring details | Supplementary; many blanks |
| Existing canonical PDD geojson | 136 verified source codes: MOC_1 60, MOC_2 71, Standard 5 | Existing production baseline |
| Existing MOC candidate GeoJSON | 159 distinct source plot codes: 136 above plus 23 MOC_3 | Boundary source, NOT equal to all project plots |
| 160-registry vs 159 MOC candidate | Missing polygon under code 66(1)-STC; conflicting 66-STC geometry versions | Manual boundary crosswalk required |
| SatelliteProject analysis | 136/136 with source scenes; 126 with at least one AUTO_VALID date; 462 scenes; 241 AUTO_VALID scenes | Reuse original results and QA |
| Existing Satellite archive | 15 provinces in daily image folder and 136 PDD catalog codes in annual/history manifests | No claim of full 160/EVR coverage |
| "แผนที่รวมแปลงปี 66.kml" | Seven placemarks, four codes not in current 160 registry (99-STC, 100-STC, 101-STC, 106-VSD) plus three PBI features | External candidates only |
| EVR | No verified registry, spatial boundary, or image manifest found among surveyed sources | UNKNOWN; NEVER assume zero EVR plots |

**Do not assert the total count for STC+VSD+EVR until EVR and additional plot sources are reconciled.**

## 2. Known GIS QA issues

1. 66-STC (registered 30.49 rai) and 66(1)-STC (registered 54.18 rai) must remain **distinct plot entities**. MOC source has inconsistent versioned geometries associated with 66-STC; do not auto-relabel a geometry as 66(1)-STC merely because the area is similar.
2. 9-STC registry PDD area 47.39 rai but candidate polygon area is 0; boundary MUST be flagged invalid/missing.
3. At least seven plot codes have >5 rai discrepancy between registry PDD area and source polygon area (9-STC, 89(1)-STC, 4-STC, 13-VSD, 11-VSD, 1-STC, 2-STC).
4. Rayong department-confirmed and historical PDD geometries are separate boundaries; do not mix trend metrics across boundary revisions without explicitly reprocessing.
5. The source 160 spreadsheet includes two entries under 66(1)-STC (54.18 and 34.87 rai); row-level reconciliation required.
6. Plot photos/GPS records can contain identical coordinates for different plot codes or generic codes like PLOT-001; ingest as unmatched observations until reviewed.
7. Source Google Drive data permissions should be audited; some sampled TIFF/plot folders exposed "anyone writer" metadata. The platform must never depend on public write access.

## 3. Domain model and keys

- project: management/program grouping, not the suffix on the plot code.
- plot: permanent UUID; project_id; canonical_plot_code; company STC/VSD/EVR/OTHER; province and administrative names; enrollment state; original registry source. Plot exists even with no geometry, no PDD, and no satellite image.
- plot_alias: source spelling variations and old names (e.g. 71_1_-VSD -> 71(1)-VSD), with explicit approved plot mapping and audit; never fuzzy-merge 66-STC and 66(1)-STC.
- plot_boundary: plot_id + boundary_id + boundary_type (DEPARTMENT_CONFIRMED, PDD, SURVEY, PLANTED, DRAFT, OTHER) + source + source CRS + effective period + verified flag + MultiPolygon 4326; keep originals/versions and distinguish published geometry from source geometry.
- data_source and data_import_run: source IDs, source file/API, scan time, file hashes, license/privacy, ingestion status, warnings, source rows.
- satellite_scene: sensor, acquisition datetime and tile/granule, scene ID, atmospheric processing level. Different scenes on the same date need separate scene IDs.
- satellite_asset: scene, plot, band content/role (10m, 20m, QA, preview), Drive File ID/immutable object URL, CRS, resolution, checksum, access status. Ingestion never requires public-writer permissions.
- analysis_run and plot_observation: code version, scene, plot, boundary_version_id, valid pixel count, QA status and provenance. QA applies to the plot (not scene cloud cover alone).
- observation_metric: typed numeric metrics (NDVI, NDRE, NDMI, NDWI, MNDWI, BSI, SAVI, EVI, GLI, water_rai, vegetation_rai, bare_soil_rai etc); NULL for metrics unavailable due to QA.
- change_event: baseline observation, current observation, overlap of valid pixels, net/new/lost area, confidence; different geometry versions require explicit migration/reprocess.
- field_survey: survey date, actual plot, method, observed area, count, survival %, photos/coordinates, evidence and verifier.
- alerts: plot_id, type, risk rule version, severity, evidence, data QA, event status, reviewer, resolution.

### Independent status axes (NEVER combine)

A. REGISTRY: CONFIRMED / NEEDS_RECONCILIATION / CANDIDATE
B. BOUNDARY: VERIFIED / CONFLICT / DRAFT / MISSING
C. IMAGERY: READY / STALE / NO_SOURCE / DOWNLOAD_FAILED
D. QA: AUTO_VALID / PARTIAL / NO_DATA / NOT_ANALYZED
E. ENVIRONMENT: NORMAL / WATCH / INVESTIGATE / UNKNOWN

Unknown or cloudy imagery MUST NOT be shown as "healthy forest" or "damaged forest".

## 4. Ingestion design

1. Source registry import: read the 160-source row set; normalize canonical codes but retain source row IDs and original strings; de-duplicate 66(1)-STC under review instead of overwriting values.
2. GIS import: read 136 canonical, 23 MOC_3, confirmed-department, legacy PDD, KML and future EVR polygons separately. Validate topology, holes, CRS 32647/32648, nonzero area, implausible coordinates, source geometry and temporal versions. Do not use a candidate as an approved boundary automatically.
3. Reconciliation service: exact source aliases then plot match; area/geometric discrepancy queue; create boundary review tasks. No area-based name inference.
4. Satellite inventory: ingest scene metadata + assets from existing Drive/GEE catalog without copying TIFF to the database. Require 10m/20m bands to match scene ID and acquisition time, not just a date folder. Source TIFF remains immutable.
5. QA and analysis: use existing Python/Rasterio as bootstrap. Preserve 136 baseline results, add source-scene and boundary UUID crosswalk. Use SCL, valid pixel count, masked indices and time-series; prefer GEE for large-scale discovery and composites; keep algorithm version and threshold.
6. Publishing: write only validated results into PostGIS; generate vector tiles/GeoJSON and signed preview asset links via API. Platform reads API, never filesystem naming conventions.
7. Alerts: quality checks first; satellite anomaly -> candidate alert -> optional tide/season filtering -> field verification -> confirmed incident. Never equate water increase with flood automatically.
8. Keep migration in read-only mode until the full reconciliation and user approval; no deletion/moving of original Drive files.

## 5. Technical stack (recommended, not yet created)

Frontend: React + Vite + TypeScript + MapLibre GL JS (Leaflet acceptable for MVP), deployed separately as mangrove-monitoring, mobile first.
API/auth: Supabase Edge Functions or FastAPI, JWT/roles, input validation and audit.
Database: PostgreSQL + PostGIS, tenant/project-aware ACL; enable RLS on all operational tables.
Media: existing Google Drive TIFF references first; private object storage later; thumbnails/COGs/tiles generated on demand, no TIFF served directly into large galleries.
Analysis: Python + Rasterio / GeoPandas + Earth Engine for discovery and long time series; scheduled queues/jobs with retries, idempotent plot/scene IDs; logs persisted.
Repo separation: SatelliteProject = imagery processing and legacy app; Mangrove Monitoring Center = operational GIS app; versioned shared data contract instead of direct cross-repo mutations.

## 6. UX sitemap

Dashboard > Province / Company / T-VER > Plot Explorer > plot overview + imagery compare + trends + field work.
Data Catalog > TIFF inventory > provenance, sensor, dates, band manifest, download links (access-controlled).
Environment Analysis > water, vegetation, soil, baselines and QA filter > change summary.
Boundary Manager > versions, conflicts, source history and supervisor approval.
Field Survey > GPS/photo upload and validation > survival/height/species monitoring.
Alert Center > candidates / verification / resolved > handover.
Reports > province, program and plot; freeze boundary version and data dates for reproducibility.
Admin > sources, users, roles, import runs, quality backlog.

## 7. Release stages and criteria

P0 | Reconcile 160 and EVR source, especially 66(1)-STC and zero-area polygons; no premature "all plots" count.
P1 | Deploy private canonical registry + PostGIS boundaries; all 160 STC/VSD present (including missing-boundary status); EVR import path ready.
P2 | Import 136 baseline analyses and 24 other plot records, surface 'not analyzed' for those without valid source TIFF.
P3 | Plot explorer/map and 16-province dashboards; all status axes exposed; links to immutable source and evidence.
P4 | Weather/tide-aware water interpretation, seasonal baseline, canopy monitoring, field verification and reporting.
P5 | Automated alerting, recurring satellite discovery, QA audits and nationwide expansion.

### Acceptance tests

- All 160 STC/VSD IDs are imported exactly once and code 66-STC != 66(1)-STC.
- Each non-PDD plot appears on registry even when it has no polygon or satellite data.
- All 136 legacy results retain exact scene dates, metric values, and QA; no invented zero.
- Each monitoring value links to source scene + band manifest + boundary version + algorithm version.
- Plot 9-STC invalid geometry cannot silently enter area-based analysis.
- Permission boundary: public frontend cannot access editable/raw staff records or credentials.
- EVR counts remain UNKNOWN until a verifiable roster/source is imported.
- Dashboard shows confirmed coverage, QA coverage, boundary coverage and candidate alerts independently.

## 8. Open decisions

- Obtain authoritative EVR plot roster, geometry and ownership/operation boundaries.
- Confirm whether the four additional 2023 KML codes and three PBI features are active project plots or separate datasets.
- Approve priority and revision history for confirmed-department vs PDD vs field-drawn boundaries; manually resolve 66(1)-STC.
- Agree on hosting, access model (staff/internal vs publicly viewable), and project ownership before provisioning the database or publishing registry records.

Source pointers (public repo): docs/data/nationwide/{pdd_scope_136.json,boundaries_pdd_all.geojson,boundaries_pdd_136.geojson,nationwide_results.json,nationwide_run_status.json}; the Google Sheets and KML mentioned above remain at their existing private Drive locations.
