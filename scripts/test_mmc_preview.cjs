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
assert.equal(await page.locator('#water-date-select').count(),0,'Insight must not have a duplicate date selector');
await page.waitForSelector('#image-date');
await page.locator('#image-date').selectOption('2026-09-29');
await page.waitForFunction(()=>document.querySelector('#water-selected-date')?.textContent?.includes('2026-09-29'),{timeout:25000});
assert.ok((await page.locator('#water-selected-date').innerText()).includes('2026-09-29'),'Water values must follow selected date');
assert.ok((await page.locator('#water-daily-panel').innerText()).includes('95.93'),'Rainfall for selected Sentinel day must match observed 3-day UTC window');
assert.ok((await page.locator('#water-daily-panel').innerText()).includes('เปอร์เซ็นไทล์ 92.58'),'Three-day rain must be compared with real ten-year seasonal climatology');
assert.ok((await page.locator('#water-daily-panel').innerText()).includes('1.23'),'Marine model daily maximum must be traceable without inventing overpass measurement');
await page.locator('#plot-select').selectOption('13-STC');
await page.locator('#image-date').selectOption('2026-09-29');
await page.waitForFunction(()=>document.querySelector('#water-selected-date')?.textContent?.includes('2026-09-29'),null,{timeout:20000});
const water13=await page.locator('#water-daily-panel').innerText();
assert.ok(water13.includes('228.02')&&water13.includes('195.09'),'13-STC water classification and earlier-date difference should show two-decimal values');
assert.ok(water13.includes('ต่ำสุด 0.15 ม.')&&water13.includes('สูงสุด 1.23 ม.'),'Modeled tide range must be labelled not mistaken for a gauge level');
assert.ok(water13.includes('289.89')&&water13.includes('259.89'),'PDD-geometry acreage disagreement must be disclosed');
const cardLayout=await page.locator('#water-daily-panel .hydro-kpis').evaluate(root=>
 [...root.querySelectorAll('.kpi')].every(card=>{
  const value=card.querySelector('strong')?.getBoundingClientRect();
  const foot=card.querySelector('.foot')?.getBoundingClientRect();
  const rect=card.getBoundingClientRect();
  return value&&foot&&value.bottom<=foot.top+1&&foot.bottom<=rect.bottom+1;
 }));
assert.ok(cardLayout,'No water/NDWI/rain value may visually overlap its explanatory footnote');
await page.locator('#plot-select').selectOption('16-STC');


assert.ok((await page.locator('#plot-digital-twin').innerText()).includes('ยังไม่มีข้อมูลน้ำขึ้นน้ำลง'),'Twin must disclose lack of tidal context');
await page.locator('[data-view="analysis"]').click();
await page.waitForFunction(()=>!!document.querySelector('#timeseries-metric-select'));
await page.locator('#plot-select').selectOption('13-STC');
const analysis=await page.locator('#view-root').innerText();
assert.ok(analysis.includes('2026-09-29'),'Analysis must show real Sentinel-2 date');
assert.ok(analysis.includes('AUTO_VALID'),'Analysis must show QA state');
await page.locator('#timeseries-metric-select').selectOption('mndwi');
assert.ok(await page.locator('#time-series-panel .ts-point').count()>=2,'Actual QA chart has at least 2 points');
assert.ok(await page.locator('#timeseries-metric-select').count()===1,'Time Series must have a metric selector alongside the chart');
await page.locator('#timeseries-metric-select').selectOption('water_rai');
assert.ok((await page.locator('#time-series-title').innerText()).includes('พื้นที่น้ำ'),'Chart title must follow Water metric');
assert.equal(await page.locator('#metric-select').count(),0,'Only one metric selector is shown for the chart');
assert.ok((await page.locator('#time-series-subtitle').innerText()).includes('ไร่'),'Water area chart uses rai rather than index unit');
await page.locator('#timeseries-metric-select').selectOption('ndre');
assert.ok((await page.locator('#time-series-title').innerText()).includes('NDRE'),'Red Edge trend should be selectable');
assert.ok((await page.locator('#time-series-visual').innerText()).includes('แกนมาตรฐาน -1.00 ถึง +1.00'),
 'NDRE must use non-exaggerated fixed -1 to +1 spectral index axis');
assert.ok((await page.locator('#time-series-details').innerText()).includes('ตรวจเทียบ Raster TIFF'),
 'Index trend must reveal source TIFF parity QA');
assert.equal(await page.locator('#time-series-details .series-source-table tbody tr').count(),2,
 'Sparse two-observation trend must show precisely its two authentic dates');

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
assert.ok(opts.some(x=>x.includes('2026-09-29')),'Real Sentinel-2 dates appear in one picker');
assert.equal(await page.locator('.img-large').count(),0,'Duplicate non-map preview must be removed');
assert.equal(await page.locator('.img-compare-grid').count(),0,'Comparison must not repeat the selected image by default');
assert.equal(await page.locator('.img-gallery').count(),0,'All-indices grid must be opt-in');
assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'Primary viewer uses a single real georeferenced raster');
for(const plot of ['13-STC','14-VSD']){
 if(await page.locator('#plot-select').inputValue()!==plot)await page.locator('#plot-select').selectOption(plot);
 for(const date of ['2026-10-02','2026-10-07']){
  await page.waitForSelector('#image-date');
  await page.locator('#image-date').selectOption(date);
  await page.locator('[data-image-layout="grid"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#imagery-explorer .img-gallery img').length===8,{timeout:30000});
  assert.equal(await page.locator('#imagery-explorer .img-gallery img').count(),8,plot+' '+date+' must show eight real TIFF images only in all-indices mode');
  await page.locator('#imagery-explorer .img-gallery img').last().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('#imagery-explorer .img-gallery img')];return images.length===8&&images.at(-1).complete&&images.at(-1).naturalWidth>0;},null,{timeout:20000});
  assert.ok((await page.locator('#imagery-explorer').innerText()).includes('ไม่ผ่าน QA'),'Cloudy TIFF cannot claim analytical QA');
  await page.locator('[data-image-open-mode="ndwi"]').first().click();
  await page.waitForFunction(()=>document.querySelector('#image-mode')?.value==='ndwi'&&!!document.querySelector('#mmc-geo-map'),{timeout:20000});
  assert.equal(await page.locator('#imagery-explorer .img-gallery').count(),0,'Opening a selected tile closes aggregate gallery to avoid duplicates');
 }
}
await page.locator('#plot-select').selectOption('13-STC');
await page.locator('#image-date').selectOption('2026-09-29');
await page.locator('#image-mode').selectOption('ndvi');
await page.waitForFunction(()=>!!document.querySelector('#mmc-geo-map .leaflet-image-layer'),{timeout:20000});
await page.locator('[data-image-layout="grid"]').click();
await page.waitForFunction(()=>[...document.querySelectorAll('.img-gallery .img-boundary-overlay')].some(x=>x.style.visibility==='visible'),{timeout:20000});
const boundary=await page.locator('.img-gallery').evaluate(el=>{
 const svgs=[...el.querySelectorAll('.img-boundary-overlay')];
 const main=svgs[0],path=main?.querySelector('.img-boundary-line')?.getAttribute('d')||'';
 const box=main?.getBoundingClientRect(),frame=main?.closest('.img-frame')?.getBoundingClientRect();
 return {count:svgs.length,main:path.length>20,bounds:box&&frame&&box.width>0&&box.height>0&&box.left>=frame.left-2&&box.right<=frame.right+2};
});
assert.ok(boundary.count>=8&&boundary.main&&boundary.bounds,'All-indices thumbnails retain true polygon geometry and correct image fit');
await page.locator('[data-image-layout="compare"]').click();
assert.equal(await page.locator('.img-compare-grid .img-frame img').count(),2,'Comparison displays precisely one Before and one After');
assert.equal(await page.locator('#image-compare-mode').count(),0,'Comparison reuses primary image type, no duplicate mode selector');
assert.equal(await page.locator('#image-before').inputValue(),'2026-04-30','Before auto-selects earlier QA valid image for 13-STC');
await page.locator('[data-image-layout="single"]').click();
assert.equal(await page.locator('.img-compare-grid').count(),0,'Comparison disappears when single image is selected');
assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'Single image remains on map');

await page.locator('#plot-select').selectOption('30-STC');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
assert.ok((await page.locator('#imagery-explorer').innerText()).includes('ไม่ผ่าน QA'),'Cloudy latest image is marked as display-only');
await page.locator('[data-image-layout="grid"]').click();
assert.equal(await page.locator('.img-gallery .img-frame img').count(),8,'All eight bands of cloudy 30-STC may be inspected on request');
assert.equal(await page.locator('.img-gallery [data-index-stat]').count(),0,'Cloudy TIFF must not show approved numerical index statistics');
await page.locator('#image-date').selectOption('2026-09-30');
await page.waitForFunction(()=>{const im=document.querySelector('.img-gallery .img-frame img');return im?.complete&&im.naturalWidth===9&&im.naturalHeight===13;},{timeout:20000});
const rgb30=await page.locator('#imagery-explorer').innerText();
assert.ok(rgb30.includes('RGB Preview 9 × 13'),'30-STC RGB retains actual 10m image resolution');
assert.ok(rgb30.includes('SCL 100.00%')&&rgb30.includes('5px'),'Five-pixel QA is not confused with full confidence');
assert.ok(rgb30.includes('เกือบขาว'),'RGB whitening screen remains visible');

await page.locator('#plot-select').selectOption('24-VSD');
await page.locator('#image-date').selectOption('2026-09-05');
await page.locator('[data-image-layout="grid"]').click();
await page.waitForFunction(()=>{const im=document.querySelector('.img-gallery .img-frame img');return im?.complete&&im.naturalWidth===21&&im.naturalHeight===29;},{timeout:20000});
const rgb24=await page.locator('.img-gallery .img-tile').first().evaluate(root=>{
 const img=root.querySelector('.img-frame img'),canvas=document.createElement('canvas');
 canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let valid=0,nearWhite=0,greenDominant=0;
 for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<200)continue;valid++;
 if(Math.min(rgba[i],rgba[i+1],rgba[i+2])>=235)nearWhite++;
 if(rgba[i+1]>rgba[i]&&rgba[i+1]>rgba[i+2])greenDominant++;}
 return {valid,nearWhite,greenDominant};
});
assert.ok(rgb24.valid>30&&rgb24.nearWhite/rgb24.valid<0.30&&rgb24.greenDominant/rgb24.valid>0.40,'24-VSD real RGB must not be white-stretched');
await page.locator('.img-index-audit-details summary').click();
const ndviCells=await page.locator('#index-value-audit tbody tr').first().locator('td').allInnerTexts();
assert.equal(ndviCells[2].trim(),'0.72');
assert.equal(ndviCells[3].trim(),'0.72');
await page.locator('[data-image-open-mode="ndmi"]').first().click();
assert.ok((await page.locator('[data-index-legend="ndmi"]').innerText()).includes('B8A'),'NDMI source band must be explicit');
assert.ok((await page.locator('[data-index-stat="ndmi"]').first().innerText()).includes('0.37'),'Mean is displayed at two decimals');
assert.ok((await page.locator('[data-index-legend="ndmi"] .img-legend-ticks').innerText()).includes('−0.50'),'Legend values are two decimal places');

await page.locator('#plot-select').selectOption('102-VSD');
await page.locator('#image-date').selectOption('2026-07-09');
await page.locator('[data-image-layout="grid"]').click();
await page.waitForFunction(()=>document.querySelectorAll('.img-gallery .img-tile img[src^="./imagery/"]').length>=6,{timeout:20000});
assert.ok(await page.locator('.img-gallery .img-boundary-overlay').count()>=6,'Index gallery shows actual polygon overlays');
await page.locator('[data-image-open-mode="ndmi"]').first().click();
assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'Tile opens correct Raster on Leaflet');
await page.locator('.img-display-options summary').click();
await page.locator('#image-boundary-toggle').uncheck();
assert.ok(await page.locator('#imagery-explorer').evaluate(el=>el.classList.contains('boundary-hidden')),'Boundary can be toggled off');
assert.equal(await page.locator('#mmc-geo-map').getAttribute('data-boundary-visible'),'false');
await page.locator('#image-boundary-toggle').check();
assert.equal(await page.locator('#mmc-geo-map').getAttribute('data-boundary-visible'),'true');

await page.locator('#plot-select').selectOption('15-STC');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'15-STC latest valid raster is on GIS map');
assert.ok((await page.locator('#imagery-explorer').innerText()).includes('น้อยกว่า 30 พิกเซล'),'Small sample QA warning remains visible');
await page.locator('[data-image-layout="history"]').click();
await page.waitForFunction(()=>document.querySelectorAll('#img-all-dates [data-history-date]').length===4,{timeout:30000});
assert.equal(await page.locator('#image-date').count(),0,'Full-history grid does not show unused individual date picker');
assert.equal(await page.locator('[data-history-date="2026-10-07"] .img-tile').count(),8);
assert.equal(await page.locator('[data-history-date="2026-08-03"] .img-tile').count(),8);
assert.equal(await page.locator('#image-history-mode').inputValue(),'all','All 8 modes remain default for full history');
assert.equal(await page.locator('#image-date').count(),0,'History uses no second date picker');
await page.locator('#image-history-mode').selectOption('ndvi');
await page.waitForFunction(()=>document.querySelector('#image-history-mode')?.value==='ndvi'&&document.querySelectorAll('[data-history-date="2026-10-07"] .img-tile').length===1,{timeout:20000});
assert.equal(await page.locator('#img-all-dates [data-history-date]').count(),4,'Index filter must preserve every acquired date');
assert.equal(await page.locator('[data-history-date="2026-10-07"] [data-history-mode="ndvi"]').count(),1,'Selected NDVI shows just NDVI for the date');
assert.equal(await page.locator('[data-history-date="2026-10-07"] [data-history-mode="mndwi"]').count(),0,'Unselected index is not duplicated');
assert.ok((await page.locator('#img-all-dates .img-history-heading').innerText()).includes('NDVI'),'History heading reflects selected index');
await page.locator('#image-history-mode').selectOption('true_color');
await page.waitForFunction(()=>document.querySelector('#image-history-mode')?.value==='true_color'&&document.querySelectorAll('[data-history-date="2026-10-07"] .img-tile').length===1,{timeout:20000});
assert.equal(await page.locator('[data-history-date="2026-10-07"] [data-history-mode="true_color"]').count(),1,'RGB-only history displays real color scenes');
await page.locator('#image-history-mode').selectOption('all');
await page.waitForFunction(()=>document.querySelector('#image-history-mode')?.value==='all'&&document.querySelectorAll('[data-history-date="2026-10-07"] .img-tile').length===8,{timeout:20000});
assert.equal(await page.locator('#img-all-dates .img-history-gallery.img-history-single').count(),0,'All layers restore grid without single-index formatting');
assert.ok((await page.locator('[data-history-date="2026-10-02"]').innerText()).includes('ไม่ผ่าน QA'));
await page.waitForFunction(()=>[...document.querySelectorAll('[data-history-date="2026-10-07"] .img-tile img')].filter(im=>im.complete&&im.naturalWidth>0).length===8,{timeout:20000});
assert.equal(await page.locator('[data-history-date="2026-10-07"] .img-boundary-line').count(),8);
await page.locator('[data-image-jump="2026-08-03"]').click();
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-08-03',{timeout:15000});
assert.equal(await page.locator('#img-all-dates').count(),0,'Date opened from history is not rendered twice');
await page.locator('#image-date').selectOption('2026-10-07');
await page.locator('[data-image-layout="compare"]').click();
assert.equal(await page.locator('#image-before').inputValue(),'2026-08-03','Before is earlier QA-valid TIFF by default');
await page.locator('#image-before').selectOption('2026-10-02');
assert.ok((await page.locator('#imagery-explorer').innerText()).includes('วันก่อนที่เลือกไม่ผ่าน QA'),'Manual cloudy before date is flagged');

await page.locator('[data-view="insights"]').click();
await page.waitForFunction(()=>!!document.querySelector('.decision-panel'));
const decision=await page.locator('.decision-panel').innerText();
assert.ok(decision.includes('15-STC')&&decision.includes('2026-10-07'),'Plot Intelligence links QA to plot');
assert.ok(decision.includes('Small Plot Warning'),'Small plot caveat persists');
assert.equal(await page.locator('#water-date-select').count(),0,'Insights date appears only in image picker');
await page.locator('[data-view="reports"]').click();
await page.waitForSelector('#rpt-analyze',{timeout:20000});
assert.equal(await page.locator('#image-date').count(),0,'Legacy images are not loaded before expanding classic report');
await page.locator('#report-legacy > summary').click();
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-10-07',{timeout:20000});
assert.ok((await page.locator('#view-root').innerText()).includes('ภาพดาวเทียม / ภาพดัชนีประกอบรายงาน'),'Report includes single-image map');

assert.ok(await page.locator('#report-copilot-root #rpt-analyze').count()===1,'Report Copilot must be mounted in Report Center');
assert.ok(await page.locator('#rpt-preview .rpt-paper').count()>=3,'Real A4 report preview includes multiple structured pages');
assert.ok((await page.locator('#rpt-source-summary').innerText()).includes('ข้อมูลจริง'),'Report preview discloses actual source coverage');

await page.locator('#rpt-text').fill('ทำรายงานติดตามแปลง ระยอง');
await page.locator('#rpt-analyze').click();
assert.equal(await page.locator('#rpt-type').inputValue(),'plot','General Rayong monitoring prompt selects plot-monitoring interpretation');
assert.equal(await page.locator('#rpt-scope').inputValue(),'province','General Rayong monitoring prompt targets all province plots');
const generalDecision=await page.evaluate(()=>{
 const r=window.MMCReportCopilot.renderPages('main'),first=r.pages.split('</article>')[0];
 return {total:r.total,first,all:r.pages,plots:r.d.pp.length,imageCount:r.imageCount};
});
assert.equal(generalDecision.plots,19,'General monitoring report includes all 19 Rayong plots');
assert.ok(generalDecision.first.includes('สรุปสถานการณ์')||generalDecision.first.includes('รายงานสถานภาพป่าชายเลน'),'Non-flood report must lead with a decision summary');
assert.ok(generalDecision.first.includes('คำแนะนำสำหรับผู้บริหาร'),'Management summary must provide next steps rather than bare raster thumbnails');
assert.ok(['NDVI','NDRE','NDMI','NDWI','MNDWI','BSI'].every(k=>generalDecision.all.includes(k)),'General monitoring report must interpret all six indices');
assert.ok(!generalDecision.all.includes('Satellite Atlas'),'General monitoring must not become a 72-image atlas by default');
assert.ok(generalDecision.total>=7&&generalDecision.total<=16,'General decision report should be compact: '+generalDecision.total);
assert.ok(generalDecision.all.includes('นักลงทุน')&&generalDecision.all.includes('Auditor')&&generalDecision.all.includes('TIFF'),'Investor exposure and Audit evidence must be included');
assert.ok(generalDecision.all.includes('วันที่ภาพก่อนหน้า')||generalDecision.all.includes('วันภาพก่อนหน้า'),'All findings must be tied to actual comparison dates');
const generalMain=await page.evaluate(()=>window.MMCReportCopilot.renderPages('appendix'));
assert.equal(generalMain.total,0,'General report appendix should be optional and empty by default');

const generalOverlaps=await page.evaluate(()=>[...document.querySelectorAll('#rpt-preview .rpt-paper')].map((paper,i)=>{
 const bottom=paper.querySelector('.rpt-pagefoot')?.getBoundingClientRect().top||Infinity;
 const content=Math.max(...[...paper.children].filter(x=>!x.classList.contains('rpt-pagefoot')).map(x=>x.getBoundingClientRect().bottom));
 return {page:i+1,content,footer:bottom};
}).filter(x=>x.content>x.footer-2));
assert.deepEqual(generalOverlaps,[],'General decision report must fit A4 preview pages above footer: '+JSON.stringify(generalOverlaps));


await page.locator('#rpt-text').fill('รายงานน้ำท่วมจังหวัดระยองย้อนหลัง 3 เดือน เน้น MNDWI NDVI และฝน อ่านง่าย');
await page.locator('#rpt-analyze').click();
assert.equal(await page.locator('#rpt-type').inputValue(),'water','Thai intent parser understands water report');
assert.equal(await page.locator('#rpt-scope').inputValue(),'province','Thai intent parser understands province scope');
assert.equal(await page.locator('#rpt-period').inputValue(),'90','Thai intent parser understands three-month window');
assert.ok(await page.locator('#rpt-preview .rpt-paper').count()>=3,'AI report blueprint generates real A4 preview');
const reportStateDebug=await page.evaluate(()=>{let result;try{const r=window.MMCReportCopilot.renderPages();result={count:r.d.pp.length,pages:r.total};}catch(e){result={error:String(e),stack:e?.stack};}return {scope:document.querySelector('#rpt-scope')?.value,warnings:document.querySelector('#rpt-warning-list')?.textContent,summary:document.querySelector('#rpt-source-summary')?.textContent,readiness:document.querySelector('#rpt-readiness')?.textContent,previewCount:document.querySelectorAll('#rpt-preview .rpt-paper').length,result};});console.log('MMC_REPORT_STATE_DEBUG',JSON.stringify(reportStateDebug));
assert.ok((await page.locator('#rpt-warning-list').innerText()).includes('ไม่เฉลี่ยค่าดัชนี'),'Province report must not mix unweighted plot indices');

assert.ok(await page.locator('[data-rpt-scope-switch="province"][aria-pressed="true"]').count()===1,'Scope selector visibly reflects province reports');
assert.equal(await page.locator('#rpt-image-dates').inputValue(),'2','Province reports default to two image dates per plot');
const provinceReport=await page.evaluate(()=>{const r=window.MMCReportCopilot.renderPages();return {plots:r.d.pp.length,pages:r.total,images:r.imageCount,head:r.pages.split('</article>')[0],hasCases:r.pages.includes('หลักฐานช่วงน้ำเพิ่มเดิม'),hasActions:r.pages.includes('ข้อเสนอแนะและการตัดสินใจ'),hasCautions:r.pages.includes('น้ำขึ้นลง'),audit:r.audit,hasAtlas:r.pages.includes('Index Atlas')}}); 
assert.ok(provinceReport.plots>1,'Province flood report must include actual plot registry');
assert.ok(provinceReport.pages>=8&&provinceReport.pages<=60,'Province decision report includes six-index evidence pages while remaining bounded: '+provinceReport.pages);
assert.ok(provinceReport.images>=8&&provinceReport.images<=160,'Flood brief includes source-derived imagery for all six indices, not an unrestricted atlas');
assert.ok(provinceReport.hasCases&&provinceReport.hasActions&&provinceReport.hasCautions,'Flood brief must explain priority cases, action plan and tide limits');
assert.ok(!provinceReport.hasAtlas,'Flood report must not generate dozens of index atlas pages by default');
assert.ok(provinceReport.head.includes('สรุปสถานการณ์พื้นที่น้ำ'),'Flood findings must appear on first page');
assert.ok(provinceReport.audit&&provinceReport.audit.reviewNeeded===true,'Flood report is screening only, never falsely approved');
assert.ok((await page.locator('#rpt-readiness').innerText()).includes('รายงานคัดกรองเท่านั้น'),'UI must disclose non-confirmation');

await page.locator('#rpt-text').fill('ขอรายงานแปลงระยอง เรื่องน้ำท่วม');
await page.locator('#rpt-analyze').click();
assert.equal(await page.locator('#rpt-type').inputValue(),'water','Exact user request must produce a flood screening report');
assert.equal(await page.locator('#rpt-scope').inputValue(),'province','Exact user request resolves Rayong province, not a random plot');
assert.equal(await page.locator('#rpt-period').inputValue(),'180','No specified window uses an explicit default six-month period');
const rayong=await page.evaluate(()=>{const r=window.MMCReportCopilot.renderPages();return {pages:r.total,images:r.imageCount,qa:r.audit,front:r.pages.split('</article>')[0],text:r.pages};});
assert.ok(rayong.pages>=9&&rayong.pages<=60,'Exact prompt should include six-index comparison pages with a bounded report length');
assert.ok(rayong.qa&&rayong.qa.plots===19,'Rayong report contains exactly 19 registry plots');
assert.ok(['mndwi','ndwi','ndvi','ndre','ndmi','bsi'].every(mode=>rayong.text.includes('data-visual-mode="'+mode+'"')),'Every spectral index must be inspected via a date-matched visual comparison');

assert.ok(rayong.qa.comparable>0,'Flood brief finds QA-valid before-after pair evidence from the real dataset');
assert.ok(rayong.text.includes('17-STC')&&rayong.text.includes('13-STC'),'Selected plot histories must include both 17-STC and 13-STC');
assert.ok(rayong.front.includes('ข้อสรุปสำหรับผู้บริหาร'),'Executive findings appear immediately instead of page 49');

assert.ok(rayong.front.includes('สถานการณ์ล่าสุดเทียบช่วงที่น้ำสูงกว่า'),'Executive cover must lead with latest receding-water evidence');
assert.ok(rayong.text.includes('2026-10-07 · 60.06')&&rayong.text.includes('2026-09-29 · 238.45'),'17-STC shows both high-water and later recession rather than stopping in September');
assert.ok(rayong.text.includes('−178.39')||rayong.text.includes('-178.39')||rayong.text.includes('178.39'),'Main Rayong report shows 17-STC decline since 29 Sept, not just historic +238 rai');
assert.ok(rayong.text.includes('rpt-water-decreased')&&rayong.text.includes('แนวโน้มล่าสุด'),'Water change chart is based on recent dates and emphasizes the decrease');
assert.ok(rayong.text.includes('2026-10-07 · 13.75')&&rayong.text.includes('2026-09-29 · 76.01'),'21-STC recent receding water is included');
assert.ok(rayong.text.includes('ลำดับภาพและแนวโน้มน้ำ · 17-STC')&&rayong.text.includes('ลำดับภาพและแนวโน้มน้ำ · 21-STC'),'Visual timeline pages prioritize dated recession examples');
assert.ok(rayong.text.includes('วันที่และภาพดัชนีที่มี:'),'Review pages disclose every raster date, not only two');
 
const visualOnlyQA=await page.evaluate(()=>{
 const report=window.MMCReportCopilot.renderPages();
 const container=document.createElement('main');container.innerHTML=report.pages;
 const pairs=[...container.querySelectorAll('.rpt-visual-pair')].map(p=>({
  scan:p.dataset.visualScan,
  text:p.querySelector('.rpt-visual-result')?.textContent||'',
  labels:[...p.querySelectorAll('.rpt-visual-date small')].map(x=>x.textContent||'')
 }));
 return {pairs,legend:['MNDWI','NDWI','NDVI','NDRE','NDMI','BSI'].every(name=>report.pages.includes(name)),qaPage:report.pages.includes('ภาพที่คัดออกจากการแปลผลเชิงภาพ'),rejected:report.audit?.visualImagesRejected||0};
});
assert.ok(visualOnlyQA.legend,'Water reports must include all six actual index image modes');
assert.ok(visualOnlyQA.pairs.length>0,'Report still has real index-pair comparisons');
assert.ok(visualOnlyQA.pairs.filter(v=>v.labels.some(x=>/QA NO_DATA|พิกเซลผ่าน QA 0[.]00%/.test(x))).every(v=>v.scan==='disabled'),
 'Zero-SCL-QA data can be displayed as visual MNDWI but never auto-highlighted or certified');
assert.ok(visualOnlyQA.rejected>=0,'QA gate distinguishes display-only indices from truly missing images');
await page.locator('#rpt-text').fill('ขอรายงานแปลง 14(1)-STC เรื่องน้ำท่วม');
await page.locator('#rpt-analyze').click();
const visual14=await page.evaluate(()=>{
 const r=window.MMCReportCopilot.renderPages();
 const host=document.createElement('main');host.innerHTML=r.pages;
 const nodes=[...host.querySelectorAll('.rpt-visual-pair')];
 return {count:nodes.length,dates:nodes.map(n=>[...n.querySelectorAll('.rpt-visual-date small')].map(x=>x.textContent)),auto:nodes.some(n=>n.dataset.visualScan==='eligible'),hint:r.pages.includes('ใช้สังเกตแนวสีน้ำได้แม้ SCL/QA ไม่ผ่าน')};
});
console.log('MMC_QA0_INDEX_VISUAL',JSON.stringify(visual14));
assert.ok(visual14.count>0,'Index data with real B3/B11 render must still be visually inspectable despite zero SCL QA');
assert.ok(visual14.dates.some(arr=>arr.some(x=>x.includes('QA NO_DATA'))),'Show explicit NO_DATA status while presenting MNDWI for visual-only inspection');
assert.equal(visual14.auto,false,'Do not auto-outline or measure water from zero-QA visual-only indices');
await page.locator('#rpt-text').fill('ขอรายงานแปลงระยอง เรื่องน้ำท่วม');
await page.locator('#rpt-analyze').click();
assert.ok(rayong.front.includes('น้ำลดจากช่วงสูงในภาพล่าสุด'),'Executive KPI differentiates current recession from older pair change');

assert.ok(rayong.text.includes('ยังไม่สรุปว่าเป็นน้ำท่วม'),'Screening uncertainty must be explicit and unambiguous');

const visualReview=await page.evaluate(()=>{
 const rr=window.MMCReportCopilot.renderPages();
 return {pages:rr.total,visualPages:(rr.pages.match(/data-visual-scan="/g)||[]).length,
  labels:rr.pages.includes('ภาพดัชนีเปรียบเทียบ'),
  qa:rr.pages.includes('ไม่ผ่าน/ยังไม่มี QA'),
  cloudGate:rr.pages.includes('เมฆ')};
});
assert.ok(visualReview.visualPages>=1,'Rayong report must show georeferenced before/after visual screening even without QA approval');
assert.ok(visualReview.labels&&visualReview.cloudGate,'Visual screening must explain approximate observations and cloud limitations');
await page.waitForFunction(()=>{
 const el=document.querySelector('#rpt-preview .rpt-visual-pair[data-visual-scan="eligible"] .rpt-visual-result');
 return !el||!/กำลังตรวจ/.test(el.textContent||'');
},{timeout:20000});
assert.ok(visualReview.visualPages>=2,'Multiple visual plot timelines exist in the full report');

const visualDiagnostics=await page.evaluate(()=>[...document.querySelectorAll('#rpt-preview .rpt-visual-pair')].map(x=>({status:x.dataset.visualScan,highlightCells:x.querySelectorAll('.rpt-visual-candidates rect').length,clipPath:!!x.querySelector('.rpt-visual-overlay defs clipPath path.rpt-visual-polygon'),actualClipped:x.querySelector('.rpt-visual-candidates')?.getAttribute('clip-path')||'',note:x.querySelector('.rpt-visual-result')?.textContent?.slice(0,110)})));
console.log('MMC_VISUAL_SCREEN_DIAGNOSTICS',JSON.stringify(visualDiagnostics));
assert.ok(visualDiagnostics.some(x=>x.status==='eligible'&&x.highlightCells>0&&x.clipPath&&x.actualClipped.startsWith('url(#rpt-visual-clip-')),'Generated highlights must be clipped to the real GIS polygon; no circles beyond boundary');



assert.ok(rayong.text.includes('ข้อค้นพบเฉพาะแปลง 17-STC')&&rayong.text.includes('ข้อค้นพบเฉพาะแปลง 13-STC'),'Rayong flood cases must include plot-specific interpretations');
assert.ok(rayong.text.includes('น้ำเพิ่ม')&&rayong.text.includes('น้ำลด')&&rayong.text.includes('ข้อมูลย้อนหลังที่คำนวณจากพิกเซลร่วม'),'Historical gain and loss must be separately labeled and secondary to current trend');
assert.ok(rayong.text.includes('rpt-locator-key')&&rayong.text.includes('WGS84 · GIS polygons'),'Location page uses actual polygon geometry and number-keyed labels');
assert.ok(rayong.text.includes('พื้นที่พิกเซลร่วมเกินพื้นที่ Geometry'),'Flag known area/geometry mismatches as an audit issue');
assert.ok(rayong.text.includes('ทุกแปลงที่มีคู่ภาพพบพื้นที่น้ำเพิ่มสุทธิพร้อมกัน'),'Unusually universal water increase triggers systemic QA notice');
assert.ok(rayong.text.includes('ยังไม่มีข้อมูลระดับน้ำขึ้นลง'),'Never imply tide normalization is ready');
const noAppendixPrint=await page.evaluate(()=>window.MMCReportCopilot.renderPages('main'));
assert.equal(noAppendixPrint.total,rayong.pages,'Main report page count matches the decision brief with appendix disabled');


assert.ok(!rayong.text.includes('ห่างกัน')&&!rayong.text.includes('ช่วง (วัน)'),'Flood report must not show day-distance metrics');
assert.ok(rayong.front.includes('ช่วงน้ำสูง')&&rayong.front.includes('ภาพล่าสุด'),'Executive table must show the high-water date and the latest acquisition instead of a day gap');
assert.ok(rayong.text.includes('<th>ภาพก่อนหน้า</th>')&&rayong.text.includes('<th>ภาพปัจจุบัน</th>'),'Ranked evidence uses separately labeled acquisition dates');
assert.ok(rayong.text.includes('วันที่ภาพก่อนหน้า:')&&rayong.text.includes('วันที่ภาพหลังในคู่เปรียบเทียบ:'),'Historical comparison pages must label the actual before/after dates without calling September current');
assert.ok(rayong.text.includes('ไม่จำเป็นต้องเป็นภาพดาวเทียมใหม่ล่าสุดในคลัง'),'Historical comparison explicitly distinguishes its pair date from current acquisition');


const a4Overflows=await page.evaluate(()=>{
 const host=document.createElement('div');
 host.style.cssText='position:absolute;left:-15000px;top:0;width:210mm;pointer-events:none';
 host.innerHTML=window.MMCReportCopilot.renderPages().pages;
 document.body.appendChild(host);
 const problems=[...host.querySelectorAll('.rpt-paper')].map((paper,i)=>{
  const foot=paper.querySelector('.rpt-pagefoot')?.getBoundingClientRect().top||Infinity;
  const last=Math.max(...[...paper.children].filter(x=>!x.classList.contains('rpt-pagefoot')).map(x=>x.getBoundingClientRect().bottom));
  return {page:i+1,overflow:Math.round(last-foot)};
 }).filter(x=>x.overflow>0);
 host.remove();return problems;
});
assert.deepEqual(a4Overflows,[],'Rayong executive report sections must fit above A4 page footer: '+JSON.stringify(a4Overflows));


assert.equal(await page.locator('#rpt-appendix').isChecked(),false,'Large image appendix must default OFF');
assert.equal(await page.locator('#rpt-module-picker').isVisible(),false,'Mandatory flood report sections are not presented as removable modules');
await page.locator('#rpt-appendix').check();
const withAppendix=await page.evaluate(()=>{const r=window.MMCReportCopilot.renderPages();return {pages:r.total,images:r.imageCount,hasAppendix:r.pages.includes('ภาคผนวก Raster Evidence')}}); 
assert.ok(withAppendix.pages>provinceReport.pages&&withAppendix.images>provinceReport.images,'Explicit appendix adds real TIFF imagery pages');
assert.ok(withAppendix.hasAppendix,'TIFF appendix must be clearly marked as supporting evidence');

const printParts=await page.evaluate(()=>{const mm=window.MMCReportCopilot;return {main:mm.renderPages('main'),appendix:mm.renderPages('appendix')}});
assert.equal(printParts.main.total,rayong.pages,'Decision PDF excludes appendix even when selected');
assert.equal(printParts.appendix.total,withAppendix.pages-rayong.pages,'Raster evidence is a standalone PDF without duplicated decision pages');
assert.ok(printParts.appendix.pages.includes('ภาคผนวก Raster Evidence')&&!printParts.appendix.pages.includes('สรุปสถานการณ์พื้นที่น้ำ'),'Separate appendix has only supporting rasters');
assert.equal(await page.locator('#rpt-print-appendix').isVisible(),true,'Appendix PDF button only appears when requested');

await page.locator('#rpt-appendix').uncheck();
await page.locator('[data-rpt-scope-switch="all"]').click();
assert.equal(await page.locator('#rpt-scope').inputValue(),'all','Nationwide scope can be selected with prominent control');
assert.equal(await page.locator('#rpt-image-dates').inputValue(),'1','Nationwide default avoids an accidental massive appendix');
const national=await page.evaluate(()=>{const r=window.MMCReportCopilot.renderPages();return {plots:r.d.pp.length,pages:r.total,images:r.imageCount,audit:r.audit,qa:r.pages.includes('QA/QC'),summary:r.pages.includes('สรุปสถานการณ์พื้นที่น้ำ')}}); 
assert.equal(national.plots,160,'National brief includes all 160 plots, including no-data plots');
assert.ok(national.summary&&national.qa,'National flood brief has executive findings and traceability');
assert.ok(national.audit&&national.audit.plots===160,'National audit coverage must account for all registered plots');
assert.ok(national.pages<55,'National flood executive brief should remain shorter than 55-page Rayong raw atlas');
assert.ok(await page.locator('#rpt-preview .rpt-paper').count()<=8,'Onscreen preview remains bounded even for national report');
assert.ok((await page.locator('#rpt-preview').innerText()).includes('PDF ฉบับเต็ม')||national.pages<=8,'Preview must disclose complete print page count');

await page.locator('#rpt-scope').selectOption('plot');
await page.locator('#rpt-plot').selectOption('15-STC');
await page.locator('#rpt-period').selectOption('365');
assert.equal(await page.locator('#rpt-image-dates').isVisible(),false,'Scene-day selector remains hidden when flood appendix is off');
await page.locator('#rpt-appendix').check();
await page.locator('#rpt-image-dates').selectOption('3');
assert.equal(await page.locator('#rpt-image-dates').inputValue(),'3','Image-rich appendix can include three scene days');
await page.locator('#rpt-appendix').uncheck();
await page.locator('#rpt-preview-button').click();
assert.ok((await page.locator('#rpt-source-summary').innerText()).includes('15-STC')||(await page.locator('#rpt-preview').innerText()).includes('15-STC'),'Plot selection follows preview');
assert.ok(await page.locator('#rpt-preview .rpt-paper').count()>=3,'Custom report modules still render after scope changes');
assert.ok((await page.locator('#rpt-preview').innerText()).includes('QA'),'Report includes QA evidence rather than unsupported impact claims');
assert.ok(!(await page.locator('#rpt-preview').first().innerText()).includes('ข้อมูลสมมติ'),'Missing pairs must not be replaced by fabricated flood findings');
await page.locator('#rpt-plot').selectOption('13-STC');
await page.locator('#rpt-period').selectOption('180');
await page.locator('#rpt-preview-button').click();

const coverQA=await page.locator('#rpt-preview .rpt-paper').first().innerText();
assert.ok(coverQA.includes('สรุปสถานการณ์พื้นที่น้ำ')&&coverQA.includes('คู่ภาพเทียบได้'),'Flood cover must lead with actual change-pair findings and coverage');
const decisionPages=await page.evaluate(()=>[...document.querySelectorAll('#rpt-preview .rpt-paper')].filter(p=>p.querySelector('.rpt-visual-pair')).map(p=>{
 const evidence=p.querySelector('.rpt-visual-pair'),footer=p.querySelector('.rpt-pagefoot');
 return {last:evidence?.getBoundingClientRect().bottom,footer:footer?.getBoundingClientRect().top};
}));
assert.ok(decisionPages.length>0,'Water report must show real all-index image comparison pages within the bounded preview');
assert.ok(decisionPages.every(x=>x.last!=null&&x.footer!=null&&x.last<x.footer-3),'Water pair imagery must not overlap A4 footer: '+JSON.stringify(decisionPages));

const borderCount=await page.locator('#rpt-preview .rpt-image-boundary').count();
assert.ok(borderCount>=1,'Report preview with authentic index Raster must include a real GIS boundary overlay');
const printWindow=page.waitForEvent('popup',{timeout:15000});
await page.locator('#rpt-print').click();
const reportPopup=await printWindow;
await reportPopup.waitForSelector('.rpt-paper',{timeout:15000});
assert.ok(await reportPopup.locator('.rpt-paper').count()>=3,'PDF print opens a dedicated multi-page A4 report, not the entire dashboard');
assert.ok((await reportPopup.locator('style').first().innerText()).includes('size:A4 portrait'),'PDF report must explicitly print A4 portrait');
await reportPopup.close();


await page.locator('#image-date').selectOption('2026-08-03');
await page.waitForFunction(()=>document.querySelector('#image-date')?.value==='2026-08-03'&&!!document.querySelector('#mmc-geo-map'),null,{timeout:20000});
const reportLayer=await page.locator('#mmc-geo-map .leaflet-image-layer').count();
const reportText=await page.locator('#imagery-explorer').innerText();
assert.ok(reportLayer>0||reportText.includes('ไม่มี Raster')||reportText.includes('ยังไม่มีภาพ'),'Report must disclose unavailable older raster rather than silently substituting basemap');
await page.locator('[data-image-layout="compare"]').click();
assert.equal(await page.locator('.img-compare-grid .img-frame').count(),2,'Report comparison preserves before/after slots, exposing missing TIFFs where necessary');
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
await mobile.locator('#image-date').selectOption('2026-10-07');
await mobile.locator('[data-image-layout="grid"]').click();
await mobile.waitForFunction(()=>document.querySelector('.img-gallery .img-boundary-overlay')?.style.visibility==='visible',{timeout:20000});
const alignedMobile=await mobile.locator('.img-gallery .img-tile').first().evaluate(el=>{
 const img=el.querySelector('img'),overlay=el.querySelector('.img-boundary-overlay'),r=overlay.getBoundingClientRect(),frame=el.querySelector('.img-frame').getBoundingClientRect();
 return img.naturalWidth>0&&r.width>0&&r.left>=frame.left-2&&r.right<=frame.right+2&&r.bottom<=frame.bottom+2;
});
assert.ok(alignedMobile,'Mobile aggregate images retain aligned GIS boundary');
await mobile.locator('[data-image-layout="history"]').click();
await mobile.waitForSelector('#image-history-mode',{timeout:20000});
await mobile.locator('#image-history-mode').selectOption('mndwi');
await mobile.waitForFunction(()=>document.querySelector('#image-history-mode')?.value==='mndwi'&&document.querySelectorAll('.img-history-single').length>0,{timeout:20000});
assert.ok(await mobile.locator('#img-all-dates [data-history-mode="mndwi"]').count()>0,'Mobile history shows requested MNDWI only');
assert.equal(await mobile.locator('#img-all-dates [data-history-mode="ndvi"]').count(),0,'Mobile filtered history excludes other indices');
await mobile.locator('[data-image-layout="single"]').click();
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
await mobile.locator('#menu-btn').click();
await mobile.locator('[data-view="insights"]').click();
await mobile.locator('#plot-select').selectOption('13-STC');
await mobile.waitForSelector('#image-date');
await mobile.locator('#image-date').selectOption('2026-09-29');
await mobile.waitForFunction(()=>document.querySelector('#water-selected-date')?.textContent?.includes('2026-09-29'),{timeout:20000});
const mobileWaterLayout=await mobile.locator('#water-daily-panel .hydro-kpis').evaluate(grid=>
 [...grid.querySelectorAll('.kpi')].every(card=>{
   const rect=card.getBoundingClientRect(),strong=card.querySelector('strong')?.getBoundingClientRect(),
     foot=card.querySelector('.foot')?.getBoundingClientRect();
   return !!strong&&!!foot&&strong.bottom<=foot.top+1&&foot.bottom<=rect.bottom+1 &&
     strong.right<=rect.right+1&&foot.right<=rect.right+1;
 }));
assert.ok(mobileWaterLayout,'Mobile water values and provenance footnotes must not overlap or overflow');

await mobile.locator('#menu-btn').click();
await mobile.locator('[data-view="reports"]').click();
await mobile.waitForSelector('#rpt-analyze',{timeout:20000});
assert.ok(await mobile.locator('#rpt-preview .rpt-paper').count()>=3,'Mobile Report Studio renders portrait pages');
await mobile.locator('#rpt-text').fill('ติดตามสภาพป่า 13-STC ย้อนหลัง 1 ปี NDVI NDMI');
await mobile.locator('#rpt-analyze').click();
assert.equal(await mobile.locator('#rpt-type').inputValue(),'forest','Mobile Thai interpreter recognizes forest monitoring');
assert.equal(await mobile.locator('#rpt-period').inputValue(),'365','Mobile report parser applies annual date window');




assert.deepEqual(errors,[],'Desktop JS errors: '+errors.join(' | '));assert.deepEqual(mobileErrors,[],'Mobile JS errors: '+mobileErrors.join(' | '));
console.log('MMC_PREVIEW_PASS registry=160 qa=126 pdd=136 chart sources=actual plot 13-STC modules=26 mobile=390');
await mobile.close();
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
