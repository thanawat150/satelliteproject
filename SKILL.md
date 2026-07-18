---
name: free-satellite-assistant
version: 1.0.0
description: Select and prepare free satellite data from a plain-language user goal. Use for basemaps, vegetation, forest change, flood, moisture, temperature, terrain, historical imagery, or when the user does not know which satellite to use.
---

# Free Satellite Assistant

## Core rule

Use **rules first, AI only when unresolved**. Never ask a beginner to choose a satellite, collection, band, CRS, or provider.

Ask only for missing essentials:

1. Boundary: SHP/GeoJSON/KML/KMZ, plot code, coordinates, or folder containing the boundary.
2. Goal: what the user wants to know.
3. Time: latest, a date/range, before-after, or historical trend. Default to latest useful data.

## Fast workflow

1. Run `python scripts/plan_job.py --goal "<user text>"`.
2. Use the returned JSON plan without further model reasoning when `confidence >= 0.75`.
3. Ask one short clarification only when `needs_clarification` is true and the boundary or time cannot be inferred.
4. Execute deterministic Python for search, download, clipping, indices, QA, preview, and manifest.
5. Return a short result: selected source, reason, acquisition date, quality warning, and output paths.

Do not paste full logs, API responses, STAC items, raster metadata, or provider documentation into model context. Save them to files and report only errors and summary values.

## Default intent routing

- Latest view or map background → Sentinel-2 L2A; fallback Sentinel-1 when cloudy.
- Vegetation or forest health → Sentinel-2 L2A: RGB, NDVI, NDMI; fallback HLS or Landsat.
- Forest loss, clearing, or land change → Sentinel-2 before-after plus Sentinel-1 confirmation; Landsat for long history.
- Flood, standing water, or cloudy-season monitoring → Sentinel-1 GRD.
- Surface temperature → Landsat Collection 2 Level-2 Surface Temperature; optional ECOSTRESS.
- Historical trend over 5+ years → Landsat or HLS time series.
- Elevation, slope, or terrain → Copernicus DEM; fallback SRTM.
- Unknown goal → discovery pack: latest optical, latest radar, NDVI, water/moisture preview, and DEM summary. Respect download limits.

The complete routing table is in `config/intent_rules.json`. Provider details are in `config/providers.json`; load only the selected provider entry.

## Safe defaults

```json
{
  "selection_mode": "best_per_sensor",
  "lookback_days": 365,
  "max_scene_cloud_percent": 30,
  "max_plot_cloud_percent": 5,
  "buffer_m": 10,
  "max_download_gb": 2,
  "clip_to_boundary": true,
  "preview": true,
  "write_manifest": true
}
```

Prefer reading COG windows and clipping remotely instead of downloading full scenes. Download only required bands and only the best matching scene unless the user explicitly asks for a time series or all matches.

## Output contract

Each job creates:

```text
outputs/<job_id>/
├── plan.json
├── data/
├── preview/
├── manifest.json
└── run.log
```

`manifest.json` must include intent, boundary source, selected datasets, acquisition dates, plot-level quality metrics, CRS, generated outputs, warnings, and status.

## Failure and fallback

- No optical scene below 5% plot cloud → relax to 10%, then 20%, then use Sentinel-1 and report the limitation.
- Missing CRS → infer only when coordinates are unambiguous; otherwise stop with one clear question.
- Multiple exact boundary matches → return candidates; do not guess.
- Authentication required → label the dataset as free-but-login-required and continue with a no-login fallback when available.
- Estimated download exceeds limit → return an estimate and reduce scenes/bands automatically; never download every free dataset blindly.

## Token budget rules

- One intent classification per job maximum.
- Use JSON plans under 1,500 characters where possible.
- Never send raster arrays, full manifests, full logs, or catalog search results to the model.
- Retry and provider fallback are implemented in code, not by repeated agent deliberation.
- Reuse cached catalog queries and completed outputs when the boundary, intent, and time window are unchanged.
- Final response should normally be no more than six concise lines.
