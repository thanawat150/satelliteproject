#!/usr/bin/env node
/* Incrementally publish the processed 13-STC scene registry into MMC. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const plotPath = path.join(root, 'docs/data/nationwide/plots/13-STC.json');
const resultsPath = path.join(root, 'docs/data/nationwide/nationwide_results.json');
const manifestPath = path.join(root, 'docs/mangrove-monitoring/imagery_manifest.json');
const sourceManifestPath = process.argv[2] ? path.resolve(process.argv[2]) : manifestPath;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

const plot = read(plotPath);
if (plot.plot !== '13-STC' || plot.scenes?.length !== 106) {
  throw new Error('Expected 106 processed 13-STC scene records.');
}
const results = read(resultsPath);
const previousScenes = (results.scenes || []).filter(x => x.plot === '13-STC');
const priorValidated = new Map(previousScenes
  .filter(x => x.analysis_status === 'AUTO_VALID')
  .map(x => [x.date, x]));
plot.scenes = plot.scenes.map(scene => {
  const prior = priorValidated.get(scene.date);
  if (!prior || scene.analysis_status === 'AUTO_VALID') return scene;
  // A later archive pass can have weaker radiometric QA. Keep an already
  // validated record and its measured areas while retaining new 60 m provenance.
  return {
    ...prior,
    source_tif60_file_id: scene.source_tif60_file_id,
    source_tif60_filename: scene.source_tif60_filename,
    source_tiff_metadata: scene.source_tiff_metadata,
    qa60_60m: scene.qa60_60m,
  };
});
const nextQa = plot.scenes.filter(x => x.analysis_status === 'AUTO_VALID').length;
const nextPartial = plot.scenes.filter(x => x.analysis_status === 'PARTIAL').length;
const nextNoData = plot.scenes.filter(x => x.analysis_status === 'NO_DATA').length;
plot.scene_count = plot.scenes.length;
plot.plot_registry.qa_valid_dates = nextQa;
plot.plot_registry.partial_dates = nextPartial;
plot.plot_registry.processed_dates = plot.scenes.length;
const sourceManifest = read(sourceManifestPath);
const sourceItems = (sourceManifest.generated_items || []).filter(x => x.plot === '13-STC');
const dates = new Set(plot.scenes.map(x => x.date));
if (sourceItems.length !== 106 || new Set(sourceItems.map(x => x.date)).size !== 106 ||
    sourceItems.some(x => !dates.has(x.date))) {
  throw new Error('13-STC imagery manifest must contain exactly one generated item for each processed date.');
}

let checkedAssets = 0;
for (const item of sourceItems) {
  for (const [mode, url] of Object.entries(item.assets || {})) {
    if (typeof url !== 'string' || !url.startsWith('./imagery/')) throw new Error(`Invalid ${mode} asset URL for ${item.date}`);
    const asset = path.resolve(root, 'docs/mangrove-monitoring', url.slice(2));
    if (!asset.startsWith(path.resolve(root, 'docs/mangrove-monitoring/imagery') + path.sep) || !fs.existsSync(asset)) {
      throw new Error(`Missing or unsafe preview asset: ${url}`);
    }
    checkedAssets++;
  }
}

const manifest = read(manifestPath);
manifest.generated_items = [
  ...(manifest.generated_items || []).filter(x => x.plot !== '13-STC'),
  ...sourceItems,
].sort((a, b) => a.plot.localeCompare(b.plot) || a.date.localeCompare(b.date));
manifest.version = '2026-10-14-13stc-all-resolutions-v1';
manifest.source = 'Original Google Drive Sentinel-2 GeoTIFF archive; incremental per-plot processing';
manifest.coverage = 'Existing image products, not all STC/VSD/EVR plots';
manifest.plot_count = new Set([
  ...(manifest.items || []).map(x => x.plot),
  ...manifest.generated_items.map(x => x.plot),
]).size;
manifest.image_dates = new Set([
  ...(manifest.items || []).map(x => `${x.plot}|${x.date}`),
  ...manifest.generated_items.map(x => `${x.plot}|${x.date}`),
]).size;

results.scenes = [
  ...(results.scenes || []).filter(x => x.plot !== '13-STC'),
  ...plot.scenes,
].sort((a, b) => a.plot.localeCompare(b.plot) || a.date.localeCompare(b.date));
const previousQa = previousScenes.filter(x => x.analysis_status === 'AUTO_VALID').length;
const previousPartial = previousScenes.filter(x => x.analysis_status === 'PARTIAL').length;
const previousNoData = previousScenes.filter(x => x.analysis_status === 'NO_DATA').length;
if (results.totals) {
  results.totals.qa_valid_dates += nextQa - previousQa;
  results.totals.partial_dates += nextPartial - previousPartial;
  results.totals.no_data_dates += nextNoData - previousNoData;
  results.totals.processed_dates = results.totals.qa_valid_dates + results.totals.partial_dates + results.totals.no_data_dates;
}
results.plots['13-STC'] = {
  ...(results.plots['13-STC'] || {}),
  province: plot.plot_registry.province,
  pdd_geometry_parts: plot.plot_registry.pdd_geometry_parts,
  pdd_area_rai: plot.plot_registry.geometry_area_rai,
  selected_dates: plot.scenes.map(x => x.date),
  completed_dates: plot.scenes.length,
  qa_valid_dates: nextQa,
  processing_status: 'DONE',
};

write(plotPath, plot);
write(manifestPath, manifest);
write(resultsPath, results);
console.log(JSON.stringify({
  plot: '13-STC', scenes: plot.scenes.length, replaced_previous_scenes: previousScenes.length,
  previews: sourceItems.length, preview_layers: checkedAssets,
  dates: plot.scenes.length, qa_valid: nextQa, partial: nextPartial, no_data: nextNoData,
  manifest_version: manifest.version,
}, null, 2));
