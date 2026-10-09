# Nationwide PDD Sentinel-2 Monitoring (phase 1)

Full analysis pipeline: real original 10m and 20m Sentinel-2 GeoTIFF data; PDD MultiPolygon geometry and holes; SCL QA, B2/B3/B4/B8/B5/B8A/B11 spectral regridding; indices NDVI, NDRE, NDMI, MNDWI, NDWI, BSI, SAVI, EVI, GLI; open water/vegetation/bare soil/wetness masks and polygon layers; per-date time series; pairwise water/vegetation/soil change restricted to common valid pixels; daily image previews and charts; CSV/PDF print view.

QA: Scene usable if at least 70 percent of pixel centres within the PDD boundary have SCL classes 2,4,5,6,7 and finite reflectance. No-data and partially cloudy scenes are recorded but not used as credible full-plot trend. Cloudy pixels are **not zeros**.

Batch 01: 10 plots (1–8-VSD Trat and 13-STC, 14-VSD Rayong), 20 image dates, 40 original TIFF input files. Successfully analyzed 20 dates; 13 QA_VALID, 7 NO_DATA (mostly Trat 29 September). Pixel-wise changes generated only for three plot pairs with comparable clear data. Original Rayong verified reports remain untouched and can differ because of data scope and QA.

**Scope discrepancy:** MOC.zip PDD polygon sources contain **159 unique plot IDs**. Earlier target says 136. Neither the 136 authoritative target list nor a precise exclusion rule is present in current source. DO NOT automatically drop 23 candidate plots or claim all 136 processed. Resolve the canonical PDD cohort first. The inventory includes sources and duplicate variants to compare.

## Run next batch

```bash
python scripts/nationwide_process.py --inputs path/to/downloaded_tiffs --boundaries docs/data/nationwide/boundaries_pdd_all.geojson --output out/batch_02 --plots 9-VSD 10-VSD ...
```

Only select plots whose PDD source record and 10m/20m pairs have been confirmed. Append each validated result; do not overwrite existing manually VERIFIED records.
