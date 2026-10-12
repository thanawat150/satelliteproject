# 1-STC completion audit

- Drive archive folder: [Nationwide Archive / 1-STC](https://drive.google.com/drive/folders/1bXR00LDNzPHEqh8xet6PLrLniyZFDCew)
- Inventory: 399 GeoTIFF files in 133 date folders; complete 10m/20m/60m sets: 133.
- Resolution counts: 10m=133, 20m=133, 60m=133.
- Acquisition dates parsed from filenames: 2017-02-13 through 2026-09-29; Drive created/modified timestamps are retained separately in the inventory and are not used as capture dates.
- Drive inventory pagination: complete for this plot; date folders listed: 133; files listed: 399; errors: 0.
- GIS identity: gis:0036 / 1-STC, Chanthaburi, verified native PDD geometry from `STC/Shapefile/STC PDD/MOC_3.shp`; 9 parts. Registry PDD area 71.6 rai vs geometry area 64.566 rai (difference retained for review, not geometry repair).
- Scene processing: 133/133 per-scene index statistics computed for NDVI, NDRE, NDMI, NDWI, MNDWI and BSI; 133 RGB/false-color/index preview sets present.
- SCL-valid coverage range: 7.06%–100.00%; 56 scenes below 60% remain visible with per-scene warnings.
- Embedded band parity: NDRE 133/133 and NDMI 133/133 (RMSE <= 0.03); MNDWI 20/133. These parity checks do not establish cross-date radiometric comparability.
- Registry status: all scenes PARTIAL; zero QA-valid scenes, zero event/change conclusions. Missing Sentinel-2 processing baseline and BOA offsets block cross-date quantitative analysis; do not infer flood extent from MNDWI alone.
- Duplicate protection: unique plot/date scene identity; re-running this integration adds zero duplicate rows.
- Original Drive TIFFs were read/listed only; no source file was moved, deleted or overwritten.

See `1stc_drive_inventory.csv`, `1stc_qa_summary.md`, `1stc_qa_review.csv`, and `1stc_processing_status.json` for file-level provenance and QA.

