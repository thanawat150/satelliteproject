/* Live Report Trends — reads append-only analysis_history.json. */
(function(){
"use strict";
let history=null,waterFC=null,loading=null,charts=[],miniMap=null,miniLayers=[];
const fmt=n=>n==null||Number.isNaN(Number(n))?"—":Number(n).toLocaleString("th-TH",{maximumFractionDigits:2});
const dth=d=>{if(!d)return"—";const [y,m,dd]=d.split("-");return `${dd}/${m}/${y}`};
const trusted=x=>x&&["VERIFIED","AUTO_VALID"].includes(x.analysis_status)&&(x.valid_pct==null||x.valid_pct>=70);
async function load(){
 if(history)return history;
 if(loading)return loading;
 loading=Promise.all([
   fetch("data/analysis_history.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("analysis_history HTTP "+r.status);return r.json()}),
   fetch("data/water_history.geojson",{cache:"no-store"}).then(r=>r.ok?r.json():({type:"FeatureCollection",features:[]})).catch(()=>({type:"FeatureCollection",features:[]}))
 ]).then(([h,w])=>{history=h;waterFC=w;return h});
 return loading;
}
function rows(plot){return [...(history?.plots?.[plot]||[])].sort((a,b)=>a.date.localeCompare(b.date))}
function latestTrusted(plot){return rows(plot).filter(trusted).at(-1)||null}
function previousTrusted(plot){const a=rows(plot).filter(trusted);return a.length>1?a.at(-2):null}
function liveSnapshot(plot){
 const cur=latestTrusted(plot),prev=previousTrusted(plot);
 if(!cur)return null;
 return {current:cur,previous:prev,observations:rows(plot).length};
}
function destroyCharts(){charts.forEach(c=>{try{c.destroy()}catch(_){}});charts=[]}
function commonOpts(yLabel){
 return {responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{color:"#53697a",boxWidth:10,font:{size:9}}},tooltip:{mode:"index",intersect:false}},scales:{x:{ticks:{color:"#6b7d8a",maxRotation:0,font:{size:9}},grid:{display:false}},y:{title:{display:!!yLabel,text:yLabel,color:"#657887",font:{size:9}},ticks:{color:"#6b7d8a",font:{size:9}},grid:{color:"rgba(50,70,85,.10)"}}}};
}
function makeChart(el,type,labels,datasets,yLabel){
 if(!el)return null;const c=new Chart(el,{type,data:{labels,datasets},options:commonOpts(yLabel)});charts.push(c);return c;
}
function decorateReport(plot,paper){
 const snap=liveSnapshot(plot);if(!snap)return;
 const {current:cur,previous:prev}=snap;
 const sub=paper.querySelector(".report-sub");
 if(sub)sub.textContent=`${plot} • จังหวัดระยอง • Sentinel-2 L2A • ล่าสุดที่ผ่าน QA ${dth(cur.date)} • อัปเดตอัตโนมัติจากประวัติการวิเคราะห์`;
 const k=paper.querySelectorAll(".report-kpi strong");
 if(k[1])k[1].textContent=cur.water_pct==null?"—":fmt(cur.water_pct)+"%";
 if(k[2]&&prev&&cur.water_rai!=null&&prev.water_rai!=null)k[2].textContent=(cur.water_rai-prev.water_rai>=0?"+":"")+fmt(cur.water_rai-prev.water_rai)+" ไร่";
 const blocks=paper.querySelectorAll(".report-block");
 if(blocks[0])blocks[0].innerHTML=`<b>MNDWI (ดัชนีน้ำเปิด)</b><p>วันที่ล่าสุดที่ผ่าน QA: ${dth(cur.date)}<br>พื้นที่น้ำ ${fmt(cur.water_rai)} ไร่ (${fmt(cur.water_pct)}%)${prev?`<br>ก่อนหน้า ${dth(prev.date)}: ${fmt(prev.water_rai)} ไร่ (${fmt(prev.water_pct)}%)`:""}</p>`;
 if(blocks[1])blocks[1].innerHTML=`<b>NDVI (ความเขียวพืช)</b><p>${prev?fmt(prev.ndvi)+" → ":""}${fmt(cur.ndvi)}</p>`;
 if(blocks[2])blocks[2].innerHTML=`<b>NDRE (สภาพใบพืช)</b><p>${prev?fmt(prev.ndre)+" → ":""}${fmt(cur.ndre)}</p>`;
 if(blocks[3])blocks[3].innerHTML=`<b>NDMI (ความชื้นพืช/พื้นที่)</b><p>${prev?fmt(prev.ndmi)+" → ":""}${fmt(cur.ndmi)}</p>`;
}
function renderCharts(plot,root){
 destroyCharts();
 const all=rows(plot),labels=all.map(x=>dth(x.date));
 const verifiedWater=all.map(x=>trusted(x)?x.water_rai:null);
 const partialWater=all.map(x=>x.analysis_status==="PARTIAL"?x.observed_water_rai:null);
 makeChart(root.querySelector('[data-chart="water"]'),"line",labels,[
  {label:"พื้นที่น้ำที่ผ่าน QA (ไร่)",data:verifiedWater,borderColor:"#1688bd",backgroundColor:"rgba(22,136,189,.12)",pointRadius:3,tension:.25,spanGaps:false},
  {label:"น้ำที่ตรวจพบในพื้นที่ข้อมูลบางส่วน",data:partialWater,borderColor:"#d98b27",backgroundColor:"rgba(217,139,39,.12)",borderDash:[5,4],pointRadius:4,tension:.2,spanGaps:false}
 ],"ไร่");
 const changes=all.map((x,i)=>{if(i===0||!trusted(x))return null;const prev=[...all.slice(0,i)].reverse().find(trusted);return prev&&x.water_rai!=null&&prev.water_rai!=null?+(x.water_rai-prev.water_rai).toFixed(2):null});
 makeChart(root.querySelector('[data-chart="water-change"]'),"bar",labels,[{label:"น้ำเพิ่ม/ลดจากรอบก่อน (ไร่)",data:changes,backgroundColor:changes.map(v=>v==null?"rgba(120,130,140,.25)":v>=0?"rgba(43,151,196,.65)":"rgba(219,111,83,.65)"),borderWidth:0}],"ไร่");
 makeChart(root.querySelector('[data-chart="vegetation"]'),"line",labels,[
  {label:"NDVI (ความเขียวพืช)",data:all.map(x=>trusted(x)?x.ndvi:null),borderColor:"#4b9253",pointRadius:3,tension:.25},
  {label:"NDRE (สภาพใบพืช)",data:all.map(x=>trusted(x)?x.ndre:null),borderColor:"#7c6dad",pointRadius:3,tension:.25}
 ],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="moisture"]'),"line",labels,[
  {label:"NDMI (ความชื้นพืช/พื้นที่)",data:all.map(x=>trusted(x)?x.ndmi:null),borderColor:"#398aa3",pointRadius:3,tension:.25},
  {label:"MNDWI (น้ำเปิด)",data:all.map(x=>trusted(x)?x.mndwi:null),borderColor:"#2a64a0",pointRadius:3,tension:.25}
 ],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="qa"]'),"bar",labels,[{label:"พื้นที่ข้อมูลที่ใช้ได้ (%)",data:all.map(x=>x.valid_pct),backgroundColor:all.map(x=>x.valid_pct>=70?"rgba(46,144,93,.62)":x.valid_pct>=20?"rgba(218,145,43,.65)":"rgba(161,84,84,.55)"),borderWidth:0}],"%");
}
function tableRows(plot){
 return rows(plot).map(x=>{
   const change=x.change_water_rai!=null?x.change_water_rai:null;
   const status=x.analysis_status==="VERIFIED"?"Verified":x.analysis_status==="AUTO_VALID"?"Auto QA ผ่าน":x.analysis_status==="PARTIAL"?"ข้อมูลบางส่วน":"ไม่ใช้วิเคราะห์";
   const water=x.water_rai!=null?fmt(x.water_rai):(x.observed_water_rai!=null?fmt(x.observed_water_rai)+"*":"—");
   return `<tr><td>${dth(x.date)}</td><td><span class="live-status live-${x.analysis_status.toLowerCase()}">${status}</span></td><td>${fmt(x.valid_pct)}%</td><td>${water}</td><td>${x.water_pct==null?"—":fmt(x.water_pct)+"%"}</td><td>${change==null?"—":(change>=0?"+":"")+fmt(change)}</td><td>${fmt(x.ndvi)}</td><td>${fmt(x.ndre)}</td><td>${fmt(x.ndmi)}</td><td>${fmt(x.mndwi)}</td><td>${fmt(x.bsi)}</td></tr>`;
 }).join("");
}
function summarize(plot){
 const cur=latestTrusted(plot),prev=previousTrusted(plot),all=rows(plot),partial=all.filter(x=>x.analysis_status==="PARTIAL").at(-1),nodata=all.filter(x=>x.analysis_status==="NO_DATA").at(-1);
 if(!cur)return"ยังไม่มีวันที่ผ่าน QA สำหรับใช้เป็นค่าปัจจุบัน";
 let s=`ค่าปัจจุบันของรายงานเลือกจากวันที่ล่าสุดที่ผ่าน QA คือ ${dth(cur.date)}.`;
 if(prev&&cur.water_rai!=null&&prev.water_rai!=null){const d=cur.water_rai-prev.water_rai;s+=` พื้นที่น้ำ${d>=0?"เพิ่ม":"ลด"} ${fmt(Math.abs(d))} ไร่ จาก ${fmt(prev.water_rai)} เป็น ${fmt(cur.water_rai)} ไร่.`}
 if(partial&&partial.date>cur.date)s+=` มีภาพใหม่วันที่ ${dth(partial.date)} แต่ใช้ได้ ${fmt(partial.valid_pct)}% จึงแสดงใน QA เท่านั้นและยังไม่แทน Current.`;
 if(nodata&&nodata.date>cur.date)s+=` วันที่ ${dth(nodata.date)} มีข้อมูลไม่เพียงพอและถูกตัดออกจากการสรุปแนวโน้ม.`;
 return s;
}
function waterFeatures(plot){return (waterFC?.features||[]).filter(f=>f.properties?.plot===plot).sort((a,b)=>a.properties.date.localeCompare(b.properties.date))}
function clearMini(){if(miniMap){miniMap.remove();miniMap=null}miniLayers=[]}
function renderWaterMap(plot,root){
 clearMini();
 const fs=waterFeatures(plot),wrap=root.querySelector(".live-water-map-wrap");
 if(!fs.length){wrap.innerHTML='<div class="live-empty">ยังไม่มี Water Footprint geometry รายวันสำหรับแปลงนี้ — กราฟพื้นที่น้ำยังทำงานจากค่าที่ตรวจสอบแล้วได้ตามปกติ</div>';return}
 wrap.innerHTML=`<div class="live-water-map-head"><label>ขอบเขตน้ำวันที่ <select class="live-water-date">${fs.map(f=>`<option value="${f.properties.date}">${dth(f.properties.date)}${f.properties.analysis_status==="PARTIAL"?" • ข้อมูลบางส่วน":""}</option>`).join("")}</select></label><span class="live-water-meta"></span></div><div class="live-water-map"></div>`;
 const mapEl=wrap.querySelector(".live-water-map");
 miniMap=L.map(mapEl,{zoomControl:true,attributionControl:false});
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(miniMap);
 const draw=date=>{
   miniLayers.forEach(l=>miniMap.removeLayer(l));miniLayers=[];
   const f=fs.find(x=>x.properties.date===date);if(!f)return;
   const b=boundaryByPlot?.get(plot);
   if(b){const l=L.geoJSON(b,{style:{color:"#ff6b61",weight:2,fill:false}}).addTo(miniMap);miniLayers.push(l)}
   const w=L.geoJSON(f,{style:{color:"#32a6dc",weight:1.5,fillColor:"#32a6dc",fillOpacity:.38}}).addTo(miniMap);miniLayers.push(w);
   const group=L.featureGroup(miniLayers);if(group.getBounds().isValid())miniMap.fitBounds(group.getBounds(),{padding:[12,12],maxZoom:17});
   const p=f.properties;wrap.querySelector(".live-water-meta").textContent=`น้ำจาก raster ≈ ${fmt(p.derived_water_rai)} ไร่ • usable ${fmt(p.valid_pct)}%${p.report_water_rai!=null?` • ค่า Report ${fmt(p.report_water_rai)} ไร่`:""}`;
 };
 const sel=wrap.querySelector(".live-water-date");sel.addEventListener("change",()=>draw(sel.value));sel.value=fs.at(-1).properties.date;setTimeout(()=>{miniMap.invalidateSize();draw(sel.value)},50);
}
async function render(plot,paper){
 await load();
 if(!paper||!history?.plots?.[plot])return;
 decorateReport(plot,paper);
 const old=paper.querySelector(".live-trend-section");if(old)old.remove();
 const snap=liveSnapshot(plot),all=rows(plot);
 const root=document.createElement("section");root.className="report-section live-trend-section";
 root.innerHTML=`<div class="live-title-row"><div><h4>แนวโน้มตามเวลา / Live Analysis History</h4><p>${summarize(plot)}</p></div><span class="live-update">ข้อมูล ${all.length} รอบ • history updated ${history.generated_at?new Date(history.generated_at).toLocaleString("th-TH"):"—"}</span></div>
 <div class="live-kpis"><div><span>รอบข้อมูลทั้งหมด</span><strong>${all.length}</strong></div><div><span>Current ที่ผ่าน QA</span><strong>${snap?dth(snap.current.date):"—"}</strong></div><div><span>พื้นที่น้ำ Current</span><strong>${snap?fmt(snap.current.water_rai)+" ไร่":"—"}</strong></div><div><span>Usable pixels</span><strong>${snap?fmt(snap.current.valid_pct)+"%":"—"}</strong></div></div>
 <div class="live-grid"><article><h5>ขอบเขตน้ำตามเวลา</h5><div class="live-chart"><canvas data-chart="water"></canvas></div></article><article><h5>น้ำเพิ่ม/ลดจากรอบก่อน</h5><div class="live-chart"><canvas data-chart="water-change"></canvas></div></article><article><h5>พืช: NDVI / NDRE</h5><div class="live-chart"><canvas data-chart="vegetation"></canvas></div></article><article><h5>น้ำและความชื้น: NDMI / MNDWI</h5><div class="live-chart"><canvas data-chart="moisture"></canvas></div></article><article class="live-wide"><h5>คุณภาพข้อมูลที่ใช้วิเคราะห์</h5><div class="live-chart live-chart-short"><canvas data-chart="qa"></canvas></div></article></div>
 <div class="live-water-map-wrap"></div>
 <div class="live-table-wrap"><table class="live-table"><thead><tr><th>วันที่</th><th>QA</th><th>Usable</th><th>น้ำ (ไร่)</th><th>น้ำ (%)</th><th>Δน้ำ (ไร่)</th><th>NDVI</th><th>NDRE</th><th>NDMI</th><th>MNDWI</th><th>BSI</th></tr></thead><tbody>${tableRows(plot)}</tbody></table></div>
 <p class="live-footnote">* ค่าที่มีเครื่องหมาย * เป็นพื้นที่น้ำที่ตรวจพบเฉพาะส่วนของภาพที่ผ่าน QA ไม่ใช้แทนค่าปัจจุบันโดยอัตโนมัติ</p>`;
 const footer=paper.querySelector(".report-footer");if(footer)footer.before(root);else paper.appendChild(root);
 renderCharts(plot,root);renderWaterMap(plot,root);
}
window.TrendReport={load,render,snapshot:plot=>history?liveSnapshot(plot):null,rows:plot=>history?rows(plot):[]};
load().catch(e=>console.warn("Trend history unavailable",e));
})();