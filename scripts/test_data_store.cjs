/* DataStore: one in-flight request per data file, independent copies, no cached failures. */
const assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const calls={};
let responses={};
const fixtures={"data/a.json":'{"v":1}',"data/b.json":'{"ok":true}'};
function fetchStub(url,opts){
 calls[url]=(calls[url]||0)+1;
 assert.equal(opts&&opts.cache,"no-store","DataStore must keep cache:no-store");
 return Promise.resolve().then(()=>{
  const queued=responses[url]&&responses[url].shift();
  if(queued==="throw")throw new TypeError("Failed to fetch");
  const status=queued||200;
  return {ok:status>=200&&status<300,status,json:async()=>JSON.parse(fixtures[url])};
 });
}
const context={window:{fetch:fetchStub},structuredClone};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,"docs/data-store.js"),"utf8"),context);
const s=context.window.DataStore;
(async()=>{
 assert.ok(s&&typeof s.json==="function","window.DataStore.json must exist");
 // concurrent calls share one request
 await Promise.all([s.json("a.json"),s.json("a.json"),s.json("data/a.json")]);
 assert.equal(calls["data/a.json"],1,"concurrent calls share one request");
 assert.equal(s.stats()["a.json"],1,"stats counts network requests per name");
 // results are independent copies
 const x=await s.json("a.json");x.v=99;
 assert.equal((await s.json("a.json")).v,1,"results are independent copies");
 assert.equal(calls["data/a.json"],1,"memoized result reused");
 // rejected request is retried
 responses["data/b.json"]=[404];
 await assert.rejects(s.json("b.json"),/b\.json HTTP 404/,"non-OK response rejects with name and status");
 assert.deepEqual(await s.json("b.json"),{ok:true},"rejected request is retried");
 assert.equal(calls["data/b.json"],2,"rejected request is retried");
 // optional returns fallback
 const fb={type:"FeatureCollection",features:[]};
 responses["data/c.geojson"]=[404,"throw"];
 assert.deepEqual(await s.json("c.geojson",{optional:true,fallback:fb}),fb,"optional returns fallback on 404");
 assert.deepEqual(await s.json("c.geojson",{optional:true,fallback:fb}),fb,"optional returns fallback on network error");
 assert.equal(calls["data/c.geojson"],2,"optional failures are not remembered");
 assert.equal(await s.json("c.geojson",{optional:true}),null,"optional without fallback resolves null");
 // fresh bypasses memo
 await s.json("a.json",{fresh:true});
 assert.equal(calls["data/a.json"],2,"fresh bypasses memo");
 // fresh request that fails while a good copy is stored: next call fetches again and recovers
 responses["data/a.json"]=[503];
 await assert.rejects(s.json("a.json",{fresh:true}),/a\.json HTTP 503/,"failed fresh request rejects");
 assert.deepEqual(await s.json("a.json"),{v:1},"after a failed fresh request the next call fetches again");
 assert.equal(calls["data/a.json"],4,"failed fresh request is not remembered");
 console.log("DATA STORE TEST PASS");
})().catch(e=>{console.error(e);process.exit(1)});
