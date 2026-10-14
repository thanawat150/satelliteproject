// Field Survey Studio: manual points are independent of random flood sampling.
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("docs/index.html","utf8");
const js=fs.readFileSync("docs/field-export.js","utf8");
const app=fs.readFileSync("docs/app.js","utf8");
assert(html.includes('class="field-workflow"'),"three-step survey workflow missing");
assert(html.includes('<option value="manual" selected>'),"manual point mode should be default");
assert(html.includes('<option value="random">'),"random-water option missing");
assert(!html.includes('class="field-export-actions"'),"old scattered button rows should be removed");
assert(app.includes("window.FieldExport?.isPointPlacement?.()"),"plot clicks should place manual points");
const boundary={type:"Feature",properties:{plot:"13-STC"},geometry:{type:"Polygon",coordinates:[[[101.7,12.7],[101.709,12.7],[101.709,12.709],[101.7,12.709],[101.7,12.7]]]}};
const water={type:"Feature",properties:{plot:"13-STC",new_water_rai:4},geometry:{type:"Polygon",coordinates:[[[101.701,12.701],[101.703,12.701],[101.703,12.703],[101.701,12.703],[101.701,12.701]]]}};
const plot={plot:"13-STC",area_rai:100,current:"20260929",baseline:"20260430"};
const makeEl=v=>({value:v||"",textContent:"",innerHTML:"",hidden:false,disabled:false,options:[],listeners:{},addEventListener(k,f){this.listeners[k]=f},setAttribute(){},replaceChildren(){this.options=[];this.value=""},appendChild(o){this.options.push(o)}});
const els=new Map();
for(const id of "field-flood-source field-point-count field-sample-mode field-point-entry-mode field-kmz-scope field-export-ready field-export-summary field-source-description field-random-btn field-export-kmz-btn field-draw-btn field-finish-btn field-reset-boundary-btn field-clear-btn field-draw-status field-undo-vertex-btn field-preview-boundary field-manual-polygons field-manual-polygon-count field-manual-polygon-list field-points-panel field-points-count field-points-list field-random-settings field-point-help field-placement-status field-draw-tools".split(" ")){
 const v=id==="field-point-entry-mode"?"manual":id==="field-sample-mode"?"water_full":id==="field-point-count"?"5":id==="field-kmz-scope"?"both":"auto";
 els.set(id,makeEl(v));
}
const events={};
const doc={readyState:"loading",getElementById:id=>els.get(id)||null,querySelector:()=>null,addEventListener(){},createElement:()=>({textContent:"",click(){},remove(){}}),body:{appendChild(){}}};
let overviewMarkers=[],fullMarkers=[];
const map=(id)=>({id,on(k,f){events[k]=f},removeLayer(){},closePopup(){},getContainer(){return {classList:{add(){},remove(){}}}}});
const overviewMap=map("overview"),fullMap=map("full");
const L={marker(coords,options){return{options,location:{lat:coords[0],lng:coords[1]},handlers:{},on(k,fn){this.handlers[k]=fn;return this},bindPopup(){return this},fire(k){this.handlers[k]?.({target:this})},getLatLng(){return this.location},setLatLng(x){this.location=Array.isArray(x)?{lat:x[0],lng:x[1]}:x},closePopup(){}}},divIcon:x=>x,
 layerGroup(items){return {addTo(m){if(m.id==="overview")overviewMarkers=items;else fullMarkers=items;return this}}},
 geoJSON:()=>({addTo(){return this}})};
const kmz=[];
class JSZip{file(name,value){if(name==="doc.kml")kmz.push(value)}async generateAsync(){return {}}}
const warnings=[];
const ctx={window:{},document:doc,selected:plot,plots:[plot],overviewMap,fullMap,L,console,showToast:t=>warnings.push(t),boundaryByPlot:new Map([[plot.plot,boundary]]),newWaterByPlot:new Map(),JSZip,URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},setTimeout(){}};
vm.createContext(ctx);vm.runInContext(js,ctx);
const field=ctx.window.FieldExport;
const click=(x,y,originalEvent={})=>events.click({latlng:{lng:x,lat:y},originalEvent});
(async()=>{
 field.onPlotChange(plot);assert.equal(els.get("field-random-btn").disabled,false,"manual entry needs no water");
 field.togglePointPlacement();assert(field.isPointPlacement());
 click(101.701,12.701);click(101.706,12.706);click(102,13);
 assert.equal(field.getPoints().length,2,"only points inside plot are accepted");
 assert.equal(els.get("field-kmz-scope").value,"points","manual without flood defaults to points-only KMZ");
 assert.equal(overviewMarkers.length,2);assert.equal(fullMarkers.length,2);
 let marker=overviewMarkers[0];
 marker.fire("dragstart");marker.setLatLng([12.704,101.704]);marker.fire("dragend");
 assert.equal(field.getPoints()[0].lat,12.704,"manual point can move anywhere within plot");
 marker.fire("dragstart");marker.setLatLng([13,102]);marker.fire("dragend");
 assert.equal(field.getPoints()[0].lat,12.704,"outside-plot drag must revert");
 await field.exportKmz();
 assert(kmz.at(-1).includes("<coordinates>101.704,12.704,0</coordinates>"),"KMZ uses moved manual coords");
 assert(!kmz.at(-1).includes('02 Flood Boundary'),"points-only KMZ includes no flood polygon");
 assert(field.removePoint("P01"));
 assert.deepEqual(field.getPoints().map(x=>x.id),["P01"],"delete renumbers remaining points");
 field.togglePointPlacement();assert.equal(field.isPointPlacement(),false);
 // When real water is available, random mode samples ONLY that water.
 ctx.newWaterByPlot.set(plot.plot,water);
 els.get("field-point-entry-mode").value="random";
 field.clearPoints(true);
 const random=field.generatePoints();
 assert.equal(random.length,5);
 assert(random.every(p=>p.lon>101.701&&p.lon<101.703&&p.lat>12.701&&p.lat<12.703),
   "random points must be within the chosen water polygon");
 marker=overviewMarkers[0];marker.fire("dragstart");marker.setLatLng([12.706,101.706]);marker.fire("dragend");
 assert(random[0].lon<101.703,"random-water points cannot be dragged onto dry land");
 console.log("PASS: consolidated studio, manual clicks without water, move/reject, points-only KMZ, delete, random water-only mode");
})().catch(e=>{console.error(e);process.exitCode=1});
