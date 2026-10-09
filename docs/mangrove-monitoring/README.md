# Mangrove Monitoring Center — Read-only Web Preview

App URL: https://thanawat150.github.io/satelliteproject/mangrove-monitoring/

This is an **independent UI route**, but currently lives in the existing SatelliteProject GitHub repository so it can safely reuse already-published public data. It is **not yet** a separate secured production API, project database, or authenticated fieldwork platform.


## Update — 2026-10-09: QA-integrity and Plot Intelligence

This update changes the **live read-only preview** but does not create an authenticated production platform.

- New **Plot Intelligence & Decisions** page: plot-level QA provenance, two-valid-date *descriptive* numerical differences (not pixel change polygons), small-plot warnings, current raster-preview coverage, action checklist, and evidence JSON.
- New **QA ↔ Raster Preview Integrity** list on Overview and QA/QC. Export missing plot-date pairs as CSV, with links to original TIFFs where source metadata exists. A date present in analysis but missing in preview is marked explicitly; it is never replaced with a different date.
- In the imagery explorer, QA-valid dates without a rendered image appear as selectable **missing-preview dates** and display a warning. The default date is the latest QA-valid observation rather than simply the latest image preview date.
- Early-warning candidate thresholds use **10% of common comparable clear area** by default (switch to rai if needed). Water **increase**, vegetation **decrease**, and bare-soil **increase** are screening directions, not proof of a flood or degradation.
- The *next execution* of `scripts/nationwide_process.py` (algorithm `pdd-full-monitor-v1.1`) compares consecutive QA-valid dates even when NO_DATA dates intervene, and calculates water/vegetation/soil/other clipped areas consistently with the PDD polygon. Existing published results retain their previous `v1.0` values until the source TIFF processing is rerun and QA-reviewed.

**Known example:** `15-STC` has four processed dates, and `2026-10-07` is QA-valid in the existing result, but no corresponding image preview is present in the manifest. Its total QA sample is only 19 pixels on the 20 m analysis grid. Do not interpret the observed difference as independently verified forest growth or flooding. The missing preview is shown explicitly and the original TIFF is linked.

**Remaining gates:** rerender 33 QA-valid plot-date previews absent from the existing published manifest, reprocess affected valid-date comparisons with matching TIFF pairs, independently validate change accuracy, reconcile all registry/boundary versions including EVR, and deploy authenticated database/workflows before calling the system production-ready.

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

## 30-STC native-resolution RGB and quality review (2026-10-09)

For the 30-STC screenshot (Phang Nga, 2026-09-30), the published prior
true-color JPEG/WebP raster was displayed on a **5 × 7 pixel 20 m grid**,
even though its source TIFF RGB channels are 10 m. The UI's AUTO_VALID
100% was simply **5 SCL-accepted 20 m pixels out of 5** for the polygon,
not a guarantee of zero clouds, accurate tree counting or good RGB color.

- Regenerated actual B4/B3/B2 and B8/B4/B3 at **native 9 × 13 RGB pixels**
  for 2026-09-22 and 2026-09-30 (10 m source). The eight spectral mode
  images remain available; spectral indices use original **20 m band
  information**, never synthetic 10 m index resolution.
- Per-image geographic bounds are stored separately for 10 m RGB and
  20 m indices, so the red polygon follows the correct raster extent.
- Native RGB brightness/near-white fraction is checked separately **within
  the PDD polygon** and clearly labeled as a *display/radiometric
  screening signal*, not a verified cloud or land-cover classification.
  The current 30-STC 2026-09-30 preview has 19 SCL-valid sampled 10 m
  RGB pixels and 21.1% rendered near-white pixels. The broader
  classification still has only 5 sample pixels on its 20 m grid.
- The UI now labels SCL QA and its pixel denominator, native RGB dimensions
  and white-pixel checks, and uses pixelated display rather than implying
  that the blurred upscale resolves individual trees.
- The generator supports an optional manual `refresh_plots` workflow
  input; normal incremental builds are idempotent when previews already
  exist. These corrections don't retroactively change original TIFFs or
  assert a new cloud-free result.

## Full satellite history for each plot (2026-10-09)

- The Satellite Explorer and printable Report Center display **all available dates** for the selected plot, with all **8 raster modes** (true color RGB, false color, NDVI, NDRE, NDMI, NDWI, MNDWI, BSI) in a dated grid and a real polygon outline for each image.
- Days with Raster but `NO_DATA`/failed QA remain visible for inspection and carry a caution; missing assets are explicitly marked missing, never synthesized or silently replaced with basemap imagery.
- Archived previews may lack one of the 8 modes; the corresponding slot says no image rather than synthesizing data.
- The original true-color image/map and QA-valid Before/After controls are retained above the full-history grid. Each dated section can be selected directly on the georeferenced map.
- Incremental raster pipeline now iterates **every QA-valid acquired date**, not only earliest and latest. As of this run, **241/241 QA-valid plot-date entries** have matching published preview entries; **126 distinct plots** have any Raster Preview. This is coverage of existing analyzed dates, **not coverage of every registered STC/VSD/EVR plot**.
- Rendering the full gallery is lazy-loaded for images and the old per-part JSON archive is fetched once per part. Real source TIFFs remain unchanged.

## Raster boundary overlays (2026-10-09)

- Satellite Catalog, Environmental Analytics, Plot Intelligence and Report Center now draw the selected **published plot polygon as a red outline on top of each real raster image** — main scene, before/after comparisons, and all index/RGB thumbnails.
- The outline follows Polygon/MultiPolygon geometry including holes from the existing GeoJSON, transformed into the raster's geographic bounds with Web Mercator scaling to match the Leaflet overlay. It is not a rectangular bounding box.
- Red outlines are positioned to match `object-fit: contain` on desktop, mobile and print. The **ขอบเขตแปลง** control toggles them in all raster images and the georeferenced Leaflet map.
- Boundary source is labeled PDD or MOC 3 according to the available geometry, **not asserted as department-confirmed or certified legal boundary**. Missing geometries and imagery are left missing, never invented.
- GeoTIFFs remain unchanged; the overlay is rendered in the web browser and is not burned into the raw raster.

## Latest generated raster coverage (2026-10-09)

- 125 of the 136 canonical PDD plots have at least one true-color/false-color or spectral-index Raster Preview, including 19 existing preview plots.
- 234 unique plot-date image sets: 65 from the prior archive and 169 generated via original 10m+20m TIFF processing.
- Generated images contain actual Sentinel-2 RGB and NDVI/NDRE/NDMI/NDWI/MNDWI/BSI pixel values; generated indices are SCL masked, never simulated.
- Source analysis contains 126 plot codes with at least one QA-valid scene; one of them (69-VSD) still has no imagery preview because Drive download failed.
- Ten canonical PDD plots do not have a QA-valid observation. The system must not imply they are healthy or damaged.
- Three source plot-date image pairs were unavailable to gdown: 94-VSD, 69-VSD, 78-STC (see imagery_render_errors.json); some of these plots have images for other dates.
- This is a display and monitoring preview, NOT an approved audit/MRV report or a model validated against independent ground truth.
