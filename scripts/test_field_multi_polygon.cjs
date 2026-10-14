// Repeatable QA for drawing, deleting, sampling and exporting several flood polygons.
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync("docs/field-export.js","utf8");
const square=(x0,y0,x1,y1,plot)=>({type:"Feature",properties:{plot},geometry:{type:"Polygon",coordinates:[[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]]}});
const plot={plot:"13-STC",area_rai:100,baseline:"20260430",current:"20260929"};
const other={...plot,plot:"15-STC"};
const el=value=>({value:value||"",textContent:"",innerHTML:"",disabled:false,hidden:false,options:[],addEventListener(){},setAttribute(){},replaceChildren(){this.options=[];this.value=""},appendChild(o){this.options.push(o)},getAttribute(){return null}});
const ids=["field-flood-source","field-point-count","field-sample-mode","field-kmz-scope","field-export-ready","field-export-summary","field-source-description","field-random-btn","field-export-kmz-btn","field-draw-btn","field-finish-btn","field-reset-boundary-btn","field-clear-btn","field-draw-status","field-undo-vertex-btn","field-preview-boundary","field-manual-polygons","field-manual-polygon-count","field-manual-polygon-list","field-points-panel","field-points-count","field-points-list"];
const elems=new Map(ids.map(id=>[id,el(id==="field-flood-source"?"auto":id==="field-point-count"?"5":id==="field-sample-mode"?"water_full":id==="field-kmz-scope"?"boundary":"")]));
const events={};const map={on(n,fn){events[n]=fn},removeLayer(){},closePopup(){},getContainer:()=>({classList:{add(){},remove(){}}})};
const L={geoJSON:()=>({addTo(){return this},bindTooltip(){}}),layerGroup:()=>({addTo(){return this}}),polyline:()=>({addTo(){return this}}),polygon:()=>({addTo(){return this}}),circleMarker:()=>({addTo(){return this}}),marker:()=>({bindPopup(){return this},on(){}}),divIcon:v=>v};
const rings=g=>g.type==="Polygon"?[g.coordinates]:g.coordinates;
const turf={kinks:()=>({features:[]}),intersect:a=>a,area:feature=>rings(feature.geometry).reduce((v,polygon)=>{const r=polygon[0];return v+Math.abs((r[1][0]-r[0][0])*(r[2][1]-r[1][1]))*12000000000},0),union:(a,b)=>({type:"Feature",properties:{},geometry:{type:"MultiPolygon",coordinates:[...rings(a.geometry),...rings(b.geometry)]}})};
const kml=[];
class JSZip { file(name,contents){if(name==="doc.kml")kml.push(contents)}async generateAsync(){return {}} }
const document={readyState:"loading",getElementById:id=>elems.get(id)||null,querySelector:()=>null,createElement:()=>({textContent:"",click(){},remove(){}}),addEventListener(){},body:{appendChild(){}}};
const ctx={window:{},document,plots:[plot,other],selected:plot,overviewMap:map,fullMap:null,L,console,showToast(){},turf,JSZip,URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},setTimeout:()=>{},boundaryByPlot:new Map([[plot.plot,square(101.7,12.7,101.71,12.71,plot.plot)],[other.plot,square(101.7,12.7,101.71,12.71,other.plot)]]),newWaterByPlot:new Map()};
vm.createContext(ctx);vm.runInContext(source,ctx);const field=ctx.window.FieldExport;
const assertCoordsInside=(point,rect)=>assert(point.lon>=rect[0]&&point.lon<=rect[2]&&point.lat>=rect[1]&&point.lat<=rect[3]);
const draw=coords=>{field.startDrawing();assert(field.isDrawing());for(const [x,y] of coords)events.click({latlng:{lng:x,lat:y},originalEvent:{}});assert.equal(field.getDraftVertices().length,coords.length);field.finishDrawing();assert(!field.isDrawing())};
(async()=>{
 field.onPlotChange(plot);
 draw([[101.701,12.701],[101.702,12.701],[101.702,12.702],[101.701,12.702]]);
 draw([[101.705,12.705],[101.706,12.705],[101.706,12.706],[101.705,12.706]]);
 assert.equal(field.getManualBoundaries().length,2,"the second polygon must not erase the first");
 assert.equal(elems.get("field-manual-polygon-count").textContent,"2 ขอบเขต");
 assert.equal(elems.get("field-flood-source").value,"manual");
 let pts=field.generatePoints();
 assert.equal(pts.length,5,"five survey points must be generated from the combined polygon");
 for(const p of pts){
  const inA=p.lon>=101.701&&p.lon<=101.702&&p.lat>=12.701&&p.lat<=12.702;
  const inB=p.lon>=101.705&&p.lon<=101.706&&p.lat>=12.705&&p.lat<=12.706;
  assert(inA||inB,"survey point outside both manual water polygons");
  assertCoordsInside(p,[101.7,12.7,101.71,12.71]);
 }
 elems.get("field-kmz-scope").value="boundary";await field.exportKmz();
 assert(kml.at(-1).includes("Manual Water 1"));
 assert(kml.at(-1).includes("Manual Water 2"));
 assert.equal((kml.at(-1).match(/Manual Water [12] \(unverified\)/g)||[]).length,2);
 field.onPlotChange(other);field.onPlotChange(plot);
 assert.equal(field.getManualBoundaries().length,2,"plot switching must preserve each plot's drawn boundaries in the session");
 assert.equal(elems.get("field-flood-source").value,"manual","manual overlay should be selected again after switching back");
 assert(field.removeManualBoundary(0));
 assert.equal(field.getManualBoundaries().length,1);
 assert.equal(elems.get("field-manual-polygon-count").textContent,"1 ขอบเขต");
 await field.exportKmz();
 assert(kml.at(-1).includes("Manual Water 1")&&!kml.at(-1).includes("Manual Water 2"),"deleted polygon remains in KMZ");
 field.clearDrawing();
 assert.equal(field.getManualBoundaries().length,0,"clear all removes all parts of the selected plot");
 assert.equal(elems.get("field-manual-polygons").hidden,true);
 assert.equal(elems.get("field-export-kmz-btn").disabled,true);
 console.log("PASS: 2 polygons, combined sampling, KMZ separate boundaries, switching plots, delete-one and clear-all");
})().catch(e=>{console.error(e);process.exitCode=1});
