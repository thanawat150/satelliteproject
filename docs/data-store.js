/* Shared loader for data/* files: one network request per file per page load.
   Keeps cache:"no-store" so daily refreshes are always seen on reload.
   Every caller gets its own copy, so one script cannot mutate another's data. */
(function(root){
"use strict";
const memo=new Map(),counts={};
const clone=v=>v==null?v:(typeof structuredClone==="function"?structuredClone(v):JSON.parse(JSON.stringify(v)));
const normalize=name=>String(name).replace(/^\.?\/?data\//,"");
function request(name){
 counts[name]=(counts[name]||0)+1;
 return root.fetch("data/"+name,{cache:"no-store"}).then(r=>{
  if(!r.ok)throw Error(name+" HTTP "+r.status);
  return r.json();
 });
}
function json(rawName,opts={}){
 const name=normalize(rawName);
 if(opts.fresh||!memo.has(name)){
  const p=request(name);
  memo.set(name,p);
  p.catch(()=>{if(memo.get(name)===p)memo.delete(name)});
 }
 const shared=memo.get(name);
 const result=shared.then(clone);
 if(!opts.optional)return result;
 return result.catch(()=>clone(opts.fallback??null));
}
root.DataStore={json,stats:()=>({...counts})};
})(typeof window==="undefined"?globalThis:window);
