const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[];page.on('pageerror',x=>errors.push(x.stack||x.message));page.setDefaultTimeout(45000);
await page.goto('http://127.0.0.1:8877/mangrove-monitoring/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.querySelector('#updated')?.textContent?.includes('ข้อมูลดาวเทียม'),{timeout:60000});
assert.ok((await page.locator('#view-root').innerText()).includes('136 / 136'),'Overview should preserve original PDD cohort');
assert.ok((await page.locator('#view-root').innerText()).includes('126 / 136'),'Overview should keep QA count');
assert.ok((await page.locator('#view-root').innerText()).includes('160'),'Must show 160-register total');
await page.locator('[data-view="plots"]').click();
await page.waitForFunction(()=>document.querySelector('#plot-search')&&document.querySelectorAll('.tbl tbody tr').length>100);
assert.equal(await page.locator('.tbl tbody tr').count(),160,'159 published boundaries + one unmatched 66(1)-STC candidate');
await page.locator('#plot-search').fill('66(1)-STC');
assert.equal(await page.locator('.tbl tbody tr').count(),1,'Missing geometry entry remains visible');
assert.ok((await page.locator('.tbl tbody tr').first().innerText()).includes('ต้องจับคู่'),'No invented geometry');
await page.locator('[data-view="analysis"]').click();
await page.waitForFunction(()=>!!document.querySelector('#metric-select'));
await page.locator('#plot-select').selectOption('13-STC');
const analysis=await page.locator('#view-root').innerText();
assert.ok(analysis.includes('2026-09-29'),'Analysis must show real Sentinel-2 date');
assert.ok(analysis.includes('AUTO_VALID'),'Analysis must show QA state');
await page.locator('#metric-select').selectOption('mndwi');
assert.ok(await page.locator('.mini-chart svg circle').count()>=2,'Actual QA chart has at least 2 points');

await page.waitForSelector('#image-date',{timeout:15000});
const opts=await page.locator('#image-date option').allTextContents();
assert.ok(opts.some(x=>x.includes('2026-09-29')),'Actual image product dates should be available for 13-STC');
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
  realImages:[...el.querySelectorAll('img[src^="data:image/"]')].length,
  validLoaded:[...el.querySelectorAll('img[src^="data:image/"]')].filter(x=>x.complete&&x.naturalWidth>0).length,
  qa:el.innerText.includes('AUTO_VALID'),
  before:el.innerText.includes('BEFORE'),
  after:el.innerText.includes('AFTER')
}));
assert.ok(imageStatus.realImages>=6&&imageStatus.validLoaded>=4,'Rendered index/rgb previews must load actual image bytes');
assert.ok(imageStatus.qa&&imageStatus.before&&imageStatus.after,'QA and before-after labels required');

await page.locator('#plot-select').selectOption('102-VSD');
await page.waitForFunction(()=>document.querySelector('#image-date option')?.textContent?.includes('2026'),{timeout:20000});
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
assert.ok(await page.locator('#mmc-geo-map .leaflet-image-layer').count()>=1,'Latest QA-valid scene overlays raster on GIS map');
assert.ok(await page.locator('.img-large .img-boundary-line').count()===1,'Latest QA-valid scene must display actual red polygon boundary');
const missingImage=await page.locator('#imagery-explorer').innerText();
assert.ok(!missingImage.includes('ยังไม่มี Raster Preview'),'15-STC 2026-10-07 preview is published and must not display missing notice');
assert.equal(await page.locator('#image-before').inputValue(),'2026-08-03','Before defaults to an earlier QA-valid available raster, never NO_DATA');
assert.ok(missingImage.includes('น้อยกว่า 30 พิกเซล'),'Small plot accuracy warning should be visible');
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
assert.ok(await page.locator('[data-action="exportgaps"]').count()===1,'Gap CSV must be available');
assert.ok((await page.locator('#view-root').innerText()).includes('66(1)-STC'),'Boundary issue should be visible');
await page.locator('[data-view="satellite"]').click();
await page.locator('#plot-select').selectOption('13-STC');
assert.ok(await page.locator('a[href*="drive.google.com"]').count()>=1,'Source assets can be inspected');
await page.locator('[data-view="alerts"]').click();
assert.ok((await page.locator('#view-root').innerText()).includes('Candidate'),'Alert must remain candidate rather than confirmed flood');
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
assert.deepEqual(errors,[],'Desktop JS errors: '+errors.join(' | '));assert.deepEqual(mobileErrors,[],'Mobile JS errors: '+mobileErrors.join(' | '));
console.log('MMC_PREVIEW_PASS registry=160 qa=126 pdd=136 chart sources=actual plot 13-STC modules=26 mobile=390');
await mobile.close();
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
