/* One-page report presentation on top of QA-qualified monitoring data.
 * Does not derive scientific values from preview images. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=(x,places=2)=>x==null||!Number.isFinite(Number(x))?"—":Number(x).toLocaleString("th-TH",{minimumFractionDigits:places,maximumFractionDigits:places});
const dt=x=>/^\d{4}-\d\d-\d\d$/.test(String(x))?x.slice(8,10)+"/"+x.slice(5,7)+"/"+(Number(x.slice(0,4))+543):"—";
const status=r=>!r?"INDEX_PENDING":r.analysis_status||"INDEX_PENDING";
const good=r=>!!r&&["VERIFIED","AUTO_VALID"].includes(status(r))&&Number(r.valid_pct)>=70;
const tagged=r=>'<span class="mcr-qa mcr-'+esc(status(r).toLowerCase())+'">'+esc(status(r))+'</span>';
const trusted=(r,k)=>good(r)&&r[k]!=null&&Number.isFinite(Number(r[k]))?Number(r[k]):null;
const metric=(label,value,detail)=>'<div class="mcr-kpi"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>';
const signed=n=>n==null?"—":(n>0?"+":"")+fmt(n)+" ไร่";
const val=(r,k,p=3)=>{const v=trusted(r,k);if(v!==null)return fmt(v,p);const partial=r?.analysis_status==="PARTIAL"?r["observed_"+k]:null;return partial!=null&&Number.isFinite(Number(partial))?fmt(partial,p)+" *":"—"};
const modeLabel=m=>m==="manual"?"ผู้ใช้เลือกช่วงเวลา (Manual Review)":"ระบบเลือกข้อมูลตามเกณฑ์ QA (System Review)";
function head(view,mode,generated){
 const title=view.kind==="province"?"รายงานสถานการณ์จังหวัดระยอง":"รายงานติดตามแปลง "+view.plot;
 const times=view.kind==="province"?["A • "+dt(view.dates[0]),"B • "+dt(view.dates[1])]:["A • "+dt(view.dates[0]),"B • "+dt(view.dates[1]),"C • "+dt(view.dates[2])];
 return '<header class="mcr-head"><div class="mcr-kicker">FLOOD & ENVIRONMENTAL MONITORING REPORT / SENTINEL-2 L2A</div>'+
 '<div class="mcr-headline"><div><h2>'+esc(title)+'</h2><p>รายงานสรุปสถานการณ์น้ำและสภาพแวดล้อม • ขอบเขตโครงการ PDD</p></div><span>RAYONG<br>MONITORING</span></div>'+
 '<div class="mcr-meta"><span><b>ขอบเขต:</b> '+esc(view.kind==="province"?"จังหวัดระยอง · 19 แปลง":view.plot)+'</span><span><b>วิธีเลือก:</b> '+esc(modeLabel(mode))+'</span><span><b>ช่วงข้อมูล:</b> '+times.map(esc).join(" | ")+'</span></div></header>';
}
function section(title,body){return '<section class="mcr-section"><h3>'+esc(title)+'</h3>'+body+'</section>'}
function plotReport(view,mode,generated){
 const r=view.records||[],a=r[0],b=r[1],c=r[2];
 const summary=view.paired?
  "ตรวจพบพื้นที่น้ำเปิดเพิ่ม/ลดสุทธิ "+signed(view.change)+" ระหว่างวันที่ A และ B ภายใน PDD ตามผลที่ผ่าน QA ทั้งสองวัน ตัวเลขนี้ไม่ใช่ขอบเขต New Water แบบรายพิกเซล":
  "ยังไม่สามารถสรุปการเปลี่ยนแปลงพื้นที่น้ำระหว่างวัน A และ B ได้ เนื่องจากผลวิเคราะห์ไม่มีข้อมูลที่ผ่าน QA ครบทั้งสองวัน";
 const statusSummary="วัน A "+status(a)+" / วัน B "+status(b)+" / วัน C "+status(c)+
  ". ตัวชี้วัดที่มี * เป็นค่าชั่วคราวจากส่วนของพื้นที่ที่ใช้ได้ ไม่ใช่ค่าเฉลี่ยยืนยันทั้งแปลง";
 const header=head(view,mode,generated);
 const cards='<div class="mcr-kpis">'+
 metric("พื้นที่ PDD",fmt(view.area)+" ไร่","แปลง "+view.plot)+
 metric("น้ำเปิดวัน B",view.areaWater==null?"—":fmt(view.areaWater)+" ไร่","เฉพาะข้อมูลที่ผ่าน QA")+
 metric("เปลี่ยนสุทธิ B−A",signed(view.change),view.paired?"คู่วันที่ผ่าน QA":"ยังคำนวณไม่ได้")+
 metric("พิกเซลใช้ได้วัน B",b?.valid_pct==null?"—":fmt(b.valid_pct,1)+"%","สถานะ "+status(b))+
 '</div>';
 const image=section("01 | หลักฐานภาพดาวเทียม 3 ช่วงเวลา",
  '<div class="mcr-image-intro">ภาพประกอบสีจริงจาก GeoTIFF ตามวัน A / B / C • เส้นแดงเป็นขอบเขต PDD • ภาพและผล QA เป็นคนละส่วน</div>'+
  '<div id="mcr-images" class="mcr-scenes"><div class="mcr-images-loading">กำลังเตรียมภาพที่มีจริงตามวันที่เลือก...</div></div>');
 const metrics=[["ndvi","NDVI • ความเขียว"],["ndre","NDRE • Red Edge"],["ndmi","NDMI • ความชื้น"],["mndwi","MNDWI • น้ำเปิด"],["bsi","BSI • ดินเปิด"]];
 const table=section("02 | ตารางค่าดัชนีจากผลวิเคราะห์",
  '<table class="mcr-table"><thead><tr><th>ตัวชี้วัด</th><th>A '+esc(dt(view.dates[0]))+'</th><th>B '+esc(dt(view.dates[1]))+'</th><th>C '+esc(dt(view.dates[2]))+'</th></tr></thead><tbody>'+
  metrics.map(([k,name])=>'<tr><td>'+esc(name)+'</td>'+r.map(x=>'<td>'+esc(val(x,k))+'</td>').join("")+'</tr>').join("")+
  '<tr class="mcr-qa-row"><td>คุณภาพข้อมูล</td>'+r.map(x=>'<td>'+tagged(x)+'</td>').join("")+'</tr></tbody></table>');
 const takeaway=section("03 | สรุปสำหรับผู้บริหารและการตรวจภาคสนาม",
  '<div class="mcr-summary">'+esc(summary)+'</div><p class="mcr-body">'+esc(statusSummary)+'</p>'+
  '<p class="mcr-body"><b>ข้อควรตรวจสอบ:</b> เปรียบเทียบเวลาเก็บภาพกับระดับน้ำขึ้น–น้ำลง ปริมาณฝน การเกิดเมฆ/เงา และสำรวจภาคสนามก่อนสรุปผลกระทบต่อป่าชายเลน</p>');
 return header+cards+image+table+takeaway+foot(view,generated);
}
function provinceReport(view,mode,generated){
 const n=view.items.length;
 const headpart=head(view,mode,generated);
 const cards='<div class="mcr-kpis">'+
 metric("พื้นที่ PDD รวม",fmt(view.area)+" ไร่","ผลบวกพื้นที่แปลง")+
 metric("แปลงมีผลน้ำวัน B",view.covered+"/"+n+" แปลง","เฉพาะรายการผ่าน QA")+
 metric("น้ำเปิดรวมวัน B",view.areaWater==null?"—":fmt(view.areaWater)+" ไร่","รวมเฉพาะ "+view.covered+" แปลงที่ผ่าน QA")+
 metric("น้ำสุทธิ B−A",signed(view.change),"คู่วันที่ผ่าน QA "+view.paired+" แปลง")+
 '</div>';
 const coverage=section("01 | ภาพรวมสถานการณ์จากข้อมูลที่ตรวจสอบได้",
  '<div class="mcr-summary">'+
  esc("ตรวจพบผลน้ำที่ผ่าน QA ในวัน B จำนวน "+view.covered+" จาก "+n+" แปลง และมีคู่วันที่ A–B ที่เปรียบเทียบกันได้ "+view.paired+" แปลง ผลรวมพื้นที่น้ำวัน B คำนวณจากเฉพาะแปลงที่ผ่าน QA ส่วนผลต่าง B−A คำนวณเฉพาะคู่วันที่ผ่าน QA ทั้งสองช่วง จึงไม่ใช่ค่าการเปลี่ยนแปลงครบทั้งจังหวัด")+
  '</div>');
 const body=view.items.map(x=>{
  const change=x.goodA&&x.goodB?x.rb.water_rai-x.ra.water_rai:null;
  return '<tr><td>'+esc(x.p.plot)+'</td><td>'+esc(fmt(x.p.area_rai))+'</td><td>'+tagged(x.rb)+'</td>'+
   '<td>'+esc(x.goodB?fmt(x.rb.water_rai):"—")+'</td><td>'+esc(change==null?"—":(change>0?"+":"")+fmt(change))+'</td>'+
   '<td>'+esc(x.rb?.valid_pct!=null?fmt(x.rb.valid_pct,1)+"%":"—")+'</td></tr>'
 }).join("");
 const table=section("02 | ตารางสรุปทุกแปลง (หน่วยพื้นที่: ไร่)",
  '<table class="mcr-table mcr-province-table"><thead><tr><th>รหัสแปลง</th><th>PDD (ไร่)</th><th>QA วัน B</th><th>น้ำวัน B</th><th>น้ำ Δ*</th><th>Valid</th></tr></thead><tbody>'+body+'</tbody></table>');
 const note=section("03 | บทสรุปและข้อจำกัด",
  '<p class="mcr-body">ผลการเปลี่ยนแปลงสุทธิใช้เฉพาะ '+esc(view.paired)+
  ' แปลงที่มีค่าผ่าน QA ทั้งสองวัน ไม่ประเมินแปลงที่ไม่มีข้อมูล และไม่รวมค่าจากวันต่างกันโดยไม่กำหนดคู่วันที่</p>'+
  '<p class="mcr-body">* น้ำ Δ คือผลต่างพื้นที่น้ำ B − A ของแปลงเดียวกัน ไม่ใช่พื้นที่ New Water จากการจำแนกราสเตอร์รายพิกเซล น้ำที่เพิ่มในป่าชายเลนอาจสัมพันธ์กับน้ำขึ้น–ลงตามธรรมชาติ ไม่ใช่หลักฐานยืนยันอุทกภัย</p>');
 return headpart+cards+coverage+table+note+foot(view,generated);
}
function foot(view,generated){
 const asOf=generated?new Date(generated).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่ระบุ";
 return '<footer class="mcr-foot"><span>DATA PROVENANCE: analysis_history.json · plots.json · PDD boundaries.geojson<br>'+
 'ข้อมูลต้นทาง: Sentinel-2 L2A | ข้อมูลวิเคราะห์เผยแพร่: '+esc(asOf)+
 ' | ค่าไม่ครบแสดง — ไม่แปลงค่า JPG เป็นดัชนี</span><strong>01 / 01</strong></footer>';
}
let activeKey="";
function render({view,mode,generated}){
 const el=$("mc-report-paper");if(!el||!view)return;
 const key=view.kind+"|"+(view.plot||"province")+"|"+view.dates.join("|");
 activeKey=key;
 el.setAttribute("data-report-kind",view.kind);
 el.innerHTML=view.kind==="province"?provinceReport(view,mode,generated):plotReport(view,mode,generated);
}
function setPreview({plot,dates,html}){
 const el=$("mcr-images");if(!el||$("mc-report-paper")?.dataset.reportKind!=="plot")return;
 const key="plot|"+plot+"|"+(dates||[]).join("|");
 if(key!==activeKey)return;
 const target=document.createElement("div");
 target.innerHTML=html;
 const cards=[...target.querySelectorAll(".mc-scene")];
 if(!cards.length){el.textContent="ไม่มีภาพจริงที่ตรงกับช่วงเวลาที่เลือก";return}
 el.innerHTML=cards.map((c,i)=>{
  const picture=c.querySelector(".mc-image");
  const image=picture?picture.innerHTML:'<div class="mcr-missing">ไม่มีภาพจริงสำหรับวันนี้</div>';
  const label=c.querySelector("header")?.textContent||["A","B","C"][i];
  const aspect=picture?.style?.aspectRatio||"1 / 1";
  return '<div class="mcr-image-card"><div class="mcr-img" style="aspect-ratio:'+esc(aspect)+'">'+image+'</div><div class="mcr-img-caption">'+esc(label)+'</div></div>';
 }).join("");
}
async function print(){
 const el=$("mc-report-paper");if(!el||!el.innerHTML.trim())return;
 document.body.classList.add("mc-print-report");
 try{
  const images=[...el.querySelectorAll("img")];
  await Promise.all(images.map(im=>im.complete?Promise.resolve():new Promise(resolve=>{
   im.addEventListener("load",resolve,{once:true});im.addEventListener("error",resolve,{once:true});
   setTimeout(resolve,3000);
  })));
  if(document.fonts?.ready)await document.fonts.ready.catch(()=>{});
  root.print();
 }finally{
  // Browsers can return synchronously from print; retain the body print class
  // until after the print dialog closes where afterprint is supported.
  setTimeout(()=>document.body.classList.remove("mc-print-report"),1200);
 }
}
function ready(){const el=$("mc-report-paper");return !!el?.innerHTML.trim()&&!el.querySelector(".mcr-images-loading")}
function bind(){
 // The analysis controller validates current dates and QA before enabling print.
 root.addEventListener("afterprint",()=>document.body.classList.remove("mc-print-report"));
}
root.MonitoringReport={render,setPreview,ready,print,bind,model:{plotReport,provinceReport,good,trusted}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})(window);