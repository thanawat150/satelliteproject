/* Portal load budget and UX guardrails: no duplicate data downloads, page renders, no page errors. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.join(__dirname,"..");
const BASE=process.env.PORTAL_BASE||"http://127.0.0.1:8877/";

// Static check: only data-store.js may call fetch among the portal scripts loaded by index.html.
const html=fs.readFileSync(path.join(root,"docs/index.html"),"utf8");
const portalScripts=[...html.matchAll(/<script src="([a-z0-9-]+\.js)\?v=[^"]*"><\/script>/g)].map(m=>m[1]);
assert.ok(portalScripts.includes("data-store.js"),"index.html must load data-store.js");
assert.ok(portalScripts.indexOf("data-store.js")<portalScripts.indexOf("map-studio.js"),"data-store.js must load before other portal scripts");
const direct=portalScripts.filter(f=>f!=="data-store.js"&&/\bfetch\(/.test(fs.readFileSync(path.join(root,"docs",f),"utf8")));
assert.deepEqual(direct,[],"portal scripts must load data through DataStore, found fetch( in: "+direct.join(", "));

let browser;
async function openPortal(viewport={width:1280,height:800},query=""){
 const page=await browser.newPage({viewport});
 page.setDefaultTimeout(60000);
 const requests=[],errors=[];
 page.on("request",r=>requests.push(r.url()));
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(BASE+query,{waitUntil:"networkidle"});
 await page.waitForFunction(()=>!/กำลังโหลด/.test(document.getElementById("updated-pill")?.textContent||"กำลังโหลด"));
 await page.waitForTimeout(1500);
 return {page,requests,errors};
}
async function main(){
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const {page,requests,errors}=await openPortal();
  const counts={};
  for(const u of requests){const p=new URL(u).pathname;if(p.includes("/data/"))counts[p]=(counts[p]||0)+1}
  const dup=Object.entries(counts).filter(([,n])=>n>1).map(([p,n])=>p.split("/").pop()+" x"+n);
  assert.deepEqual(dup,[],"no data file fetched twice: "+dup.join(", "));
  assert.equal(await page.locator("#plot-list .plot-item").count(),19,"page still renders 19 plot cards");
  const cardText=id=>page.evaluate(id=>[...document.querySelectorAll("#plot-list .plot-item")].find(el=>el.querySelector("strong")?.textContent.trim()===id)?.innerText??"(missing card "+id+")",id);
  for(const id of ["17-STC","18(1)-STC"])assert.ok((await cardText(id)).includes("Polygon น้ำรอตรวจ"),"polygon QA chip shown: "+id);
  assert.ok(!(await cardText("13-STC")).includes("Polygon น้ำรอตรวจ"),"polygon QA chip shown only for failed polygons: 13-STC");
  assert.deepEqual(errors,[],"page throws no errors");
  console.log("PORTAL REQUESTS TEST PASS:",Object.keys(counts).length,"data files,",requests.length,"requests");
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exit(1)});
