# Water Anomaly Intelligence — Screening specification

Status: read-only screening, not confirmed flooding or calibrated tidal correction.

Input: existing published plot/date change pairs, common-clear 20 m pixels,
polygon area, status and dates. Stage v1.3 TIFF outputs remain separate.

## Screening rules

- WATER_INCREASE_CANDIDATE: water gained > 0 and at least 0.25 rai,
  or at least 0.05 rai and >=5% of comparable clear area.
- WATER_REVERSAL_REVIEW: a subsequent adjacent-date pair has negative
  water change, up to 14 days between the two observations, with
  both changes meeting the above materiality screen.
- INSUFFICIENT_EVIDENCE: fewer than 30 shared pixels, <50% plot
  coverage, missing usable area, or inadequate QA.
- Reversal means only that direction changed, not that water returned
  to its normal level or that a flooding event was verified.

## Required evidence to interpret a flood

1. Same scene acquisition timestamp in local time and timezone, not only date.
2. Tidal observation or validated prediction at an appropriate station with
   station distance, datum, units, timestamp, uncertainty, source and review.
3. 24h/72h rainfall with gauge or gridded-data provenance and QA.
4. Multi-year seasonally comparable baseline with enough valid observations,
   SCL/valid pixels, similar tide conditions and documented data gaps.
5. Independent field verification for high-consequence decisions.

Without those inputs, the interface explicitly says tide/rain NOT CONNECTED.
Never fill absent measurements with zeros, predictions or synthetic values.

## Acceptance gates

- Unit and browser regression tests pass.
- Source TIFF and raster QC concerns stay visible separately.
- No staging result automatically overwrites nationwide_results.json.
- Changes are not labeled confirmed floods, mangrove growth or carbon gains.
- Human reviewer verifies geometry, scene IDs, thresholds and tide/rain evidence.
