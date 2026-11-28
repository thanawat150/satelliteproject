# Flood Event & Recovery Monitoring — Report Studio V1

**Status:** Source-based screening. No authenticated tidal-gauge measurements or independent field-validation are implied.

## Objective

Users should understand whether a plot's remotely sensed water signal **rose, peaked, receded, returned near an observed reference, or rebounded**, without confusing historical water gain with today's condition or declaring mangrove recovery from a lower water area alone.

## Selection of the three observed phases

All candidate water-area observations must have an actual Sentinel-2 scene date, QA-qualified water classification, and a numerical value in rai. Sort acquisition dates chronologically.

1. **Observed reference:** the lowest QA-qualified classified-water area strictly **before** the first recorded maximum; this is **not automatically a dry, pre-flood day**.
2. **Observed maximum:** the earliest observation with the largest classified-water area in the selected time window.
3. **Latest QA:** the final dated qualified classified-water observation. If its date is also the peak, the report explicitly says there is no observed post-peak recession. If no earlier reference exists, it is shown as unavailable rather than fabricated.

All data are sparse images, **not continuous daily water levels**. A different time window or a tide stage can change which dates are selected.

## Three comparisons (with units and provenance)

For a valid reference B, peak P and latest L:

- **B → P**: observed classified-water area at P minus B.
- **P → L**: classified-water area at L minus P (usually negative when receding).
- **B → L**: classified-water area at L minus B, showing residual water signal above the reference.

These three numbers are differences of **per-scene totals**, potentially over different valid-pixel footprints. They are **not** mapped “new water,” “lost water,” or a validated inundated area. If MMC has a date-matched raster common-valid-pixel class product, show its *new / lost / net* as a **distinct evidence field**, with geometry and arithmetic consistency checks.

The latest interval (two most recent QA observations) also determines whether the most recent signal continued downward or reversed upward. This prevents labeling a rebound as an ongoing recession.

## Interpretation categories

- **Missing reference:** peak in the earliest observed image — insufficient pre-peak evidence.
- **Peak latest:** highest observed water classified in latest image — no confirmed falling phase.
- **Receding:** later lower water signal than observed maximum.
- **Near reference:** latest signal within the system's provisional, explicitly non-validated proximity rule (absolute difference ≤ max(1 rai, 10% of observed reference-to-peak rise)); **not ecological recovery**.
- **Rebound:** water is below the earlier observed maximum but has increased over the last two observations.
- **Insufficient data / uncertain:** scene sequence cannot support the three-phase interpretation.

The proximity threshold is an initial **presentation rule**, not an official flood threshold, tide-adjusted anomaly, or assurance standard.

## Mangrove condition after the water signal recedes

Report the peak-date and latest-date **NDVI, NDRE and NDMI** observations when available. They are unitless indices, not rai, and their means may refer to differing valid masks. The report must say that uncovering vegetation after inundation can itself change apparent vegetation indices; species survival, ecological recovery, canopy damage and investment losses require independent evidence. **Stable Land** values must not be invented when those paired raster outputs do not exist.

## A4 report sections

- Executive condition across plots: latest versus earlier maximum, number with observed complete sequences, those near reference, and rebounds.
- Observed event phases with exact dates, water area (two decimals) and three comparisons, distinguishing per-scene totals from date-matched common-mask transitions.
- Source-derived true color and MNDWI scene images at those exact three observed dates; no repeat or substitution if peak/latest share a date.
- Multi-date chart using **actual date spacing** rather than equal spacing between irregular acquisitions, with exact observations preserved.
- Post-water NDVI, NDRE and NDMI, unresolved ecological effects, source TIFFs and coverage.
- Audit limitations: tides, rainfall, SCL, NoData, common-pixel coverage, spatial accuracy and field validation.

## Regression checks

Synthetic sequences:

- `10 → 100 → 35` rai: rise 90, fall 65 from observed maximum, residual 25 above reference.
- `10 → 100 → 35 → 50` rai: rebound in the latest interval (+15), **not** “still receding”.
- `10 → 100 → 12` rai: near observed reference, **not** mangrove recovery.
- `10 → 100` rai: peak is latest, no invented post-peak observation.
- `100 → 30` rai: no pre-peak reference, not a fabricated “before flood” scene.

Production checks require real dates, all three comparison directions, A4-fitting image-evidence pages, dated sources, QA disclosures and preservation of the old general-purpose/report-atlas workflows.

## Scope and outstanding requirements

Implemented in `docs/mangrove-monitoring/report-copilot.js` for flood reports at provincial scale and plot monitoring. **Still needed for impact certification**: independently checked classification-change accuracy, verified overpass-matched tide measurements, stable-land paired spectral indices, and field evidence linked to plot/date.
