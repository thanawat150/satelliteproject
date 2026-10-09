const assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:850}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8877/nationwide.html",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>document.getElementById("national-status")?.textContent?.includes("เชื่อม"),{timeout:60000});
  assert.equal(await page.locator("#national-plot option").count(),137,"must show 136 plot choices + all");
  await page.locator("#national-all-years").click();
  await page.locator("#national-plot").selectOption("ALL");
  await page.waitForFunction(()=>document.getElementById("national-total")?.textContent?.includes("3,922"),{timeout:10000});
  assert.ok(await page.locator("#national-gallery .nat-image-card").count()>0,"gallery should display files");
  await page.waitForTimeout(1600);
  const thumbs=await page.locator("#national-gallery img").evaluateAll(xs=>({requested:xs.length,shown:xs.filter(i=>i.complete&&i.naturalWidth>0).length,failed:xs.filter(i=>i.complete&&i.naturalWidth===0).length}));
  console.log("DRIVE_TIFF_THUMBNAIL_DIAGNOSTIC",JSON.stringify(thumbs));
  await page.locator("#national-province").selectOption({label:"ตราด"});
  await page.locator("#national-plot").selectOption("1-VSD");
  await page.locator("#national-one-year").check();
  const n=Number((await page.locator("#national-total").innerText()).replace(/,/g,""));
  assert.ok(n>0&&n<=7,"one per year must return max seven images for selected plot");
  await page.locator("#national-gallery .nat-image-card").first().click();
  assert.equal(await page.locator("#national-preview").getAttribute("hidden"),null,"full-frame preview modal should open");
  await page.locator("#national-preview-close").click();
  assert.notEqual(await page.locator("#national-preview").getAttribute("hidden"),null,"modal should close");
  const own=errors.filter(x=>x.includes("nationwide-catalog")||x.includes("national"));
  assert.deepEqual(own,[],"nationwide gallery has no uncaught runtime errors");
  console.log("PASS: 136 plot choices, 3,922 source files, national filters, one image per year, full-frame modal");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
