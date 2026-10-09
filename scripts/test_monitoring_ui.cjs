/* Browser smoke: Leaflet swipe, plot-layer QA and Alert Center on the actual portal UI. */
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.setDefaultTimeout(60000);
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8877/?tab=compare&plot=17-STC",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.getElementById("compare-newwater")?.disabled===true,{timeout:45000});
  const status=await page.locator("#compare-newwater-status").innerText();
  assert.ok(status.includes("Polygon"),"17-STC mismatched overlay must be disabled");
  assert.equal(await page.locator("#compare-vegetation").isDisabled(),true,"Missing vegetation masks should not be clickable");
  assert.equal(await page.locator("#compare-soil").isDisabled(),true,"Missing bare-soil masks should not be clickable");
  await page.selectOption("#compare-mode","swipe");
  await page.waitForFunction(()=>document.querySelectorAll("#compare-map-b img.leaflet-image-layer").length>=2,{timeout:30000});
  await page.waitForTimeout(550);
  assert.equal(await page.locator("#compare-map-wrap").evaluate(el=>getComputedStyle(el.querySelector(".cmp-panel-a")).display),"none");
  const w=await page.locator("#compare-map-b").evaluate(el=>el.getBoundingClientRect().width);
  assert.ok(w>500,"B map needs full-width viewport in swipe");
  const before=await page.locator("#compare-map-b img.leaflet-image-layer").last().evaluate(el=>el.style.clipPath);
  await page.locator("#compare-split").evaluate(el=>{el.value="25";el.dispatchEvent(new Event("input",{bubbles:true}))});
  await page.waitForTimeout(200);
  const after=await page.locator("#compare-map-b img.leaflet-image-layer").last().evaluate(el=>el.style.clipPath);
  assert.ok(after.startsWith("inset(")&&before!==after,"Slider must clip the B image, not an entire map");
  const overlays=await page.locator("#compare-map-b img.leaflet-image-layer").evaluateAll(els=>els.map(x=>({loaded:x.complete&&x.naturalWidth>0,width:x.naturalWidth})));
  assert.ok(overlays.slice(-2).every(x=>x.loaded),"Both georeferenced imagery dates should render actual images");

  await page.selectOption("#compare-plot","13-STC");
  await page.waitForFunction(()=>document.getElementById("compare-newwater")?.disabled===false,{timeout:8000});
  await page.locator('button[data-tab="alerts"]').click();
  await page.waitForFunction(()=>document.querySelectorAll("#alert-list .alert-item").length>0,{timeout:15000});
  const has17=await page.locator("#alert-list").innerText();
  assert.ok(has17.includes("17-STC"),"Derived alerts should include 17-STC");
  await page.locator("#alert-export").click();
  await page.locator(".header-calendar-btn").click();
  await page.waitForFunction(()=>document.querySelectorAll("#calendar-root .cal-alert-dot").length>0,{timeout:15000});
  assert.ok(await page.locator("#calendar-root .cal-alert-dot").count()>0,"Calendar should show alerts from actual dates");
  // New report selection must use checkboxes for multiple dates, years, and each graph.
  await page.locator('button[data-tab="report"]').click();
  await page.selectOption("#report-plot","13-STC");
  await page.selectOption("#report-type","quick");
  await page.waitForFunction(()=>document.querySelectorAll("#report-date-checkboxes input[data-report-date]").length>=2,{timeout:30000});
  assert.equal(await page.locator("#report-date-a").count(),0,"No Report A/B date dropdown should remain");
  const available=await page.locator('#report-date-checkboxes input[data-report-date]').count();
  assert.ok(available>=2,"At least 2 selectable actual plot dates");
  await page.locator('input[data-report-graph="ndvi"]').uncheck();
  await page.waitForFunction(()=>!!document.querySelector('.live-grid [data-chart="ndre"]')&&!document.querySelector('.live-grid [data-chart="ndvi"]'),{timeout:25000});
  assert.equal(await page.locator('.live-grid [data-chart="ndvi"]').count(),0,"Unchecked NDVI graph hidden");
  assert.ok(await page.locator('.live-grid [data-chart="ndre"]').count()>0,"Other checked graphs stay visible");
  // BSI must be backed by actual numeric GeoTIFF results, not the raster preview.
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.live-grid canvas[data-chart="bsi"]');
    const chart=canvas&&window.Chart?.getChart?.(canvas);
    return !!chart&&chart.data.datasets.some(s=>s.data.filter(x=>x!==null&&Number.isFinite(Number(x))).length>=2);
  },{timeout:25000});
  const bsiValues=await page.locator('.live-grid canvas[data-chart="bsi"]').evaluate(el=>window.Chart.getChart(el).data.datasets[0].data.filter(x=>x!==null));
  assert.ok(bsiValues.length>=2,"BSI graph must show at least two real observations");

  await page.locator('input[name="report-period-mode"][value="annual"]').check();
  await page.waitForFunction(()=>document.querySelector('#report-scope-caption')?.textContent?.includes('ปีละหนึ่งวัน')&&document.querySelector('.report-imagery-grid'),{timeout:25000});
  const perYear=await page.locator('.report-imagery-item').count();
  const yearCount=await page.locator('#report-year-checkboxes input:checked').count();
  assert.equal(perYear,yearCount,"Exactly one real scene per checked year");
  const noDateDropdowns=await page.locator('#report-paper select.live-water-date').count();
  assert.equal(noDateDropdowns,0,"Water footprint date dropdown removed in favor of multi-date");
  await page.locator('input[name="report-period-mode"][value="dates"]').check();
  const choices=page.locator('#report-date-checkboxes input[data-report-date]');
  if(available>2){
    await choices.nth(0).uncheck();
    await page.waitForFunction(()=>document.querySelectorAll('#report-paper .report-imagery-item').length<document.querySelectorAll('#report-date-checkboxes input[data-report-date]').length,{timeout:25000});
  }
  await page.goto("http://127.0.0.1:8877/nationwide.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelectorAll("#plot option").length>=2 && document.querySelectorAll("#dates input[data-day]").length===2,{timeout:30000});
  const validation=await page.evaluate(async()=>{
    const data=await fetch("data/nationwide/batch_01_results.json").then(r=>r.json());
    const source=await fetch("data/nationwide/boundaries_pdd_all.geojson").then(r=>r.json());
    return {nPlots:Object.keys(data.plots).length,nScenes:data.scenes.length,qa:data.totals.qa_valid_dates,candidates:source.features.length,hasFullMetrics:data.scenes.some(x=>x.status==="AUTO_VALID"&&x.bsi!=null&&x.ndvi!=null&&x.ndre!=null&&x.ndmi!=null&&x.mndwi!=null&&x.savi!=null&&x.evi!=null),waterGeojsonCount:(await fetch("data/nationwide/batch_01_features.geojson").then(r=>r.json())).features.length};
  });
  assert.equal(validation.nPlots,10,"Batch 01 must contain 10 real PDD plots");
  assert.equal(validation.nScenes,20,"Batch 01 must contain 20 original TIFF analysis dates");
  assert.equal(validation.candidates,159,"Native PDD source inventory has 159 candidate geometries");
  assert.ok(validation.hasFullMetrics,"Original TIFFs must provide full index set");
  assert.ok(validation.waterGeojsonCount>10,"Vector water/vegetation/soil/wetness geometries must exist");
  await page.locator('#province').selectOption('ตราด');
  await page.locator('#plot').selectOption('7-VSD');
  await page.waitForFunction(()=>document.querySelectorAll('#charts canvas').length>3 && document.querySelectorAll('#images img').length===2,{timeout:20000});
  assert.ok((await page.locator('#plotmeta').innerText()).includes('PDD'),"PDD metadata visible");
  await page.locator('input[data-metric="bsi"]').uncheck();
  await page.waitForFunction(()=>document.querySelectorAll('#charts canvas').length>0 && ![...document.querySelectorAll('#charts h3')].some(x=>x.textContent==="BSI"),{timeout:15000});
  assert.equal(await page.locator("#tablebody tr").count(),2,"Daily table must show both selected actual acquisition dates");
    assert.deepEqual(errors,[],"Unhandled browser runtime errors: "+errors.join(" | "));
  console.log("BROWSER SMOKE PASS: compare map, alert list, calendar, report multi-date, annual images, graph checkboxes, real BSI values and nationwide PDD full-process pipeline");
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
