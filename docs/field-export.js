/* Flood field-survey export: plot boundary + flood polygon + practical random points -> KMZ. */
(function(){
"use strict";
let activePlot=null;
let points=[];
let pointsEdited=false; // Prevent KMZ export from regenerating points intentionally deleted.
let manualFlood=null, drawing=false, drawVertices=[], drawLayer=null, confirmedLayer=null;
const manualByPlot=new Map(); // Each plot keeps its own independently editable polygons for this page session.
const listeningMaps=new Set(), processedClickEvents=new WeakSet();
const surveyLayers={overview:null,full:null};
const floodLayers={overview:null,full:null};
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));

let waterHistoryFeatures=[];
function validHistory(plot){
  return waterHistoryFeatures.filter(f=>f.properties?.plot===plot && ["VERIFIED","AUTO_VALID"].includes(f.properties?.analysis_status) && Number(f.properties?.valid_pct)>=70 && ringsFromGeometry(f.geometry).length).sort((a,b)=>String(a.properties.date).localeCompare(String(b.properties.date)));
}
function latestHistory(plot){const rows=validHistory(plot);return rows.length?rows[rows.length-1]:null;}
function makeSource(f,kind,date,area,qa){
  if(!f)return null;
  return {type:"Feature",geometry:f.geometry,properties:{...f.properties,_kmzSource:kind,_kmzDate:date,_kmzArea:Number(area)||0,_kmzQA:qa||"NOT_VERIFIED"}};
}
function manualPartsFor(plot){return manualByPlot.get(plot)||[]}
function syncManualFlood(plot){
  const parts=manualPartsFor(plot);
  if(!parts.length){manualFlood=null;return null}
  const geometries=parts.flatMap(part=>ringsFromGeometry(part.geometry));
  let merged={type:"Feature",properties:{plot},geometry:geometries.length===1?{type:"Polygon",coordinates:geometries[0]}:{type:"MultiPolygon",coordinates:geometries}};
  let unionSucceeded=geometries.length===1;
  if(parts.length>1&&typeof turf!=="undefined"&&typeof turf.union==="function"){
    try{
      let candidate={type:"Feature",properties:{},geometry:parts[0].geometry};
      for(let i=1;i<parts.length;i++){
        const next={type:"Feature",properties:{},geometry:parts[i].geometry};
        const union=turf.union(candidate,next);
        if(!union)throw Error("Union empty");
        candidate=union;
      }
      if(ringsFromGeometry(candidate.geometry).length){merged={...candidate,properties:{plot}};unionSucceeded=true}
    }catch(e){console.warn("Manual footprint union unavailable; retaining each polygon",e)}
  }
  let area=parts.reduce((total,part)=>total+part.areaRai,0);
  if(unionSucceeded&&typeof turf!=="undefined"&&typeof turf.area==="function"){
    try{area=turf.area(merged)/1600}catch(_){}
  }
  manualFlood={type:"Feature",geometry:merged.geometry,properties:{plot,_kmzSource:"manual",_kmzQA:"UNVERIFIED",_kmzDate:"",_kmzArea:area,_kmzPartCount:parts.length,_kmzAreaSumFallback:!unionSucceeded}};
  return manualFlood;
}
function renderManualList(){
  const p=activePlot||selected,parts=p?manualPartsFor(p.plot):[];
  const panel=$("field-manual-polygons"),list=$("field-manual-polygon-list"),count=$("field-manual-polygon-count");
  if(!panel||!list)return;
  panel.hidden=!parts.length;
  if(count)count.textContent=parts.length+" ขอบเขต";
  list.innerHTML=parts.map((part,i)=>
    '<div class="field-manual-row"><span class="field-manual-number">#'+(i+1)+'</span>'+
    '<span class="field-manual-area">ขอบเขตน้ำ '+(i+1)+' <small>'+fmtLocal(part.areaRai)+' ไร่ • ยังไม่ยืนยัน</small></span>'+
    '<button type="button" class="field-point-delete" data-remove-manual="'+i+'" aria-label="ลบขอบเขตน้ำ '+(i+1)+'">ลบ ×</button></div>'
  ).join("");
}
function redrawManualBoundaries(){
  if(confirmedLayer){try{overviewMap?.removeLayer(confirmedLayer)}catch(_){}confirmedLayer=null}
  const p=activePlot||selected,parts=p?manualPartsFor(p.plot):[];
  if(!overviewMap||!parts.length)return;
  const colors=["#ffad42","#f17479","#ba8bf5","#51b2df","#83c36b"];
  const layers=parts.map((part,i)=>{
    const color=colors[i%colors.length];
    const layer=L.geoJSON({type:"Feature",geometry:part.geometry,properties:{plot:p.plot}},{style:{color,weight:3,fillColor:color,fillOpacity:.19},interactive:false});
    layer.bindTooltip?.("ขอบเขตน้ำ "+(i+1)+" • "+fmtLocal(part.areaRai)+" ไร่");
    return layer;
  });
  confirmedLayer=L.layerGroup(layers).addTo(overviewMap);
}
function removeManualBoundary(index){
  const p=activePlot||selected;if(!p)return false;
  const parts=manualPartsFor(p.plot);
  if(!Number.isInteger(index)||index<0||index>=parts.length)return false;
  parts.splice(index,1);
  if(!parts.length)manualByPlot.delete(p.plot);
  syncManualFlood(p.plot);
  refreshSourceOptions(p.plot);
  if(parts.length&&$("field-flood-source"))$("field-flood-source").value="manual";
  redrawManualBoundaries();redrawFloodBoundary();renderManualList();clearPoints(true);updatePanel();
  notify("ลบขอบเขตน้ำ "+(index+1)+" แล้ว • เหลือ "+parts.length+" ขอบเขต");
  return true;
}
function floodFeature(plot){
  const val=$("field-flood-source")?.value||"auto";
  if(val==="manual")return manualFlood?.properties?.plot===plot?manualFlood:null;
  const info=plotInfo(plot),h=latestHistory(plot);
  const nw=(()=>{try{return newWaterByPlot?.get(plot)||null}catch(_){return null}})();
  const historyAsSource=f=>f?makeSource(f,"water_extent",f.properties.date,f.properties.report_water_rai??f.properties.derived_water_rai,f.properties.analysis_status):null;
  const newAsSource=()=>nw?makeSource(nw,"new_water",String(info?.current||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3"),nw.properties?.new_water_rai, "QA_SCREENED_PAIR"):null;
  if(val.startsWith("date:")){const d=val.slice(5);return historyAsSource(validHistory(plot).find(f=>f.properties.date===d))}
  if(val==="new")return newAsSource();
  if(val==="auto"){
    if(h)return historyAsSource(h);
    if(nw)return newAsSource();
    return manualFlood?.properties?.plot===plot?manualFlood:null;
  }
  return null;
}
function qaFailure(plot){
  try{
    const info=plotInfo(plot),candidate=newWaterFC?.features?.find(f=>f.properties?.plot===plot);
    if(!candidate||!info)return "ยังไม่มี Polygon น้ำอัตโนมัติของแปลงนี้";
    const a=String(info.baseline||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
    const b=String(info.current||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
    const history=window.TrendReport?.rows?.(plot)||[];
    const result=window.MonitoringQA?.verifyPair?.(info,a,b,history,candidate);
    if(result?.ok)return "Polygon ผ่าน QA (รอรายการแผนที่อัปเดต)";
    return result?.reason||"พบ Polygon แต่ยังยืนยันคุณภาพไม่ได้";
  }catch(e){return "ยังตรวจสอบ QA ของ Polygon ไม่ครบ"}
}
function sourceDescription(feature){
  if(!feature)return "ไม่มี Polygon อัตโนมัติที่ผ่าน QA สำหรับแปลงนี้ — ใช้ปุ่มวาดขอบเขตน้ำได้";
  const p=feature.properties||{};
  const kind=p._kmzSource==="water_extent"?"ขอบเขตน้ำของวันนั้น (Water Extent)":p._kmzSource==="new_water"?"ขอบเขตน้ำเพิ่มจากวันฐาน (New Water)":"ขอบเขตที่วาดเอง "+(p._kmzPartCount||1)+" พื้นที่ (ยังไม่ยืนยัน)";
  return kind+(p._kmzDate?" • "+p._kmzDate:"")+" • "+(p._kmzQA||"UNVERIFIED");
}
function refreshSourceOptions(plot){
  const sel=$("field-flood-source");if(!sel)return;
  const prior=sel.value||"auto";sel.replaceChildren();
  const add=(value,label)=>{const o=document.createElement("option");o.value=value;o.textContent=label;sel.appendChild(o)};
  add("auto","Auto — ใช้ข้อมูลน้ำที่ผ่าน QA ล่าสุด");
  for(const f of validHistory(plot))add("date:"+f.properties.date,f.properties.date+" • ขอบเขตน้ำวันนั้น ("+f.properties.analysis_status+")");
  try{if(newWaterByPlot?.get(plot))add("new","น้ำเพิ่มจากวันฐาน (New Water)")}catch(_){}
  if(manualPartsFor(plot).length)add("manual","ขอบเขตวาดเอง ("+manualPartsFor(plot).length+" พื้นที่ • Unverified)");
  if([...sel.options].some(o=>o.value===prior))sel.value=prior;else sel.value="auto";
  const hint=$("field-source-description");if(hint)hint.textContent=sourceDescription(floodFeature(plot));
}
async function loadHistoricalFlood(){
  try{const response=await fetch("data/water_history.geojson",{cache:"no-store"});if(!response.ok)return;const j=await response.json();waterHistoryFeatures=Array.isArray(j.features)?j.features:[];
    const p=activePlot||((typeof selected!=="undefined")?selected:null);if(p){refreshSourceOptions(p.plot);clearPoints(true);redrawFloodBoundary();updatePanel();}
  }catch(e){console.warn("Field water history not available",e)}
}
function plotFeature(plot){
  try{return boundaryByPlot?.get(plot)||null}catch(_){return null}
}
function plotInfo(plot){
  try{return plots?.find(x=>x.plot===plot)||null}catch(_){return null}
}
function activeArea(info,flood){return Number(flood?.properties?._kmzArea??0)}
function recommendedCount(areaRai){
  const a=Number(areaRai||0);
  if(a<=0)return 5;
  if(a<5)return 5;
  if(a<20)return 7;
  if(a<50)return 10;
  if(a<100)return 12;
  if(a<200)return 15;
  return 18;
}
function desiredCount(info, flood){
  const v=$("field-point-count")?.value||"auto";
  return v==="auto"?recommendedCount(activeArea(info,flood)):clamp(Number(v)||5,1,50);
}
function ringsFromGeometry(geom){
  if(!geom)return[];
  if(geom.type==="Polygon")return [geom.coordinates];
  if(geom.type==="MultiPolygon")return geom.coordinates;
  return[];
}
function pointInRing(pt,ring){
  const x=pt[0],y=pt[1];let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    const cross=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-15)+xi);
    if(cross)inside=!inside;
  }
  return inside;
}
function pointInPolygon(pt,poly){
  if(!poly?.length||!pointInRing(pt,poly[0]))return false;
  for(let i=1;i<poly.length;i++)if(pointInRing(pt,poly[i]))return false;
  return true;
}
function pointInFeature(pt,feature){
  return ringsFromGeometry(feature?.geometry).some(poly=>pointInPolygon(pt,poly));
}
function allCoords(feature){
  const out=[];
  for(const poly of ringsFromGeometry(feature?.geometry))for(const ring of poly)for(const p of ring)out.push(p);
  return out;
}
function bbox(feature){
  const c=allCoords(feature);
  return [
    Math.min(...c.map(p=>p[0])),Math.min(...c.map(p=>p[1])),
    Math.max(...c.map(p=>p[0])),Math.max(...c.map(p=>p[1]))
  ];
}
function metersBetween(a,b){
  const lat=((a[1]+b[1])/2)*Math.PI/180;
  const dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*110540;
  return Math.hypot(dx,dy);
}
function pointSegmentDistanceM(p,a,b){
  const lat=p[1]*Math.PI/180;
  const sx=111320*Math.cos(lat),sy=110540;
  const ax=(a[0]-p[0])*sx,ay=(a[1]-p[1])*sy,bx=(b[0]-p[0])*sx,by=(b[1]-p[1])*sy;
  const vx=bx-ax,vy=by-ay;
  const vv=vx*vx+vy*vy;
  const t=vv?clamp(-(ax*vx+ay*vy)/vv,0,1):0;
  return Math.hypot(ax+t*vx,ay+t*vy);
}
function distanceToBoundaryM(pt,feature){
  let best=Infinity;
  for(const poly of ringsFromGeometry(feature?.geometry)){
    for(const ring of poly){
      for(let i=1;i<ring.length;i++)best=Math.min(best,pointSegmentDistanceM(pt,ring[i-1],ring[i]));
    }
  }
  return best;
}
// Edge-seeded candidates avoid wasting thousands of attempts in a broad bbox
// when water is fragmented into many narrow disjoint polygons.
function candidatePool(flood,plotBoundary,count,mode,areaRai){
  const land=mode==="land_edge", edge=mode!=="water_full";
  const region=land?plotBoundary:flood;
  if(!region||!ringsFromGeometry(flood.geometry).length)return {pool:[],edgeDepth:0};
  const [minX,minY,maxX,maxY]=bbox(region);
  const target=Math.max(260,count*35), pool=[],seen=new Set();
  const typical=Math.sqrt(Math.max(1600,Number(areaRai||1)*1600)/Math.max(1,count));
  const edgeDepth=land?clamp(typical*1.5,35,125):clamp(typical*.55,18,55);
  const edges=[], polys=ringsFromGeometry(flood.geometry);
  let totalLength=0;
  for(const poly of polys){for(const ring of poly){
    for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],length=metersBetween(a,b);
      if(!Number.isFinite(length)||length<.2)continue;
      totalLength+=length;edges.push({a,b,total:totalLength,length});
    }
  }}
  function seeded(){
    if(!edges.length)return null;
    const cut=Math.random()*totalLength;
    let left=0,right=edges.length-1;
    while(left<right){const mid=(left+right)>>1;if(edges[mid].total<cut)left=mid+1;else right=mid}
    const seg=edges[left],t=Math.random();
    const ax=seg.a[0],ay=seg.a[1],bx=seg.b[0],by=seg.b[1];
    const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
    const sx=111320*Math.cos(y*Math.PI/180),sy=110540;
    const vx=(bx-ax)*sx,vy=(by-ay)*sy,l=Math.hypot(vx,vy);
    if(l<.01||Math.abs(sx)<1)return null;
    const d=(edge?6+Math.random()*Math.max(0,edgeDepth-6):2+Math.random()*edgeDepth)* (Math.random()<.5?-1:1);
    return [x-vy/l*d/sx,y+vx/l*d/sy];
  }
  // For full-water sampling, use individual polygon bounding boxes instead
  // of the all-islands envelope, then fall back to edge-seeded candidates.
  const parts=polys.map(poly=>{const c=poly[0];const x0=Math.min(...c.map(p=>p[0])),x1=Math.max(...c.map(p=>p[0])),y0=Math.min(...c.map(p=>p[1])),y1=Math.max(...c.map(p=>p[1]));return {x0,x1,y0,y1,weight:Math.max(1,(x1-x0)*(y1-y0)*Math.cos(y0*Math.PI/180))}});
  const totalWeight=parts.reduce((sum,p)=>sum+p.weight,0);
  function polygonCandidate(){
    if(!parts.length)return null;
    let r=Math.random()*totalWeight,part=parts[parts.length-1];
    for(const p of parts){r-=p.weight;if(r<=0){part=p;break}}
    return [part.x0+Math.random()*(part.x1-part.x0),part.y0+Math.random()*(part.y1-part.y0)];
  }
  const maxTries=Math.min(28000,Math.max(6000,count*650));
  for(let tries=0;tries<maxTries&&pool.length<target;tries++){
    const xy=(!edge && tries%3!==0)?polygonCandidate():seeded();
    if(!xy||!Number.isFinite(xy[0])||!Number.isFinite(xy[1]))continue;
    if(xy[0]<minX||xy[0]>maxX||xy[1]<minY||xy[1]>maxY)continue;
    if(plotBoundary&&!pointInFeature(xy,plotBoundary))continue;
    const inWater=pointInFeature(xy,flood);
    if(land&&inWater)continue;
    if(!land&&!inWater)continue;
    const dist=distanceToBoundaryM(xy,flood);
    if(land&&(dist<4||dist>edgeDepth))continue;
    if(mode==="water_edge"&&dist>edgeDepth)continue;
    const key=xy.map(x=>x.toFixed(6)).join(",");if(seen.has(key))continue;seen.add(key);
    pool.push(xy);
  }
  return {pool,edgeDepth};
}
function spreadSelect(pool,count){
  if(!pool.length)return[];
  const chosen=[pool[Math.floor(Math.random()*pool.length)]];
  const remaining=pool.slice();
  while(chosen.length<count&&remaining.length){
    let bestIndex=0,best=-1;
    for(let i=0;i<remaining.length;i++){
      let d=Infinity;
      for(const c of chosen)d=Math.min(d,metersBetween(remaining[i],c));
      if(d>best){best=d;bestIndex=i}
    }
    chosen.push(remaining.splice(bestIndex,1)[0]);
  }
  return chosen;
}
function generatePoints(){
  const p=activePlot||selected;if(!p)return[];
  const flood=floodFeature(p.plot),boundary=plotFeature(p.plot),info=plotInfo(p.plot)||p;
  if(!flood){notify("ไม่มีขอบเขตน้ำสำหรับแปลงนี้ กรุณาวาดขอบเขตด้วยตนเอง หรือเลือกวันที่ที่ผ่าน QA");return[]}
  const count=desiredCount(info,flood),mode=$("field-sample-mode")?.value||"water_full";
  if(mode==="land_edge"&&!boundary){notify("ยังไม่มีขอบเขตแปลงสำหรับเลือกจุดด้านนอกน้ำ");return[]}
  const {pool,edgeDepth}=candidatePool(flood,boundary,count,mode,activeArea(info,flood));
  if(pool.length<count){points=[];drawPoints();updatePanel();notify("พื้นที่ที่ตรงเงื่อนไขมีน้อยเกินไป: ลดจำนวนจุดหรือเปลี่ยนวิธีสุ่ม ห้ามใช้จุดที่ไม่ผ่านเงื่อนไข");return[]}
  pointsEdited=false;
  points=spreadSelect(pool,count).map((c,i)=>({
    id:"P"+String(i+1).padStart(2,"0"),
    lon:+c[0].toFixed(7),lat:+c[1].toFixed(7),
    edge_distance_m:+distanceToBoundaryM(c,flood).toFixed(1),
    method:mode==="land_edge"?"land_near_water":mode==="water_edge"?"water_near_edge":"water_interior",
    in_water:mode!=="land_edge",
    flood_source:flood.properties._kmzSource||"manual"
  }));
  drawPoints();renderPointList();updatePanel(edgeDepth);notify("สุ่ม "+points.length+" จุดแล้ว • ยังต้องตรวจทางเข้าหน้างาน");
  return points;
}

function redrawFloodBoundary(){
  const p=activePlot||((typeof selected!=="undefined")?selected:null);
  try{
    [[overviewMap,"overview"],[fullMap,"full"]].forEach(([map,key])=>{
      if(!map)return;
      if(floodLayers[key]){map.removeLayer(floodLayers[key]);floodLayers[key]=null;}
      if(!p||!$("field-preview-boundary")?.checked)return;const f=floodFeature(p.plot);if(!f||f.properties?._kmzSource==="manual")return;
      floodLayers[key]=L.geoJSON(f,{style:{color:"#00dbff",weight:2,opacity:0.95,dashArray:"6 5",fillColor:"#32b8f4",fillOpacity:0.08},interactive:false}).addTo(map);
    });
  }catch(e){console.warn("Field flood drawing",e)}
}
function clearLayer(map,key){
  if(map&&surveyLayers[key]){map.removeLayer(surveyLayers[key]);surveyLayers[key]=null}
}
function clearPoints(silent=false){
  points=[];
  pointsEdited=!silent;
  try{clearLayer(overviewMap,"overview");clearLayer(fullMap,"full")}catch(_){}
  renderPointList();
  updatePanel();
  if(!silent)notify("ล้างจุดตรวจแล้ว");
}
function removePoint(id){
  const index=points.findIndex(p=>p.id===id);
  if(index===-1)return false;
  points.splice(index,1);
  // Keep the surviving geographic coordinates; only the visible IDs are consecutive.
  points.forEach((p,i)=>{p.id="P"+String(i+1).padStart(2,"0")});
  pointsEdited=true;
  drawPoints();
  renderPointList();
  updatePanel();
  notify("ลบจุด "+id+" แล้ว • เหลือ "+points.length+" จุด");
  return true;
}
function renderPointList(){
  const panel=$("field-points-panel"),list=$("field-points-list"),count=$("field-points-count");
  if(!panel||!list)return;
  panel.hidden=!points.length&&!pointsEdited;
  if(count)count.textContent=points.length+" จุด";
  if(!points.length){
    list.innerHTML='<div class="field-points-empty">ไม่มีจุดที่เลือกอยู่ กด “สุ่มจุดบนแผนที่” เพื่อสร้างชุดใหม่</div>';
    return;
  }
  list.innerHTML=points.map(p=>
    '<div class="field-point-row"><span class="field-point-number">'+esc(p.id)+'</span>'+
    '<span class="field-point-position">'+Number(p.lat).toFixed(6)+', '+Number(p.lon).toFixed(6)+
    '<small>อยู่ในขอบเขตน้ำ • ห่างจากขอบน้ำ ~'+Math.round(p.edge_distance_m)+' ม. • ลากหมุดบนแผนที่เพื่อย้าย</small></span>'+
    '<button type="button" class="field-point-delete" data-remove-point="'+esc(p.id)+'" aria-label="ลบจุด '+esc(p.id)+'">ลบ ×</button></div>'
  ).join("");
}
// A marker remains a true editable survey point, not a static random preview.
function repositionPoint(id,longitude,latitude){
  const p=activePlot||selected,pt=points.find(x=>x.id===id);
  if(!p||!pt)return {ok:false,reason:"missing_point"};
  const x=Number(longitude),y=Number(latitude);
  if(!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,reason:"invalid_coordinates"};
  const boundary=plotFeature(p.plot),flood=floodFeature(p.plot),xy=[x,y];
  if(!flood)return {ok:false,reason:"missing_flood"};
  if(boundary&&!pointInFeature(xy,boundary))return {ok:false,reason:"outside_plot"};
  // Every draggable survey marker is confined to the selected mapped-water
  // footprint, including its interior holes and disjoint manual polygons.
  if(!pointInFeature(xy,flood))return {ok:false,reason:"outside_water"};
  pt.lon=+x.toFixed(7);pt.lat=+y.toFixed(7);
  pt.edge_distance_m=+distanceToBoundaryM(xy,flood).toFixed(1);
  pt.method="water_adjusted";pt.in_water=true;pt.flood_source=flood.properties?._kmzSource||"manual";
  pointsEdited=true;
  renderPointList();updatePanel();
  return {ok:true,point:{...pt}};
}
function markerFor(pt,plot){
  const marker=L.marker([pt.lat,pt.lon],{
    draggable:true,
    autoPan:true,
    riseOnHover:true,
    icon:L.divIcon({className:"field-point-icon is-water is-draggable",html:`<span>${esc(pt.id)}</span>`,iconSize:[36,24],iconAnchor:[18,12]})
  }).bindPopup(`<b>${esc(plot)} • ${esc(pt.id)}</b><br>Lat ${pt.lat.toFixed(6)}<br>Lon ${pt.lon.toFixed(6)}<br><small>ลากหมุดเพื่อย้ายจุดภายในขอบเขตน้ำได้ • ระยะจากขอบน้ำ ~${Math.round(pt.edge_distance_m)} ม.</small><br><button type="button" class="field-popup-delete">ลบจุดนี้ ×</button>`);
  marker.on?.("popupopen",e=>{
    const btn=e.popup?.getElement?.()?.querySelector(".field-popup-delete");
    btn?.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();removePoint(pt.id);
    },{once:true});
  });
  marker.on?.("dragstart",()=>{
    marker.closePopup?.();
    marker._fieldLastLocation=[pt.lat,pt.lon];
  });
  marker.on?.("dragend",()=>{
    const location=marker.getLatLng?.();
    if(!location)return;
    const old=marker._fieldLastLocation||[pt.lat,pt.lon];
    // Switching plots or changing the flood-source invalidates a pending drag.
    if((activePlot||selected)?.plot!==plot||!points.includes(pt)){
      marker.setLatLng?.(old);
      return;
    }
    const result=repositionPoint(pt.id,location.lng,location.lat);
    if(!result.ok){
      marker.setLatLng?.(old);
      notify(result.reason==="outside_water"?"ต้องวางจุดภายในขอบเขตน้ำที่เลือกเท่านั้น":"ตำแหน่งอยู่นอกขอบเขตแปลงหรือไม่ถูกต้อง — คืนจุดเดิมแล้ว");
      return;
    }
    // Keep both the Overview and full-map markers in sync with the saved
    // coordinate. The KMZ reads the updated point model directly.
    drawPoints();
    notify("ย้าย "+pt.id+" แล้ว • KMZ จะใช้พิกัดใหม่");
  });
  return marker;
}
function drawPoints(){
  const p=activePlot||selected;if(!p)return;
  try{
    [[overviewMap,"overview"],[fullMap,"full"]].forEach(([map,key])=>{
      if(!map)return;clearLayer(map,key);
      const group=L.layerGroup(points.map(pt=>markerFor(pt,p.plot))).addTo(map);
      surveyLayers[key]=group;
    });
  }catch(e){console.warn("field points map render",e)}
}
function modeLabel(){
  const m=$("field-sample-mode")?.value||"water_full";return m==="land_edge"?"นอก Polygon น้ำที่เลือก ใกล้ขอบน้ำ (ยังไม่ยืนยันทางเข้า)":m==="water_edge"?"ภายในน้ำใกล้ขอบ":"ภายในน้ำทั่วบริเวณ";
}
function updatePanel(edgeDepth){
  const p=activePlot||selected,ready=$("field-export-ready"),sum=$("field-export-summary");
  const randomBtn=$("field-random-btn"),exportBtn=$("field-export-kmz-btn"),scope=$("field-kmz-scope")?.value||"both";
  const canExport=(flood,pointsCount)=>scope==="points"?pointsCount>0:scope==="boundary"?!!flood:!!flood&&(!pointsEdited||pointsCount>0);
  if(!p||!ready||!sum)return;
  const flood=floodFeature(p.plot),info=plotInfo(p.plot)||p;
  const hint=$("field-source-description");if(hint)hint.textContent=sourceDescription(flood);
  if(!flood){
    ready.textContent="ต้องวาดขอบเขต";ready.className="field-export-ready is-missing";
     sum.textContent=p.plot+" • "+qaFailure(p.plot)+" • ใช้วาดขอบเขตน้ำบนแผนที่อย่างน้อย 3 จุด เพื่อจัดทำ KMZ ชั่วคราว (ยังไม่ยืนยัน)";
    if(randomBtn)randomBtn.disabled=true;if(exportBtn)exportBtn.disabled=!canExport(flood,points.length);renderPointList();return;
  }
  const area=activeArea(info,flood),auto=recommendedCount(area),wanted=desiredCount(info,flood);
  ready.textContent=points.length?points.length+" จุดพร้อม Export":pointsEdited?"ไม่มีจุดที่เลือก":"พร้อมสุ่มจุด";ready.className="field-export-ready is-ready";
  sum.textContent=p.plot+" • "+sourceDescription(flood)+" • "+fmtLocal(area)+" ไร่ • "+($("field-point-count")?.value==="auto"?"แนะนำ "+auto+" จุด":"กำหนด "+wanted+" จุด")+" • "+modeLabel()+(edgeDepth?" (ระยะจากขอบน้ำ ≤ "+Math.round(edgeDepth)+" ม.)":"");
  if(randomBtn)randomBtn.disabled=false;if(exportBtn)exportBtn.disabled=!canExport(flood,points.length);
}

function fmtLocal(n){return Number.isFinite(Number(n))?Number(n).toLocaleString("th-TH",{maximumFractionDigits:2}):"—"}
function notify(s){try{showToast(s)}catch(_){console.info(s)}}

function coordString(ring){
  return ring.map(p=>`${Number(p[0]).toFixed(7)},${Number(p[1]).toFixed(7)},0`).join(" ");
}
function polygonKml(poly){
  if(!poly?.length)return"";
  const outer=`<outerBoundaryIs><LinearRing><coordinates>${coordString(poly[0])}</coordinates></LinearRing></outerBoundaryIs>`;
  const holes=poly.slice(1).map(r=>`<innerBoundaryIs><LinearRing><coordinates>${coordString(r)}</coordinates></LinearRing></innerBoundaryIs>`).join("");
  return `<Polygon><tessellate>1</tessellate>${outer}${holes}</Polygon>`;
}
function geometryKml(feature){
  const polys=ringsFromGeometry(feature?.geometry);
  if(!polys.length)return"";
  if(polys.length===1)return polygonKml(polys[0]);
  return `<MultiGeometry>${polys.map(polygonKml).join("")}</MultiGeometry>`;
}
function placemarkPolygon(name,feature,styleUrl,description){
  return `<Placemark><name>${esc(name)}</name><styleUrl>${styleUrl}</styleUrl><description><![CDATA[${description}]]></description>${geometryKml(feature)}</Placemark>`;
}
function buildKml(p,scope="both"){
  const includeBoundary=scope==="both"||scope==="boundary";
  const includePoints=scope==="both"||scope==="points";
  const boundary=plotFeature(p.plot),flood=floodFeature(p.plot),info=plotInfo(p.plot)||p;
  const current=String(info.current||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
  const baseline=String(info.baseline||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
  const area=activeArea(info,flood);
  const plotPm=includeBoundary&&boundary?placemarkPolygon(`${p.plot} — Plot Boundary`,boundary,"#plotBoundary",`Plot: ${esc(p.plot)}<br>Area: ${fmtLocal(info.area_rai)} rai`):"";
  const source=flood?.properties?._kmzSource||"unknown";
  const sourceDate=flood?.properties?._kmzDate||current;
  const floodPm=includeBoundary&&flood?(source==="manual"?manualPartsFor(p.plot).map((part,i)=>
  placemarkPolygon(p.plot+" — Manual Water "+(i+1)+" (unverified)",{type:"Feature",geometry:part.geometry},"#floodArea",
    "Plot: "+esc(p.plot)+"<br>Manual boundary: "+(i+1)+" of "+manualPartsFor(p.plot).length+"<br>QA: UNVERIFIED<br>Area: "+fmtLocal(part.areaRai)+" rai")
  ).join(""):placemarkPolygon(`${p.plot} — ${source==="water_extent"?"Water Extent":"New Water"}`,flood,"#floodArea",`Plot: ${esc(p.plot)}<br>Source: ${esc(source)}<br>Date: ${esc(sourceDate)}<br>Baseline: ${esc(baseline)}<br>QA: ${esc(flood.properties?._kmzQA||"UNVERIFIED")}<br>Mapped area: ${fmtLocal(area)} rai`)):"";
  const pointPm=(includePoints?points:[]).map(pt=>`<Placemark><name>${pt.id}</name><styleUrl>#surveyPoint</styleUrl><description><![CDATA[Plot: ${esc(p.plot)}<br>Date: ${esc(current)}<br>Sampling: ${esc(modeLabel())}<br>Point in mapped water: ${pt.in_water?"YES — access by water may be required":"NO — outside selected polygon; dry land not confirmed"}<br>Lat: ${pt.lat.toFixed(7)}<br>Lon: ${pt.lon.toFixed(7)}<br>Distance to flood edge: ~${Math.round(pt.edge_distance_m)} m]]></description><ExtendedData><Data name="plot"><value>${esc(p.plot)}</value></Data><Data name="sample_id"><value>${pt.id}</value></Data><Data name="sample_method"><value>${esc(pt.method)}</value></Data><Data name="in_water"><value>${pt.in_water?"true":"false"}</value></Data><Data name="flood_source"><value>${esc(source)}</value></Data><Data name="water_date"><value>${esc(sourceDate)}</value></Data><Data name="edge_distance_m"><value>${pt.edge_distance_m}</value></Data></ExtendedData><Point><coordinates>${pt.lon},${pt.lat},0</coordinates></Point></Placemark>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${esc(p.plot)} Flood Field Survey</name>
<description><![CDATA[KMZ selection: ${esc(scope)}. Generated by Rayong Flood & Environmental Monitoring. Flood geometry may be drawn manually and is unverified, or follows a QA-accepted portal layer. Land-near-water sampling is outside the mapped water polygon but never guarantees dryness, road or path access, land rights, tide stage or field safety. Flood polygons may represent current water or ONLY newly detected water; check flood_source.]]></description>
<Style id="plotBoundary"><LineStyle><color>ff4c4cff</color><width>3</width></LineStyle><PolyStyle><color>00ffffff</color></PolyStyle></Style>
<Style id="floodArea"><LineStyle><color>fff8bd38</color><width>2</width></LineStyle><PolyStyle><color>66f8bd38</color></PolyStyle></Style>
<Style id="surveyPoint"><IconStyle><scale>1.05</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>
${includeBoundary?`<Folder><name>01 Plot Boundary</name>${plotPm}</Folder><Folder><name>02 Flood Boundary</name>${floodPm}</Folder>`:""}
${includePoints?`<Folder><name>03 Random Field Check Points</name>${pointPm}</Folder>`:""}
</Document></kml>`;
}
async function exportKmz(){
  const p=activePlot||selected;if(!p)return;
  const scope=$("field-kmz-scope")?.value||"both";
  const includeBoundary=scope==="both"||scope==="boundary";
  const includePoints=scope==="both"||scope==="points";
  const flood=floodFeature(p.plot);
  if(includeBoundary&&!flood){notify("ขอบเขตน้ำยังไม่พร้อมส่งออก กรุณาเลือกวันที่ผ่าน QA หรือวาดขอบเขต");return}
  if(includePoints&&!points.length&&scope==="both"&&!pointsEdited)generatePoints();
  if(includePoints&&!points.length){notify("ยังไม่มีจุดที่เลือกสำหรับส่งออก — กรุณาสุ่มจุดก่อน");return}
  if(typeof JSZip==="undefined"){notify("โหลดตัวสร้าง KMZ ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ");return}
  const kml=buildKml(p,scope),zip=new JSZip();
  zip.file("doc.kml",kml);
  zip.file("README.txt",`Rayong Flood & Environmental Monitoring
Plot: ${p.plot}
Export scope: ${scope} (both / boundary / points)
Flood source: ${flood?.properties?._kmzSource||"none"}
Manual polygon count: ${flood?.properties?._kmzSource==="manual"?manualPartsFor(p.plot).length:0}
Water image date: ${flood?.properties?._kmzDate||"not recorded"}
QA: ${flood?.properties?._kmzQA||"UNVERIFIED"}
Random points included: ${includePoints?points.length:0}
Sampling mode: ${modeLabel()}
CRS: WGS84 (EPSG:4326)
CAUTION: outside newly mapped water does NOT imply dry ground; no route or field accessibility guarantee.`);
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
  const info=plotInfo(p.plot)||p,date=String(flood?.properties?._kmzDate||info.current||"undated").replaceAll("-","");
  const a=document.createElement("a"),u=URL.createObjectURL(blob);
  a.href=u;a.download=`${p.plot}_Flood_Field_Survey_${scope}_${date}.kmz`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
  notify(`Export KMZ ${p.plot} • ${scope==="both"?"ขอบเขตและจุด":scope==="boundary"?"เฉพาะขอบเขต":"เฉพาะจุด"}${includePoints?" • "+points.length+" จุด":""}`);
}
function drawStatus(message,show=true){
  const el=$("field-draw-status");if(!el)return;
  el.hidden=!show;
  el.textContent=message;
}
function removeDraftLayer(){
  if(drawLayer){try{overviewMap?.removeLayer(drawLayer)}catch(_){}drawLayer=null}
}
function removeDrawing(){
  drawing=false;drawVertices=[];removeDraftLayer();
  const btn=$("field-draw-btn");if(btn){btn.textContent=activePlot&&manualPartsFor(activePlot.plot).length?"วาดขอบเขตเพิ่ม":"วาดขอบเขตน้ำ";btn.setAttribute?.("aria-pressed","false")}
  const finish=$("field-finish-btn");if(finish)finish.disabled=true;
  const undo=$("field-undo-vertex-btn");if(undo)undo.disabled=true;
  try{overviewMap?.getContainer?.()?.classList.remove("field-map-drawing")}catch(_){}
  drawStatus("",false);
}
function renderDraft(){
  removeDraftLayer();
  if(!drawVertices.length)return;
  const latlngs=drawVertices.map(c=>[c[1],c[0]]);
  const segments=[L.polyline(latlngs,{color:"#ffb347",weight:3,dashArray:"7 5",interactive:false})];
  if(drawVertices.length>=3&&typeof L.polygon==="function"){
    segments.push(L.polygon(latlngs,{color:"#ffb347",weight:2,dashArray:"7 5",fillColor:"#ffb347",fillOpacity:.18,interactive:false}));
  }
  if(typeof L.circleMarker==="function"){
    latlngs.forEach((xy,i)=>segments.push(L.circleMarker(xy,{radius:5,color:"#fff",weight:2,fillColor:"#ffab32",fillOpacity:1,interactive:false})));
  }
  drawLayer=L.layerGroup(segments).addTo(overviewMap);
}
function startDrawing(){
  if(!activePlot&&!selected)return;
  if(drawing){removeDrawing();notify("ยกเลิกการวาด");return}
  const map=overviewMap;
  if(!map){notify("ยังไม่พร้อมแสดงแผนที่");return}
  removeDrawing();drawing=true;ensureDrawingListeners();
  const btn=$("field-draw-btn");if(btn){btn.textContent="ยกเลิกวาด";btn.setAttribute?.("aria-pressed","true")}
  const finish=$("field-finish-btn");if(finish)finish.disabled=true;
  try{map.closePopup?.();map.getContainer?.()?.classList.add("field-map-drawing")}catch(_){}
  const mapCard=document.querySelector?.("#tab-overview .map-card");
  mapCard?.scrollIntoView?.({behavior:"smooth",block:"nearest"});
  drawStatus("กำลังวาดขอบเขตที่ "+(manualPartsFor((activePlot||selected).plot).length+1)+" • คลิกในแปลงอย่างน้อย 3 จุด แล้วกดยืนยัน");
  notify("เปิดโหมดวาดขอบเขตแล้ว — คลิกในแปลงบนแผนที่ซ้ายเพื่อปักจุด");
}
function finishDrawing(){
  const p=activePlot||selected;
  if(!drawing||!p||drawVertices.length<3){notify("ต้องคลิกอย่างน้อย 3 จุด");return}
  const ring=[...drawVertices,drawVertices[0]];
  let feature={type:"Feature",properties:{plot:p.plot,source:"manual_unverified"},geometry:{type:"Polygon",coordinates:[ring]}};
  const b=plotFeature(p.plot);
  try{if(turf.kinks(feature)?.features?.length){notify("ขอบเขตที่วาดมีเส้นตัดกัน กรุณาวาดใหม่");return}if(b){const clipped=turf.intersect(feature,b);if(!clipped){notify("แนวที่วาดอยู่นอกแปลง");return}feature={...clipped,properties:feature.properties};}}catch(e){console.warn("draw clipping failed",e);notify("ไม่สามารถตรวจสอบขอบเขตที่วาดได้ กรุณาวาดใหม่");return}
  let areaRai=0;
  try{areaRai=turf.area(feature)/1600}catch(_){areaRai=0}
  if(!Number.isFinite(areaRai)||areaRai<=0){notify("รูปหลายเหลี่ยมไม่ถูกต้อง");return}
  feature.properties._kmzArea=areaRai;
  feature.properties._kmzSource="manual";feature.properties._kmzQA="UNVERIFIED";feature.properties._kmzDate="";
  const parts=manualPartsFor(p.plot);
  parts.push({geometry:feature.geometry,areaRai});
  manualByPlot.set(p.plot,parts);
  removeDrawing();syncManualFlood(p.plot);
  refreshSourceOptions(p.plot);$("field-flood-source").value="manual";
  redrawManualBoundaries();redrawFloodBoundary();renderManualList();
  clearPoints(true);updatePanel();
  notify("บันทึกขอบเขตน้ำที่ "+parts.length+" แล้ว • รวม "+parts.length+" ขอบเขต • วาดเพิ่มหรือ Export KMZ ได้");
}
function clearDrawing(){
  const p=activePlot||selected;if(!p)return;
  manualByPlot.delete(p.plot);removeDrawing();syncManualFlood(p.plot);
  refreshSourceOptions(p.plot);redrawManualBoundaries();redrawFloodBoundary();renderManualList();clearPoints(true);updatePanel();
  notify("ล้างขอบเขตที่วาดทั้งหมดของ "+p.plot+" แล้ว");
}
function onMapClick(e){
  if(!drawing||!e?.latlng)return false;
  const raw=e.originalEvent;
  if(raw&&typeof raw==="object"){
    if(processedClickEvents.has(raw))return false;
    processedClickEvents.add(raw);
  }
  const p=activePlot||selected,boundary=plotFeature(p?.plot);
  const xy=[e.latlng.lng,e.latlng.lat];
  if(!Number.isFinite(xy[0])||!Number.isFinite(xy[1]))return false;
  if(boundary&&!pointInFeature(xy,boundary)){
    drawStatus("อยู่นอกขอบเขต "+p.plot+" • คลิกภายในขอบเขตสีแดงเท่านั้น");
    notify("จุดอยู่นอกขอบเขตแปลง กรุณาคลิกภายในแปลง");return false;
  }
  drawVertices.push(xy);
  renderDraft();
  const finish=$("field-finish-btn");if(finish)finish.disabled=drawVertices.length<3;
  const undo=$("field-undo-vertex-btn");if(undo)undo.disabled=false;
  drawStatus("วาดแล้ว "+drawVertices.length+" จุด"+(drawVertices.length<3?" • เพิ่มอีก "+(3-drawVertices.length)+" จุด":" • กด 'ยืนยันขอบเขตที่วาด' ได้"));
  return true;
}
function undoDrawingVertex(){
  if(!drawing||!drawVertices.length)return;
  drawVertices.pop();renderDraft();
  const finish=$("field-finish-btn");if(finish)finish.disabled=drawVertices.length<3;
  const undo=$("field-undo-vertex-btn");if(undo)undo.disabled=!drawVertices.length;
  drawStatus("เหลือ "+drawVertices.length+" จุด • คลิกบนแผนที่เพื่อแก้แนวขอบเขต");
}
function ensureDrawingListeners(){
  try{
    for(const map of [overviewMap]){
      if(map&&!listeningMaps.has(map)){map.on("click",onMapClick);listeningMaps.add(map)}
    }
  }catch(e){console.warn("Cannot attach map digitizing",e)}
}
function onPlotChange(p){
  if(!p)return;
  // Clicks on the currently selected plot should NEVER discard a draft.
  if(drawing&&activePlot?.plot===p.plot)return;
  removeDrawing();
  activePlot=p;
  syncManualFlood(p.plot);
  redrawManualBoundaries();renderManualList();
  const sourceSelect=$("field-flood-source");if(sourceSelect)sourceSelect.value=manualPartsFor(p.plot).length?"manual":"auto";
  ensureDrawingListeners();
  refreshSourceOptions(p.plot);clearPoints(true);redrawFloodBoundary();updatePanel();
}
function bind(){
  $("field-random-btn")?.addEventListener("click",generatePoints);
  $("field-draw-btn")?.addEventListener("click",startDrawing);
  $("field-finish-btn")?.addEventListener("click",finishDrawing);
  $("field-undo-vertex-btn")?.addEventListener("click",undoDrawingVertex);
  $("field-reset-boundary-btn")?.addEventListener("click",clearDrawing);
  $("field-manual-polygon-list")?.addEventListener("click",e=>{const btn=e.target?.closest?.("[data-remove-manual]");if(btn){e.preventDefault();removeManualBoundary(Number(btn.getAttribute("data-remove-manual")))}});
  ensureDrawingListeners();
  $("field-export-kmz-btn")?.addEventListener("click",exportKmz);
  $("field-clear-btn")?.addEventListener("click",()=>clearPoints(false));
  $("field-kmz-scope")?.addEventListener("change",()=>updatePanel());
  $("field-points-list")?.addEventListener("click",e=>{
    const btn=e.target?.closest?.("[data-remove-point]");
    if(btn){e.preventDefault();removePoint(btn.getAttribute("data-remove-point"));}
  });
  $("field-flood-source")?.addEventListener("change",()=>{clearPoints(true);redrawFloodBoundary();updatePanel()});
  $("field-preview-boundary")?.addEventListener("change",()=>{redrawFloodBoundary();});
  $("field-point-count")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  $("field-sample-mode")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  loadHistoricalFlood();renderPointList();renderManualList();updatePanel();
}
window.FieldExport={onPlotChange,generatePoints,exportKmz,clearPoints,startDrawing,finishDrawing,clearDrawing,getPoints:()=>points.slice(),removePoint,isDrawing:()=>drawing,addVertex:onMapClick,getDraftVertices:()=>drawVertices.slice(),repositionPoint,getManualBoundaries:plot=>manualPartsFor(plot||(activePlot||selected)?.plot).slice(),removeManualBoundary};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
