/* Office Monitoring Studio — evidence-only satellite compare, monitoring zones & report. */
(function(){
"use strict";
const $=id=>document.getElementById(id), iso=s=>String(s||"").replace(/-/g,""),fmt=n=>n==null||!Number.isFinite(Number(n))?"—":Number(n).toLocaleString("th-TH",{maximumFractionDigits:2});
const dth=s=>s?String(s).split("-").reverse().join("/"):"—";
const valid=r=>r&&["VERIFIED","AUTO_VALID"].includes(r.analysis_status)&&(r.valid_pct==null||r.valid_pct>=70);
const colors={water:"#248ac1",ndvi:"#3c9b59",ndre:"#7a6cbb",ndmi:"#3397a2",mndwi:"#2875ad",bsi:"#a77d41",valid_pct:"#56879b"};
const lab={water:"พื้นที่น้ำ (ไร่)",ndvi:"NDVI",ndre:"NDRE",ndmi:"NDMI",mndwi:"MNDWI",bsi:"BSI",valid_pct:"พื้นที่ใช้ได้ (%)"};
const palettes={ndvi:["#965032","#d8bb70","#e5dea8","#77b96b","#116b38"],ndre:["#8e4738","#d1b671","#e6e8bd","#85b895","#2c7155"],ndmi:["#995037","#e3ae68","#efe2b8","#69afc7","#125b92"],mndwi:["#916533","#d4b882","#faf2ca","#73b9d1","#095ba3"],bsi:["#2b7152","#86a86f","#e9dfac","#d9a36e","#975534"]};
const ms={ready:false,rows:[],previews:new Map(),visual:new Map(),full:new Map(),bounds:new Map(),history:{},water:[],newwater:[],landcover:[],spatialHotspots:[],boundaries:new Map(),plots:[],dates:[],plot:null,A:null,B:null,layer:"true",display:"side",sync:false,showBoundary:true,showWater:true,showNew:true,showVegetation:true,showSoil:true,reportMetrics:["water","ndvi","ndre","ndmi"],maps:[],mapLayers:[],charts:[],hotmap:null,hotLayers:[]};
const log=e=>console.warn("Monitoring Studio:",e);
function eltxt(id,s){let e=$(id);if(e)e.textContent=s}
function selectVal(id,v){const e=$(id);if(e&&[...e.options].some(o=>o.value===v))e.value=v}
async function json(path){const r=await fetch("data/"+path,{cache:"no-store"});if(!r.ok)throw Error(path+" HTTP "+r.status);return r.json()}
function dateRows(p){return [...new Set(ms.rows.filter(x=>x.plot===p).map(x=>x.date))].sort()}
function observation(p,d){return (ms.history[p]||[]).find(x=>x.date===d)}
function plotInfo(p){return ms.plots.find(x=>x.plot===p)}
function isVerifiedPair(p,a,b){const info=plotInfo(p);return info&&iso(a)===info.baseline&&iso(b)===info.current}
function qaText(p,d){const r=observation(p,d);if(!r)return "ยังไม่มีผลวิเคราะห์";
 const names={VERIFIED:"ตรวจสอบแล้ว",AUTO_VALID:"ผ่าน QA อัตโนมัติ",PARTIAL:"ข้อมูลบางส่วน",NO_DATA:"ไม่เพียงพอ"};
 return (names[r.analysis_status]||r.analysis_status)+(r.valid_pct!=null?" • ใช้ได้ "+fmt(r.valid_pct)+"%":"")}
function hrefRaw(p,d){const item=ms.rows.find(x=>x.plot===p&&x.date===d&&x.resolution==="10m");return item?.url||"#"}
function stableColor(p,d){const r=observation(p,d);return valid(r)?"#319d72":r?.analysis_status==="PARTIAL"?"#d29936":"#b95d59"}
function findImage(p,d,mode){
 const candidates=ms.rows.filter(x=>x.plot===p&&x.date===d&&x.resolution==="10m"&&ms.previews.get(x.title)?.src);
 const pref=ms.bounds.get(p+"|"+d)?.source_title;
 const c=candidates.find(x=>x.title===pref)||candidates.sort((a,b)=>String(b.modified_time).localeCompare(String(a.modified_time)))[0];
 if(!c)return null;
 if(mode==="true"){const v=ms.previews.get(c.title);return {url:v.src,bounds:v.bounds,source:c,description:"สีจริง (GeoTIFF 10 m)"}}
 const full=ms.full.get(p+"|"+d+"|"+mode);
 if(full?.src)return {url:full.src,bounds:full.bounds,source:c,description:"ภาพแสดงผลเต็มความละเอียดกริดต้นฉบับ "+full.width+"×"+full.height+" px",lowres:false};
 const v=ms.visual.get(p+"|"+d+"|"+mode);
 if(!v)return null;
 return {url:visualImage(v),bounds:v.bounds,source:c,description:"ภาพแสดงผลสำรอง 48×48 จากแบนด์จริง (เพื่อดูแนวโน้ม)",lowres:true};
}
function visualImage(v){
 if(v.url)return v.url;
 if(!v.pixels||!Array.isArray(v.size))return null;
 const w=v.size[0],h=v.size[1],c=document.createElement("canvas");c.width=w;c.height=h;
 const ctx=c.getContext("2d"),image=ctx.createImageData(w,h),a=image.data;
 const r=v.pixels,isrgb=v.mode==="false",col=palettes[v.mode]||palettes.ndvi;
 function mix(t){const n=Math.max(0,Math.min(col.length-1,t*(col.length-1))),lo=Math.floor(n),hi=Math.min(col.length-1,lo+1),f=n-lo;return [0,1,2].map(k=>{const x=parseInt(col[lo].slice(1+2*k,3+2*k),16),y=parseInt(col[hi].slice(1+2*k,3+2*k),16);return Math.round(x*(1-f)+y*f)})}
 for(let i=0;i<w*h;i++){const off=i*(isrgb?3:1),val=r.slice(off,off+(isrgb?3:1));if(val.includes("x"))continue;
 const rgb=isrgb?[parseInt(val[0],16)*17,parseInt(val[1],16)*17,parseInt(val[2],16)*17]:mix(parseInt(val[0],16)/15);
 for(let j=0;j<3;j++)a[i*4+j]=rgb[j];a[i*4+3]=255}
 ctx.putImageData(image,0,0);return c.toDataURL("image/png");
}
function mapInit(){
 if(ms.maps.length)return;
 for(const id of ["compare-map-a","compare-map-b"]){const e=$(id);if(!e)return;
 const m=L.map(e,{zoomControl:id==="compare-map-a",attributionControl:false,preferCanvas:true});
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(m);
 ms.maps.push(m)}
 ms.maps.forEach((m,i)=>m.on("moveend zoomend",()=>{if(ms.sync)return;ms.sync=true;const other=ms.maps[1-i];other.setView(m.getCenter(),m.getZoom(),{animate:false});ms.sync=false}));
}
function footprint(p,d){return ms.water.find(x=>x.properties?.plot===p&&x.properties?.date===d)}
function layerAdd(m,l){l.addTo(m);return l}
function chooseCenter(p){const b=ms.boundaries.get(p);if(!b)return null;const l=L.geoJSON(b);return l.getBounds().isValid()?l.getBounds():null}
function compareWaterMasks(p,a,b){
 const fa=footprint(p,a),fb=footprint(p,b);
 if(!fa||!fb||!valid(observation(p,a))||!valid(observation(p,b))||typeof turf==="undefined")return null;
 try{
  const fresh=turf.difference(fb,fa),receded=turf.difference(fa,fb),stable=turf.intersect(fa,fb);
  return {fresh,receded,stable};
 }catch(e){log("Water polygon difference not available: "+e.message);return null}
}
function redrawMap(){
 if(!ms.ready||!$("compare-map-a"))return;
 mapInit();if(ms.maps.length!==2)return;
 const p=ms.plot;
 ms.maps.forEach((m,i)=>{
  (ms.mapLayers[i]||[]).forEach(l=>{try{m.removeLayer(l)}catch(_){}});
  ms.mapLayers[i]=[];
  const date=i===0?ms.A:ms.B,img=findImage(p,date,ms.layer),status=$("compare-qa-"+(i===0?"a":"b"));
  if(status){status.textContent=dth(date)+" • "+qaText(p,date);status.style.borderLeftColor=stableColor(p,date)}
  if(img?.url&&img?.bounds)ms.mapLayers[i].push(layerAdd(m,L.imageOverlay(img.url,img.bounds,{opacity:.9,interactive:false})));
  const bound=ms.boundaries.get(p);if(ms.showBoundary&&bound)ms.mapLayers[i].push(layerAdd(m,L.geoJSON(bound,{style:{color:"#fa7064",weight:2.3,fill:false}})));
  const water=ms.showWater?footprint(p,date):null;
  if(water)ms.mapLayers[i].push(layerAdd(m,L.geoJSON(water,{style:{color:"#23cbf0",weight:2,fillColor:"#1f9acf",fillOpacity:.24,dashArray:"5,4"}})));
  for(const f of ms.landcover.filter(x=>x.properties?.plot===p&&x.properties?.date===date)){
   const cls=f.properties.class||f.properties.landcover_class;
   if(cls==="vegetation"&&!ms.showVegetation||cls==="bare_soil"&&!ms.showSoil)continue;
   const color=cls==="vegetation"?"#42b971":cls==="bare_soil"?"#c49c61":null;
   if(!color)continue;
   ms.mapLayers[i].push(layerAdd(m,L.geoJSON(f,{style:{color,weight:1.2,fillColor:color,fillOpacity:.18}})));
  }
 });
 const b=chooseCenter(p);
 if(b){ms.sync=true;ms.maps.forEach(m=>m.fitBounds(b,{padding:[15,15],maxZoom:16,animate:false}));ms.sync=false}
 const aWater=footprint(p,ms.A),bWater=footprint(p,ms.B),canNew=isVerifiedPair(p,ms.A,ms.B);
 const cm=ms.display==="change"&&ms.showWater?compareWaterMasks(p,ms.A,ms.B):null;
 if(cm&&ms.display==="change"){
  for(const [f,color,op] of [[cm.stable,"#2367b5",.30],[cm.fresh,"#17bddc",.52],[cm.receded,"#efaa4b",.52]]){
   if(!f)continue;
   ms.mapLayers[1].push(layerAdd(ms.maps[1],L.geoJSON(f,{style:{color,weight:1.8,fillColor:color,fillOpacity:op}})));
  }
 }
 if(ms.showNew&&canNew&&!cm){const newF=ms.newwater.find(x=>x.properties.plot===p);if(newF){const layer=layerAdd(ms.maps[1],L.geoJSON(newF,{style:{color:"#e6fc79",weight:1.6,fillColor:"#00cbeb",fillOpacity:.33}}));ms.mapLayers[1].push(layer)}}
 let note="ภาพคู่ใช้ภาพที่บันทึกแต่ละวันจริง และจัดตำแหน่งตามพิกัด GeoTIFF";
 if(ms.display==="change"){
  if(cm){
   const ra=f=>f&&typeof turf!=="undefined"?fmt(turf.area(f)/1600):"0";
   note="พื้นที่น้ำใหม่ "+ra(cm.fresh)+" ไร่ • น้ำลด "+ra(cm.receded)+" ไร่ • น้ำคงเดิม "+ra(cm.stable)+" ไร่ (ประมาณจาก Polygon ที่ผ่าน QA ทั้งสองวัน ไม่แทนค่ารายงาน Raster)";
  }else note=canNew&&ms.newwater.some(x=>x.properties.plot===p)?"แสดงพื้นที่น้ำใหม่จากผล Verified ของคู่วัน Baseline → Current เท่านั้น • ยังไม่มีขอบน้ำเต็มรายวันสองชุดที่เปรียบเทียบได้":"คู่วันที่เลือกยังไม่มี Water Footprint ที่ผ่าน QA ทั้งสองวัน จึงไม่สามารถคำนวณน้ำใหม่/น้ำลด/น้ำคงเดิมเชิงพื้นที่";
  if(!cm&&ms.showWater&&aWater){const l=layerAdd(ms.maps[1],L.geoJSON(aWater,{style:{color:"#ffd56a",weight:3,dashArray:"7,4",fill:false}}));ms.mapLayers[1].push(l)}
 }else if(!aWater||!bWater)note+=" • ยังไม่มีขอบน้ำรายวันที่ยืนยันครบทั้งสองวัน";
 if(ms.layer!=="true"){
 const aa=findImage(p,ms.A,ms.layer),bb=findImage(p,ms.B,ms.layer);
 note+=" • "+(aa?.lowres||bb?.lowres?"มีภาพย่อ 48×48 เป็นแหล่งสำรองในอย่างน้อยหนึ่งวัน":"ใช้ภาพแสดงผลที่ความละเอียดกริดเดิมของข้อมูล");
 note+=" (ค่ารายงานยังอ้างอิงผลที่ผ่าน QA)";
}
 eltxt("compare-note",note);
 const wrapper=$("compare-map-wrap");
 wrapper?.classList.toggle("compare-swipe",ms.display==="swipe");wrapper?.classList.toggle("compare-change",ms.display==="change");
 setSplit();setTimeout(()=>ms.maps.forEach(m=>m.invalidateSize()),80);
}
function setSplit(){const v=Number($("compare-split")?.value||50);if($("compare-map-b"))$("compare-map-b").style.clipPath=ms.display==="swipe"?"inset(0 0 0 "+v+"%)":"";eltxt("compare-split-value",v+"%")}
function refreshInputs(){
 const plotsList=[...new Set(ms.rows.map(x=>x.plot))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const plotsSel=$("compare-plot"),hsSel=$("hotspot-plot");
 for(const select of [plotsSel,hsSel]){if(!select)continue;select.innerHTML=plotsList.map(p=>'<option value="'+p+'">'+p+'</option>').join("");selectVal(select.id,ms.plot)}
 const dates=dateRows(ms.plot);ms.dates=dates;
 for(const id of ["compare-date-a","compare-date-b","report-date-a","report-date-b"]){const e=$(id);if(!e)continue;e.innerHTML=dates.map(d=>'<option value="'+d+'">'+dth(d)+'</option>').join("")}
 const trusted=(ms.history[ms.plot]||[]).filter(valid).map(x=>x.date).filter(d=>dates.includes(d)).sort();
 if(!ms.A||!dates.includes(ms.A))ms.A=trusted.at(-2)||dates.at(-2)||dates[0];
 if(!ms.B||!dates.includes(ms.B))ms.B=trusted.at(-1)||dates.at(-1)||dates[0];
 selectVal("compare-date-a",ms.A);selectVal("compare-date-b",ms.B);selectVal("report-date-a",ms.A);selectVal("report-date-b",ms.B);
}
function changePlot(p){if(!ms.ready||!ms.plots.some(x=>x.plot===p))return;ms.plot=p;ms.A=ms.B=null;refreshInputs();if(typeof selected!=="undefined"&&selected?.plot!==p&&typeof selectPlot==="function"&&typeof plots!=="undefined"){const row=plots.find(x=>x.plot===p);if(row)selectPlot(row,true)}redrawMap();drawHotspots();renderSummary();renderReport()}
function renderSummary(){
 const p=ms.plot,a=observation(p,ms.A),b=observation(p,ms.B),x=$("compare-summary");
 if(!x)return;
 const can=valid(a)&&valid(b),source=isVerifiedPair(p,ms.A,ms.B);
 const delta=can&&a.water_rai!=null&&b.water_rai!=null?b.water_rai-a.water_rai:null;
 const cards=[["วัน A",can?fmt(a.water_rai)+" ไร่":"ไม่ผ่าน QA"],["วัน B",can?fmt(b.water_rai)+" ไร่":"ไม่ผ่าน QA"],["น้ำเปลี่ยนสุทธิ",delta==null?"—":(delta>=0?"+":"")+fmt(delta)+" ไร่"],["น้ำใหม่",can&&source?fmt(plotInfo(p).new_water_rai)+" ไร่":"ไม่มีผลยืนยันสำหรับคู่นี้"]];
 x.innerHTML=cards.map(([k,v])=>'<div class="cmp-stat"><span>'+k+'</span><strong>'+v+'</strong></div>').join("");
 if(!can)x.innerHTML+='<p class="cmp-qa-warning">อย่างน้อยหนึ่งวันที่เลือกยังไม่ผ่าน QA — แสดงภาพได้ แต่ยังไม่สรุปการเปลี่ยนแปลงเชิงปริมาณ</p>';
}
function reportDateChange(){ms.A=$("report-date-a")?.value||ms.A;ms.B=$("report-date-b")?.value||ms.B;selectVal("compare-date-a",ms.A);selectVal("compare-date-b",ms.B);redrawMap();renderSummary();renderReport()}
function renderReport(){
 const root=$("report-paper");if(!root)return;
 const type=$("report-type")?.value;if(type!=="compare")return;
 const p=$("report-plot")?.value||ms.plot;
 if(p!==ms.plot){ms.plot=p;ms.A=null;ms.B=null;refreshInputs()}
 const a=observation(p,ms.A),b=observation(p,ms.B),can=valid(a)&&valid(b),known=isVerifiedPair(p,ms.A,ms.B),pa=plotInfo(p);
 const fpA=footprint(p,ms.A),fpB=footprint(p,ms.B);
 const msg=!a||!b?"ไม่มีผลวิเคราะห์สำหรับอย่างน้อยหนึ่งวันที่เลือก":!can?"วันหนึ่งหรือทั้งสองวันยังไม่ผ่าน QA จึงไม่สรุปผลต่างเชิงปริมาณ":"เปรียบเทียบค่าจากวัน A และ B ที่ผ่าน QA; ค่าดัชนีเป็นสถิติระดับแปลงตามแต่ละวัน ไม่ใช่การยืนยันสาเหตุจากพิกเซลเดียวกัน";
 const metrics=ms.reportMetrics;
 const val=(r,k)=>valid(r)?(k==="water"?r.water_rai:r[k]):null;
 const chosen=metrics.map(k=>{const va=val(a,k),vb=val(b,k);return '<tr><td>'+lab[k]+'</td><td>'+fmt(va)+'</td><td>'+fmt(vb)+'</td><td>'+(va==null||vb==null?"—":(vb>=va?"+":"")+fmt(vb-va))+'</td></tr>'}).join("");
 const nw=can&&known?fmt(pa.new_water_rai)+" ไร่":"ยังไม่มีค่าพื้นที่น้ำใหม่สำหรับคู่วันที่นี้";
 root.innerHTML='<div class="report-title">รายงานเปรียบเทียบภาพดาวเทียมตามวันที่เลือก</div><div class="report-sub">'+p+' • วันที่ A '+dth(ms.A)+' → วันที่ B '+dth(ms.B)+'</div><div class="report-rule"></div>'+
 '<div class="report-section"><h4>ขอบเขตและคุณภาพข้อมูล</h4><div class="report-grid"><div class="report-block"><b>วันที่ A</b><p>'+qaText(p,ms.A)+'</p></div><div class="report-block"><b>วันที่ B</b><p>'+qaText(p,ms.B)+'</p></div><div class="report-block"><b>พื้นที่น้ำใหม่</b><p>'+nw+'</p></div><div class="report-block"><b>Water Footprint</b><p>'+((fpA&&fpB)?"มีรูปทรงขอบน้ำรายวันทั้งสองวัน":"ยังไม่มี Polygon ขอบน้ำรายวันครบทั้งสองวันที่เลือก")+'</p></div></div></div>'+
 '<div class="report-section"><h4>ผลการเปรียบเทียบ</h4><p class="cmp-report-note">'+msg+'</p><div class="live-table-wrap"><table class="live-table"><thead><tr><th>รายการ</th><th>A</th><th>B</th><th>ผลต่าง B−A</th></tr></thead><tbody>'+chosen+'</tbody></table></div></div>'+
 '<div class="report-section"><h4>กราฟดัชนีตามคู่วันที่เลือก</h4><div id="cmp-report-graphs" class="cmp-report-graphs">'+metrics.map(k=>'<article><h5>'+lab[k]+'</h5><div class="cmp-report-chart"><canvas data-metric="'+k+'"></canvas></div></article>').join("")+'</div></div>'+
 '<div class="report-section"><h4>ข้อควรระวังในการตีความ</h4><p>ภาพและค่าแต่ละวันอาจได้รับอิทธิพลจากน้ำขึ้นน้ำลง เมฆ และพิกเซลที่ใช้ได้ต่างกัน สรุปความเครียดของพืชหรือน้ำขังเป็นเพียงสัญญาณเฝ้าระวัง จนกว่าจะยืนยันจากข้อมูลเพิ่มเติม</p></div>'+
 '<div class="report-footer">สร้างจาก analysis_history.json และ footprint ที่มีอยู่จริง • Verified PDF ต้นฉบับไม่ได้ถูกแก้ไข</div>';
 ms.charts.forEach(c=>{try{c.destroy()}catch(_){}});ms.charts=[];
 if(typeof Chart==="undefined")return;
 metrics.forEach(k=>{
  const canvas=root.querySelector('canvas[data-metric="'+k+'"]');if(!canvas)return;
  const values=[val(a,k),val(b,k)];
  ms.charts.push(new Chart(canvas,{type:"bar",data:{labels:[dth(ms.A),dth(ms.B)],datasets:[{label:lab[k],data:values,backgroundColor:colors[k]||"#56879b",maxBarThickness:85}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:10}}}}}}));
 });
}
function hotspots(){
 const p=ms.plot,feat=ms.newwater.find(f=>f.properties?.plot===p),info=plotInfo(p);
 const rows=(ms.history[p]||[]).filter(valid),a=rows.at(-2),b=rows.at(-1);
 const stress=!!a&&!!b&&a.ndre!=null&&b.ndre!=null&&a.ndmi!=null&&b.ndmi!=null&&(b.ndre<a.ndre)&&(b.ndmi>a.ndmi);
 return {feat,info,a,b,stress};
}
function drawHotspots(){
 const cont=$("hotspot-map");if(!cont||!ms.ready)return;
 if(!ms.hotmap){ms.hotmap=L.map(cont,{zoomControl:true,attributionControl:false});L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(ms.hotmap)}
 ms.hotLayers.forEach(l=>ms.hotmap.removeLayer(l));ms.hotLayers=[];
 const {feat,info,a,b,stress}=hotspots(),p=ms.plot;
 const boundary=ms.boundaries.get(p);
 if(boundary)ms.hotLayers.push(layerAdd(ms.hotmap,L.geoJSON(boundary,{style:{color:"#ff7265",weight:2,fill:false}})));
 if(feat)ms.hotLayers.push(layerAdd(ms.hotmap,L.geoJSON(feat,{style:{color:"#22a6d5",weight:2,fillColor:"#2fb2e5",fillOpacity:.35}})));
 const actualHotspots=ms.spatialHotspots.filter(f=>f.properties?.plot===p);
 for(const f of actualHotspots){
  const color=f.properties?.priority==="P1"?"#ed6758":f.properties?.priority==="P2"?"#e8a83c":"#e8cc67";
  ms.hotLayers.push(layerAdd(ms.hotmap,L.geoJSON(f,{style:{color,weight:2,fillColor:color,fillOpacity:.33}})));
 }
 const bnds=chooseCenter(p);if(bnds)ms.hotmap.fitBounds(bnds,{padding:[20,20],maxZoom:16});
 const content=$("hotspot-results");
 if(content){
  let html="";
  if(feat&&info){html+='<article class="monitor-event"><span class="monitor-severity">ตรวจสอบภาพก่อน</span><h4>น้ำรุกพื้นที่ใหม่</h4><p>ตรวจพบพื้นที่น้ำใหม่ '+fmt(info.new_water_rai)+' ไร่ ตามผลรอบ '+dth(String(info.baseline).replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3"))+' → '+dth(String(info.current).replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3"))+'</p><small>สีฟ้าบนแผนที่ = ขอบเขตพื้นที่น้ำใหม่ที่มี geometry อ้างอิง • ไม่ใช่การยืนยันว่าเกิดน้ำท่วมผิดปกติ</small></article>'}
  for(const f of actualHotspots){
   const p=f.properties||{};
   html+='<article class="monitor-event"><span class="monitor-severity">'+String(p.priority||"สัญญาณเฝ้าระวัง")+'</span><h4>'+String(p.event_type||p.rule||"ตรวจพบพื้นที่ผิดปกติ")+'</h4><p>วันที่ '+dth(p.date||p.date_b)+' • พื้นที่ '+fmt(p.area_rai)+' ไร่</p><small>'+String(p.reason_th||"สร้างจากผลวิเคราะห์ Raster พร้อมตรวจ QA")+'</small></article>';
  }
  if(stress){html+='<article class="monitor-event"><span class="monitor-severity">เฝ้าระวังระดับแปลง</span><h4>NDRE ลด และ NDMI เพิ่ม</h4><p>NDRE '+fmt(a.ndre)+' → '+fmt(b.ndre)+'; NDMI '+fmt(a.ndmi)+' → '+fmt(b.ndmi)+'</p><small>เป็นสัญญาณรวมระดับแปลง ยังไม่มี Raster Stress Mask ที่ระบุตำแหน่งได้ จึงไม่วาดจุดสมมติบนแผนที่</small></article>'}
  html||='<p class="cmp-qa-warning">ยังไม่พบขอบเขตน้ำใหม่หรือสัญญาณที่ผ่านเงื่อนไขสำหรับแปลงนี้จากชุดข้อมูลที่มี</p>';
  content.innerHTML=html;
 }
 setTimeout(()=>ms.hotmap.invalidateSize(),90);
}
function exportCSV(){
 const p=$("report-plot")?.value||ms.plot,a=observation(p,ms.A),b=observation(p,ms.B),keys=ms.reportMetrics;
 const safe=v=>v==null?"":String(v);
 const lines=[["plot","date_a","date_b","metric","a","b","delta","status_a","status_b"].join(",")];
 for(const k of keys){const va=valid(a)?(k==="water"?a.water_rai:a[k]):null,vb=valid(b)?(k==="water"?b.water_rai:b[k]):null;lines.push([p,ms.A,ms.B,k,safe(va),safe(vb),va!=null&&vb!=null?safe(vb-va):"",a?.analysis_status||"NOT_ANALYZED",b?.analysis_status||"NOT_ANALYZED"].join(","))}
 const file=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(file),link=document.createElement("a");link.href=url;link.download=p+"_"+ms.A+"_to_"+ms.B+"_comparison.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function updateCenter(){
 const x=$("monitoring-update-center");if(!x)return;
 const newest=ms.rows.map(r=>r.date).sort().at(-1),trusted=Object.entries(ms.history).flatMap(([p,arr])=>arr.filter(valid).map(x=>x.date)).sort().at(-1);
 x.innerHTML='<div class="card-head"><div><div class="eyebrow">DATA UPDATE CENTER</div><h3>รอบตรวจและสถานะข้อมูล</h3></div></div><div class="cmp-summary"><div class="cmp-stat"><span>ภาพล่าสุดในรายการ</span><strong>'+dth(newest)+'</strong></div><div class="cmp-stat"><span>วันที่มีผลผ่าน QA ล่าสุด</span><strong>'+dth(trusted)+'</strong></div><div class="cmp-stat"><span>รอบอัตโนมัติ</span><strong>ทุก 3 วัน + จันทร์</strong></div></div><p>ตรวจเฉพาะไฟล์ใหม่/เวอร์ชันที่เปลี่ยน • วันที่ภาพไม่ใช่เวลาที่ระบบประมวลผล • สถานะกำหนดการไม่ได้ยืนยันการรันสำเร็จ</p><button type="button" class="ghost-btn" id="update-copy-command">คัดลอกคำสั่งตรวจใหม่ด้วยตนเอง</button> <a class="ghost-btn" href="https://chatgpt.com/" target="_blank" rel="noopener">เปิด ChatGPT เพื่อสั่งตรวจ</a><p id="monitor-update-message"></p>';
 $("update-copy-command").onclick=async()=>{const prompt="ตรวจไฟล์ดาวเทียมใหม่ใน Google Drive ของ satelliteproject ตอนนี้ และประมวลผลเฉพาะ plot/date+version ที่ยังไม่เคยวิเคราะห์ ตรวจ QA แล้วจึงอัปเดตภาพ Footprints Hotspots Graph และ Report บน GitHub Pages ตรวจ deploy และแจ้งความเปลี่ยนแปลง ห้ามคำนวณซ้ำหรือสร้างข้อมูลสมมติ";try{await navigator.clipboard.writeText(prompt);eltxt("monitor-update-message","คัดลอกคำสั่งแล้ว — เปิด ChatGPT และวางคำสั่งได้เลย")}catch(_){eltxt("monitor-update-message",prompt)}};
}
function bind(){
 $("compare-plot")?.addEventListener("change",e=>changePlot(e.target.value));
 $("hotspot-plot")?.addEventListener("change",e=>changePlot(e.target.value));
 for(const [id,key] of [["compare-date-a","A"],["compare-date-b","B"]])$(id)?.addEventListener("change",e=>{ms[key]=e.target.value;selectVal("report-date-"+key.toLowerCase(),ms[key]);redrawMap();renderSummary();renderReport()});
 $("compare-layer")?.addEventListener("change",e=>{ms.layer=e.target.value;redrawMap()});
 $("compare-mode")?.addEventListener("change",e=>{ms.display=e.target.value;redrawMap()});
 $("compare-split")?.addEventListener("input",setSplit);
 for(const [id,key] of [["compare-boundary","showBoundary"],["compare-water","showWater"],["compare-newwater","showNew"],["compare-vegetation","showVegetation"],["compare-soil","showSoil"]])$(id)?.addEventListener("change",e=>{ms[key]=e.target.checked;redrawMap()});
 for(const id of ["report-date-a","report-date-b"])$(id)?.addEventListener("change",reportDateChange);
 $("report-plot")?.addEventListener("change",e=>{if(ms.ready)changePlot(e.target.value)});
 $("report-type")?.addEventListener("change",()=>{if(ms.ready&&$("report-type").value==="compare")renderReport()});
 document.querySelectorAll("[data-monitor-metric]").forEach(e=>e.addEventListener("change",()=>{
  ms.reportMetrics=[...document.querySelectorAll("[data-monitor-metric]:checked")].map(x=>x.value);
  if($("report-type")?.value==="compare")renderReport();
 }));
 $("compare-to-report")?.addEventListener("click",()=>{
  selectVal("report-plot",ms.plot);selectVal("report-date-a",ms.A);selectVal("report-date-b",ms.B);selectVal("report-type","compare");
  if(typeof switchTab==="function")switchTab("report");
  renderReport();
 });
 $("compare-export-csv")?.addEventListener("click",exportCSV);
 $("hotspot-open-compare")?.addEventListener("click",()=>{if(typeof switchTab==="function")switchTab("compare");showTab("compare")});
}
function showTab(tab){
 if(!ms.ready)return;
 if(tab==="compare"){if(!ms.maps.length)redrawMap();else setTimeout(()=>{ms.maps.forEach(m=>m.invalidateSize());redrawMap()},90)}
 if(tab==="hotspots")drawHotspots();
 if(tab==="report"&&$("report-type")?.value==="compare")renderReport();
}
async function init(){
 bind();
 try{
  const [parts,history,water,newwater,boundaries,bounds,plots,visual,landcover,spatialHotspots]=await Promise.all([json("satellite_parts.json"),json("analysis_history.json"),json("water_history.geojson"),json("new_water.geojson"),json("boundaries.geojson"),json("satellite_bounds.json"),json("plots.json"),json("visual_layers.json"),json("landcover_history.geojson").catch(()=>({features:[]})),json("monitoring_hotspots.geojson").catch(()=>({features:[]}))]);
  const files=await Promise.all(parts.parts.map(p=>json(p.file))),previews=await Promise.all(parts.parts.map((p,i)=>json("existing_display_part_"+(i+1)+".json"))),fulls=await Promise.all(parts.parts.map((p,i)=>json("full_preview_part_"+(i+1)+".json").catch(()=>({layers:[]}))));
  ms.rows=[...new Map(files.flat().map(x=>[x.id,x])).values()];
  ms.history=history.plots||{};ms.water=water.features||[];ms.newwater=newwater.features||[];ms.landcover=landcover.features||[];ms.spatialHotspots=spatialHotspots.features||[];ms.boundaries=new Map((boundaries.features||[]).map(f=>[f.properties.plot,f]));
  ms.bounds=new Map((bounds.overlays||[]).map(x=>[x.plot+"|"+x.date,x]));
  ms.plots=plots.plots||[];ms.previews=new Map(previews.flatMap(x=>Object.entries(x.files||{})));
  ms.visual=new Map((visual.layers||[]).map(x=>[x.plot+"|"+x.date+"|"+x.mode,x]));
  ms.full=new Map(fulls.flatMap(x=>x.layers||[]).map(x=>[x.plot+"|"+x.date+"|"+(x.mode==="false_color"?"false":x.mode==="true_color"?"true":x.mode),x]));
  const urlPlot=new URLSearchParams(location.search).get("plot");
  const selectedPlot=typeof selected!=="undefined"&&selected?.plot?selected.plot:null;
  ms.plot=ms.plots.some(p=>p.plot===selectedPlot)?selectedPlot:ms.plots.some(p=>p.plot===urlPlot)?urlPlot:ms.plots.some(p=>p.plot==="13-STC")?"13-STC":ms.plots[0]?.plot;
  ms.ready=true;
  refreshInputs();updateCenter();renderSummary();redrawMap();
  eltxt("compare-loading",ms.rows.length+" ไฟล์ • "+ms.water.length+" ขอบน้ำรายวัน • "+ms.newwater.length+" พื้นที่น้ำใหม่ (รอบ Verified)");
  if($("report-type")?.value==="compare")renderReport();
 }catch(e){log(e);eltxt("compare-loading","โหลดข้อมูลเปรียบเทียบไม่สำเร็จ: "+e.message)}
}
window.MonitoringStudio={showTab,renderReport,onPlotChange:p=>{if(p&&ms.ready&&p.plot!==ms.plot)changePlot(p.plot)},setComparison:(a,b,p)=>{if(p&&p!==ms.plot)changePlot(p);if(a)ms.A=a;if(b)ms.B=b;refreshInputs();redrawMap();renderSummary();renderReport()}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();