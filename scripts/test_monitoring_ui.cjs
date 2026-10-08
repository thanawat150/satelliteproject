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
  await page.locator('button[data-tab="calendar"]').click();
  assert.ok(await page.locator("#calendar-root .cal-alert-dot").count()>0,"Calendar should show alerts from actual dates");
  assert.deepEqual(errors,[],"Unhandled browser runtime errors: "+errors.join(" | "));
  console.log("BROWSER SMOKE PASS: date pairing, layer disabled states, single-map swipe with 2 loaded images, alert listing, calendar");
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
