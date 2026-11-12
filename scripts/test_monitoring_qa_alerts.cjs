const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,"docs/data",p),"utf8"));
const context={window:{}};vm.createContext(context);
for(const p of ["monitoring-qa.js","status-engine.js","alert-engine.js"]){
 vm.runInContext(fs.readFileSync(path.join(root,"docs",p),"utf8"),context);
}
const qa=context.window.MonitoringQA;
const alertEngine=context.window.MonitoringAlerts;
const plots=read("plots.json").plots,history=read("analysis_history.json").plots,geo=read("new_water.geojson").features;
function status(p){
 const x=plots.find(r=>r.plot===p),geom=geo.find(f=>f.properties.plot===p);
 const a=x.baseline.slice(0,4)+"-"+x.baseline.slice(4,6)+"-"+x.baseline.slice(6);
 const b=x.current.slice(0,4)+"-"+x.current.slice(4,6)+"-"+x.current.slice(6);
 return qa.verifyPair(x,a,b,history[p],geom);
}
const bad=status("17-STC");
assert.equal(bad.ok,false);
assert.ok(bad.polygon_rai>50&&bad.polygon_rai<70,"Unexpected geometry-area mismatch in 17-STC");
assert.equal(status("13-STC").ok,true,"Verified geometry that approximately matches should display");
assert.equal(status("18(1)-STC").ok,false,"Mismatched geometry must not be shown");
const p=plots.find(x=>x.plot==="17-STC"),f=geo.find(x=>x.properties.plot==="17-STC");
const wrongDate=qa.verifyPair(p,"2026-04-30","2026-10-02",history["17-STC"],f);
assert.equal(wrongDate.ok,false,"Never show prior pair footprint on an arbitrary new date");
const images=JSON.parse(fs.readFileSync(path.join(root,"docs/data/satellite_part_1.json"),"utf8"));
const events=alertEngine.build({history,plots,images});
assert.equal(events.some(x=>x.plot==="17-STC"&&x.type==="water"),false,"Stale >30-day reference must suppress water P1/P2");
assert.ok(events.some(x=>x.plot==="17-STC"&&x.type==="baseline"&&x.priority==="P3"),"Old baseline should remain visible as informational P3");
assert.ok(events.some(x=>x.plot==="23-STC"&&x.type==="water"&&x.priority==="P2"),"Recent first increase should be WATCH / P2");
assert.ok(events.some(x=>x.plot==="17-STC"&&x.type==="vegetation"&&x.priority==="P2"),"Vegetation screening alert expected");
assert.ok(events.some(x=>x.plot==="13-STC"&&x.type==="qa"&&x.priority==="P3"),"Latest partial scene must be flagged");
assert.equal(events.some(x=>x.plot==="13-STC"&&x.date==="2026-10-07"&&x.type==="water"),false,"Partial imagery cannot generate confirmed water-change alerts");
assert.equal(new Set(events.map(x=>x.id)).size,events.length);
const changed=JSON.parse(JSON.stringify(history));
changed["17-STC"]=[{date:"2026-10-06",analysis_status:"VERIFIED",water_rai:1,water_pct:2,ndvi:.55,ndre:.4,ndmi:.2,valid_pct:100},
{date:"2026-10-09",analysis_status:"AUTO_VALID",water_rai:29,water_pct:40,ndvi:.41,ndre:.31,ndmi:.39,valid_pct:98}];
const latest=alertEngine.build({history:changed,plots,images});
assert.ok(latest.some(x=>x.plot==="17-STC"&&x.date==="2026-10-09"&&x.type==="water"&&x.priority==="P2"),"Recent first qualified increase should be WATCH/P2");
changed["17-STC"].unshift({date:"2026-10-03",analysis_status:"VERIFIED",water_rai:0,water_pct:0,ndvi:.56,ndre:.44,ndmi:.21,valid_pct:95});
const confirmed=alertEngine.build({history:changed,plots,images});
assert.ok(confirmed.some(x=>x.plot==="17-STC"&&x.date==="2026-10-09"&&x.type==="water"&&x.priority==="P1"),"Two repeated QA-valid rises should trigger HIGH/P1");
changed["17-STC"][0].valid_pct=null;
const nullValid=alertEngine.build({history:changed,plots,images});
assert.equal(nullValid.some(x=>x.plot==="17-STC"&&x.type==="water"&&x.priority==="P1"),false,"Null valid_pct must not enter confirmed water series");
console.log("MONITORING QA + ALERTS TEST PASS:",events.length,"alerts;",bad.polygon_rai.toFixed(1),"rai 17-STC polygon vs",bad.reported_rai,"rai report");
