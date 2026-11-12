const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.join(__dirname,"..");
function read(file){return JSON.parse(fs.readFileSync(path.join(root,"docs","data",file),"utf8"))}
const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,"docs","status-engine.js"),"utf8"),sandbox);
const engine=sandbox.window.MonitoringStatus;
assert.ok(engine, "Expected live computed status engine");
assert.equal(engine.EXPERIMENTAL_MAX_BASELINE_DAYS,30);
function row(date,water,qa="VERIFIED",valid=100){
 return {date,water_rai:water,analysis_status:qa,valid_pct:valid}
}
const plot={plot:"EXAMPLE",area_rai:100,current:"20260929",baseline:"20260909"};
assert.equal(engine.classify(plot,[row("2026-09-09",4),row("2026-09-29",16)]).status,"WATCH","First positive within 30 days needs follow-up");
assert.equal(engine.classify(plot,[row("2026-07-19",4),row("2026-09-29",16)]).status,"WAIT_BASELINE","Old positive baseline cannot create alert");
assert.equal(engine.classify(plot,[row("2026-07-19",20),row("2026-09-29",12)]).status,"NORMAL","Declining water keeps non-alert status");
assert.equal(engine.classify(plot,[row("2026-09-09",4),row("2026-09-19",16),row("2026-09-29",24)]).status,"HIGH","Repeated qualifying increases within 30 days are HIGH");
assert.equal(engine.classify(plot,[row("2026-09-09",4),row("2026-09-19",16),row("2026-09-29",17)]).status,"WATCH","Insufficient second increase must not be HIGH");
assert.equal(engine.classify(plot,[row("2026-09-09",4),row("2026-09-29",16,"VERIFIED",null)]).status,"WAIT_BASELINE","Null QA coverage forbidden");
assert.equal(engine.classify(plot,[row("2026-09-09",4),row("2026-09-29",16,"PARTIAL",69)]).status,"WAIT_BASELINE","Partial scene does not count");
assert.equal(engine.classify(plot,[row("2026-09-09",4),row("2026-09-29",null,"NO_DATA",0)]).status,"NO_DATA","NO_DATA at target date is independent");
assert.equal(engine.classify({...plot,current:"20261007"},[row("2026-09-09",4),row("2026-09-29",16),row("2026-10-07",null,"PARTIAL",45)]).status,"WAIT_BASELINE","Unverified new target cannot silently be confirmed");
assert.equal(engine.classify({...plot,current:"20261007"},[row("2026-09-09",4),row("2026-09-29",16),row("2026-10-07",22)]).status,"HIGH","Third valid observation can confirm sustained increase");
const actual=engine.apply(read("plots.json").plots,read("analysis_history.json").plots);
assert.equal(actual.length,19);
const counts=actual.reduce((x,p)=>(x[p.status]=(x[p.status]||0)+1,x),{});
assert.deepEqual(JSON.parse(JSON.stringify(counts)),{WAIT_BASELINE:13,WATCH:3,NORMAL:1,NO_DATA:2});
assert.ok(actual.every(x=>x.status_source==="analysis_history.json"),"No static status from plots.json");
const p141=actual.find(x=>x.plot==="14(1)-STC");
assert.ok(Math.abs(p141.water_current_pct-2.2/12.47*100)<0.02,"Percent must use total PDD plot area, not the small valid subset");
const stale=actual.find(x=>x.plot==="13-STC");
assert.equal(stale.status,"WAIT_BASELINE");
const currentScene=actual.find(x=>x.plot==="23-STC");
assert.equal(currentScene.status,"WATCH");
const printed=fs.readFileSync(path.join(root,"docs","index.html"),"utf8");
assert.ok(printed.includes('data-status="WAIT_BASELINE"'),"Must visibly filter pending baseline plots");
assert.ok(printed.includes('id="kpi-wait-baseline"'),"Must show a separate awaiting-baseline KPI");
assert.ok(printed.includes("เกณฑ์ทดลอง"),"Trial period must be shown to users");
const app=fs.readFileSync(path.join(root,"docs","app.js"),"utf8");
assert.ok(app.includes("MonitoringStatus.apply"),"UI must recalculate on every data load");
const raw=read("plots.json").plots;
assert.ok(raw.every(x=>!Object.hasOwn(x,"status")),"Static statuses must not remain in plots.json");
console.log("RAYONG B+ TEST PASS",counts,"14(1)-STC",p141.water_current_pct);
