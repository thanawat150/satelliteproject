/* Flood field-survey export: plot boundary + flood polygon + practical random points -> KMZ. */
(function(){
"use strict";
let activePlot=null;
let points=[];
const surveyLayers={overview:null,full:null};
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));

function floodFeature(plot){
  try{return newWaterByPlot?.get(plot)||null}catch(_){return null}
}
function plotFeature(plot){
  try{return boundaryByPlot?.get(plot)||null}catch(_){return null}
}
function plotInfo(plot){
  try{return plots?.find(x=>x.plot===plot)||null}catch(_){return null}
}
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
function desiredCount(info){
  const v=$("field-point-count")?.value||"auto";
  return v==="auto"?recommendedCount(info?.new_water_rai):clamp(Number(v)||5,1,50);
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
function candidatePool(feature,count,mode,areaRai){
  const [minX,minY,maxX,maxY]=bbox(feature);
  const target=Math.max(900,count*100),all=[],edge=[];
  const areaM2=Math.max(1600,Number(areaRai||1)*1600);
  const typical=Math.sqrt(areaM2/Math.max(1,count));
  const edgeDepth=clamp(typical*.55,18,55);
  let tries=0,maxTries=Math.max(25000,target*40);
  while(all.length<target&&tries++<maxTries){
    const p=[minX+Math.random()*(maxX-minX),minY+Math.random()*(maxY-minY)];
    if(!pointInFeature(p,feature))continue;
    all.push(p);
    if(distanceToBoundaryM(p,feature)<=edgeDepth)edge.push(p);
  }
  if(mode==="edge"&&edge.length>=Math.max(count*5,50))return {pool:edge,edgeDepth};
  return {pool:all,edgeDepth};
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
  const flood=floodFeature(p.plot),info=plotInfo(p.plot)||p;
  if(!flood){notify("แปลงนี้ยังไม่มีขอบเขตน้ำท่วมที่ผ่าน QA");return[]}
  const count=desiredCount(info),mode=$("field-sample-mode")?.value||"edge";
  const area=Number(flood.properties?.new_water_rai??info.new_water_rai??0);
  const {pool,edgeDepth}=candidatePool(flood,count,mode,area);
  points=spreadSelect(pool,count).map((c,i)=>({
    id:`P${String(i+1).padStart(2,"0")}`,
    lon:+c[0].toFixed(7),lat:+c[1].toFixed(7),
    edge_distance_m:+distanceToBoundaryM(c,flood).toFixed(1),
    method:mode==="edge"?"near_water_edge":"full_random"
  }));
  drawPoints();
  updatePanel(edgeDepth);
  if(points.length)notify(`สุ่ม ${points.length} จุดแล้ว`);
  else notify("สุ่มจุดเม่สำเร็จ");
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
    icon:L.divIcon({className:"field-point-icon",html:`<span>${pt.id}</span>`,iconSize:[36,24],iconAnchor:[18,12]})
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
  return ($("field-sample-mode")?.value||"edge")==="edge"?"ใกล้ขอบน้ำ":"สุ่มทั่วพื้นที่น้ำ";
}
function updatePanel(edgeDepth){
  const p=activePlot||selected,ready=$("field-export-ready"),sum=$("field-export-summary");
  const randomBtn=$("field-random-btn"),exportBtn=$("field-export-kmz-btn");
  if(!p||!ready||!sum)return;
  const flood=floodFeature(p.plot),info=plotInfo(p.plot)||p;
  if(!flood){
    ready.textContent="ไม้มีขอบเขตน้ำ";ready.className="field-export-ready is-missing";
    sum.textContent=`${p.plot} • ยังไม่มี Flood Polygon ที่ผ่าน QA สำหรับ Export`;
    if(randomBtn)randomBtn.disabled=true;if(exportBtn)exportBtn.disabled=true;return;
  }
  const area=Number(flood.properties?.new_water_rai??info.new_water_rai??0);
  const auto=recommendedCount(area),wanted=desiredCount(info);
  ready.textContent=points.length?`${points.length} จุดพร้อม Export`:"พร้อมใช้งาน";ready.className="field-export-ready is-ready";
  sum.textContent=`${p.plot} • พื้นที่น้ำ ${fmtLocal(area)} ไร่ • ${$("field-point-count")?.value==="auto"?`Auto แนะนำ ${auto} จุด`:`กำหนด ${wanted} จุด`} • ${modeLabel()}${edgeDepth?` (≤ ~${Math.round(edgeDepth)} ม. จากขอบน้ำ)`:""}`;
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
  const area=Number(flood?.properties?.new_water_rai??info.new_water_rai??0);
  const plotPm=boundary?placemarkPolygon(`${p.plot} — Plot Boundary`,boundary,"#plotBoundary",`Plot: ${esc(p.plot)}<br>Area: ${fmtLocal(info.area_rai)} rai`):"";
  const floodPm=flood?placemarkPolygon(`${p.plot} — Flood / New Water`,flood,"#floodArea",`Plot: ${esc(p.plot)}<br>Comparison: ${esc(baseline)} → ${esc(current)}<br>Flood/New water: ${fmtLocal(area)} rai`):"";
  const pointPm=points.map(pt=>`<Placemark><name>${pt.id}</name><styleUrl>#surveyPoint</styleUrl><description><![CDATA[Plot: ${esc(p.plot)}<br>Date: ${esc(current)}<br>Sampling: ${esc(modeLabel())}<br>Lat: ${pt.lat.toFixed(7)}<br>Lon: ${pt.lon.toFixed(7)}<br>Distance to flood edge: ~${Math.round(pt.edge_distance_m)} m]]></description><ExtendedData><Data name="plot"><value>${esc(p.plot)}</value></Data><Data name="sample_id"><value>${pt.id}</value></Data><Data name="sample_method"><value>${esc(pt.method)}</value></Data><Data name="edge_distance_m"><value>${pt.edge_distance_m}</value></Data></ExtendedData><Point><coordinates>${pt.lon},${pt.lat},0</coordinates></Point></Placemark>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${esc(p.plot)} Flood Field Survey</name>
<description><![CDATA[Generated by Rayong Flood & Environmental Monitoring. Flood geometry follows the portal layer that passed QA. Near-edge sampling estimates accessibility only from distance to the flood edge; it does not verify roads, land access or field safety.]]></description>
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
  const info=plotInfo(p.plot)||p,date=String(info.current||"current").replaceAll("-","");
  const a=document.createElement("a"),u=URL.createObjectURL(blob);
  a.href=u;a.download=`${p.plot}_Flood_Field_Survey_${date}.kmz`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
  notify(`Export KMZ ${p.plot} • ${points.length} จุดแล้ว`);
}
function onPlotChange(p){
  activePlot=p;clearPoints(true);updatePanel();
}
function bind(){
  $("field-random-btn")?.addEventListener("click",generatePoints);
  $("field-export-kmz-btn")?.addEventListener("click",exportKmz);
  $("field-clear-btn")?.addEventListener("click",()=>clearPoints(false));
  $("field-point-count")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  $("field-sample-mode")?.addEventListener("change",()=>{clearPoints(true);updatePanel()});
  updatePanel();
}
window.FieldExport={onPlotChange,generatePoints,exportKmz,clearPoints,getPoints:()=>points.slice()};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
