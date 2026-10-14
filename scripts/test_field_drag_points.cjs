// Draggable survey points must stay in the selected water footprint and update KMZ.
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync("docs/field-export.js","utf8");
const html=fs.readFileSync("docs/index.html","utf8");
assert(html.includes('<option value="water_full" selected>'),"default random sampling must be inside water");
assert(!html.includes('<option value="land_edge">'),"outside-water mode should not be in field UI");
const square=(a,b,c,d)=>[[[a,b],[c,b],[c,d],[a,d],[a,b]]];
const flood={type:"Feature",properties:{plot:"13-STC",new_water_rai:30},geometry:{type:"MultiPolygon",coordinates:[
 square(101.701,12.701,101.703,12.703),
 square(101.706,12.706,101.708,12.708)
]}};
const boundary={type:"Feature",properties:{plot:"13-STC"},geometry:{type:"Polygon",coordinates:square(101.700,12.700,101.709,12.709)}};
const plot={plot:"13-STC",current:"20260929",baseline:"20260430",area_rai:100,new_water_rai:30};
const makeEl=value=>({value:value||"",hidden:false,disabled:false,textContent:"",innerHTML:"",options:[],setAttribute(){},addEventListener(){},replaceChildren(){this.options=[];this.value=""},appendChild(o){this.options.push(o)},getAttribute(){return null}});
const ids=["field-flood-source","field-point-count","field-sample-mode","field-kmz-scope","field-export-ready","field-export-summary","field-source-description","field-random-btn","field-export-kmz-btn","field-draw-btn","field-finish-btn","field-reset-boundary-btn","field-clear-btn","field-draw-status","field-undo-vertex-btn","field-preview-boundary","field-manual-polygons","field-manual-polygon-count","field-manual-polygon-list","field-points-panel","field-points-count","field-points-list"];
const elements=new Map(ids.map(id=>[id,makeEl(id==="field-flood-source"?"auto":id==="field-point-count"?"5":id==="field-sample-mode"?"water_full":id==="field-kmz-scope"?"points":"")]));
const document={readyState:"loading",getElementById:id=>elements.get(id)||null,querySelector:()=>null,createElement:()=>({click(){},remove(){},textContent:""}),addEventListener(){},body:{appendChild(){}}};
let currentOverview=[],currentFull=[];
function map(kind){return {kind,on(){},removeLayer(){}}}
const overviewMap=map("overview"),fullMap=map("full");
const lastMarkers=[];
const L={
 marker(coords,options){
  const obj={coordinate:{lat:coords[0],lng:coords[1]},options,handlers:{},
  on(name,cb){this.handlers[name]=cb;return this},bindPopup(){return this},
  getLatLng(){return this.coordinate},
  setLatLng(v){this.coordinate=Array.isArray(v)?{lat:v[0],lng:v[1]}:v;return this},
  closePopup(){},fire(name){this.handlers[name]?.({target:this})}};
  lastMarkers.push(obj);return obj;
 },
 divIcon:x=>x,layerGroup(markers){return {markers,addTo(map){if(map.kind==="overview")currentOverview=markers;else currentFull=markers;return this}}},
 geoJSON:()=>({addTo(){return this}})
};
const kml=[];
class JSZip{file(name,value){if(name==="doc.kml")kml.push(value)}async generateAsync(){return {}}}
const messages=[];
const ctx={window:{},document,selected:plot,plots:[plot],overviewMap,fullMap,L,console,showToast:s=>messages.push(s),
 boundaryByPlot:new Map([[plot.plot,boundary]]),newWaterByPlot:new Map([[plot.plot,flood]]),
 JSZip,URL:{createObjectURL:()=>"blob:field",revokeObjectURL(){}},setTimeout:()=>{}};
vm.createContext(ctx);vm.runInContext(source,ctx);
const field=ctx.window.FieldExport;
function insideWater(pt){
 return (pt.lon>101.701&&pt.lon<101.703&&pt.lat>12.701&&pt.lat<12.703)||
 (pt.lon>101.706&&pt.lon<101.708&&pt.lat>12.706&&pt.lat<12.708);
}
(async()=>{
 field.onPlotChange(plot);
 const pts=field.generatePoints();assert.equal(pts.length,5);
 assert(pts.every(insideWater),"initial points must be within mapped water");
 assert.equal(currentOverview.length,5);assert.equal(currentFull.length,5);
 assert(currentOverview.every(m=>m.options.draggable===true),"overview points must be draggable");
 assert(currentFull.every(m=>m.options.draggable===true),"full map points must be draggable");
 const id=pts[0].id,original=[pts[0].lat,pts[0].lon];
 let marker=currentOverview[0];
 marker.fire("dragstart");marker.setLatLng([12.705,101.705]);marker.fire("dragend");
 let after=field.getPoints()[0];
 assert.deepEqual([after.lat,after.lon],original,"outside-water point should revert");
 assert.deepEqual([marker.getLatLng().lat,marker.getLatLng().lng],original,"marker must visually snap back");
 // Move point onto the second disjoint water polygon.
 marker=currentFull[0];marker.fire("dragstart");marker.setLatLng([12.7072,101.7074]);marker.fire("dragend");
 after=field.getPoints()[0];
 assert.equal(after.lat,12.7072);assert.equal(after.lon,101.7074);
 assert.equal(after.method,"water_adjusted");
 assert.equal(after.in_water,true);
 assert.equal(currentOverview[0].getLatLng().lat,12.7072,"overview marker synced after full-map dragging");
 assert.equal(currentFull[0].getLatLng().lng,101.7074);
 // A drag outside the whole plot must be rejected.
 marker=currentOverview[0];marker.fire("dragstart");marker.setLatLng([12.73,101.73]);marker.fire("dragend");
 assert.equal(field.getPoints()[0].lon,101.7074,"out-of-plot drag changed point");
 const beforeKml=field.getPoints().length;
 await field.exportKmz();
 assert(kml.at(-1).includes("<coordinates>101.7074,12.7072,0</coordinates>"),"KMZ must contain moved coordinate");
 assert.equal(beforeKml,5);
 assert(field.removePoint(id));
 const rest=field.getPoints();
 assert.equal(rest.length,4);
 assert(rest.map(x=>x.id).join(",")==="P01,P02,P03,P04");
 assert(messages.some(x=>x.includes("คืนจุดเดิม")||x.includes("ภายในขอบเขตน้ำ")),"invalid move should notify user");
 console.log("PASS: water-only random; overview/full-map draggable; outside-water and outside-plot rejection; multi-polygon move; KMZ coords; deletion");
})().catch(e=>{console.error(e);process.exitCode=1});
