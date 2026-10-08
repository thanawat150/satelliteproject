/* Data-driven Alert Center for office monitoring. Map markers identify whole plots, not inferred hotspots. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const e=s=>String(s==null?"":s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmt=n=>n==null||!Number.isFinite(Number(n))?"—":Number(n).toLocaleString("th-TH",{maximumFractionDigits:2});
const date=s=>s?s.split("-").reverse().join("/"):"—";
let state={alerts:[],plots:[],history:{},images:[],map:null,layer:null,loaded:false,fetching:null};
const rank={P1:1,P2:2,P3:3};
async function fetchJSON(n){const r=await fetch("data/"+n,{cache:"no-store"});if(!r.ok)throw Error(n+" HTTP "+r.status);return r.json()}
async function reload(){
 if(state.fetching)return state.fetching;
 state.fetching=(async()=>{
  const [h,p,meta]=await Promise.all([fetchJSON("analysis_history.json"),fetchJSON("plots.json"),fetchJSON("satellite_parts.json")]);
  const blocks=await Promise.all(meta.parts.map(x=>fetchJSON(x.file)));
  state.history=h.plots||{};state.plots=p.plots||[];
  state.images=[...new Map(blocks.flat().filter(x=>x.id&&x.plot&&x.date).map(x=>[x.id,x])).values()];
  if(!window.MonitoringAlerts?.build)throw Error("Alert Engine ยังไม่พร้อม");
  state.alerts=window.MonitoringAlerts.build({history:state.history,plots:state.plots,images:state.images});
  state.loaded=true;
  const plotSel=$("alert-plot"),prior=plotSel?.value||"ALL";
  if(plotSel){plotSel.innerHTML='<option value="ALL">ทุกแปลง</option>'+state.plots.map(x=>'<option value="'+e(x.plot)+'">'+e(x.plot)+'</option>').join("");if(state.plots.some(x=>x.plot===prior))plotSel.value=prior}
  const counts={P1:0,P2:0,P3:0};state.alerts.forEach(a=>counts[a.priority]++);
  const uniquePlots=new Set(state.alerts.map(x=>x.plot));
  const kpis=$("alert-kpis");
  if(kpis)kpis.innerHTML=[["จำนวนแปลงที่มีสัญญาณ",uniquePlots.size],["P1 ตรวจภาพก่อน",counts.P1],["P2 เฝ้าระวัง",counts.P2],["P3 คุณภาพข้อมูล",counts.P3]].map(([label,v])=>'<div><strong>'+v+'</strong><span>'+label+'</span></div>').join("");
  const nav=$("nav-alert-count");if(nav)nav.textContent=uniquePlots.size?" ("+uniquePlots.size+" แปลง)":"";
  const strip=$("overview-alert-strip");
  if(strip)strip.innerHTML='<strong>Monitoring Alerts • '+uniquePlots.size+' แปลงน่าตรวจภาพ</strong> <span>P1 '+counts.P1+' รายการ • P2 '+counts.P2+' รายการ • P3 '+counts.P3+' รายการ</span> <button type="button" id="overview-alert-open" class="ghost-btn">ดู Alert Center</button><small>ข้อมูลจากวันที่ถ่ายดาวเทียมและผลวิเคราะห์ที่ผ่าน QA ไม่ใช่เหตุการณ์ที่เกิดขึ้นวันนี้</small>';
  $("overview-alert-open")?.addEventListener("click",()=>{if(typeof switchTab==="function")switchTab("alerts")});
  if($("alert-status"))$("alert-status").textContent="สร้างจากประวัติผลวิเคราะห์ที่มีจริง • "+state.alerts.length+" รายการ จาก "+uniquePlots.size+" แปลง • เกณฑ์จัดอันดับเบื้องต้น: P1 น้ำเพิ่มสุทธิ ≥20 ไร่ หรือ ≥10% ของแปลง; P2 สัญญาณน้ำ/พืช; P3 ภาพใหม่ที่ยังไม่ผ่าน QA";
  show();
 })().catch(err=>{$("alert-status")&&($("alert-status").textContent="โหลด Alerts ไม่สำเร็จ: "+err.message);console.warn(err)}).finally(()=>{state.fetching=null});
 return state.fetching;
}
function selected(){
 const priority=$("alert-priority")?.value||"ALL",type=$("alert-type")?.value||"ALL",plot=$("alert-plot")?.value||"ALL";
 return state.alerts.filter(x=>(priority==="ALL"||x.priority===priority)&&(type==="ALL"||x.type===type)&&(plot==="ALL"||x.plot===plot));
}
function renderList(arr){
 const el=$("alert-list");if(!el)return;
 if(!arr.length){el.innerHTML='<div class="alert-empty">ไม่พบการแจ้งเตือนตามตัวกรองนี้ (ไม่ได้หมายความว่าทุกแปลงปกติ)</div>';return}
 el.innerHTML=arr.map(a=>
  '<article class="alert-item"><div class="alert-item-top"><span class="alert-priority '+a.priority.toLowerCase()+'">'+a.priority+'</span><b>'+e(a.plot)+'</b><small>ภาพ '+date(a.date)+'</small></div>'+
  '<h4>'+e(a.title)+'</h4><p>'+e(a.detail)+'</p><small>'+e(a.note||"")+'</small>'+
  '<div class="alert-actions"><button type="button" class="ghost-btn" data-alert-action="compare" data-alert-id="'+e(a.id)+'">เปิด Compare</button>'+
  '<button type="button" class="ghost-btn" data-alert-action="report" data-alert-id="'+e(a.id)+'">เปิด Report</button></div></article>').join("");
}
function drawMap(arr){
 const root=$("alert-map");if(!root||!document.getElementById("tab-alerts")?.classList.contains("active")||typeof L==="undefined")return;
 if(!state.map){
  state.map=L.map(root,{zoomControl:true,attributionControl:false,preferCanvas:true});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(state.map);
 }
 if(state.layer)state.map.removeLayer(state.layer);
 state.layer=L.featureGroup();
 const top=new Map();
 for(const a of arr){const v=top.get(a.plot);if(!v||rank[a.priority]<rank[v.priority])top.set(a.plot,a)}
 for(const p of state.plots){
  const alert=top.get(p.plot);if(!alert||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))continue;
  const fill=alert.priority==="P1"?"#dc5b50":alert.priority==="P2"?"#e0a13a":"#819ba7";
  // Marker = location of the entire verified plot, not a pixel-level anomaly.
  const point=L.circleMarker([p.lat,p.lon],{radius:8,color:"#fff",weight:2,fillColor:fill,fillOpacity:.95});
  point.bindPopup('<b>'+e(p.plot)+' • '+e(alert.priority)+'</b><p>'+e(alert.title)+'</p><small>หมุดนี้ใช้แสดงตำแหน่งแปลง ไม่ใช่พิกัด Hotspot</small>');
  point.on("click",()=>{const sel=$("alert-plot");if(sel){sel.value=p.plot;show()}});
  state.layer.addLayer(point);
 }
 state.layer.addTo(state.map);
 if(state.layer.getLayers().length){const bounds=state.layer.getBounds();state.map.fitBounds(bounds.pad(.14),{maxZoom:12,animate:false})}
 else state.map.setView([12.7,101.7],10);
 setTimeout(()=>state.map?.invalidateSize({pan:false}),80);
}
function show(){
 if(!state.loaded)return;
 const arr=selected();renderList(arr);drawMap(arr);
}
function openAlert(id,type){
 const a=state.alerts.find(x=>x.id===id);if(!a)return;
 const p=state.plots.find(x=>x.plot===a.plot);
 if(p&&typeof selectPlot==="function")selectPlot(p,false);
 if(type==="compare"){
  window.MonitoringStudio?.setComparison?.(a.dateA,a.dateB,a.plot);
  if(typeof switchTab==="function")switchTab("compare");
 }else{
  const sel=$("report-plot");if(sel)sel.value=a.plot;
  if(typeof switchTab==="function")switchTab("report");
  if(typeof renderReportPreview==="function")renderReportPreview();
 }
}
function csv(){
 const arr=selected(),headers=["plot","image_date","date_a","date_b","priority","type","title","detail","confidence","note","valid_pct","new_water_rai","change_water_rai","delta_ndre","delta_ndmi"];
 const escCsv=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const rows=[headers.join(","),...arr.map(a=>headers.map(k=>escCsv(a[k]??a.evidence?.[k])).join(","))];
 const blob=new Blob(["\ufeff"+rows.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="Rayong_Monitoring_Alerts.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function bind(){
 for(const id of ["alert-priority","alert-type","alert-plot"])$(id)?.addEventListener("change",show);
 $("alert-reload")?.addEventListener("click",reload);
 $("alert-export")?.addEventListener("click",csv);
 $("alert-list")?.addEventListener("click",evt=>{
  const btn=evt.target.closest("[data-alert-action]");if(btn)openAlert(btn.dataset.alertId,btn.dataset.alertAction)
 });
}
window.AlertCenter={load:reload,show:()=>{if(state.loaded)show();else reload()},alerts:()=>state.alerts.slice()};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{bind();reload()},{once:true});else{bind();reload()}
})();
