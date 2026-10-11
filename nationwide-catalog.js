/* Nationwide source-driven, unmasked satellite imagery catalog.
   Plot boundaries are used ONLY as vector context; raw display frames are never clipped. */
(function(){
"use strict";
const PARTS=["catalog_2020.json","catalog_2021.json","catalog_2022.json","catalog_2023.json","catalog_2024.json","catalog_2025.json","catalog_2026.json","catalog_reference.json"];
let records=[],scope=[],geo=null,results=null,batchStatus=null,map=null,pddLayer=null,chart=null,ready=false,loading=null,visible=36;
let selection={plot:"13-STC",province:"ALL",search:"",years:new Set(["2026"]),sensors:new Set(["S2","S1","L89","FCD","DEM"]),kinds:new Set(["annual","ytd","latest","reference"]),onePerYear:false};
const $=id=>document.getElementById(id);
const escapeHTML=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const locale=n=>Number(n||0).toLocaleString("th-TH");
function src(r){return "https://drive.google.com/file/d/"+encodeURIComponent(r.id)+"/view"}
function thumb(r){return "https://drive.google.com/thumbnail?id="+encodeURIComponent(r.id)+"&sz=w1600"}
function kindName(k){return ({annual:"Annual Median",ytd:"YTD Composite",latest:"ภาพล่าสุดตาม PDD",reference:"FCD / DEM Reference"})[k]||k}
function imageRows(part){
 const yr=String(part.year);
 return (part.files||[]).map(x=>{
  const kind=x[5]||"annual",sensor=x[1],match=(x[2]||"").match(/20[0-9]{2}-[0-9]{2}-[0-9]{2}/);
  return {plot:x[0],sensor,title:x[2],id:x[3],size:x[4],kind,variant:x[6]||"",year:sensor==="FCD"?"2022":yr,date:match?match[0]:null,source:part.type||kind}
 });
}
async function init(){
 if(ready)return;
 if(loading)return loading;
 loading=(async()=>{
  const st=$("national-status");if(st)st.textContent="กำลังอ่านรายการ GeoTIFF ในคลังกลาง...";
  const fetched=await Promise.allSettled(PARTS.map(p=>fetch("data/nationwide/"+p,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(p+" HTTP "+r.status);return r.json()})));
  records=fetched.filter(x=>x.status==="fulfilled").flatMap(x=>imageRows(x.value));
  if(!records.length)throw Error("ไม่มีข้อมูลไฟล์จากคลังกลาง");
  const [s,g,b,z]=await Promise.allSettled([
    fetch("data/nationwide/pdd_scope_136.json").then(r=>r.json()),
    fetch("data/nationwide/boundaries_pdd_136.geojson").then(r=>r.json()),
    fetch("data/nationwide/nationwide_results.json").then(r=>r.ok?r.json():fetch("data/nationwide/batch_01_results.json").then(x=>x.json())),
    fetch("data/nationwide/batch_status.json").then(r=>r.json())
  ]);
  scope=s.status==="fulfilled"?s.value.plots||[]:[];
  geo=g.status==="fulfilled"?g.value:null;
  results=b.status==="fulfilled"?b.value:null;
  batchStatus=z.status==="fulfilled"?z.value:null;
  let p=new URLSearchParams(location.search).get("plot");
  if(p&&scope.some(x=>x.code===p))selection.plot=p;
  bind();
  renderFilters();
  render();
  ready=true;
  if(st)st.textContent="เชื่อม "+locale(records.length)+" ไฟล์จาก Google Drive • "+locale(new Set(records.map(x=>x.plot)).size)+" แปลง • แสดงไฟล์ TIFF โดยไม่ตัดภาพ";
  if(fetched.some(x=>x.status!=="fulfilled"))st.textContent+=" • ⚠ บางชุดข้อมูลโหลดไม่สำเร็จ";
 })().catch(e=>{$("national-status").textContent="โหลดคลังภาพไม่สำเร็จ: "+e.message;loading=null;throw e});
 return loading;
}
function bind(){
 $("national-plot").addEventListener("change",e=>{selection.plot=e.target.value;visible=36;syncQuery();render()});
 $("national-province").addEventListener("change",e=>{selection.province=e.target.value;visible=36;renderFilters();render()});
 $("national-search").addEventListener("input",e=>{selection.search=e.target.value.trim().toLowerCase();visible=36;render()});
 $("national-year-checks").addEventListener("change",e=>{if(e.target.matches("[data-year]")){e.target.checked?selection.years.add(e.target.value):selection.years.delete(e.target.value);visible=36;render()}});
 $("national-sensor-checks").addEventListener("change",e=>{if(e.target.matches("[data-sensor]")){e.target.checked?selection.sensors.add(e.target.value):selection.sensors.delete(e.target.value);visible=36;render()}});
 $("national-kind-checks").addEventListener("change",e=>{if(e.target.matches("[data-kind]")){e.target.checked?selection.kinds.add(e.target.value):selection.kinds.delete(e.target.value);visible=36;render()}});
 $("national-one-year").addEventListener("change",e=>{selection.onePerYear=e.target.checked;visible=36;render()});
 $("national-reset").addEventListener("click",()=>{selection.years=new Set(["2026"]);selection.sensors=new Set(["S2","S1","L89","FCD","DEM"]);selection.kinds=new Set(["annual","ytd","latest","reference"]);selection.onePerYear=false;selection.search="";selection.province="ALL";visible=36;renderFilters();render()});
 $("national-more").addEventListener("click",()=>{visible+=36;renderGallery()});
 $("national-preview-close").addEventListener("click",closeModal);
 $("national-preview").addEventListener("click",e=>{if(e.target.id==="national-preview")closeModal()});
 $("national-gallery").addEventListener("click",e=>{const hit=e.target.closest("[data-file]");if(hit)openModal(hit.dataset.file)});
 $("national-all-years").addEventListener("click",()=>{selection.years=new Set(["2020","2021","2022","2023","2024","2025","2026"]);renderFilters();render()});
}
function syncQuery(){const url=new URL(location.href);url.searchParams.set("tab","nationwide");url.searchParams.set("plot",selection.plot);history.replaceState({},"",url)}
function renderFilters(){
 const avail=scope.filter(x=>selection.province==="ALL"||x.province===selection.province).sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
 const pv=$("national-province");const provinces=[...new Set(scope.map(x=>x.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));pv.innerHTML='<option value="ALL">ทุกจังหวัด</option>'+provinces.map(v=>'<option value="'+escapeHTML(v)+'">'+escapeHTML(v)+'</option>').join("");pv.value=selection.province;
 const sl=$("national-plot"),old=selection.plot;
 sl.innerHTML='<option value="ALL">ทุกแปลง (โหลดทีละหน้า)</option>'+avail.map(x=>'<option value="'+escapeHTML(x.code)+'">'+escapeHTML(x.code)+' — '+escapeHTML(x.province)+'</option>').join("");
 if(avail.some(x=>x.code===old)||old==="ALL")sl.value=old;else{selection.plot="ALL";sl.value="ALL"}
 $("national-search").value=selection.search;
 $("national-year-checks").innerHTML=["2020","2021","2022","2023","2024","2025","2026"].map(y=>'<label><input type="checkbox" data-year value="'+y+'"'+(selection.years.has(y)?" checked":"")+'> '+y+'</label>').join("");
 $("national-sensor-checks").innerHTML=[["S2","Sentinel-2"],["S1","Sentinel-1"],["L89","Landsat 8/9"],["FCD","FCD"],["DEM","DEM"]].map(x=>'<label><input type="checkbox" data-sensor value="'+x[0]+'"'+(selection.sensors.has(x[0])?" checked":"")+'> '+x[1]+'</label>').join("");
 $("national-kind-checks").innerHTML=[["annual","Annual Median"],["ytd","YTD"],["latest","Latest"],["reference","FCD / DEM"]].map(x=>'<label><input type="checkbox" data-kind value="'+x[0]+'"'+(selection.kinds.has(x[0])?" checked":"")+'> '+x[1]+'</label>').join("");
 $("national-one-year").checked=selection.onePerYear;
}
function filtered(){
 let rows=records.filter(r=>(selection.plot==="ALL"||r.plot===selection.plot)&&(selection.province==="ALL"||scope.some(x=>x.code===r.plot&&x.province===selection.province))&&selection.years.has(r.year)&&selection.sensors.has(r.sensor)&&selection.kinds.has(r.kind)&&(!selection.search||((r.plot+" "+r.title).toLowerCase().includes(selection.search))));
 rows.sort((a,b)=>b.year.localeCompare(a.year)||(b.date||"").localeCompare(a.date||"")||a.plot.localeCompare(b.plot,undefined,{numeric:true})||a.sensor.localeCompare(b.sensor));
 if(selection.onePerYear){
  const choose=new Map(),quality=r=>(r.sensor==="S2"?0:r.sensor==="L89"?1:r.sensor==="S1"?2:3)*10+(r.kind==="annual"?0:r.kind==="ytd"?1:r.kind==="latest"?2:3);
  rows.forEach(r=>{let key=r.plot+"|"+r.year;let old=choose.get(key);if(!old||quality(r)<quality(old))choose.set(key,r)});
  rows=[...choose.values()].sort((a,b)=>b.year.localeCompare(a.year)||a.plot.localeCompare(b.plot,undefined,{numeric:true}));
 }
 return rows;
}
function render(){renderGallery();renderMap();renderMetrics()}
function renderGallery(){
 let rows=filtered();$("national-total").textContent=locale(rows.length);$("national-plots-count").textContent=locale(new Set(rows.map(r=>r.plot)).size);
 $("national-years-count").textContent=locale(new Set(rows.map(r=>r.year)).size);
 $("national-preview-note").textContent="แสดงภาพเต็มจาก TIFF ที่เก็บใน Drive โดยขอ Thumbnail จาก Google; หากไฟล์ไม่มี Preview ให้เปิดต้นฉบับใน Drive • ไม่มีการตัดภาพตาม PDD";
 const host=$("national-gallery");host.innerHTML=rows.slice(0,visible).map(r=>{
   const quality=r.variant==="scl"?"SCL QA mask":kindName(r.kind);
   return '<article class="nat-image-card" data-file="'+escapeHTML(r.id)+'"><div class="nat-image-frame"><img loading="lazy" referrerpolicy="no-referrer" alt="'+escapeHTML(r.plot+" "+r.title)+'" src="'+thumb(r)+'" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="nat-image-failed" hidden>ไม่มีภาพ Preview จาก Drive<br><small>คลิกเพื่อเปิดไฟล์ TIFF ต้นฉบับ</small></div></div><div class="nat-image-meta"><strong>'+escapeHTML(r.plot)+'</strong><span>'+escapeHTML(r.sensor)+'</span></div><p>'+escapeHTML(r.year+" • "+(r.date||kindName(r.kind))+" • "+quality)+'</p><small title="'+escapeHTML(r.title)+'">'+escapeHTML(r.title)+'</small><a href="'+src(r)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">เปิด GeoTIFF ต้นฉบับ ↗</a></article>';
 }).join("");
 if(!rows.length)host.innerHTML='<p class="nat-no-data">ไม่มีไฟล์ที่ตรงกับตัวกรองนี้ ลองเพิ่มปีหรือเซนเซอร์</p>';
 $("national-more").hidden=rows.length<=visible;
 $("national-visible").textContent="กำลังแสดง "+locale(Math.min(rows.length,visible))+" จาก "+locale(rows.length)+" ไฟล์";
}
function openModal(id){
 const r=records.find(x=>x.id===id);if(!r)return;
 const m=$("national-preview");m.hidden=false;m.classList.add("open");
 $("national-modal-title").textContent=r.plot+" • "+r.sensor+" • "+r.year;
 $("national-modal-details").textContent=r.title+" • "+kindName(r.kind)+" • ภาพเต็มไม่ตัดตาม PDD";
 $("national-original").href=src(r);
 const im=$("national-modal-img"),fallback=$("national-modal-fallback");
 im.hidden=false;fallback.hidden=true;const embedded=$("national-modal-drive-frame");if(embedded)embedded.src="about:blank";im.onerror=()=>{im.hidden=true;fallback.hidden=false;if(embedded)embedded.src="https://drive.google.com/file/d/"+encodeURIComponent(r.id)+"/preview"};im.src=thumb(r);
}
function closeModal(){const m=$("national-preview");m.hidden=true;m.classList.remove("open");$("national-modal-img").removeAttribute("src");const d=$("national-modal-drive-frame");if(d)d.src="about:blank"}
function renderMap(){
 if(!geo||!window.L)return;
 if(!map){map=L.map("national-boundary-map",{zoomControl:true,scrollWheelZoom:false}).setView([11,101.5],6);
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagery: Esri"}).addTo(map)}
 if(pddLayer){map.removeLayer(pddLayer);pddLayer=null}
 let features=geo.features||[],p=selection.plot;
 features=features.filter(f=>p==="ALL"?(selection.province==="ALL"||f.properties?.province===selection.province):f.properties?.plot===p);
 if(features.length){pddLayer=L.geoJSON({type:"FeatureCollection",features},{style:{color:"#ff6960",weight:2.5,fillOpacity:.08},onEachFeature:(f,l)=>l.bindPopup(escapeHTML(f.properties.plot)+" • "+escapeHTML(f.properties.province)+" • PDD MultiPolygon")}).addTo(map);map.fitBounds(pddLayer.getBounds(),{padding:[25,25],maxZoom:p==="ALL"?9:15})}
 setTimeout(()=>map.invalidateSize(),200);
}
function renderMetrics(){
 let code=selection.plot,info=scope.find(x=>x.code===code);let host=$("national-analysis");
 if(!info||code==="ALL"){host.innerHTML="<strong>เลือกแปลงเพื่อดูผลวิเคราะห์</strong><p>การแสดงไฟล์ภาพไม่เท่ากับการคำนวณดัชนี กรุณาเลือกแปลง PDD ก่อน</p>";return}
 const one=(results?.scenes||[]).filter(x=>x.plot===code).sort((a,b)=>a.date.localeCompare(b.date));
 const ch=(results?.changes||[]).filter(x=>x.plot===code);
 const top='<strong>'+escapeHTML(code)+' • '+escapeHTML(info.province)+'</strong><p>ขอบเขต PDD: '+escapeHTML(info.source)+' • '+escapeHTML(info.geometry_parts)+' Polygon</p>';
 if(!one.length){host.innerHTML=top+'<p class="nat-qa-pending">ยังไม่มีค่าดัชนีจาก TIFF ผ่านกระบวนการ QA สำหรับแปลงนี้ใน Batch ที่เผยแพร่ • แสดงภาพต้นฉบับได้ แต่ไม่สร้างค่า NDVI/BSI หรือน้ำขึ้นมาแทน</p>';return}
 const indices=["ndvi","ndre","ndmi","mndwi","bsi","savi","evi","water_rai","vegetation_rai","bare_soil_rai"];
 let table='<div class="nat-report-scroll"><table class="nat-report-table"><thead><tr><th>ตัวชี้วัด</th>'+one.map(x=>'<th>'+escapeHTML(x.date)+'</th>').join("")+'</tr></thead><tbody>';
 table+=indices.map(k=>'<tr><th>'+k.toUpperCase()+'</th>'+one.map(x=>'<td>'+(Number.isFinite(x[k])?Number(x[k]).toFixed(4):"—")+'</td>').join("")+'</tr>').join("");
 table+='</tbody></table></div>';
 let statuses='<p>สถานะ QA: '+one.map(x=>escapeHTML(x.date)+" = "+escapeHTML(x.status)+" ("+Number(x.qa_valid_pct||0).toFixed(1)+"%)").join(" • ")+'</p>';
 let changes=ch.map(x=>'<p>เปลี่ยนแปลง '+escapeHTML(x.date_a)+" → "+escapeHTML(x.date_b)+" • น้ำใหม่ "+Number(x.water_new_rai||0).toFixed(2)+" ไร่ • น้ำลด "+Number(x.water_lost_rai||0).toFixed(2)+" ไร่ (common valid pixels)</p>").join("");
 host.innerHTML=top+statuses+table+changes+'<small>ข้อมูลตัวเลขจาก Batch ที่ผ่าน QA เท่านั้น ไม่ได้อนุมานจาก Thumbnail หรือจากภาพ Annual Median</small>';
}
function show(){init().then(()=>{if(map)setTimeout(()=>map.invalidateSize(),100)}).catch(e=>console.error("Nationwide catalog",e))}
window.NationwideCatalog={show,init,stats:()=>({files:records.length,plots:new Set(records.map(r=>r.plot)).size})};
if(new URLSearchParams(location.search).get("tab")==="nationwide")document.addEventListener("DOMContentLoaded",show,{once:true});
})();