# MMC Report Methodology & Acceptance Criteria (v2)

## Purpose
Produce a **decision-oriented environmental monitoring report**, not a satellite-image catalog. This policy is based on reviewing the user's `ss.pdf` (14 pages, Rayong monitoring, 2026-10-11) and on the distinction between remote-sensing screening and verified impact assessment.

## Mandatory reporting logic
1. **Decision question**: interpret the user's intent and scope (plot/province/nationwide, flood/forest/general/audit), identify the period and audience.
2. **Evidence inventory**: enumerate all registered plots (including no-data), actual image dates and acquisition products; show the newest **available** acquisition separately from the newest **QA-valid** acquisition.
3. **Scene quality**: SCL-based valid percentages are *not* classification accuracy. Validate band presence, CRS, geometry, footprints, cloud/no-data and plot coverage. RGB/index preview transparency is a display-quality check, not independent product validation.
4. **Paired change**: a difference of separately computed per-scene mean indices is labeled an **index-mean screening comparison**. Do **not** call it validated spatial pixel change. To validate change, reproject to a common CRS/grid and intersect masks at identical geographic pixels. Report the common-valid pixel count, comparable area, denominator, and dates, and compare on that exact intersection. Until those outputs are generated, the report must explicitly say that common-pixel comparison is unverified.
5. **Visual interpretation**: read true color, false color and all available NDVI, NDRE, NDMI, NDWI, MNDWI and BSI images. Make observations date-specific and strictly inside GIS polygons. A color change alone is not a certified inundation, forest survival rate, mortality, encroachment or ecological recovery.
6. **Mangrove-specific competing explanations**: check tidal stage, rainfall, seasonal changes, clouds, shadows, surface water and spatial resolution. Do not declare flooding from increased MNDWI without suitable evidence. Sentinel-2 source bands have different native resolutions; display resampling does not increase native information.
7. **Risk/finance**: plot geometry area is neither damaged area nor loss of investment value. Financial exposure requires credible project boundaries, liabilities, costs/contracts and independently reviewed impact claims.
8. **Actionability**: every major finding has evidence, limitation, owner role, required next evidence and a specific sign-off condition.
9. **Document design**: lead with an executive status and illustrated findings; explain technical terms; use readable A4 charts with dates and values. Move full 6-index plot matrices and extensive imagery to separately printable technical appendices by default.
10. **Audit**: preserve before/after dates and both TIFF identifiers, processing-method version, mask rules and uncertainty. Never replace missing data with 0.00.

## Evidence levels — MMC internal labels (not ISO/CEOS certification)
- **E0**: No adequate scene evidence in the selected period.
- **E1**: Visual or one-date source evidence; no validated date pair.
- **E2**: Two QA-valid source dates with a numeric *mean-index screening* comparison, not independently validated.
- **E3**: An area-specific, independently checked common-valid-pixel change product with documented accuracy/uncertainty.
- **E4**: Evidence is adequate for the stated management or audit decision and has explicit authorized sign-off; this is not automatic from E3.

The current static report data supports **at most E2**. Reports must not claim E3 or E4 until supporting results and sign-off records exist. Any visual-preview completeness below full coverage must be disclosed; missing pixels are not zeros or unaffected area.

## Lessons from `ss.pdf` (the actual supplied example)
- Rayong registry: **19 plots**. Reported QA pairs: **17/19**; do not silently omit the other two.
- At the example **14-STC**, the source-derived image preview dated **2026-10-07** shows approximately **85.12%** inside-polygon visual coverage, while SCL QA is **82.35%**. They are **different quality measures**.
- Example separate-scene index mean changes for 14-STC, **2026-09-29 → 2026-10-07**: NDVI **+0.19**, NDRE **+0.11**, NDMI **−0.12**, NDWI **−0.18**, MNDWI **−0.37**, BSI **+0.04**. These do **not** establish recovery or whole-plot water recession without comparable-pixel validation.
- The source PDF also includes data through **2026-10-07**, but some plots end earlier. Dates must be explicit for each finding.
- The earlier draft spent **four pages** on raw six-index matrices and did not provide clear sign-off requirements. The revised main report uses a six-index synthesis table; detailed plot matrices are annexed.

## Release checks
- [ ] Exact request “ทำรายงานติดตามแปลง ระยอง” selects all 19 Rayong plots.
- [ ] Executive section contains mutually exclusive trend groups, current-vs-old scene distinction, and an explicit **screening-only** gate.
- [ ] There are no invented costs, affected hectares/rai, validated common-pixel ratios, or field verification claims.
- [ ] Every present image is marked with date, plot and mode, bounded by plot geometry, and incomplete preview alpha is flagged.
- [ ] A4 layout has no text/figures crossing the footer on *any* page, not only the first eight preview pages.
- [ ] Full raw index matrices are accessible only by explicit technical/appendix choice.
- [ ] Audit pages show evidence status, before/after dates, both TIFF source identifiers and limitations.
- [ ] CI browser smoke tests and deployment succeed; then review a newly generated PDF visually before approving it for external use.

## Outstanding work
- Build a genuine GeoTIFF-based common-valid-pixel calculation with reproducible georeferencing and intersection masks, and then independently validate change accuracy.
- Integrate timestamp-matched tidal/weather observations only when actual sources are available.
- Add a human review and authorized sign-off workflow; existing GitHub Pages output remains a **DRAFT**.
