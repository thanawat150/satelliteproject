/* Flood field-survey export: plot boundary + flood polygon + practical random points -> KMZ. */
(function(){
"use strict";
let activePlot=null;
let points=[];
let manualFlood=null, drawing=false, drawVertices=[], drawLayer=null, confirmedLayer=null, listeningMap=null;
const surveyLayers={overview:null,full:null};
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
function sourceDescription(feature){
  if(!feature)return "ไม่มี Polygon อัตโนมัติที่ผ่าน QA สำหรับแปลงนี้ — ใช้ปุ่มวาดขอบเขตน้ำได้";
  const p=feature.properties||{};
  const kind=p._kmzSource==="water_extent"?"ขอบเขตน้ำของวันนั้น (Water Extent)":p._kmzSource==="new_water"?"ขอบเขตน้ำเพิ่มจากวันฐาน (New Water)":"ขอบเขตที่วาดเอง (ยังไม่ยืนยัน)";
  return kind+(p._kmzDate?" • "+p._kmzDate:"")+" • "+(p._kmzQA||"UNVERIFIED");
}
function refreshSourceOptions(plot){
  const sel=$("field-flood-source");if(!sel)return;
  const prior=sel.value||"auto";sel.replaceChildren();
  const add=(value,label)=>{const o=document.createElement("option");o.value=value;o.textContent=label;sel.appendChild(o)};
  add("auto","Auto — ใช้ข้อมูลน้ำที่ผ่าน QA ล่าสุด");
  for(const f of validHistory(plot))add("date:"+f.properties.date,f.properties.date+" • ขอบเขตน้ำวันนั้น ("+f.properties.analysis_status+")");
  try{if(newWaterByPlot?.get(plot))add("new","น้ำเพิ่มจากวันฐาน (New Water)")}catch(_){}
  if(manualFlood?.properties?.plot===plot)add("manual","ขอบเขตวาดเอง (Unverified)");
  if([...sel.options].some(o=>o.value===prior))sel.value=prior;else sel.value="auto";
  const hint=$("field-source-description");if(hint)hint.textContent=sourceDescription(floodFeature(plot));
}
async function loadHistoricalFlood(){
  try{const response=await fetch("data/water_history.geojson",{cache:"no-store"});if(!response.ok)return;const j=await response.json();waterHistoryFeatures=Array.isArray(j.features)?j.features:[];
    const p=activePlot||((typeof selected!=="undefined")?selected:null);if(p){refreshSourceOptions(p.plot);clearPoints(true);updatePanel();}
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
function candidatePool(flood,plotBoundary,count,mode,areaRai){
  const land=mode==="land_edge";
  const region=land?plotBoundary:flood;
  if(!region)return {pool:[],edgeDepth:0};
  const [minX,minY,maxX,maxY]=bbox(region);
  const target=Math.max(1000,count*110),pool=[];
  const typical=Math.sqrt(Math.max(1600,Number(areaRai||1)*1600)/Math.max(1,count));
  const edgeDepth=land?clamp(typical*1.5,35,125):clamp(typical*.55,18,55);
  let tries=0;const maxTries=120000;
  while(pool.length<target&&tries++<maxTries){
    const xy=[minX+Math.random()*(maxX-minX),minY+Math.random()*(maxY-minY)];
    if(!pointInFeature(xy,region))continue;
    const inWater=pointInFeature(xy,flood),d=distanceToBoundaryM(xy,flood);
    if(land){if(inWater||d<4||d>edgeDepth)continue;}
    else if(mode==="water_edge" && d>edgeDepth)continue;
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
  const count=desiredCount(info,flood),mode=$("field-sample-mode")?.value||"land_edge";
  if(mode==="land_edge"&&!boundary){notify("ยังไม่มีขอบเขตแปลงสำหรับเลือกจุดด้านนอกน้ำ");return[]}
  const {pool,edgeDepth}=candidatePool(flood,boundary,count,mode,activeArea(info,flood));
  if(pool.length<count){points=[];drawPoints();updatePanel();notify("พื้นที่ที่ตรงเงื่อนไขมีน้อยเกินไป: ลดจำนวนจุดหรือเปลี่ยนวิธีสุ่ม ห้ามใช้จุดที่ไม่ผ่านเงื่อนไข");return[]}
  points=spreadSelect(pool,count).map((c,i)=>({
    id:"P"+String(i+1).padStart(2,"0"),
    lon:+c[0].toFixed(7),lat:+c[1].toFixed(7),
    edge_distance_m:+distanceToBoundaryM(c,flood).toFixed(1),
    method:mode==="land_edge"?"land_near_water":mode==="water_edge"?"water_near_edge":"water_interior",
    in_water:mode!=="land_edge",
    flood_source:flood.properties._kmzSource||"manual"
  }));
  drawPoints();updatePanel(edgeDepth);notify("สุ่ม "+points.length+" จุดแล้ว • ยังต้องตรวจทางเข้าหน้างาน");
  return points;
}

function clearLayer(map,key){
  if(map&&surveyLayers[key]){map.removeLayer(surveyLayers[key]);surveyLayers[key]=null}
}
function clearPoints(silent=false){
  points=[];
  try{clearLayer(overviewMap,"overview");clearLayer(fullMap,"full")}catch(_){}
  updatePanel();
  if(!silent)notify("ล้างจุดตรวจแล้ว");
}
function markerFor(pt,plot){
  return L.marker([pt.lat,pt.lon],{
    icon:L.divIcon({className:"field-point-icon"+(pt.in_water?" is-water":" is-land"),html:`<span>${pt.id}</span>`,iconSize:[36,24],iconAnchor:[18,12]})
  }).bindPopup(`<b>${esc(plot)} • ${pt.id}</b><br>Lat ${pt.lat.toFixed(6)}<br>Lon ${pt.lon.toFixed(6)}<br><small>ระยะจากขอบน้ำ ~${Math.round(pt.edge_distance_m)} ม.</small>`);
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
  const m=$("field-sample-mode")?.value||"land_edge";return m==="land_edge"?"พื้นดินใกล้ขอบน้ำ (ยังไม่ยืนยันทางเข้า)":m==="water_edge"?"ภายในน้ำใกล้ขอบ":"ภายในน้ำทั่วบริเวณ";
}
function updatePanel(edgeDepth){
  const p=activePlot||selected,ready=$("field-export-ready"),sum=$("field-export-summary");
  const randomBtn=$("field-random-btn"),exportBtn=$("field-export-kmz-btn");
  if(!p||!ready||!sum)return;
  const flood=floodFeature(p.plot),info=plotInfo(p.plot)||p;
  const hint=$("field-source-description");if(hint)hint.textContent=sourceDescription(flood);
  if(!flood){
    ready.textContent="ต้องวาดขอบเขต";ready.className="field-export-ready is-missing";
    sum.textContent=p.plot+" • ข้อมูลน้ำอัตโนมัติยังไม่ผ่าน QA สำหรับวันที่มีอยู่ กด “วาดขอบเขตน้ำ” แล้วคลิกอย่างน้อย 3 จุดภายในแปลง เพื่อทำ KMZ ชั่วคราว";
    if(randomBtn)randomBtn.disabled=true;if(exportBtn)exportBtn.disabled=true;return;
  }
  const area=activeArea(info,flood),auto=recommendedCount(area),wanted=desiredCount(info,flood);
  ready.textContent=points.length?points.length+" จุดพร้อม Export":"พร้อมสุ่มจุด";ready.className="field-export-ready is-ready";
  sum.textContent=p.plot+" • "+sourceDescription(flood)+" • "+fmtLocal(area)+" ไร่ • "+($("field-point-count")?.value==="auto"?"แนะนำ "+auto+" จุด":"กำหนด "+wanted+" จุด")+" • "+modeLabel()+(edgeDepth?" (ระยะจากขอบน้ำ ≤ "+Math.round(edgeDepth)+" ม.)":"");
  if(randomBtn)randomBtn.disabled=false;if(exportBtn)exportBtn.disabled=false;
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
function buildKml(p){
  const boundary=plotFeature(p.plot),flood=floodFeature(p.plot),info=plotInfo(p.plot)||p;
  const current=String(info.current||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
  const baseline=String(info.baseline||"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
  const area=activeArea(info,flood);
  const plotPm=boundary?placemarkPolygon(`${p.plot} — Plot Boundary`,boundary,"#plotBoundary",`Plot: ${esc(p.plot)}<br>Area: ${fmtLocal(info.area_rai)} rai`):"";
  const source=flood?.properties?._kmzSource||"unknown";
  const sourceDate=flood?.properties?._kmzDate||current;
  const floodPm=flood?placemarkPolygon(`${p.plot} — ${source==="water_extent"?"Water Extent":source==="new_water"?"New Water":"User-drawn Water (unverified)"}`,flood,"#floodArea",`Plot: ${esc(p.plot)}<br>Source: ${esc(source)}<br>Date: ${esc(sourceDate)}<br>Baseline: ${esc(baseline)}<br>QA: ${esc(flood.properties?._kmzQA||"UNVERIFIED")}<br>Mapped area: ${fmtLocal(area)} rai`):"";
  const pointPm=points.map(pt=>`<Placemark><name>${pt.id}</name><styleUrl>#surveyPoint</styleUrl><description><![CDATA[Plot: ${esc(p.plot)}<br>Date: ${esc(current)}<br>Sampling: ${esc(modeLabel())}<br>Point in mapped water: ${pt.in_water?"YES — access by water may be required":"NO — dry-land candidate only"}<br>Lat: ${pt.lat.toFixed(7)}<br>Lon: ${pt.lon.toFixed(7)}<br>Distance to flood edge: ~${Math.round(pt.edge_distance_m)} m]]></description><ExtendedData><Data name="plot"><value>${esc(p.plot)}</value></Data><Data name="sample_id"><value>${pt.id}</value></Data><Data name="sample_method"><value>${esc(pt.method)}</value></Data><Data name="in_water"><value>${pt.in_water?"true":"false"}</value></Data><Data name="flood_source"><value>${esc(source)}</value></Data><Data name="water_date"><value>${esc(sourceDate)}</value></Data><Data name="edge_distance_m"><value>${pt.edge_distance_m}</value></Data></ExtendedData><Point><coordinates>${pt.lon},${pt.lat},0</coordinates></Point></Placemark>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${esc(p.plot)} Flood Field Survey</name>
<description><![CDATA[Generated by Rayong Flood & Environmental Monitoring. Flood geometry may be drawn manually and is unverified, or follows a QA-accepted portal layer. Land-near-water sampling is outside the mapped water polygon but never guarantees dryness, road or path access, land rights, tide stage or field safety. Flood polygons may represent current water or ONLY newly detected water; check flood_source.]]></description>
<Style id="plotBoundary"><LineStyle><color>ff4c4cff</color><width>3</width></LineStyle><PolyStyle><color>00ffffff</color></PolyStyle></Style>
<Style id="floodArea"><LineStyle><color>fff8bd38</color><width>2</width></LineStyle><PolyStyle><color>66f8bd38</color></PolyStyle></Style>
<Style id="surveyPoint"><IconStyle><scale>1.05</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>
<Folder><name>01 Plot Boundary</name>${plotPm}</Folder>
<Folder><name>02 Flood Boundary</name>${floodPm}</Folder>
<Folder><name>03 Random Field Check Points</name>${pointPm}</Folder>
</Document></kml>`;
}
async function exportKmz(){
  const p=activePlot||selected;if(!p)return;
  const flood=floodFeature(p.plot);
  if(!flood){notify("ไม่มีขอบเขตน้ำท่วมที่พร้อม Export");return}
  if(!points.length)generatePoints();
  if(!points.length)return;
  if(typeof JSZip==="undefined"){notify("โหลดตัวสร้าง KMZ ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ");return}
  const kml=buildKml(p),zip=new JSZip();
  zip.file("doc.kml",kml);
  zip.file("README.txt",`Rayong Flood & Environmental Monitoring\nPlot: ${p.plot}\nRandom points: ${points.length}\nSampling mode: ${modeLabel()}\nCRS: WGS84 (EPSG:4326)\nNote: near-edge mode is not a road/accessibility guarantee.`);
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
  const info=plotInfo(p.plot)||p,date=String(flood.properties?._kmzDate||info.current||"undated").replaceAll("-","");
  const a=document.createElement("a"),u=URL.createObjectURL(blob);
  a.href=u;a.download=`${p.plot}_Flood_Field_Survey_${date}.kmz`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
  notify(`Export KMZ ${p.plot} • ${points.length} จุดแล้ว`);
}
function removeDrawing(){
  drawing=false;drawVertices=[];
  if(drawLayer){try{overviewMap?.removeLayer(drawLayer)}catch(_){}drawLayer=null}
  const btn=$("field-draw-btn");if(btn)btn.textContent="วาดขอบเขตน้ำ";
  const finish=$("field-finish-btn");if(finish)finish.disabled=true;
}
function renderDraft(){
  if(drawLayer){try{overviewMap.removeLayer(drawLayer)}catch(_){}}
  if(!drawVertices.length){drawLayer=null;return}
  drawLayer=L.polyline(drawVertices.map(c=>[c[1],c[0]]),{color:"#f59e0b",weight:3,dashArray:"6 6"}).addTo(overviewMap);
}
function startDrawing(){
  if(!activePlot&&!selected)return;
  if(drawing){removeDrawing();notify("ยกเลิกการวาด");return}
  const map=overviewMap;
  if(!map){notify("ยังไม่พร้อมแสดงแผนที่");return}
  removeDrawing();drawing=true;
  $("field-draw-btn").textContent="ยกเลิกวาด";
  $("field-finish-btn").disabled=false;
  document.getElementById("tab-overview")?.scrollIntoView({behavior:"smooth",block:"center"});
  notify("คลิกบนแผนที่ภาพรวมเพื่อกำหนดแนวขอบน้ำ อย่างน้อย 3 จุด แล้วกดยืนยัน");
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
  removeDrawing();manualFlood=feature;
  refreshSourceOptions(p.plot);$("field-flood-source").value="manual";
  if(confirmedLayer){overviewMap?.removeLayer(confirmedLayer);confirmedLayer=null}
  confirmedLayer=L.geoJSON(feature,{style:{color:"#f59e0b",weight:3,fillColor:"#f59e0b",fillOpacity:0.22}}).addTo(overviewMap);
  clearPoints(true);updatePanel();
  notify("สร้างขอบเขตน้ำจากการวาดแล้ว (ยังไม่ยืนยัน) — สุ่มจุดและ Export KMZ ได้");
}
function clearDrawing(){
  manualFlood=null;removeDrawing();if(activePlot)refreshSourceOptions(activePlot.plot);if(confirmedLayer){overviewMap?.removeLayer(confirmedLayer);confirmedLayer=null}clearPoints(true);updatePanel();
  notify("ล้างขอบเขตที่วาดแล้ว");
}
function onMapClick(e){
  if(!drawing)return;
  const p=activePlot||selected, boundary=plotFeature(p?.plot);
  const xy=[e.latlng.lng,e.latlng.lat];
  if(boundary&&!pointInFeature(xy,boundary)){notify("จุดอยู่นอกขอบเขตแปลง กรุณาคลิกภายในแปลง");return}
  drawVertices.push(xy);renderDraft();
}
function onPlotChange(p){
  removeDrawing();manualFlood=null;if(confirmedLayer){overviewMap?.removeLayer(confirmedLayer);confirmedLayer=null}
  activePlot=p;
  if(typeof overviewMap!=="undefined"&&overviewMap!==listeningMap){listeningMap?.off("click",onMapClick);overviewMap.on("click",onMapClick);listeningMap=overviewMap}
  refreshSourceOptions(p.plot);clearPoints(true);updatePanel();
}
function bind(){
  $("field-random-btn")?.addEventListener("click",generatePoints);
  $("field-draw-btn")?.addEventListener("click",startDrawing);
  $("field-finish-btn")?.addEventListener("click",finishDrawing);
  $("field-reset-boundary-btn")?.addEventListener("click",clearDrawing);
  const attach=()=>{if(typeof overviewMap!=="undefined"&&overviewMap){overviewMap.on("click",onMapClick);return true}return false};
  if(!attach())window.addEventListener("load",attach,{once:true});
  $("field-export-kmz-btn")?.addEventListener("click",exportKmz);
  $("field-clear-btn")?.addEventListener("click",()=>clearPoints(false));
  $("field-flood-source")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  $("field-point-count")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  $("field-sample-mode")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  loadHistoricalFlood();updatePanel();
}
window.FieldExport={onPlotChange,generatePoints,exportKmz,clearPoints,startDrawing,finishDrawing,clearDrawing,getPoints:()=>points.slice()};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
