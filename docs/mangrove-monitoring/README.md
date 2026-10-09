# Mangrove Monitoring Center — Read-only Web Preview

App URL: https://thanawat150.github.io/satelliteproject/mangrove-monitoring/

This is an **independent UI route**, but currently lives in the existing SatelliteProject GitHub repository so it can safely reuse already-published public data. It is **not yet** a separate secured production API, project database, or authenticated fieldwork platform.

## Functional screens in this preview

- Overview dashboard, company and province filters, data-coverage indicators
- Leaflet nationwide GIS and plot explorer, publicly published PDD/MOC geometry
- Plot Registry table (159 existing candidate geometries + one independently registered unresolved code)
- Sentinel-2 indices and graphs from original publicly published 136-plot QA source
- Satellite catalog source-file links only when source metadata exists
- Change detection and **candidate** alerts from previous QA-valid comparison records
- QA/QC and boundary reconciliation issues (do not treat zero-area or mismatched area as approved)
- Browser print/PDF, CSV templates, per-plot CSV and GeoJSON export
- Mobile responsive layout
- A directory specifying 26 complete-platform modules with honest implementation status

## Data API (read-only and relative to app)

- ../data/nationwide/boundaries_pdd_all.geojson (159 MOC candidate codes)
- ../data/nationwide/boundaries_pdd_136.geojson (136 canonical approved PDD cohort)
- ../data/nationwide/nationwide_results.json (462 scenes, 241 QA-valid dates in the 2026-10-09 baseline)
- ../data/nationwide/nationwide_run_status.json (136 processed, 126 plots having >=1 QA-valid date)

The 160th registry code **66(1)-STC** is deliberately shown as "no reconciled geometry". It is **not** placed on the map. EVR total remains UNKNOWN and is **not** shown as zero.

Data statuses are independent: registry source, boundary QA, satellite scene availability, plot QA and environment interpretation. Never label unverified increase in water as flood, or missing imagery as healthy forest.

## Privacy / access

Do not ship full 160-plot private Google Sheets, personal field GPS/photos, contractor details, owner contacts, public-writable Drive credentials/permissions or unrestricted source file IDs through this site. Any submission, alert acknowledgement, boundary approval or field survey requires authenticated API with per-project row-level permissions and audit logs.

## Production pathway

Master spec: ../../architecture/MMC_MASTER_SPEC_v2.md (repository path, not a live Pages path)
Draft SQL: ../../architecture/mmc_schema_v1.sql (design only)
Data reconciliation: ../../architecture/mmc_reconciliation_queue_v1.json
Source architecture: ../../architecture/MANGROVE_MONITORING_CENTER_BLUEPRINT_v1.md

1. Review all 160 STC/VSD source rows privately and resolve 66(1)-STC / 9-STC boundaries and version priority.
2. Obtain verifiable EVR plot roster and spatial source, preserve all original plot identifiers.
3. Stand up a private PostGIS project with RLS, migration audit and read-only import API.
4. Migrate results without changing QA and provenance, then process additional 24 STC/VSD plot records.
5. Add authenticated fieldwork, planting, survival, drone, carbon and MRV modules.
6. Add tide/season-adjusted changes and reviewer workflow before automated risk notifications.
7. Split the frontend into its own deployment/repository and keep SatelliteProject as an ingest/analysis provider.

## Testing

GitHub workflow: .github/workflows/mmc-preview-smoke.yml
Run Playwright smoke locally with:
    node --check docs/mangrove-monitoring/app.js
    python -m http.server 8877 --bind 127.0.0.1 --directory docs
    node scripts/test_mmc_preview.cjs

Tests exercise 160 public-registry placeholders, QA coverage, charts, source links, unconnected modules and mobile menu. Passing the test does not mean all 26 modules are complete.

## Latest generated raster coverage (2026-10-09)

- 125 of the 136 canonical PDD plots have at least one true-color/false-color or spectral-index Raster Preview, including 19 existing preview plots.
- 234 unique plot-date image sets: 65 from the prior archive and 169 generated via original 10m+20m TIFF processing.
- Generated images contain actual Sentinel-2 RGB and NDVI/NDRE/NDMI/NDWI/MNDWI/BSI pixel values; generated indices are SCL masked, never simulated.
- Source analysis contains 126 plot codes with at least one QA-valid scene; one of them (69-VSD) still has no imagery preview because Drive download failed.
- Ten canonical PDD plots do not have a QA-valid observation. The system must not imply they are healthy or damaged.
- Three source plot-date image pairs were unavailable to gdown: 94-VSD, 69-VSD, 78-STC (see imagery_render_errors.json); some of these plots have images for other dates.
- This is a display and monitoring preview, NOT an approved audit/MRV report or a model validated against independent ground truth.
