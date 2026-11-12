/* User-triggered refreshes must reach the network even though DataStore remembers files for the page load. */
const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const calls={};
function fetchStub(url){
 calls[url]=(calls[url]||0)+1;
 const file=path.join(root,"docs",url);
 return Promise.resolve(fs.existsSync(file)
  ?{ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(file,"utf8"))}
  :{ok:false,status:404,json:async()=>{throw Error("404")}});
}
const nullEl=new Proxy(function(){},{get:(t,k)=>k==="addEventListener"?()=>{}:undefined});
const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},readyState:"complete",createElement:()=>nullEl};
const context={fetch:fetchStub,document,console,structuredClone,setTimeout,clearTimeout,location:{search:""},URLSearchParams};
context.window=context;
vm.createContext(context);
for(const f of ["data-store.js","monitoring-qa.js","alert-engine.js","alert-center.js","trend-report.js"])
 vm.runInContext(fs.readFileSync(path.join(root,"docs",f),"utf8"),context,{filename:f});
const n=u=>calls["data/"+u]||0;
(async()=>{
 // Alert Center: first load uses shared copies; the reload button must re-read the web.
 await context.AlertCenter.load();
 const before=n("analysis_history.json");
 await context.AlertCenter.load();
 assert.equal(n("analysis_history.json"),before,"automatic load reuses the shared copy");
 assert.equal(typeof context.AlertCenter.refresh,"function","AlertCenter.refresh must exist for the reload button");
 await context.AlertCenter.refresh();
 assert.equal(n("analysis_history.json"),before+1,"alert reload button re-fetches analysis_history.json");
 assert.equal(n("plots.json"),2,"alert reload button re-fetches plots.json");
 assert.equal(n("satellite_parts.json"),2,"alert reload button re-fetches satellite_parts.json");
 // TrendReport: load(true) must refresh both files it reads.
 await context.TrendReport.load();
 const wh=n("water_history.geojson");
 await context.TrendReport.load(true);
 assert.equal(n("water_history.geojson"),wh+1,"TrendReport.load(true) re-fetches water_history.geojson");
 console.log("REFRESH PATHS TEST PASS");
})().catch(e=>{console.error(e);process.exit(1)});
