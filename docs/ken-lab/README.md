# KEN LAB v2 — Creative & Geo Technology Studio

Local-first website, hosted under `https://thanawat150.github.io/satelliteproject/ken-lab/`. No mandatory sign-in, Supabase, API key, or server-side private data transfer.

## What works today

1. **Content Factory**: Enter topic and generate a labeled *editable template* of five scenes, including narration and visuals. Saves browser-side. Does not invoke an AI model or fabricate results.
2. **Auto Video Studio**: Animated 9:16 procedural Canvas; preview; optional personal audio/music uploads; MediaRecorder real-time export 720×1280 or 1080×1920. Format is *WebM or MP4 depending on actual browser support*; no unsupported MP4 conversion. Keep page foreground during render. Licensed media only.
3. **GIS Auto Map**: Read WGS84 EPSG:4326 GeoJSON, KML, or KMZ geometries; validate geographic longitude/latitude and feature count; draw coordinates and polygons in a custom cartographic SVG map; approximate area in rai/hectares, scale bar, legend, north arrow; export PNG/SVG. Use browser Print → Save as PDF. Does **not** support SHP directly, UTM unconverted coordinates, orthophoto basemaps, or survey-grade area/scale accuracy.
4. **Field Report**: Enter project/observer/date/WGS84 coordinates/notes and structured observations; attach up to six images (session only); export report via browser Print → PDF, field observations as CSV, or JSON. No automatic assertions about ecological condition. Field values saved locally, but photo files are **not retained after page reload**.
5. **Satellite Intelligence**: CSV reflectance (0–1) import from the user's preprocessed observations with date/plot/B2/B3/B4/B8/B11. Computes NDVI, NDWI (McFeeters), MNDWI, NDMI, and BSI; shows date-index charts and table; export derived CSV. Can send a clearly qualified *draft* into Content Factory. Links to the existing Satellite Project. Does **not** fetch Sentinel scenes, mask clouds, or infer flood impacts automatically.
6. **GeoAI Learning Lab**: Five interactive GIS and remote-sensing questions with explanations and in-browser score.

## Supported Satellite CSV header

`date,plot,B2,B3,B4,B8,B11`

`date` must be `YYYY-MM-DD`; band values are *reflectance 0–1* (not raw Sentinel-2 L2A scaled integers). At least B3, B4, B8 required. B2/B11 are optional for specific indices. Unknown ratios are shown as missing, not 0.

## Backup and restore

Top-right **สำรองข้อมูล** exports JSON containing the Content Factory workspace and persisted GEO workspace. **กู้คืน** imports a previously exported JSON after explicit user confirmation and replaces existing saved workspace. Images attached to Field Report are session-only and are not included in backups.

## Security, limitations, and deployment

- Browser processing only. No user data is posted to this repo or private backend by this code.
- Geospatial inputs are treated as untrusted and rendered with HTML/XML escaping; imported data must be reviewed.
- Print to PDF requires allowing a pop-up window and choosing Save as PDF.
- The main local `index.html` imports base `app.js`, `styles.css`, and new `geo-tools.js`, `geo-tools.css`.
- Hosted from `docs/ken-lab/` on repo `thanawat150/satelliteproject` through GitHub Actions publication to `gh-pages`.
- No promise of live social posting, real-time satellite downloads, automated imagery analytics, or genuine AI generation.

## Testing

Chromium/Playwright local injection smoke suite exercises GeoJSON, KML/KMZ, browser PNG/SVG downloads, field forms + CSV/JSON and satellite CSV/index/export. The full hosted page must still complete GitHub Pages deployment after commits.