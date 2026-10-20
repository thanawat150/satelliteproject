/* Monitoring Center: province/plot × system/manual review. No browser-side raster analysis. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=v=>{const s=String(v||"");return /^\d{8}$/.test(s)?s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6):s};
const dateTH=v=>/^\d{4}-\d\d-\d\d$/.test(String(v))?v.slice(8)+"/"+v.slice(5,7)+"/"+(Number(v.slice(0,4))+543):"—";
const num=(v,n=2)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("th-TH",{minimumFractionDigits:n,maximumFractionDigits:n});
const trusted=r=>!!r&&["VERIFIED","AUTO_VALID"].includes(r.analysis_status)&&Number(r.valid_pct)>=70;
const qa=r=>!r?"INDEX_PENDING":r.analysis_status==="VERIFIED"?"VERIFIED":r.analysis_status==="AUTO_VALID"?"AUTO_VALID":r.analysis_status==="PARTIAL"?"PARTIAL":r.analysis_status==="NO_DATA"?"NO_DATA":"INDEX_PENDING";
const rowsFor=(history,plot)=>(history?.plots?.[plot]||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)).slice().sort((a,b)=>a.date.localeCompare(b.date));
const rowAt=(history,plot,date)=>rowsFor(history,plot).find(r=>r.date===date)||null;
const datesFor=(history,plot,scenes=[])=>[...new Set([...rowsFor(history,plot).map(r=>r.date),...scenes.filter(s=>s.plot===plot).map(s=>s.date)].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))))].sort();
function plotDefaults(history,p,scenes=[]){
 const rows=rowsFor(history,p.plot),dates=datesFor(history,p.plot,scenes);
 const good=rows.filter(trusted);
 const a=rows.find(r=>r.date===iso(p.baseline)&&trusted(r))?.date||good[0]?.date||dates[0]||"";
 const b=good.slice().reverse().find(r=>r.date!==a)?.date||dates.slice().reverse().find(d=>d!==a)||"";
 const c=dates.slice().reverse().find(d=>d!==a&&d!==b)||"";
 return [a,b,c];
}
function provinceDefaults(history,plots){
 const count=new Map();
 for(const p of plots)for(const r of rowsFor(history,p.plot))if(trusted(r))count.set(r.date,(count.get(r.date)||0)+1);
 const ranked=[...count].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]));
 const b=ranked[0]?.[0]||"";
 const paired=ranked.filter(([d])=>d!==b).map(([d,n])=>({date:d,count:plots.filter(p=>trusted(rowAt(history,p.plot,d))&&trusted(rowAt(history,p.plot,b))).length,n})).sort((a,b)=>b.count-a.count||b.n-a.n||b.date.localeCompare(a.date));
 return [paired[0]?.date||"",b,""];
}
function makePlot(history,p,dates){
 const r=dates.map(d=>rowAt(history,p.plot,d));
 const a=r[0],b=r[1],paired=trusted(a)&&trusted(b)&&Number.isFinite(a.water_rai)&&Number.isFinite(b.water_rai);
 return {kind:"plot",plot:p.plot,area:p.area_rai,dates,records:r,
  trustedCount:r.filter(trusted).length,
  areaWater:trusted(b)&&Number.isFinite(b.water_rai)?b.water_rai:null,
  change:paired?b.water_rai-a.water_rai:null,
  valid: b?.valid_pct??null,paired};
}
function makeProvince(history,plots,dates){
 const a=dates[0],b=dates[1];
 const items=plots.map(p=>{const ra=rowAt(history,p.plot,a),rb=rowAt(history,p.plot,b);return {p,ra,rb,goodA:trusted(ra)&&Number.isFinite(ra.water_rai),goodB:trusted(rb)&&Number.isFinite(rb.water_rai)}});
 const good=items.filter(x=>x.goodB),paired=items.filter(x=>x.goodA&&x.goodB);
 const sum=arr=>arr.reduce((s,x)=>s+x,0);
 return {kind:"province",dates,items,area:sum(plots.map(p=>Number(p.area_rai)||0)),
  covered:good.length,paired:paired.length,
  areaWater:good.length?sum(good.map(x=>x.rb.water_rai)):null,
  pairedWaterA:paired.length?sum(paired.map(x=>x.ra.water_rai)):null,
  pairedWaterB:paired.length?sum(paired.map(x=>x.rb.water_rai)):null,
  change:paired.length?sum(paired.map(x=>x.rb.water_rai-x.ra.water_rai)):null,
  partial:items.filter(x=>qa(x.rb)==="PARTIAL").length,
  missing:items.filter(x=>!x.goodB).length};
}
const state={plots:[],boundaries:null,scenes:[],history:null,scope:"province",mode:"auto",plot:"",dates:["","",""],effective:["","",""],dirty:false,view:null,map:null,geo:null,preview:new Map(),previewParts:null,token:0,visible:false,ready:false};
const layerNames={true_color:"ภาพสีจริง",false_color:"ภาพสีเท็จ",ndvi:"NDVI",mndwi:"MNDWI",bsi:"BSI"};
function setText(id,value){const x=$(id);if(x)x.textContent=String(value)}
function setStatus(msg,level="info"){const x=$("mc-feedback");if(x){x.textContent=msg;x.dataset.level=level}}
function saveQuery(){
 const u=new URL(location.href);
 u.searchParams.set("scope",state.scope);u.searchParams.set("analysis",state.mode);
 if(state.scope==="plot")u.searchParams.set("plot",state.plot);
 history.replaceState({},'',u);
}
function updateChips(){
 for(const [id,on] of [["mc-scope-province",state.scope==="province"],["mc-scope-plot",state.scope==="plot"],["mc-mode-auto",state.mode==="auto"],["mc-mode-manual",state.mode==="manual"]]){
  const el=$(id);if(el){el.classList.toggle("is-active",on);el.setAttribute("aria-pressed",String(on));}
 }
 const plotBox=$("mc-plot-select");if(plotBox){plotBox.hidden=state.scope!=="plot";plotBox.value=state.plot}
 $("mc-date-c-wrap").hidden=state.scope!=="plot";
 $("mc-run").hidden=state.mode!=="manual";
 $("mc-refresh").hidden=state.mode!=="auto";
 $("mc-layer-control").hidden=state.scope!=="plot";
 setText("mc-context",state.scope==="province"?"19 แปลงในจังหวัดระยอง • ข้อมูลระดับจังหวัดจากผล QA จริง":"แปลง "+state.plot+" • วิเคราะห์เฉพาะขอบเขต PDD");
 setText("mc-mode-note",state.mode==="auto"?"ระบบเลือกวันที่มีผลผ่าน QA โดยอัตโนมัติ และอ่านข้อมูลจากคลังที่ประมวลผลไว้แล้ว ไม่ได้สั่งรันดาวเทียมใหม่":"เลือกวันที่แล้วกด «เปรียบเทียบข้อมูล» ใช้ผลวิเคราะห์ที่มีอยู่เท่านั้น • หากยังไม่มีดัชนีจะแจ้ง INDEX_PENDING ไม่คำนวณจาก JPG");
}
function fillSelect(id,values,chosen){
 const el=$(id);if(!el)return;
 el.innerHTML='<option value="">— ไม่มีวันที่ —</option>'+values.map(d=>'<option value="'+esc(d)+'">'+esc(dateTH(d))+'</option>').join("");
 el.value=values.includes(chosen)?chosen:"";
 el.disabled=state.mode==="auto"||!values.length;
}
function setDefaults(){
 if(!state.history)return;
 state.dates=state.scope==="province"?provinceDefaults(state.history,state.plots):plotDefaults(state.history,state.plots.find(p=>p.plot===state.plot)||state.plots[0],state.scenes);
}
function drawControls(){
 updateChips();
 const days=state.scope==="province"?
 [...new Set(state.plots.flatMap(p=>rowsFor(state.history,p.plot).map(r=>r.date)))].sort():
 datesFor(state.history,state.plot,state.scenes);
 ["a","b","c"].forEach((k,i)=>fillSelect("mc-date-"+k,days,state.dates[i]));
 const title=state.scope==="province"?"จังหวัดระยอง":"แปลง "+state.plot;
 setText("mc-title",title);
 setText("mc-source","ผลวิเคราะห์เผยแพร่ "+(state.history?.generated_at?new Date(state.history.generated_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่ระบุ")+
 " • แหล่งข้อมูล analysis_history.json");
}
function useSelection(){
 if(!state.history)return;
 state.effective=state.dates.slice();
 state.view=state.scope==="province"?makeProvince(state.history,state.plots,state.effective):
 makePlot(state.history,state.plots.find(p=>p.plot===state.plot),state.effective);
 state.dirty=false;
 $("mc-results").hidden=false;
 displayResults();
}
function resetForChange(){
 if(state.mode==="auto"){setDefaults();state.dirty=false;drawControls();useSelection()}
 else{state.dirty=true;state.view=null;root.PlotReview?.onView?.(null);drawControls();$("mc-results").hidden=true;setStatus("เลือกวันที่แล้วกด «เปรียบเทียบข้อมูล» เพื่อแสดงผลตามวันที่ที่เลือก","warn");paintMap();}
}
function metric(label,value,detail=""){return '<article class="mc-metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>'}
function addSign(v){return v==null?"—":(v>0?"+":"")+num(v)+" ไร่"}
function qaClass(r){const q=qa(r);return 'mc-qa mc-qa-'+q.toLowerCase()}
function qualityCell(r){return '<span class="'+qaClass(r)+'">'+esc(qa(r))+'</span>'}
function paintKpis(view){
 let html="";
 if(view.kind==="province"){
  html+=metric("จำนวนแปลง",state.plots.length+" แปลง","จังหวัดระยอง");
  html+=metric("พื้นที่ PDD รวม",num(view.area)+" ไร่","ผลรวมพื้นที่รายแปลง ไม่ใช่พื้นที่ Union");
  html+=metric("มีผลน้ำผ่าน QA วัน B",view.covered+"/"+state.plots.length+" แปลง",dateTH(view.dates[1]));
  html+=metric("พื้นที่น้ำของแปลงที่ผ่าน QA",view.areaWater==null?"—":num(view.areaWater)+" ไร่","รวมเฉพาะวัน B • "+view.covered+" แปลง");
 }else{
  const p=state.plots.find(p=>p.plot===view.plot),r=view.records[1];
  html+=metric("พื้นที่ PDD",num(view.area)+" ไร่",view.plot);
  html+=metric("น้ำเปิดวัน B",view.areaWater==null?"—":num(view.areaWater)+" ไร่",dateTH(view.dates[1]));
  html+=metric("น้ำสุทธิ B − A",addSign(view.change),view.paired?"เทียบผล QA ผ่าน 2 วัน":"คำนวณไม่ได้หาก QA ไม่ครบ");
  html+=metric("พื้นที่พิกเซลใช้ได้ วัน B",view.valid==null?"—":num(view.valid,1)+"%",qa(r));
 }
 $("mc-kpis").innerHTML=html;
}
function displayProvince(view){
 const compatible=view.paired>0;
 $("mc-result-title").textContent="ภาพรวมการตรวจข้อมูลรายจังหวัด";
 $("mc-analysis-note").textContent=
 "วัน A "+dateTH(view.dates[0])+" → วัน B "+dateTH(view.dates[1])+" • พบข้อมูลผ่าน QA ในวัน B "+view.covered+"/"+state.plots.length+
 " แปลง • คู่วันที่ตรวจผ่านทั้งสองวัน "+view.paired+" แปลง"+
 (compatible?" • น้ำเปลี่ยนสุทธิของเฉพาะ "+view.paired+" แปลง = "+addSign(view.change):" • ยังสรุปการเปลี่ยนแปลงระดับจังหวัดไม่ได้");
 $("mc-coverage").textContent="ไม่อนุมานพื้นที่น้ำใน "+view.missing+" แปลงที่ไม่มีผลวัน B ผ่าน QA และไม่รวมข้อมูลคนละวันเข้าด้วยกัน • ยังไม่ถือเป็นการยืนยันอุทกภัย";
 const rows=view.items.map(x=>'<tr data-mc-plot="'+esc(x.p.plot)+'"><td><b>'+esc(x.p.plot)+'</b></td><td>'+qualityCell(x.rb)+'</td><td>'+esc(x.goodB?num(x.rb.water_rai)+" ไร่":"—")+'</td><td>'+esc(x.rb?.valid_pct==null?"—":num(x.rb.valid_pct,1)+"%")+'</td><td><button type="button" data-mc-open="'+esc(x.p.plot)+'">ดูแปลง ↗</button></td></tr>').join("");
 $("mc-data").innerHTML='<h3>ข้อมูลรายแปลงในวัน B</h3><div class="mc-scroll"><table><thead><tr><th>แปลง</th><th>สถานะ QA</th><th>น้ำเปิด</th><th>พิกเซลใช้ได้</th><th>รายละเอียด</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 $("mc-preview").innerHTML='<div class="mc-empty"><strong>แผนที่ขอบเขต PDD ทั้งจังหวัด</strong><span>คลิกพื้นที่แปลงบนแผนที่หรือตารางเพื่อเจาะดูภาพดาวเทียมและดัชนีของแปลงนั้น</span></div>';
 $("mc-chart-note").textContent="แผนภูมิแสดงจำนวนแปลงที่ผ่าน QA ตามวันที่ ไม่ใช่ผลรวมพื้นที่น้ำต่างวัน";
}
function displayPlot(view){
 const p=state.plots.find(p=>p.plot===view.plot);
 $("mc-result-title").textContent="เปรียบเทียบข้อมูลแปลง "+view.plot;
 const a=view.records[0],b=view.records[1],c=view.records[2];
 const detail=view.paired?
 "พื้นที่น้ำสุทธิ "+addSign(view.change)+" เทียบระหว่างสองวันที่ผ่าน QA ไม่ใช่พื้นที่ New Water จากการตัด Raster ซ้อนกัน":
 "ยังเปรียบเทียบพื้นที่น้ำระหว่าง A–B ไม่ได้ เพราะไม่มีผลที่ผ่าน QA ครบทั้งสองวัน";
 $("mc-analysis-note").textContent=detail;
 $("mc-coverage").textContent="ค่า NDVI / NDRE / NDMI ต่างวันอาจใช้ฐานพิกเซลไม่เท่ากัน จึงแสดงค่ารายวันโดยไม่สรุปการฟื้นตัวหรือการรอดตายของต้นไม้ • ต้องตรวจน้ำขึ้นลง/ฝนก่อนระบุว่าน้ำท่วม";
 const names=[["water_rai","พื้นที่น้ำเปิด"," ไร่"],["ndvi","NDVI · ความเขียวของพืช",""],["ndre","NDRE · Red Edge",""],["ndmi","NDMI · ความชื้น",""],["mndwi","MNDWI · น้ำเปิด",""],["bsi","BSI · ดินเปิด",""]];
 const cell=(r,key,unit)=>trusted(r)&&r[key]!=null&&Number.isFinite(Number(r[key]))?num(r[key],key==="water_rai"?2:3)+unit:r?.analysis_status==="PARTIAL"&&r["observed_"+key]!=null?num(r["observed_"+key],3)+"*":"—";
 $("mc-data").innerHTML='<h3>ตารางค่าดัชนีที่มีหลักฐาน</h3><div class="mc-scroll"><table><thead><tr><th>ตัวชี้วัด</th><th>A • '+esc(dateTH(view.dates[0]))+'</th><th>B • '+esc(dateTH(view.dates[1]))+'</th><th>C • '+esc(dateTH(view.dates[2]))+'</th></tr></thead><tbody>'+
 names.map(([key,label,unit])=>'<tr><td><b>'+esc(label)+'</b></td>'+[a,b,c].map(r=>'<td>'+esc(cell(r,key,unit))+'</td>').join("")+'</tr>').join("")+
 '<tr><td><b>QA</b></td>'+[a,b,c].map(r=>'<td>'+qualityCell(r)+'</td>').join("")+'</tr></tbody></table></div><p class="mc-table-note">* ค่าชั่วคราวจากพิกเซลที่ใช้ได้บางส่วน • เครื่องหมาย — หมายถึงไม่มีข้อมูลที่รองรับ ไม่ใช่ค่า 0</p>';
 $("mc-chart-note").textContent="แผนภูมิค่าน้ำเปิด (ไร่) จากวันที่มีผลผ่าน QA ของ "+p.plot+" • ไม่เชื่อมค่าที่ไม่มีข้อมูล";
 renderPreview();
}
function displayResults(){
 if(!state.view||state.dirty)return;
 paintKpis(state.view);
 root.MonitoringReport?.render?.({view:state.view,mode:state.mode,generated:state.history?.generated_at});
 if(state.view.kind==="province")displayProvince(state.view);else displayPlot(state.view);
 root.PlotReview?.onView?.(state.view);
 setStatus(state.mode==="auto"?"แสดงผลล่าสุดที่ผ่านเกณฑ์ QA จากฐานข้อมูล • ไม่ใช่การรันภาพใหม่":"เปรียบเทียบจากค่าที่มีจริงเรียบร้อย • ไม่มีการประมวลผล GeoTIFF ใหม่","ok");
 paintMap();
 drawChart();
}
function allAreaFeatures(){return (state.boundaries?.features||[]).filter(x=>state.plots.some(p=>p.plot===x.properties?.plot))}
function paintMap(){
 if(!state.visible||typeof L==="undefined"||!$("mc-analysis-detail")?.open)return;
 const mapEl=$("mc-map");if(!mapEl)return;
 if(!state.map){
  state.map=L.map(mapEl,{scrollWheelZoom:false,zoomControl:true});
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(state.map);
 }
 if(state.geo){state.geo.remove();state.geo=null}
 const date=state.view?.dates?.[1]||state.dates[1];
 state.geo=L.geoJSON({type:"FeatureCollection",features:allAreaFeatures()},{
  style:f=>{
   const active=state.scope==="plot"&&f.properties?.plot===state.plot,r=rowAt(state.history,f.properties?.plot,date);
   const color=qa(r)==="VERIFIED"||qa(r)==="AUTO_VALID"?"#35caa5":qa(r)==="PARTIAL"?"#f6b34b":"#7b91a5";
   return {color:active?"#ff7067":color,weight:active?3.5:1.5,fillColor:active?"#ff7067":color,fillOpacity:active?.28:.13};
  },
  onEachFeature:(f,ly)=>{
   ly.bindTooltip(esc(f.properties?.plot||"")+" • "+esc(qa(rowAt(state.history,f.properties?.plot,date))));
   ly.on("click",()=>selectPlot(f.properties?.plot));
  }
 }).addTo(state.map);
 try{const bounds=state.scope==="plot"?
  L.geoJSON({type:"FeatureCollection",features:allAreaFeatures().filter(f=>f.properties.plot===state.plot)}).getBounds():state.geo.getBounds();
  if(bounds.isValid())state.map.fitBounds(bounds.pad(.12),{animate:false,maxZoom:15});
 }catch(e){console.warn("Monitoring map bounds",e)}
 setTimeout(()=>state.map?.invalidateSize(),50);
}
function drawChart(){
 const el=$("mc-chart");if(!el||!state.view||typeof Chart==="undefined")return;
 if(state.chart){state.chart.destroy();state.chart=null}
 let labels=[],values=[],label="";
 if(state.scope==="province"){
  const byDate=new Map();
  for(const p of state.plots)for(const r of rowsFor(state.history,p.plot))if(trusted(r))byDate.set(r.date,(byDate.get(r.date)||0)+1);
  labels=[...byDate.keys()].sort();values=labels.map(d=>byDate.get(d));label="แปลงผ่าน QA";
 }else{
  const records=rowsFor(state.history,state.plot).filter(r=>trusted(r)&&Number.isFinite(r.water_rai));
  labels=records.map(r=>r.date);values=records.map(r=>r.water_rai);label="พื้นที่น้ำเปิด (ไร่)";
 }
 if(!labels.length){el.hidden=true;return}
 el.hidden=false;
 state.chart=new Chart(el,{type:"line",data:{labels:labels.map(dateTH),datasets:[{label,data:values,borderColor:"#37b9ed",backgroundColor:"rgba(55,185,237,.12)",tension:.22,spanGaps:false,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#d7e8f3"}}},scales:{x:{ticks:{color:"#afc5d4"}},y:{beginAtZero:true,ticks:{color:"#afc5d4"}}}}});
}
async function previewPart(plot){
 const token=++state.token;
 if(!state.previewParts){try{const r=await fetch("data/satellite_parts.json",{cache:"no-store"});if(!r.ok)throw Error("manifest");state.previewParts=await r.json()}catch(e){setText("mc-preview-message","โหลดข้อมูลภาพไม่สำเร็จ");return null}}
 if(token!==state.token||state.scope!=="plot"||state.plot!==plot)return null;
 const part=(state.previewParts.parts||[]).findIndex(x=>x.plots?.includes(plot));
 if(part<0)return null;
 if(!state.preview.has(part)){try{const r=await fetch("data/full_preview_part_"+(part+1)+".json",{cache:"no-store"});if(!r.ok)throw Error("full preview");state.preview.set(part,await r.json())}catch(e){return null}}
 if(token!==state.token||state.scope!=="plot"||state.plot!==plot)return null;
 return state.preview.get(part).layers||[];
}
function boundarySvg(plot,bounds){
 if(!Array.isArray(bounds)||bounds.length!==2)return "";
 const sw=bounds[0],ne=bounds[1],dx=ne[1]-sw[1],dy=ne[0]-sw[0];
 if(!(dx>0&&dy>0))return "";
 const shapes=allAreaFeatures().filter(f=>f.properties.plot===plot).flatMap(f=>{
  const g=f.geometry;if(!g)return[];
  return g.type==="Polygon"?g.coordinates:g.type==="MultiPolygon"?g.coordinates.flat():[];
 });
 return '<svg class="mc-outline" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+shapes.map(ring=>'<polygon points="'+ring.map(pt=>((pt[0]-sw[1])/dx*1000).toFixed(2)+","+((ne[0]-pt[1])/dy*1000).toFixed(2)).join(" ")+'"/>').join("")+'</svg>';
}
async function renderPreview(){
 const container=$("mc-preview"),plot=state.plot,dates=state.view?.dates?.slice()||[];
 const mode=$("mc-layer")?.value||"true_color";
 container.innerHTML='<div class="mc-empty" id="mc-preview-message">กำลังโหลดภาพจาก GeoTIFF Preview จริง...</div>';
 const layers=await previewPart(plot);
 if(state.scope!=="plot"||state.plot!==plot||!dates.every((d,i)=>d===state.view?.dates?.[i]))return;
 if(!layers){container.innerHTML='<div class="mc-empty">ยังไม่มีภาพ Preview ที่รองรับวันที่และแปลงที่เลือก</div>';root.MonitoringReport?.setPreview?.({plot,dates,html:""});return}
 const priority={DIRECT:0,LATEST_RECT:1,HIST_CLEAR_RECT_SCL0:2,NO_CLOUD_FILTER:3};
 const makeCards=displayMode=>dates.map((d,i)=>{
  const l=layers.filter(x=>x.plot===plot&&x.date===d&&x.mode===displayMode&&x.src).sort((a,b)=>(priority[a.source_suffix]??5)-(priority[b.source_suffix]??5))[0];
  const r=rowAt(state.history,plot,d);
  const content=l?'<div class="mc-image" style="aspect-ratio:'+Number(l.width||1)+'/'+Number(l.height||1)+'"><img src="'+esc(l.src)+'" alt="'+esc(layerNames[displayMode])+' '+esc(dateTH(d))+'" loading="lazy">'+boundarySvg(plot,l.bounds)+'</div>':'<div class="mc-image mc-noimage">ไม่มีภาพ '+esc(layerNames[displayMode])+' ในวันที่เลือก</div>';
  return '<article class="mc-scene"><header><b>'+["A · ก่อนเหตุ","B · ตรวจติดตาม","C · ล่าสุด"][i]+'</b><small>'+esc(dateTH(d))+'</small></header>'+content+'<div>'+qualityCell(r)+'</div></article>';
 });
 container.innerHTML='<div class="mc-scenes">'+makeCards(mode).join("")+'</div><p class="mc-table-note">'+esc(layerNames[mode])+' • แสดงภาพจาก Raster จริง • ขอบแดงคือ PDD</p>';
 // The report always uses real True Color GeoTIFF-derived previews.
 root.MonitoringReport?.setPreview?.({plot,dates,html:makeCards("true_color").join(""),mndwiHtml:makeCards("mndwi").join("")});
}
function selectPlot(id){
 const p=state.plots.find(p=>p.plot===id);if(!p)return;
 state.plot=id;state.scope="plot";setDefaults();resetForChange();saveQuery();
 if(typeof root.selectPlot==="function")root.selectPlot(p);
}
function exportCsv(){
 if(!state.view||state.dirty){setStatus("กรุณากดวิเคราะห์ข้อมูลตามวันที่ก่อนดาวน์โหลด CSV","warn");return}
 const v=state.view,head=["scope","plot","date","analysis_status","valid_pct","water_rai","ndvi","ndre","ndmi","mndwi","bsi","source"];
 const plots=v.kind==="province"?state.plots:[state.plots.find(p=>p.plot===v.plot)];
 const rows=[];
 for(const p of plots)for(const d of v.dates.filter(Boolean)){
  const r=rowAt(state.history,p.plot,d);
  rows.push([""+v.kind,p.plot,d,qa(r),r?.valid_pct??"",trusted(r)?r.water_rai??"":"",...["ndvi","ndre","ndmi","mndwi","bsi"].map(k=>trusted(r)?r[k]??"":""),r?.source??"" ]);
 }
 const csv=[head,...rows].map(row=>row.map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="Environmental_Monitoring_"+(v.kind==="province"?"Rayong":v.plot)+"_"+(v.dates[1]||"unknown")+".csv";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function chooseManual(){
 if(state.dates[0]===state.dates[1]||!state.dates[0]||!state.dates[1]){
  setStatus("กรุณาเลือกวัน A และ B ที่แตกต่างกันก่อนวิเคราะห์","warn");return;
 }
 if(state.scope==="plot"&&state.dates[2]&&[state.dates[0],state.dates[1]].includes(state.dates[2])){
  setStatus("วันที่ C ต้องไม่ซ้ำกับ A หรือ B","warn");return;
 }
 useSelection();
}
function openReport(){
 if(state.mode==="manual"&&state.dirty){setStatus("กรุณากด «วิเคราะห์เปรียบเทียบข้อมูล» ก่อนเปิดรายงานตามวันที่เลือก","warn");return}
 if(state.scope!=="plot"){setStatus("เลือกแปลงก่อนเปิดรายงาน PDF รายแปลง • รายงานจังหวัดยังไม่เปิดให้สร้างอัตโนมัติ","warn");return}
 const p=state.plots.find(x=>x.plot===state.plot);
 if(typeof root.selectPlot==="function")root.selectPlot(p);
 $("report-type").value="three";
 if(typeof root.ThreePeriodReport?.setDates==="function"&&state.view&&!state.dirty)root.ThreePeriodReport.setDates(state.plot,state.view.dates);
 if(typeof root.switchTab==="function")root.switchTab("report");
}
function wire(){
 const on=(id,handler,type="click")=>$(id)?.addEventListener(type,handler);
 on("mc-scope-province",()=>{state.scope="province";setDefaults();resetForChange();saveQuery()});
 on("mc-scope-plot",()=>{state.scope="plot";setDefaults();resetForChange();saveQuery()});
 on("mc-mode-auto",()=>{state.mode="auto";setDefaults();resetForChange();saveQuery()});
 on("mc-mode-manual",()=>{state.mode="manual";state.dirty=true;state.view=null;root.PlotReview?.onView?.(null);drawControls();$("mc-results").hidden=true;paintMap();setStatus("เลือกวันและกดเปรียบเทียบเพื่ออ่านผลที่คำนวณไว้แล้ว","warn");saveQuery()});
 on("mc-plot",e=>selectPlot(e.target.value),"change");
 ["a","b","c"].forEach((k,i)=>on("mc-date-"+k,e=>{state.dates[i]=e.target.value;state.dirty=true;state.view=null;root.PlotReview?.onView?.(null);$("mc-results").hidden=true;paintMap();setStatus("เปลี่ยนวันแล้ว • กดเปรียบเทียบข้อมูลเพื่อแสดงผลใหม่","warn")},"change"));
 on("mc-run",chooseManual);
 on("mc-refresh",async()=>{
  setStatus("กำลังตรวจฐานข้อมูลผลวิเคราะห์ล่าสุด...");try{const r=await fetch("data/analysis_history.json",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);state.history=await r.json();setDefaults();drawControls();useSelection()}catch(e){setStatus("โหลดผลวิเคราะห์ไม่ได้: "+e.message,"error")}
 });
 on("mc-layer",()=>{if(!state.dirty&&state.view?.kind==="plot")renderPreview()},"change");
 on("mc-analysis-detail",e=>{if(e.target.open){paintMap();drawChart();setTimeout(()=>{state.map?.invalidateSize();state.chart?.resize()},120)}},"toggle");
 const printOne=()=>{
  if(!state.view||state.dirty){setStatus("กรุณากดวิเคราะห์ตามวันที่ก่อนบันทึกรายงาน PDF","warn");return}
  if(!root.PlotReview?.canPrint?.() && state.scope==="plot")return;
  if(!root.MonitoringReport?.ready?.()){setStatus("รอการโหลดภาพประกอบรายงานให้เสร็จก่อนพิมพ์ หรือเลือกใช้รายงานที่แจ้งว่าไม่มีภาพ","warn");return}
  root.MonitoringReport?.print?.();
 };
 on("mc-print-onepage",printOne);
 on("mc-print-onepage-top",printOne);
 on("mc-open-report",openReport);
 on("mc-export-csv",exportCsv);
 on("mc-table-report",openReport);
 $("mc-data")?.addEventListener("click",e=>{const b=e.target.closest("[data-mc-open]");if(b)selectPlot(b.dataset.mcOpen)});
}
async function init({plots,boundaries,scenes,selectedPlot}){
 if(state.ready)return;
 state.plots=plots||[];state.boundaries=boundaries;state.scenes=scenes||[];state.plot=selectedPlot||plots?.[0]?.plot||"";
 const params=new URLSearchParams(location.search);
 state.scope=params.get("scope")==="plot"?"plot":"province";
 state.mode=params.get("analysis")==="manual"?"manual":"auto";
 $("mc-plot").innerHTML=state.plots.map(p=>'<option value="'+esc(p.plot)+'">'+esc(p.plot)+'</option>').join("");
 $("mc-plot").value=state.plot;
 wire();
 try{
  const r=await fetch("data/analysis_history.json",{cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status);
  state.history=await r.json();
  setDefaults();drawControls();state.ready=true;
  if(state.mode==="auto")useSelection();else{state.dirty=true;$("mc-results").hidden=true;setStatus("เลือกวันที่แล้วกดเปรียบเทียบข้อมูล","warn")}
  if(state.visible)paintMap();
 }catch(e){setStatus("ไม่สามารถอ่านผลวิเคราะห์จริง: "+e.message,"error")}
}
function showTab(tab){
 state.visible=tab==="center";
 if(state.visible&&state.ready){if(!state.dirty&&state.view)displayResults();else paintMap();setTimeout(()=>state.map?.invalidateSize(),160)}
}
function onPlotChange(p){
 if(!state.ready||!p||state.plot===p.plot)return;
 state.plot=p.plot;
 if(state.scope==="plot"){setDefaults();resetForChange()}
}
root.AnalysisCenter={init,showTab,onPlotChange,setScope:s=>{if(s!=="plot"&&s!=="province")return;state.scope=s;setDefaults();resetForChange();saveQuery()},model:{trusted,qa,plotDefaults,provinceDefaults,makePlot,makeProvince,rowAt}};
})(window);