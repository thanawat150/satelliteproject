# 13-STC Processing Audit

- Plot identity: `gis:0116` / `13-STC`, verified PDD geometry; source `STC/Shapefile/STC PDD/Standard.shp`.
- Drive inventory: 316 GeoTIFFs, 106 unique acquisition dates, 106 10m, 106 20m, 104 60m.
- Date range: 2017-12-18 through 2026-10-07 (parsed from image filenames; upload times retained separately).
- Scene processing: 106/106 dates in the per-plot registry; 105 dates have per-scene SCL-filtered index statistics and 1 date(s) are visual-only because no SCL-valid pixels were available.
- Status: all 106 dates remain `PARTIAL` for cross-date interpretation because archive radiometric baseline / BOA offsets are not established. Flood extent and area-change values were not inferred.
- Source files: read-only; SHA-256 checksums, Drive IDs, source paths and Drive timestamps are retained. No TIFF was moved, deleted or rewritten.
- Missing 60m: 2 dates; 10m/20m pair is present for all dates.
- Duplicate-safe key: `Sentinel-2|gis:0116|<acquisition date>`; registry partition contains one row per date.

Detailed outputs: `13stc_drive_inventory.json`, `13stc_processing_status.csv`, `13stc_qa_review.csv`, and `13stc_60m_qa.csv`.

## 60m auxiliary-band processing

- 60m source TIFFs: 104/104 checked and processed; the remaining 2 acquisition dates have no 60m source file in Drive.
- Native review layers: 104 B1 Coastal Aerosol, 104 B9 Water Vapour and 104 QA60 cloud/cirrus layers; these are separate layers, not synthetic RGB.
- Per-file CRS, transform, pixel size, band descriptions, NoData, polygon valid coverage, QA60 bit 10/11 and MSK_CLASSI summaries are in `13stc_60m_qa.csv`.
- QA60 is an auxiliary source flag only; cloudy scenes remain in the archive and visual review.
