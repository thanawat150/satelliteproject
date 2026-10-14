# 17-STC complete archive processing audit

- GIS identity: `gis:0124` / `17-STC`, source-verified PDD boundary in ระยอง (`STC/Shapefile/STC PDD/Standard.shp`).
- Drive inventory: 345 original TIFF files from 114 unique acquisition dates; 10m/20m/60m present for every date; 3 same-date alternate source files were processed and retained separately.
- Full source QA: 345/345 TIFFs opened and checked for CRS, transform, pixel size, dimensions, bands, NoData, polygon coverage, and SHA-256. Exact checksum duplicate groups: 0; same-date alternate crops: 3.
- Acquisition dates: 2017-01-27 through 2026-10-07 (parsed from filenames; upload/modified times remain separate inventory fields).
- Processing: 114/114 dates received 10m RGB, 20m spectral index, and 60m B1/B9/QA60 processing. Source byte-size checks, TIFF open, CRS, transforms, pixel sizes, band metadata, polygon coverage, SHA-256, SCL and QA60 statistics are recorded.
- Preview layers: 1596 scene/mode entries across 8 spectral/RGB modes and 3 60m review modes per date. All scenes remain visible for visual review regardless of SCL result.
- SCL review: 109/114 dates have at least 60% valid SCL coverage; 5 date(s) are below 60% and are listed in `17stc_qa_failures.csv`. All 114 scenes remain available in the visual archive. Three dates with 100% SCL-valid coverage retain their prior AUTO_VALID records in MMC; other dates remain PARTIAL.
- Processing and cross-date comparison remain `PARTIAL` even where SCL coverage is adequate: archive TIFFs do not establish Sentinel-2 processing baseline / BOA offsets. Do not infer cross-date change, flood extent, or recovery solely from these numeric values.
- Original TIFFs were downloaded to local staging for read-only processing. No original Drive file was moved, deleted, or overwritten.
- Idempotent scene key: `Sentinel-2|gis:0124|<acquisition date>`.

Detailed files: `17stc_drive_inventory.csv`, `17stc_duplicate_files.csv`, `17stc_processing_status.csv`, `17stc_qa_review.csv`, `17stc_qa_failures.csv`, `17stc_60m_qa.csv`, `17stc_plot_registry.csv`, and `../plots/17-STC.json`.
