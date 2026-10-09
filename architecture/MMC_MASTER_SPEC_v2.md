# MMC — Mangrove Monitoring Center | Full Product Specification v2
Document status: DESIGN / READ-ONLY WEB PREVIEW FIRST.
Date: 2026-10-09. Audience: Forestry, GIS, remote-sensing, operations, MRV, executives.

## Non-negotiable mission

Track every STC, VSD, EVR and later-added mangrove project plot, whether or not the plot has a PDD polygon or satellite scene, and join geospatial, remote sensing, fieldwork, restoration, compliance and MRV evidence. Data quality is a first-class concept, never silently converted to healthy forest, destroyed forest or numeric zero. The app is NOT a gallery clone of SatelliteProject.

## Verified starting data and scope

- Public SatelliteProject: 136 existing PDD analyses; 462 processed plot-date observations; 241 QA-valid dates; 126 plots have >=1 QA-valid date; 10 plots have no QA-valid date.
- Existing public boundaries: 136 canonical PDD + 23 other MOC3 candidates = 159 plot codes. These two sets overlap none. The 159 candidate polygon files are not interchangeable with approved registry.
- Audited registry in connected private spreadsheets: 160 STC/VSD codes (87 STC, 73 VSD), 16 provinces; separate project-specific 66(1)-STC not present under its own correct code in published MOC boundaries; multiple versions and 9-STC zero-area anomaly.
- EVR number and definitive boundary source unknown; do not assume zero or synthesize plot codes.
- 2023 KML includes unverified additional codes: they are review candidates only, not production plot count.
- Source satellite archives 2020–2026 have historical multisenor imagery, some year-median composites (not equivalent to single acquisition dates), plus daily/near-current images.
- Inventory source IDs may point at public writable Google Drive; do not copy confidential registers, user identity, personal field notes or privileged Drive links into a public web preview.

## Modules, screens and acceptance criteria

| # | Page | Mandatory functions | Initial data / implementation |
| - | - | - | - |
| 01 | Overview | Plot and province counts; selected company / PDD cohort; coverage by registry/boundary/satellite/QA; alerts and last refresh; filters shared with map/table | Public records; no invented EVR total |
| 02 | Nationwide GIS | Satellite/street basemap; 159 published polygon candidates; legend by source/cohort and QA; multi polygons/holes; zoom by province/plot; visual selection; export selected geojson | Existing MOC GeoJSON |
| 03 | Plot Registry | Plot lifecycle, code aliases, STC/VSD/EVR, administrative area, planted vs PDD vs department area, year, T-VER, staff owners (restricted), evidence, additions, deactivation | Private registry via server later; public preview only publicly known IDs and incomplete flag |
| 04 | Boundary Manager | PDD vs department verified vs field drawing, multiple versions; topology, holes, coordinate system, temporal validity, area consistency, overlap and missing geometry review; supervisor approval | Canonical PDD and MOC3 separate; 66(1)-STC and 9-STC investigation |
| 05 | Satellite Explorer | Date/scene search and QA filters; S2/L8-L9 historical scenes; RGB B4/B3/B2 and B8/B4/B3; compare swiping/map; RAW TIFF download subject to permission; catalog; band manifest | 136 existing observation records; imagery URLs only when known; no fake previews |
| 06 | Vegetation | NDVI, NDRE, SAVI, EVI, GLI with plot-level distribution/time series and masks; growth trend by seasonal baseline; alternate methods for mangroves; uncertainty | Existing index values; seasonal models future |
| 07 | Water | MNDWI/NDWI, water_rai, new/lost water, persistent vs temporary, tidal range and climate/precipitation context, change validation | Existing water metrics; no automatic flood assertion |
| 08 | Soil / moisture | BSI, NDMI, exposed soil area, wetness_rai, plausible seasonal/phenology patterns, field verification | Existing index values and masks |
| 09 | Change detection | pixel-common-valid area, net/new/lost water, veg/soil change, change polygons; compare years and exact scene IDs; baseline versions | Existing "changes" records |
| 10 | Growth and survival | trees planted, survival count, survival %, heights/DBH, species, planting year, sample plots, repeat censuses, stocking trees/rai, DBH and regeneration | Private forestry sheets after authenticated ETL |
| 11 | Drone / LiDAR | Flight inventory, GCP/RTK, orthomosaics, CHM/DSM/DTM, tree crowns, tree detection estimates and validation, canopy height and uncertainty | Future; model not falsely marked production |
| 12 | Field Ops | team schedule and offline mobile GPS work queue, photo evidence, geofenced check-in, sample plots, species/patrol/invasive species/damage, verification handover | Future authenticated API |
| 13 | Carbon MRV | stratum, plots and project periods, AGB/BGB, allometry chosen and documented, carbon stock, tCO2e, uncertainty, baseline and verification documentation; no unsupported carbon credit issuance | Calculated only after method and approvals |
| 14 | Early Warning | Rule-versioned candidate anomalies, data availability events, tidal season checks; dedup; review/resolve and evidence trail; configurable thresholds | Public preview may show REVIEW CANDIDATE from actual QA-valid change events only |
| 15 | Reports | plot/province/company/T-VER summary, freeze scene IDs + geometry revision + algorithms, CSV/XLSX/PDF, print-friendly image comparison | CSV and browser print in preview, PDF backend later |
| 16 | QA/QC | incoming file checks, cloud SCL counts, nodata, CRS EPSG:32647/32648, 10m/20m pairing by acquisition ID, layer topology, geometry areas, source file fingerprints, run logs | Existing results + flagged geometry cases |
| 17 | Data Catalog | source file inventory; Google Drive reference, provider metadata, file hash/version, updates, storage use, provenance lineage; preview and permission checks | Public data manifests only |
| 18 | Processing Center | scheduled GEE discovery, retries, completeness dashboard, job traces, queue prioritization, batch status and audit; human override controls | Existing GitHub Actions + Python; later job API |
| 19 | Project / Work Orders | planned vs actual planting, owner contractor, milestones, procurement, tasks, field assignments, budgets, evidence and approvals | Private operational backend later |
| 20 | Accounts / Security | SSO/Auth, internal/external/public roles, row-level security by project, field-level privacy, action audit, encrypted secrets, versioned backups/restore | Not available on static Pages; default read-only |
| 21 | Environmental context | rainfall, tide stations, river water levels, storms, DEM, salinity field readings and soil properties where sourced | Optional external ingestion; avoid treating reflectance as salinity |
| 22 | Ground verification | field verification status, photo/GPS, drone corroboration, evidence checklist, comment/assignment/resolution | Authenticated private backend later |
| 23 | API / Integrations | Google Drive/Sheets data contract, GEE, GitHub Actions, STAC where available, organization webhooks, QGIS export GeoJSON/GeoPackage, OGC tiles | Versioned API required |
| 24 | Spatial analytics | restoration priority, density trees/rai, distance to hazards, spatial joins, confidence/uncertainty, interannual land-cover classification | After baseline truth and QA |
| 25 | Notifications | email/chat internal alerts, SLA, digest preferences, suppression during bad QA, escalation chain | Opt-in after verified rules |
| 26 | Backup / disaster recovery | immutable source, incremental storage snapshots, rerunnable analytics, checksum audit, recovery runbook | Mandatory production gate |

## User journeys

- Executive: select all projects / province / STC/VSD/EVR -> summary 160 confirmed STC/VSD + EVR unknown -> plots requiring field check -> drill down -> generate period-locked report.
- GIS operator: open missing-geometry queue -> compare source boundary revisions and area discrepancies -> approve canonical version -> reprocess affected plot only -> publish QA audit.
- RS analyst: choose plot -> pick exact scenes or annual median with correct temporal metadata -> QA filter -> compare identical boundary version + common clear pixels -> annotate candidate anomaly -> request verification.
- Field team: accept plot work order -> offline collect GPS/photo/height/DBH/survival -> sync -> supervisor review.
- MRV verifier: use only verified geometry+methods+provenance; export reproducible calculation/evidence pack.
- Administrator: grant least privilege, check Drive exposure and identify source drift, process failures and backup restoration.

## Global interaction standards

- Single global plot/province/company filters persist across modules; URL carries plot and view safely; no blank plot reset.
- Desktop 1440px and mobile <=390px; keyboard, focus, accessible legend, map/list sync and text alternatives.
- Fixed bottom mobile navigation to 4 most used screens; advanced screens reachable menu.
- Loading/error/empty states differentiate: NO_IMAGE, QA_NO_DATA, NO_BOUNDARY, NOT_PROCESSED, NOT_CONNECTED, RESTRICTED, SOURCE_ERROR.
- PDD area not equivalent to planting area or department-confirmed area; label with boundary type and version.
- Environment state UNKNOWN when no comparable QA-valid dates. NO_DATA != healthy.
- Explicit last refresh and last acquisition (separate dates), sensor, source and algorithm.
- Never hallucinate images, acquisition dates, bands, field survival %, MRV credits or flood.
- Provide permissions before any mutating action. Public static preview is read-only.
- Source scenes may have duplicates/same-date tiles; key by product ID and acquisition time; never date-only dedupe.

## Source-of-truth and boundaries

Registry authoritative source is a verified program roster imported privately; database UUID immutable.
Boundary lifecycle: DRAFT -> SOURCE_CHECKED -> TOPOLOGY_CHECKED -> RECONCILED -> APPROVED -> SUPERSEDED. Never relabel 66-STC geometry as 66(1)-STC based on area.
Satellite processing: pass SCL >=70% usable based on classes 2,4,5,6,7 and finite reflectance as current method, record per-plot QA; allow threshold version evolution with A/B results.
Composites: annual or period median have start/end dates and composite flag, not acquisition day.
Change-event: same approved boundary version and comparable clear-pixel mask; when versions change recompute historical image results on reference geometry (or label incomparable).
Alerts: quality gate first, seasonal/tide check second, candidate signal third, human confirmation before tagging as damaged/illegal.
MRV: record methodology, allometry, plot strata, parameter uncertainties and audit trails. Spatial NDVI alone never creates certified credits.

## Architecture and release

Frontend React/TypeScript + MapLibre/Leaflet; service API FastAPI/TypeScript; PostGIS/PostgreSQL with RLS and immutable audit. Queue Python Rasterio/GEE and cloud storage for COG/previews. Keep SatelliteProject as existing ingest/analysis legacy until authoritative migration. Expose only approved sanitized data publicly.

Release A (NOW): read-only public-data demo: 159 MOC polygons (136+23), missing-boundary cohort indicator (160 registry), 136 results with QA, plot explorer, map, changes, CSV, issue queue, report; all private modules visibly NOT CONNECTED.
Release B: authenticated source registry for all 160 and EVR onboarding; PostGIS; boundary resolution and source reconciliation; no public export of private registries.
Release C: automated ingestion and new processing for 24 plots outside original 136; preview TIFF/COG; full QA/metadata.
Release D: field work, drone, survival, MRV and reviewers; tide/season data and alert verification.
Release E: scheduled updates, verified carbon MRV, production operations, DR and monitoring.

### Production acceptance
- 160 private registry records no alias collisions; EVR intake open but unknown count.
- Existing 136 exact QA scene results preserved.
- 23 MOC3 plots retained, not claimed QA-success.
- 66(1)-STC and 9-STC flagged until approved geometry.
- No private staff/field GPS, editing permission or Drive writer links exposed in public.
- End-to-end auth/role tests, source lineage, error recovery, backup test and policy review.
- Mobile map/table interaction and all report calculations verified; dashboard performance target <3s for cached aggregates.

## Explicitly out of scope for read-only demo
Creating actual accounts, modifying Drive, field data uploads, carbon credit issuance, official determination of deforestation, flood or legal encroachment, and automatic EVR count. These require authorization, source data and review.
