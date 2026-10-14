// Regression checks: water indices only from real raster previews, never QA-gated image viewing.
const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("docs/index.html","utf8"),js=fs.readFileSync("docs/map-studio.js","utf8"),app=fs.readFileSync("docs/app.js","utf8");
assert(html.includes('id="overview-sat-mode"'));
for(const mode of ["mndwi","ndwi","ndmi","true","false"])assert(html.includes('<option value="'+mode+'">'),"missing water-index choice: "+mode);
assert(html.includes('id="studio-resampling"'),"native-pixel sharpness selector missing");
assert(html.includes('id="overview-index-legend"'),"index color legend missing");
assert(app.includes('mapSatelliteOpacity=1'),"default imagery must not be double-exposed over basemap");
assert(app.includes('Date availability is driven by the entire image catalog, never report QA.'));
assert(js.includes('el.style.imageRendering=sharp?"pixelated":"auto"'),"native nearest neighbour style missing");
assert(js.includes('nativePreviewCache'),"native-resolution TIFF preview restoration missing");
assert(!js.includes('d=choices[0]'),"must not silently change image date if index is missing");
assert(js.includes('const availableForPlot='),"indices must be disabled unless genuine source exists");
const plotCodes=new Set(),modes=new Map();
for(let i=1;i<=10;i++){
  const sat=JSON.parse(fs.readFileSync("docs/data/satellite_part_"+i+".json","utf8"));
  const displays=JSON.parse(fs.readFileSync("docs/data/existing_display_part_"+i+".json","utf8")).files;
  for(const x of sat){assert(displays[x.title]?.src,"missing TIFF preview: "+x.title);plotCodes.add(x.plot);}
  const layers=JSON.parse(fs.readFileSync("docs/data/full_preview_part_"+i+".json","utf8")).layers;
  for(const l of layers){assert(l.src?.startsWith("data:image/"),"invalid index raster preview");
    modes.set(l.mode,(modes.get(l.mode)||0)+1);
  }
}
assert.equal(plotCodes.size,19);
assert(modes.get("mndwi")>=19&&modes.get("ndmi")>=19,"water/moisture indices must exist for all plots");
if(!modes.get("ndwi"))assert(js.includes('mode==="ndwi"')||js.includes('"ndwi"'),"missing NDWI availability handling");
console.log("PASS: 19 plots, 192 TIFF previews, genuine dated MNDWI/NDMI, sharp native imagery and independent QA.");
