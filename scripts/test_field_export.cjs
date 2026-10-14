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
for(const id of ["field-point-count","field-sample-mode","field-flood-source","field-export-ready","field-export-summary","field-source-description","field-random-btn","field-export-kmz-btn","field-draw-btn","field-finish-btn","field-reset-boundary-btn","field-clear-btn","field-kmz-scope","field-points-panel","field-points-list","field-points-count","field-draw-status","field-undo-vertex-btn"]){
 const val=id==="field-point-count"?"10":id==="field-sample-mode"?"land_edge":id==="field-kmz-scope"?"both":"auto";
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
assert.equal(field.isDrawing(),true,"click draw should activate mode");
const click=(x,y,raw)=>overviewMap.handlers.click({latlng:{lng:x,lat:y},originalEvent:raw});
const firstEvent={};
click(101.7104,12.7104,firstEvent);
assert.equal(field.getDraftVertices().length,1,"first map click adds one vertex");
field.onPlotChange(plots[1]);
assert.equal(field.isDrawing(),true,"reselecting active plot must NOT cancel drawing");
assert.equal(field.getDraftVertices().length,1,"reselecting active plot must preserve vertices");
click(101.7104,12.7104,firstEvent);
assert.equal(field.getDraftVertices().length,1,"duplicate bubbling event must not duplicate a vertex");
click(101.7126,12.7104,{});
assert.equal(elements.get("field-finish-btn").disabled,true,"two vertices are insufficient");
click(101.7126,12.7126,{});
assert.equal(elements.get("field-finish-btn").disabled,false,"third vertex enables confirmation");
// Boundary-only KMZ can be exported even before survey points are selected.
elements.get("field-kmz-scope").value="boundary";
field.finishDrawing();
assert.equal(elements.get("field-flood-source").value,"manual");
assert.equal(elements.get("field-export-kmz-btn").disabled,false);
elements.get("field-kmz-scope").value="both";
pts=field.generatePoints();
assert(pts.length>0,"manual water polygon must support field sampling");
console.log("PASS: QA-safe KMZ sampling, polygon containment, NO_DATA and manual fallback");

// Regression: removing one survey point must retain coordinates of all other points
// and export precisely those remaining without repopulating removed points.
(async()=>{
  ctx.selected=plots[0];field.onPlotChange(plots[0]);
  elements.get("field-sample-mode").value="land_edge";
  let original=field.generatePoints();
  assert.equal(original.length,10);
  const originalById=new Map(original.map(x=>[x.id,[x.lon,x.lat]]));
  const originalCoordinates=Array.from(original,x=>[x.lon,x.lat]);
  const removedId=original[1].id;
  assert.equal(field.removePoint(removedId),true);
  let remaining=field.getPoints();
  assert.equal(remaining.length,9);
  assert.deepEqual(Array.from(remaining,x=>x.id),Array.from({length:9},(_,i)=>"P"+String(i+1).padStart(2,"0")),"point names must run consecutively");
  const expected=originalCoordinates.filter((_,i)=>i!==1);
  for(let i=0;i<remaining.length;i++)assert.deepEqual([remaining[i].lon,remaining[i].lat],expected[i],"surviving point moved");
  const saved={};
  ctx.JSZip=class{file(name,content){saved[name]=content} async generateAsync(){return {placeholder:true}}};
  ctx.URL={createObjectURL:()=>"blob:fake-field-kmz",revokeObjectURL:()=>{}};
  await field.exportKmz();
  assert(saved["doc.kml"].includes("P01"),"remaining points must be present in KMZ");
  assert(!saved["doc.kml"].includes(originalById.get(removedId)[0]+","+originalById.get(removedId)[1]+",0"),"removed coordinates must not be in KMZ");
  assert(saved["doc.kml"].includes('<Folder><name>03 Survey Points (Manual and Sampled)</name>'));
  elements.get("field-kmz-scope").value="boundary";
  await field.exportKmz();
  assert(saved["doc.kml"].includes('<Folder><name>02 Flood Boundary</name>'));
  assert(!saved["doc.kml"].includes("<name>P01</name>"),"boundary-only should not contain points");
  elements.get("field-kmz-scope").value="points";
  await field.exportKmz();
  assert(saved["doc.kml"].includes("<name>P01</name>"));
  assert(!saved["doc.kml"].includes('<Folder><name>01 Plot Boundary</name><Placemark>'),"points-only must not include plot geometry");
  assert(!saved["doc.kml"].includes('<Folder><name>02 Flood Boundary</name><Placemark>'),"points-only must not include water geometry");
  elements.get("field-kmz-scope").value="both";
  const lastKml=saved["doc.kml"];
  while(field.getPoints().length)assert.equal(field.removePoint(field.getPoints()[0].id),true);
  assert.equal(field.getPoints().length,0);
  assert.equal(elements.get("field-export-kmz-btn").disabled,true);
  await field.exportKmz();
  assert.equal(saved["doc.kml"],lastKml,"export must not regenerate points after removing all of them");
  assert.equal(field.getPoints().length,0);
  console.log("PASS: one-point removal preserves other points; KMZ uses only remaining points; delete-all never regenerates points");
})().catch(e=>{console.error(e);process.exitCode=1});

assert(require('node:fs').readFileSync('docs/app.js','utf8').includes('window.FieldExport.addVertex?.(e)'), 'plot polygon click must forward vertex instead of cancelling the drawing');
