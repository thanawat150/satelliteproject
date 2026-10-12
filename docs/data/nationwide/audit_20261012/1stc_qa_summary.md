# 1-STC Satellite Index QA

- Source: paired original Google Drive 10m/20m GeoTIFFs; source checksum saved per scene.
- Verified boundary: PDD registry feature `1-STC` (EPSG:32647 source geometry); index mask: polygon.
- Scenes processed: 133/133; failures: 0.
- Date range: 2017-02-13 to 2026-09-29.
- Per-scene pixel statistics produced: six indices per scene; SCL primary classes 2,4,5,6.
- Embedded TIFF parity (RMSE <= 0.03): NDRE 133/133, NDMI 133/133, MNDWI 20/133.
- SCL cloud/shadow inside polygon: cloud classes 8,9,10; shadow class 3; report percentages are separate from valid-data percentage.
- 56 scenes have <60% SCL-valid pixels; see `1stc_qa_review.csv`. These remain viewable.
- All scenes remain `PARTIAL`: archive TIFFs omit processing baseline and BOA offsets. Do not compare cross-date index values or infer inundated area until radiometric metadata is verified.
- RGB and false color retain all source-valid pixels, including SCL cloud/unclassified classes, for visual review.

