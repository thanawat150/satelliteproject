// QA and random field-point containment checks with all 19 actual Rayong geometries.
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const plots=JSON.parse(fs.readFileSync("docs/data/plots.json","utf8")).plots;
const bounds=JSON.parse(fs.readFileSync("docs/data/boundaries.geojson","utf8")).features;
const candidates=JSON.parse(fs.readFileSync("docs/data/new_water.geojson","utf8")).features;
const histories=JSON.parse(fs.readFileSync("docs/data/analysis_history.json","utf8")).plots;
assert.equal(plots.length,19);assert.equal(bounds.length,19);
const map=()=>({on(){},off(){},removeLayer(){}});
const el=v=>({value:v||"",disabled:false,options:[],textContent:"",className:"",replaceChildren(){this.options=[];this.value=""},appendChild(o){this.options.push(o)},addEventListener(){}});
const elements=new Map();
for(const id of ["field-flood-source","field-point-count","field-sample-mode","field-export-ready","field-export-summary","field-source-description","field-random-btn","field-export-kmz-btn","field-draw-btn","field-finish-btn","field-reset-boundary-btn","field-clear-btn"]){
elements.set(id,el(id==="field-point-count"?"5":id==="field-sample-mode"?"land_edge":"auto"))}
const document={readyState:"loading",getElementById:id=>elements.get(id)||null,createElement:()=>el(),addEventListener(){},body:{appendChild(){}}};
const L={geoJSON:()=>({addTo(){return this}}),layerGroup:()=>({addTo(){return this}}),divIcon:o=>o,marker:()=>({bindPopup(){return this}}),polyline:()=>({addTo(){return this}})};
const ctx={window:{},document,plots,selected:plots[0],overviewMap:map(),fullMap:map(),L,Math,console,Promise,setTimeout,showToast(){},boundaryByPlot:new Map(bounds.map(f=>[f.properties.plot,f])),newWaterByPlot:new Map()};
vm.createContext(ctx);vm.runInContext(fs.readFileSync("docs/monitoring-qa.js","utf8"),ctx);
const qa=ctx.window.MonitoringQA,approved=[],blocked=[];
for(const p of plots){
const f=candidates.find(x=>x.properties.plot===p.plot);
const iso=s=>String(s).replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
const check=f?qa.verifyPair(p,iso(p.baseline),iso(p.current),histories[p.plot]||[],f):{ok:false,reason:"NO_POLYGON"};
if(check.ok){approved.push(p.plot);ctx.newWaterByPlot.set(p.plot,f)}else blocked.push([p.plot,check.reason]);
}
vm.runInContext(fs.readFileSync("docs/field-export.js","utf8"),ctx);
const field=ctx.window.FieldExport;assert(field);
function inRing(xy,ring){let inside=false;const [x,y]=xy;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if(((b>y)!==(d>y))&&(x<(c-a)*(y-b)/(d-b)+a))inside=!inside}return inside}
function inside(xy,f){if(!f)return false;const g=f.geometry;const polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];return polys.some(p=>inRing(xy,p[0])&&!p.slice(1).some(h=>inRing(xy,h)))}
let land=0,water=0;
for(const p of plots){
ctx.selected=p;elements.get("field-sample-mode").value="land_edge";field.onPlotChange(p);
assert.equal(elements.get("field-flood-source").value,"auto");
const approvedHere=approved.includes(p.plot);
assert.equal(elements.get("field-random-btn").disabled,!approvedHere,"random QA eligibility: "+p.plot);
assert.equal(elements.get("field-export-kmz-btn").disabled,true,"combined KMZ requires points: "+p.plot);
if(!approvedHere){assert.equal(field.generatePoints().length,0,"unsafe automatic sampling: "+p.plot);continue}
const plotGeom=ctx.boundaryByPlot.get(p.plot),flood=ctx.newWaterByPlot.get(p.plot);
let pts=field.generatePoints();
if(pts.length){assert.equal(elements.get("field-export-kmz-btn").disabled,false,"KMZ ready with points: "+p.plot);land++;assert(pts.every(x=>inside([x.lon,x.lat],plotGeom)&&!inside([x.lon,x.lat],flood)),"land constraint: "+p.plot)}
elements.get("field-sample-mode").value="water_full";field.clearPoints(true);pts=field.generatePoints();
if(pts.length){water++;assert(pts.every(x=>inside([x.lon,x.lat],plotGeom)&&inside([x.lon,x.lat],flood)),"water constraint: "+p.plot)}
}
assert.equal(approved.length+blocked.length,19);
assert(land>0);assert(water>0);
console.log(JSON.stringify({ok:true,plots:plots.length,qa_pass:approved.length,manual_required:blocked.length,land_point_plots:land,water_point_plots:water,blocked}));
