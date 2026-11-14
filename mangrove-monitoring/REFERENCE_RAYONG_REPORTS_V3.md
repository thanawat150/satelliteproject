# Rayong Environmental Flood Impact Report — Reference Study

**Reviewed source:** The user-supplied Google Drive folder containing **19 plot-level PDF reports** and `00_Rayong_Environmental_Flood_Summary.csv`. The PDFs are examples of reporting structure and narrative; **their numeric results must never be silently substituted for the newer satellite data currently connected to MMC**.

Folder: https://drive.google.com/drive/folders/1YNqh9KF6L-bCB_wAfHmaUVyVW1s4qauk

## Source characteristics to preserve
Most source plot reports use a roughly **6-page A4 sequence**:
1. **Status/cover:** plot boundary from UTM coordinates; area on official/project map vs geometry; most recent usable scene and scene quality; water-like area before/after; summary in plain Thai.
2. **Visual evidence:** before/after true color and NIR false color images, explicitly dated, with comparable visualization settings.
3. **Water transition:** MNDWI images and categorized gained/lost/stable water; explain what threshold and pixel comparison mean.
4. **Environment indices:** water/moisture, bare soil, vegetation; discuss the distinction between whole-plot indices and values calculated only on **stable land** (land in both periods).
5. **Water optical proxies:** NDTI/NDCI on stable water when source supports calculations; correctly state that these are **not NTU, chlorophyll-a, salinity, DO, or lab water-quality data**. Include glossary only when relevant.
6. **Methods/QA/actions:** scene QA, area overlap, imagery dates, boundary provenance, limitations, plain-language next step and traceable references.

## Scientific lessons grounded in source files
- **13-STC:** whole-plot NDVI can fall as water area grows, even when NDVI on the unchanged land pixels rises. Do not label whole-plot NDVI loss as tree death.
  - Reference PDF: https://drive.google.com/file/d/1oTqG1EmrDdejBXeVAxurtmKgDKpCfgWG/view
- **14-STC:** water-like change and NDVI/NDRE/NDMI may move in different directions; describe all available indices and the stable-land comparison.
  - Reference PDF: https://drive.google.com/file/d/1D-ePHsvwnooZMVk9qACnHrCTaCVGB17v/view
- **15-STC and 23(1)-STC:** where the current image has zero valid pixels, show **N/A**, not 0.00 and not a six-page dossier of fabricated change.
  - References: https://drive.google.com/file/d/1lVpoBzMewruImN0v3D0H7C7AOso6BjLa/view and https://drive.google.com/file/d/18Hy6p-JD0tasM5uV9J1gFwG6hZZLhtrA/view
- **23-STC:** quantify a water-like increase, then separate landscape/canopy interpretations and tidal-season caveats; NDVI on stable land can differ markedly from average NDVI across the whole scene.
  - Reference PDF: https://drive.google.com/file/d/1c85U38n7bOh7OXnJKZv8aVU6sNyrJVNW/view
- **22-STC:** **quality issue in the example itself**: its narrative describes an increase while the listed water-like area goes from 8.36 rai down to 2.62 rai. This must be corrected in a source-inspired system, not copied.
  - Reference PDF: https://drive.google.com/file/d/1MABrUUDc7usJptsgneWuhGrPZwNQ2Hcs/view

## Improvements required over the examples
1. **Use latest available vs latest QA-qualified dates separately.** Older baseline/current dates in reference PDFs must not masquerade as the present MMC observation.
2. **Read more than two images:** chronological QA-qualified trend lines and visual-only newer images when raw index pixels exist, with explicit evidence status.
3. **No unsupported stable land/water numbers:** MMC's current published common-valid class mask exports new/lost/net but does not currently provide every stable land NDVI/NDRE/NDMI or stable-water NDTI/NDCI result available in the source PDFs. Show unavailable rather than importing old sample values.
4. **Numerical consistency:** water new minus water lost must agree with water net within rounding; common-clear area must not exceed verified Geometry without a hold/review.
5. **Explain data lineage:** pair dates, source TIFFs, SCL QA and whether values are separate-scene means or actual common-valid class transitions.
6. **Readable decision pages:** show plot context, before/after images and decisive spatial water transitions before technical tables; move visual-only and deep QA pages to the end.
7. **No exaggerated certification:** tidal stage, season, clouds, object accuracy and field validation remain necessary before concluding flooding, mortality or financial loss.

## Implementation in Report Studio
- `plotEvidencePlan(d)`: new source-inspired plot evidence sequence with QA-adaptive short reports and source-index visual screening.
- `floodTimeSeries(d)`: source-backed multi-date timeline used when data are sufficient.
- `monitoringPlan(d)` and `floodPlan(d)`: retain province/nationwide decision focus and existing cross-plot caution.
- `REPORT_METHODOLOGY_AND_QA_V2.md`: stronger definition of evidence/readiness levels.

## Acceptance
Test the prompts:
- `ทำรายงานติดตามแปลง 13-STC` (full evidence).
- `ทำรายงานน้ำท่วม 14-STC` (visual index QA exceptions).
- `ทำรายงานติดตามแปลง 15-STC` (insufficient data, no N/A-as-zero).
- `ทำรายงานติดตามแปลง ระยอง` (province executive view, all plots).
- `ขอรายงานแปลงระยอง เรื่องน้ำท่วม` (time series with water rising/receding distinction).

Do not release as *audited impact findings* until classification validity, geographic consistency and independent accuracy have been documented.
