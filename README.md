# Rayong Flood & Environmental Monitoring Portal

Static GitHub Pages prototype for Rayong flood and environmental impact monitoring.

## Features

- 19 Rayong plots
- status dashboard and priority list
- Leaflet situation map
- water / NDVI / NDRE / NDMI comparison
- Impact Matrix
- in-browser Report Center
- Export PDF via browser Print / Save as PDF
- links to verified PDF reports in Google Drive

## Publish with GitHub Pages

Repository Settings → Pages → Deploy from a branch → main → /docs

Expected URL:

https://thanawat150.github.io/satelliteproject/

## Data

The dashboard reads `docs/data/plots.json`, generated from the verified polygon-clipped Sentinel-2 analysis used for the Rayong reports.

> Prototype note: map markers currently use plot center positions. Production version should replace them with the verified UTM polygon boundaries and add satellite Before/After imagery.