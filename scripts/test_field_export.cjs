// Smoke tests for field survey point placement and missing-QA behavior.
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const square=(x0,y0,x1,y1)=>({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]]}});
const plot=square(101.7000,12.7000,101.7040,12.7040);
const flood=square(101.7010,12.7010,101.7030,12.7030);
flood.properties={plot:"13-STC",new_water_rai:25};
plot.properties={plot:"13-STC"};
const stc15=square(101.7100,12.7100,101.7130,12.7130);
stc15.properties={plot:"15-STC"};
const plots=[{plot:"13-STC",area_rai:120,current:"20260929",new_water_rai:25},{plot:"15-STC",area_rai:80,current:"20260929",new_water_rai:0,status:"NO_DATA"}];
const makeMap=()=>{
 const handlers={};
 return {handlers,on:(event,fn)=>handlers[event]=fn,off:()=>{},removeLayer:()=>{},addLayer:()=>{}};
};
const overviewMap=makeMap(),fullMap=makeMap();
const elements=new Map();
for(const id of ["field-point-count","field-sample-mode","field-flood-source","field-export-ready","field-export-summary","field-source-description","field-random-btn","field-export-kmz-btn","field-draw-btn","field-finish-btn","field-reset-boundary-btn","field-clear-btn"]){
 const val=id==="field-point-count"?"10":id==="field-sample-mode"?"land_edge":"auto";
 elements.set(id,{value:val,disabled:false,textContent:"",className:"",options:[],listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},replaceChildren(){this.options=[];this.value="";},appendChild(o){this.options.push(o)}});
}
const document={readyState:"loading",getElementById:id=>elements.get(id)||null,addEventListener:()=>{},createElement:tag=>({tag,value:"",textContent:"",click:()=>{},remove:()=>{}}),body:{appendChild:()=>{}}};
const L={
 marker:()=>({bindPopup(){return this}}),divIcon:x=>x,
 layerGroup:()=>({addTo(){return this}}),
 geoJSON:()=>({addTo(){return this}}),
 polyline:()=>({addTo(){return this}})
};
const messages=[];
const ctx={window:{},document,plots,selected:plots[0],boundaryByPlot:new Map([["13-STC",plot],["15-STC",stc15]]),newWaterByPlot:new Map([["13-STC",flood]]),overviewMap,fullMap,L,showToast:s=>messages.push(s),console,Math,Number,String,URL,Promise,setTimeout};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("docs/field-export.js","utf8"),ctx);
const field=ctx.window.FieldExport;
assert(field,"field export module was not registered");
field.onPlotChange(plots[0]);
let pts=field.generatePoints();
assert.equal(pts.length,10,"land sampling should create ten points");
assert(pts.every(p=>p.method==="land_near_water"&&!p.in_water),"default sampling must be outside selected flood polygon");
assert(pts.every(p=>p.lon>=101.7&&p.lon<=101.704&&p.lat>=12.7&&p.lat<=12.704),"all points must stay inside project bounds");
elements.get("field-sample-mode").value="water_full";
field.clearPoints(true);
pts=field.generatePoints();
assert.equal(pts.length,10,"water-full sampling should produce ten points");
assert(pts.every(p=>p.in_water&&p.lon>=101.701&&p.lon<=101.703&&p.lat>=12.701&&p.lat<=12.703),"water-full points must stay inside flood polygon");
ctx.selected=plots[1];
field.onPlotChange(plots[1]);
assert.equal(field.generatePoints().length,0,"NO_DATA plot must not generate flood polygon or points");
assert.equal(elements.get("field-export-kmz-btn").disabled,true,"NO_DATA plot must disable auto export");
// Explicitly drawn geometry remains available but unverified.
ctx.turf={kinks:()=>({features:[]}),intersect:f=>f,area:()=>8000};
field.startDrawing();
for(const xy of [[101.7104,12.7104],[101.7126,12.7104],[101.7126,12.7126],[101.7104,12.7126]]){
 overviewMap.handlers.click({latlng:{lng:xy[0],lat:xy[1]}});
}
field.finishDrawing();
assert.equal(elements.get("field-flood-source").value,"manual");
assert.equal(elements.get("field-export-kmz-btn").disabled,false);
pts=field.generatePoints();
assert(pts.length>0,"manual water polygon must support field sampling");
console.log("PASS: QA-safe KMZ sampling, polygon containment, NO_DATA and manual fallback");
