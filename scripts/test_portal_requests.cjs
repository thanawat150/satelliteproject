/* Portal load budget and UX guardrails: no duplicate data downloads, page renders, no page errors. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {chromium}=require("playwright");
const root=path.join(__dirname,"..");
const BASE=process.env.PORTAL_BASE||"http://127.0.0.1:8877/";
const readData=p=>JSON.parse(fs.readFileSync(path.join(root,"docs/data",p),"utf8"));

// Static check: only data-store.js may call fetch among the local scripts loaded by index.html.
const html=fs.readFileSync(path.join(root,"docs/index.html"),"utf8");
const portalScripts=[...html.matchAll(/<script\b[^>]*\bsrc="([a-z0-9-]+\.js)(?:\?[^"]*)?"/g)].map(m=>m[1]);
assert.ok(portalScripts.includes("data-store.js"),"index.html must load data-store.js");
assert.ok(portalScripts.indexOf("data-store.js")<portalScripts.indexOf("map-studio.js"),"data-store.js must load before other portal scripts");
const direct=portalScripts.filter(f=>f!=="data-store.js"&&/\bfetch\(/.test(fs.readFileSync(path.join(root,"docs",f),"utf8")));
assert.deepEqual(direct,[],"portal scripts must load data through DataStore, found fetch( in: "+direct.join(", "));

// Which plots should carry the failed-polygon chip, derived from today's data with the same QA gate the page uses.
const qaCtx={window:{}};vm.createContext(qaCtx);
vm.runInContext(fs.readFileSync(path.join(root,"docs/monitoring-qa.js"),"utf8"),qaCtx);
const plots=readData("plots.json").plots,history=readData("analysis_history.json").plots,newWater=readData("new_water.geojson").features;
const iso=s=>String(s).replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
const polygonPlots=new Set(newWater.map(f=>f.properties?.plot).filter(id=>plots.some(p=>p.plot===id)));
const expectedFailed=[...polygonPlots].filter(id=>{const p=plots.find(x=>x.plot===id);
 return !qaCtx.window.MonitoringQA.verifyPair(p,iso(p.baseline),iso(p.current),history[id]||[],newWater.find(f=>f.properties.plot===id)).ok}).sort();
assert.ok(expectedFailed.length>0&&expectedFailed.length<polygonPlots.size,"fixture data should have both passing and failing polygons");

let browser;
async function openPortal(viewport={width:1280,height:800},{route}={}){
 const page=await browser.newPage({viewport});
 page.setDefaultTimeout(60000);
 if(route)await route(page);
 const requests=[],errors=[];
 page.on("request",r=>requests.push(r.url()));
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(BASE,{waitUntil:"networkidle"});
 await page.waitForFunction(()=>!/กำลังโหลด/.test(document.getElementById("updated-pill")?.textContent||"กำลังโหลด"));
 await page.waitForTimeout(1500);
 return {page,requests,errors};
}
const chipsOf=(page,label)=>page.evaluate(label=>[...document.querySelectorAll("#plot-list .plot-item")]
 .filter(el=>[...el.querySelectorAll(".qa-chip")].some(c=>c.textContent.trim()===label))
 .map(el=>el.querySelector("strong").textContent.trim()).sort(),label);
function duplicates(requests){
 const counts={};
 for(const u of requests){const p=new URL(u).pathname;if(p.includes("/data/"))counts[p]=(counts[p]||0)+1}
 return {counts,dup:Object.entries(counts).filter(([,n])=>n>1).map(([p,n])=>p.split("/").pop()+" x"+n)};
}
async function main(){
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const {page,requests,errors}=await openPortal();
  assert.equal(await page.locator("#plot-list .plot-item").count(),plots.length,"page renders one card per plot");
  assert.deepEqual(await chipsOf(page,"Polygon น้ำรอตรวจ"),expectedFailed,"polygon QA chip shown exactly for plots whose polygon fails QA");
  assert.match((await page.locator("#updated-pill").innerText()).trim(),/^อัปเดต \d{2}\/\d{2}\/25\d{2}$/,"header date is BE");
  assert.deepEqual(await page.evaluate(()=>[formatThaiDateISO("2026-10-08"),formatThaiDateISO("20261008"),formatThaiDateISO(""),formatThaiDateISO(null)]),
   ["08/10/2569","20261008","—","—"],"date formatter converts ISO dates and keeps unknown formats as-is");
  for(const tab of ["satellite","compare","center"]){await page.click(`[data-tab="${tab}"]`);await page.waitForLoadState("networkidle");await page.waitForTimeout(800)}
  const noAlt=await page.$$eval("img:not([alt])",els=>els.map(e=>(e.className||e.parentElement?.className||"")+" "+String(e.src).slice(-40)));
  assert.deepEqual(noAlt,[],"every img has alt");
  const {counts,dup}=duplicates(requests);
  assert.deepEqual(dup,[],"no data file fetched twice (including after switching tabs): "+dup.join(", "));
  assert.deepEqual(errors,[],"page throws no errors");
  assert.equal(await page.locator("#top-more").isVisible(),false,"desktop hides the more-menu button");
  assert.equal(await page.getByRole("button",{name:"คัดลอกลิงก์"}).isVisible(),true,"desktop shows header actions");
  await page.close();

  const mobile=await openPortal({width:375,height:812});
  const m=mobile.page;
  const headerH=await m.locator("header.topbar").evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(headerH<=140,"mobile header compact: "+Math.round(headerH)+"px");
  const copy=m.getByRole("button",{name:"คัดลอกลิงก์"});
  assert.equal(await copy.isVisible(),false,"more menu hides actions until opened");
  await m.click("#top-more");
  assert.equal(await copy.isVisible(),true,"more menu reveals actions");
  assert.equal(await m.getAttribute("#top-more","aria-expanded"),"true","more menu sets aria-expanded");
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=375),"no horizontal scroll on mobile");
  await m.keyboard.press("Escape");
  assert.equal(await copy.isVisible(),false,"Escape closes the more menu");
  assert.equal(await m.getAttribute("#top-more","aria-expanded"),"false","Escape resets aria-expanded");
  await m.click("#top-more");
  await m.mouse.click(187,600);
  assert.equal(await copy.isVisible(),false,"clicking outside closes the more menu");
  assert.deepEqual(mobile.errors,[],"mobile page throws no errors");
  await m.close();

  // QA history unavailable: polygons are hidden, so every plot with a polygon must say why.
  const down=await openPortal(undefined,{route:p=>p.route("**/data/analysis_history.json*",r=>r.fulfill({status:503,body:"down"}))});
  assert.deepEqual(await chipsOf(down.page,"รอผล QA"),[...polygonPlots].sort(),"QA-unavailable chip on every plot with a polygon");
  assert.deepEqual(await chipsOf(down.page,"Polygon น้ำรอตรวจ"),[],"no failed-polygon verdict without QA history");
  await down.page.close();

  console.log("PORTAL REQUESTS TEST PASS:",Object.keys(counts).length,"data files,",requests.length,"requests; mobile header",Math.round(headerH),"px;",expectedFailed.length,"failed polygons");
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exit(1)});
