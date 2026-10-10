const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[];page.on('pageerror',x=>errors.push(x.stack||x.message));page.setDefaultTimeout(45000);
await page.goto('http://127.0.0.1:8877/mangrove-monitoring/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.querySelector('#updated')?.textContent?.includes('ข้อมูลดาวเทียม'),{timeout:60000});
const archiveCoverage=await page.evaluate(async()=>{
 const r=await fetch('./all_preview_coverage_audit.json');
 return r.ok?r.json():null;
});
assert.ok(archiveCoverage,'Archived image coverage audit must be published');
assert.equal(archiveCoverage.total_plot_dates,466);
assert.equal(archiveCoverage.required_preview_images,3728);
assert.equal(archiveCoverage.incomplete_images,0);
assert.ok((await page.locator('#view-root').innerText()).includes('136 / 136'),'Overview should preserve original PDD cohort');
assert.ok((await page.locator('#view-root').innerText()).includes('126 / 136'),'Overview should keep QA count');
assert.ok((await page.locator('#view-root').innerText()).includes('160'),'Must show 160-register total');
await page.locator('[data-view="plots"]').click();
await page.waitForFunction(()=>document.querySelector('#plot-search')&&document.querySelectorAll('.tbl tbody tr').length>100);
assert.ok((await page.locator('.tbl tbody').first().locator('tr').count())>=160,'All registry plots must remain visible, including newly added external plots');
await page.locator('#plot-search').fill('66(1)-STC');
assert.equal(await page.locator('.tbl tbody').first().locator('tr').count(),1,'Missing geometry entry remains visible');
assert.ok((await page.locator('.tbl tbody').first().locator('tr').first().innerText()).includes('ต้องจับคู่'),'No invented geometry');
await page.locator('[data-view="insights"]').click();
await page.waitForSelector('#plot-digital-twin');
assert.ok((await page.locator('#plot-digital-twin').innerText()).includes('Pixel Change'),'Plot Digital Twin must show changes with screening limits');
assert.ok((await page.locator('#plot-digital-twin').innerText()).includes('NDMI'),'Plot Digital Twin must expose original index bands');
assert.ok((await page.locator('#water-intelligence').innerText()).includes('น้ำขึ้นน้ำลง'),'Plot Twin must disclose missing tidal observations');
assert.ok((await page.locator('#water-intelligence').innerText()).includes('NASA POWER'),'Water panel must identify source even if remote context is unavailable');
await page.locator('#plot-select').selectOption('16-STC');
assert.ok((await page.locator('#water-intelligence').innerText()).includes('95.93'),'Live rainfall context must expose verified 16-STC three-day NASA POWER value');
assert.ok(await page.locator('#water-date-select option').count()>=2,'Water index must permit selecting real image dates');
await page.locator('#water-date-select').selectOption('2026-09-29');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-09-29'&&document.querySelector('#image-mode')?.value==='mndwi',{timeout:25000});
assert.ok((await page.locator('#water-selected-date').innerText()).includes('2026-09-29'),'Water values must follow selected date');
assert.ok((await page.locator('#water-daily-panel').innerText()).includes('95.93'),'Rainfall for selected Sentinel day must match observed 3-day UTC window');

assert.ok((await page.locator('#plot-digital-twin').innerText()).includes('ยังไม่มีข้อมูลน้ำขึ้นน้ำลง'),'Twin must disclose lack of tidal context');
await page.locator('[data-view="analysis"]').click();
await page.waitForFunction(()=>!!document.querySelector('#metric-select'));
await page.locator('#plot-select').selectOption('13-STC');
const analysis=await page.locator('#view-root').innerText();
assert.ok(analysis.includes('2026-09-29'),'Analysis must show real Sentinel-2 date');
assert.ok(analysis.includes('AUTO_VALID'),'Analysis must show QA state');
await page.locator('#metric-select').selectOption('mndwi');
assert.ok(await page.locator('#time-series-panel .ts-point').count()>=2,'Actual QA chart has at least 2 points');
assert.ok(await page.locator('#timeseries-metric-select').count()===1,'Time Series must have a metric selector alongside the chart');
await page.locator('#timeseries-metric-select').selectOption('water_rai');
assert.ok((await page.locator('#time-series-title').innerText()).includes('พื้นที่น้ำ'),'Chart title must follow Water metric');
assert.equal(await page.locator('#metric-select').inputValue(),'water_rai','Top and in-chart metric menus must remain synchronized');
assert.ok((await page.locator('#time-series-subtitle').innerText()).includes('ไร่'),'Water area chart uses rai rather than index unit');
await page.locator('#timeseries-metric-select').selectOption('ndre');
assert.ok((await page.locator('#time-series-title').innerText()).includes('NDRE'),'Red Edge trend should be selectable');
const ndreGeometry=await page.locator('#time-series-panel').evaluate(panel=>{
 const rect=el=>el.getBoundingClientRect();
 const outer=rect(panel),plot=rect(panel.querySelector('.ts-plot'));
 const svg=rect(panel.querySelector('.ts-chart-svg'));
 const summary=rect(panel.querySelector('#time-series-details'));
 const dates=rect(panel.querySelector('.ts-x-axis'));
 const markers=[...panel.querySelectorAll('.ts-point')].map(rect);
 const tickLabels=[...panel.querySelectorAll('.ts-y-tick')].map(rect);
 return {
  plotHeight:plot.height,
  markersInsidePlot:markers.length>=2&&markers.every(x=>x.left>=plot.left-1&&x.right<=plot.right+1&&x.top>=plot.top-1&&x.bottom<=plot.bottom+1),
  svgContained:svg.left>=plot.left-1&&svg.right<=plot.right+1&&svg.top>=plot.top-1&&svg.bottom<=plot.bottom+1,
  ticksOutsidePlot:tickLabels.length===3&&tickLabels.every(x=>x.right<=plot.left+1),
  datesBelowPlot:dates.top>=plot.bottom-1,
  detailsBelowPlot:summary.top>=dates.bottom-1,
  contentInPanel:summary.bottom<=outer.bottom+1
 };
});
assert.ok(ndreGeometry.plotHeight>=250&&ndreGeometry.svgContained&&ndreGeometry.markersInsidePlot&&ndreGeometry.ticksOutsidePlot&&ndreGeometry.datesBelowPlot&&ndreGeometry.detailsBelowPlot&&ndreGeometry.contentInPanel,
 'NDRE with negative values must keep SVG, markers, tick labels, dates and summary inside chart card: '+JSON.stringify(ndreGeometry));

await page.locator('#timeseries-metric-select').selectOption('rain_prev_3_utc_days_mm');
assert.ok((await page.locator('#time-series-details').innerText()).includes('NASA POWER'),'Rainfall trend must show its real source and UTC day caveat');
assert.ok((await page.locator('#time-series-subtitle').innerText()).includes('มม.'),'Rainfall chart must use millimeters');
await page.locator('#plot-select').selectOption('16-STC');
assert.ok((await page.locator('#time-series-visual').innerText()).includes('2026-07-19'),'Rainfall chart must follow the plot selected');
assert.ok((await page.locator('#time-series-visual .ts-point').evaluateAll(nodes=>nodes.map(x=>x.getAttribute('aria-label')||''))).some(x=>x.includes('95.93')),'September rain series value must be actual NASA POWER source');
await page.locator('#plot-select').selectOption('13-STC');
await page.locator('#timeseries-metric-select').selectOption('mndwi');


await page.waitForSelector('#image-date',{timeout:15000});
const opts=await page.locator('#image-date option').allTextContents();
assert.ok(opts.some(x=>x.includes('2026-09-29')),'Actual image product dates should be available for 13-STC');
// Legacy archive dates used to render 7/8 images because NDWI had never
// existed in the historic generic_preview source. All four now use original
// real 10m/20m TIFFs, still explicitly unvalidated for analytical QA.
for(const plot of ['13-STC','14-VSD']){
  if(await page.locator('#plot-select').inputValue()!==plot){
    await page.locator('#plot-select').selectOption(plot);
  }
  for(const date of ['2026-10-02','2026-10-07']){
    await page.waitForSelector('#image-date');
    await page.locator('#image-date').selectOption(date);
    await page.waitForFunction((d)=>
      document.querySelector('#image-date')?.value===d &&
      document.querySelectorAll('#imagery-explorer .img-gallery:not(.img-history-gallery) img').length===8,
      date,{timeout:30000});
    const images=await page.locator('#imagery-explorer .img-gallery:not(.img-history-gallery) img').count();
    assert.equal(images,8,plot+' '+date+' should show all eight true TIFF images');
    await page.locator('#imagery-explorer .img-gallery:not(.img-history-gallery) img').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const images=[...document.querySelectorAll('#imagery-explorer .img-gallery:not(.img-history-gallery) img')];const ndwi=images.at(-1);return images.length===8&&ndwi.complete&&ndwi.naturalWidth>0;},null,{timeout:20000});
    assert.ok((await page.locator('#imagery-explorer').innerText()).includes('ไม่ผ่าน QA'),'Archive must not claim QA passed');
  }
}
await page.locator('#plot-select').selectOption('13-STC');
await page.waitForSelector('#image-date');
await page.locator('#image-date').selectOption('2026-09-29');
await page.locator('#image-mode').selectOption('ndvi');
await page.waitForFunction(()=>document.querySelectorAll('#imagery-explorer .img-gallery img').length>=5,{timeout:15000});
assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'Georeferenced satellite layer should overlay Leaflet map');
await page.waitForFunction(()=>[...document.querySelectorAll('#imagery-explorer .img-boundary-overlay')].some(x=>x.style.visibility==='visible'),{timeout:15000});
const boundary=await page.locator('#imagery-explorer').evaluate(el=>{
 const svgs=[...el.querySelectorAll('.img-boundary-overlay')];
 const main=el.querySelector('.img-large .img-boundary-overlay');
 const path=main?.querySelector('.img-boundary-line')?.getAttribute('d')||'';
 const box=main?.getBoundingClientRect(),frame=main?.closest('.img-frame')?.getBoundingClientRect();
 return {count:svgs.length,main:path.length>20,bounds:box&&frame&&box.width>0&&box.height>0&&box.left>=frame.left-2&&box.right<=frame.right+2};
});
assert.ok(boundary.count>=8&&boundary.main&&boundary.bounds,'Actual polygon must overlay RGB/index thumbnails without distortion');
const imageStatus=await page.locator('#imagery-explorer').evaluate(el=>({
  realImages:[...el.querySelectorAll('img')].filter(x=>x.src.startsWith('data:image/')||x.src.includes('/imagery/')).length,
  validLoaded:[...el.querySelectorAll('img')].filter(x=>(x.src.startsWith('data:image/')||x.src.includes('/imagery/'))&&x.complete&&x.naturalWidth>0).length,
  qa:el.innerText.includes('AUTO_VALID'),
  before:el.innerText.includes('BEFORE'),
  after:el.innerText.includes('AFTER')
}));
assert.ok(imageStatus.realImages>=6&&imageStatus.validLoaded>=4,'Rendered index/rgb previews must load actual image bytes');
assert.ok(imageStatus.qa&&imageStatus.before&&imageStatus.after,'QA and before-after labels required');

// Regression for screenshot: 30-STC had a 5x7 full-color thumbnail incorrectly resampled to 20m.
await page.locator('#plot-select').selectOption('30-STC');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
assert.ok((await page.locator('#imagery-explorer').innerText()).includes('ไม่ผ่าน QA'),'Latest cloudy TIFF must be clearly labeled display-only');
assert.equal(await page.locator('[data-history-date="2026-10-07"] .img-frame img').count(),8,'Cloudy 30-STC date must have real RGB and six TIFF-based index quicklooks');
assert.ok((await page.locator('#imagery-explorer').innerText()).includes('ไม่มีผลดัชนี'),'Cloudy indexes must not receive approved index statistics');
await page.locator('#image-date').selectOption('2026-09-30');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-09-30',{timeout:20000});
await page.waitForFunction(()=>{const im=document.querySelector('.img-large .img-frame img');return im?.complete&&im.naturalWidth===9&&im.naturalHeight===13;},{timeout:20000});
const rgb30=await page.locator('#imagery-explorer').innerText();
assert.ok(rgb30.includes('RGB Preview 9 × 13'),'30-STC actual RGB preview must use native 10m, not old 5x7 20m image');
assert.ok(rgb30.includes('SCL 100%')&&rgb30.includes('5px'),'The 100% QA result must be labeled with only 5 sample pixels');
assert.ok(rgb30.includes('เกือบขาว'),'Independent RGB whiteness screening must be exposed');
assert.equal(await page.locator('#image-before').inputValue(),'2026-09-22','30-STC defaults to prior QA-valid date');
assert.ok(await page.locator('.img-large .img-boundary-line').count()===1,'Georeferenced 10m preview retains plot polygon');
assert.equal(await page.locator('[data-history-date="2026-09-30"] .img-tile').count(),8,'30-STC has 8 mode thumbnails for native RGB and 20m indices');

// Regression: 24-VSD 2026-09-05 was an almost entirely white false RGB render.
await page.locator('#plot-select').selectOption('24-VSD');
await page.locator('#image-date').selectOption('2026-09-05');
await page.waitForFunction(()=>{
 const img=document.querySelector('.img-large .img-frame img');
 return img?.complete&&img.naturalWidth===21&&img.naturalHeight===29;
},{timeout:20000});
assert.ok((await page.locator('.img-large .img-frame img').getAttribute('src')).includes('mmc-rgb-fixed-reflectance-v2'),'Re-rendered image URL must bypass stale white preview caches');
const rgb24=await page.locator('.img-large').evaluate(root=>{
 const img=root.querySelector('.img-frame img'),canvas=document.createElement('canvas');
 canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let valid=0,nearWhite=0,greenDominant=0;
 for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<200)continue;valid++;
  if(Math.min(rgba[i],rgba[i+1],rgba[i+2])>=235)nearWhite++;
  if(rgba[i+1]>rgba[i]&&rgba[i+1]>rgba[i+2])greenDominant++;
 }
 return {valid,nearWhite,greenDominant};
});
assert.ok(rgb24.valid>30,'24-VSD must render real valid pixels');
assert.ok(rgb24.nearWhite/rgb24.valid<0.30,'24-VSD RGB must not be a white-only falsely stretched image');
assert.ok(rgb24.greenDominant/rgb24.valid>0.40,'Vegetated plot must retain plausible green RGB band balance');
assert.ok((await page.locator('#index-value-audit').innerText()).includes('NDMI'),'Source index comparison table is visible');
const qa24=await page.locator('#index-value-audit').innerText();
assert.ok(qa24.includes('0.7176')&&qa24.includes('0.7174'),'24-VSD 2026-09-05 NDVI source mean and previous mean must both appear');
await page.locator('#image-mode').selectOption('ndmi');
assert.ok((await page.locator('[data-index-legend="ndmi"]').innerText()).includes('B8A'),'NDMI B8A variant must be explicitly labeled');
assert.ok((await page.locator('[data-index-stat="ndmi"]').first().innerText()).includes('0.3661'),'Calculated NDMI mean comes from TIFF pixels');
assert.ok((await page.locator('[data-index-legend="ndmi"] .img-legend-ticks').innerText()).includes('−0.5'),'Legend must include correctly positioned numeric colors');

assert.ok(await page.locator('.img-large .img-boundary-line').count()===1,'24-VSD actual polygon remains georeferenced');
await page.locator('#plot-select').selectOption('102-VSD');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
await page.locator('#image-date').selectOption('2026-07-09');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-07-09',{timeout:20000});
await page.locator('#image-mode').selectOption('ndmi');
await page.waitForFunction(()=>document.querySelectorAll('#imagery-explorer .img-tile img[src^="./imagery/"]').length>=6,{timeout:20000});
const generated=await page.locator('#imagery-explorer').evaluate(el=>({images:[...el.querySelectorAll('.img-tile img')].filter(x=>x.complete&&x.naturalWidth>0).length,legend:!!el.querySelector('.img-legend-ramp'),geo:!!el.querySelector('.leaflet-image-layer')}));
assert.ok(generated.images>=6&&generated.legend&&generated.geo,'Generated true/false and index PNGs must be visible with georeferencing and numeric legend');
assert.ok(await page.locator('#imagery-explorer .img-tile .img-boundary-overlay').count()>=6,'Generated index gallery must include geometry overlay');
await page.locator('#image-boundary-toggle').uncheck();
assert.ok(await page.locator('#imagery-explorer').evaluate(el=>el.classList.contains('boundary-hidden')),'User can toggle boundary overlays off');
assert.equal(await page.locator('#mmc-geo-map').getAttribute('data-boundary-visible'),'false','Boundary toggle must also hide polygon on canvas map');
await page.locator('#image-boundary-toggle').check();
assert.equal(await page.locator('#mmc-geo-map').getAttribute('data-boundary-visible'),'true','Boundary toggle restores polygon on canvas map');


// Regression: 15-STC has QA-valid 2026-10-07 without a corresponding rendered Raster Preview.
await page.locator('#plot-select').selectOption('15-STC');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
const latestImage=await page.locator('.img-large img').first();
await page.waitForFunction(()=>{const im=document.querySelector('.img-large img');return im?.complete&&im.naturalWidth>0;},{timeout:20000});
assert.ok((await latestImage.getAttribute('src')).includes('/15-STC/2026-10-07/true_color.webp'),'15-STC QA-valid 2026-10-07 must now have a real RGB raster');
await page.waitForFunction(()=>document.querySelectorAll('#img-all-dates [data-history-date]').length===4,{timeout:30000});
assert.equal(await page.locator('#img-all-dates [data-history-date]').count(),4,'Full history must include every acquired date, including NO_DATA');
assert.equal(await page.locator('[data-history-date="2026-10-07"] .img-tile').count(),8,'All 8 real raster bands/index views for latest valid date');
assert.ok(await page.locator('[data-history-date="2026-08-03"] .img-tile').count()===8,'Older date also displays all 8 mode slots');
assert.ok((await page.locator('[data-history-date="2026-10-02"]').innerText()).includes('ไม่ผ่าน QA'),'Cloudy/no-data acquisition must remain visible with clear QA warning');
await page.waitForFunction(()=>[...document.querySelectorAll('[data-history-date="2026-10-07"] .img-tile img')].filter(im=>im.complete&&im.naturalWidth>0).length===8,{timeout:20000});
assert.equal(await page.locator('[data-history-date="2026-10-07"] .img-boundary-line').count(),8,'Every image in complete history must have actual geometry overlay');

assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'Latest QA-valid scene overlays raster on GIS map');
assert.ok(await page.locator('.img-large .img-boundary-line').count()===1,'Latest QA-valid scene must display actual red polygon boundary');
const missingImage=await page.locator('#imagery-explorer').innerText();
assert.ok(!missingImage.includes('ยังไม่มี Raster Preview'),'15-STC 2026-10-07 preview is published and must not display missing notice');
assert.equal(await page.locator('#image-before').inputValue(),'2026-08-03','Before defaults to an earlier QA-valid available raster, never NO_DATA');
assert.ok(missingImage.includes('น้อยกว่า 30 พิกเซล'),'Small plot accuracy warning should be visible');
await page.locator('[data-image-jump="2026-08-03"]').click();
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-08-03',{timeout:15000});
assert.equal(await page.locator('#img-all-dates [data-history-date]').count(),4,'Changing selected date must preserve complete image history');
await page.locator('#image-date').selectOption('2026-10-07');
await page.locator('#image-before').selectOption('2026-10-02');
assert.ok((await page.locator('#imagery-explorer').innerText()).includes('วัน Before ที่เลือกไม่ผ่าน QA'),'Manually chosen NO_DATA Before must be warned');
await page.locator('[data-view="insights"]').click();
await page.waitForFunction(()=>!!document.querySelector('.decision-panel'));
const decision=await page.locator('.decision-panel').innerText();
assert.ok(decision.includes('15-STC')&&decision.includes('2026-10-07'),'Plot Intelligence must link QA results to plot');
assert.ok(decision.includes('Small Plot Warning'),'Plot Intelligence must not silently overstate small pixel samples');
await page.locator('[data-view="reports"]').click();
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
assert.ok((await page.locator('#view-root').innerText()).includes('ภาพดาวเทียม / ภาพดัชนีประกอบรายงาน'),'Reports must include real satellite and index viewer');
await page.locator('#image-date').selectOption('2026-08-03');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-08-03'&&document.querySelectorAll('#imagery-explorer .img-gallery img').length>=4,{timeout:20000});
assert.ok(await page.locator('.img-large .img-boundary-line').count()===1,'15-STC has an actual polygon outline in report imagery');
assert.ok(await page.locator('.img-compare-grid .img-boundary-line').count()>=1,'Before/After images retain per-date geographic boundary');
await page.locator('[data-view="qa"]').click();
assert.ok((await page.locator('#view-root').innerText()).includes('QA / Raster Preview Integrity'),'QA view must expose missing image pairs');
assert.ok((await page.locator('#view-root').innerText()).includes('ภาพไม่ผ่าน QA'),'QA overview must count cloudy dates separately');
assert.ok(await page.locator('[data-action="exportnonqagaps"]').count()===1,'Missing non-QA scene CSV must be downloadable');
assert.ok((await page.locator('#view-root').innerText()).includes('Raster Visual QA'),'QA must expose portfolio-wide visual integrity inspection');
assert.ok((await page.locator('#view-root').innerText()).includes('Index QA'),'QA view must list spectral formula and report parity checks');
assert.ok((await page.locator('#view-root').innerText()).includes('241 / 241'),'All QA-valid dates must have source-verified spectral means');
assert.ok(await page.locator('[data-action="exportindexqa"]').count()===1,'Downloadable source-index parity CSV must be available');

assert.ok(await page.locator('[data-action="exportvisualqa"]').count()===1,'Full RGB display-QA report must export as CSV');
assert.ok(await page.locator('#view-root .tbl tbody tr').count()>0,'At least one QC anomaly should remain inspectable');
assert.ok(await page.locator('[data-action="exportgaps"]').count()===1,'Gap CSV must be available');
assert.ok((await page.locator('#view-root').innerText()).includes('66(1)-STC'),'Boundary issue should be visible');
await page.locator('[data-view="satellite"]').click();
await page.locator('#plot-select').selectOption('13-STC');
assert.ok(await page.locator('a[href*="drive.google.com"]').count()>=1,'Source assets can be inspected');
await page.locator('[data-view="alerts"]').click();
assert.ok((await page.locator('#view-root').innerText()).includes('Candidate'),'Alert must remain candidate rather than confirmed flood');
assert.ok(await page.locator('#water-intelligence').count()===1,'Alert must render the water-intelligence panel');
assert.ok((await page.locator('#view-root').innerText()).includes('พักแจ้งเตือนอัตโนมัติ'),'QA-limited change events must have a visible separate queue');
assert.equal(await page.locator('#risk-unit').inputValue(),'percent','Alert default must be normalized by comparable area');
await page.locator('#risk-unit').selectOption('rai');
assert.equal(await page.locator('#risk-threshold').inputValue(),'1','Changing risk unit should reset threshold');
await page.locator('[data-view="modules"]').click();
assert.equal(await page.locator('.module-card').count(),26,'All planned 26 modules listed');
await page.locator('[data-view="field"]').click();
assert.ok((await page.locator('#view-root').innerText()).includes('ยังไม่เชื่อม'),'Nonpublic field data are not exposed');
const mobile=await browser.newPage({viewport:{width:390,height:844}});
const mobileErrors=[];mobile.on('pageerror',x=>mobileErrors.push(x.stack||x.message));
await mobile.goto('http://127.0.0.1:8877/mangrove-monitoring/',{waitUntil:'domcontentloaded'});
await mobile.waitForFunction(()=>document.getElementById('updated')?.textContent?.includes('ข้อมูลดาวเทียม'),{timeout:60000});
await mobile.locator('#menu-btn').click();
assert.ok(await mobile.locator('#sidebar').evaluate(el=>el.classList.contains('open')),'Mobile nav must open');
await mobile.locator('[data-view="satellite"]').click();
await mobile.locator('#plot-select').selectOption('15-STC');
await mobile.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
await mobile.locator('#image-date').selectOption('2026-08-03');
await mobile.waitForFunction(()=>document.querySelector('.img-large .img-boundary-overlay')?.style.visibility==='visible',{timeout:20000});
const alignedMobile=await mobile.locator('.img-large').evaluate(el=>{
 const img=el.querySelector('img'),overlay=el.querySelector('.img-boundary-overlay'),r=overlay.getBoundingClientRect(),frame=el.querySelector('.img-frame').getBoundingClientRect();
 return img.naturalWidth>0&&r.width>0&&r.left>=frame.left-2&&r.right<=frame.right+2&&r.bottom<=frame.bottom+2;
});
assert.ok(alignedMobile,'Polygon overlay must fit contained satellite bitmap on mobile');
await mobile.locator('#menu-btn').click();
await mobile.locator('[data-view="analysis"]').click();
await mobile.waitForSelector('#timeseries-metric-select');
await mobile.locator('#timeseries-metric-select').selectOption('mndwi');
assert.ok((await mobile.locator('#time-series-title').innerText()).includes('MNDWI'),'Time Series dropdown must work on mobile');
const mobileChartLayout=await mobile.locator('#time-series-panel').evaluate(panel=>{
 const parent=panel.getBoundingClientRect();
 const plot=panel.querySelector('.ts-plot').getBoundingClientRect();
 const dates=panel.querySelector('.ts-x-axis').getBoundingClientRect();
 const details=panel.querySelector('#time-series-details').getBoundingClientRect();
 const chooser=panel.querySelector('#timeseries-metric-select').getBoundingClientRect();
 return {width:parent.width,plotHeight:plot.height,
   plotWithinCard:plot.left>=parent.left-1&&plot.right<=parent.right+1,
   datesBelowPlot:dates.top>=plot.bottom-1,
   detailsInCard:details.top>=dates.bottom-1&&details.bottom<=parent.bottom+1,
   chooserWithinCard:chooser.left>=parent.left-1&&chooser.right<=parent.right+1};
});
assert.ok(mobileChartLayout.plotWithinCard&&mobileChartLayout.datesBelowPlot&&mobileChartLayout.detailsInCard&&mobileChartLayout.chooserWithinCard&&mobileChartLayout.plotHeight>=200,
 'Mobile Time Series chart must not overrun card: '+JSON.stringify(mobileChartLayout));

const chooser=await mobile.locator('#timeseries-metric-select').boundingBox();
assert.ok(chooser&&chooser.width>=190&&chooser.width<=390,'Chart metric selection should fit phone width');

assert.deepEqual(errors,[],'Desktop JS errors: '+errors.join(' | '));assert.deepEqual(mobileErrors,[],'Mobile JS errors: '+mobileErrors.join(' | '));
console.log('MMC_PREVIEW_PASS registry=160 qa=126 pdd=136 chart sources=actual plot 13-STC modules=26 mobile=390');
await mobile.close();
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
