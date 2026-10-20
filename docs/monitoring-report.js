/* Research-poster infographic reports for the real Sentinel-2/PDD monitoring records.
 * Educational layout only: never invent GeoAI model outputs or infer indices from JPGs. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=(x,p=2)=>x==null||!Number.isFinite(Number(x))?"—":Number(x).toLocaleString("th-TH",{minimumFractionDigits:p,maximumFractionDigits:p});
const dt=x=>/^\d{4}-\d\d-\d\d$/.test(String(x))?x.slice(8,10)+"/"+x.slice(5,7)+"/"+(Number(x.slice(0,4))+543):"—";
const status=r=>r?.analysis_status||"INDEX_PENDING";
const good=r=>!!r&&["VERIFIED","AUTO_VALID"].includes(status(r))&&Number(r.valid_pct)>=70;
const trusted=(r,k)=>good(r)&&r[k]!=null&&Number.isFinite(Number(r[k]))?Number(r[k]):null;
const signed=n=>n==null?"—":(n>0?"+":"")+fmt(n);
const modeLabel=m=>m==="manual"?"เลือกช่วงเวลาเอง":"ระบบเลือกอัตโนมัติ";
const qaClass=r=>"mcr-qa mcr-qa-"+status(r).toLowerCase();
const qaTag=r=>'<span class="'+qaClass(r)+'">'+esc(status(r))+'</span>';
const measured=(r,k,p=3)=>{
 const v=trusted(r,k);
 if(v!==null)return fmt(v,p);
 const partial=r?.analysis_status==="PARTIAL"?r["observed_"+k]:null;
 return partial!=null&&Number.isFinite(Number(partial))?fmt(partial,p)+" *":"—";
};
const icons={
 leaf:'<svg viewBox="0 0 42 42" aria-hidden="true"><path d="M6 31C7 15 20 4 35 6c2 18-12 29-29 25Zm1 2C14 25 22 18 34 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
 drop:'<svg viewBox="0 0 42 42" aria-hidden="true"><path d="M21 4C13 15 7 22 7 28a14 14 0 0 0 28 0c0-6-6-13-14-24Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 28c1 5 4 7 9 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
 chart:'<svg viewBox="0 0 42 42" aria-hidden="true"><path d="M6 34V8M6 34h30M12 28l9-10 6 5 9-13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 layers:'<svg viewBox="0 0 42 42" aria-hidden="true"><path d="m4 14 17-9 17 9-17 9L4 14Zm0 10 17 9 17-9M4 19l17 9 17-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
 clock:'<svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M21 11v10l8 5" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
 pin:'<svg viewBox="0 0 42 42" aria-hidden="true"><path d="M21 38s-13-14-13-23a13 13 0 0 1 26 0c0 9-13 23-13 23Z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="21" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="3"/></svg>'
};
const section=(n,title,body,cls="")=>'<section class="mcr-section '+cls+'"><div class="mcr-band"><span class="mcr-number">'+n+'</span><h3>'+esc(title)+'</h3></div><div class="mcr-section-body">'+body+'</div></section>';
const kpi=(label,value,small,accent="")=>'<div class="mcr-kpi '+accent+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(small)+'</small></div>';
const check=x=>'<div class="mcr-check"><i>✓</i><span>'+esc(x)+'</span></div>';
const process=(title,small,number)=>'<div class="mcr-process"><b>'+number+'</b><strong>'+esc(title)+'</strong><small>'+esc(small)+'</small></div>';
const indicator=(label,letter,val,note)=>'<div class="mcr-indicator"><div class="mcr-index-icon">'+esc(letter)+'</div><span>'+esc(label)+'</span><b>'+esc(val)+'</b><small>'+esc(note)+'</small></div>';
function head(view,mode,generated){
 const isProvince=view.kind==="province";
 const plot=isProvince?"จังหวัดระยอง":view.plot;
 const subtitle=isProvince?"การติดตามสถานการณ์น้ำและพื้นที่ป่าชายเลนระดับจังหวัด":
 "การติดตามสถานการณ์น้ำและดัชนีพืชพรรณภายในขอบเขตแปลง";
 return '<header class="mcr-poster-head"><div class="mcr-poster-sky">'+
 '<div class="mcr-poster-topline"><span>ENVIRONMENTAL MONITORING • RESEARCH INFOGRAPHIC</span><span>SENTINEL-2 / GIS</span></div>'+
 '<div class="mcr-poster-head-body"><div class="mcr-poster-title"><div class="mcr-poster-overline">รายงานติดตามการเปลี่ยนแปลงสิ่งแวดล้อม</div>'+
 '<h2>'+(isProvince?'รายงานสถานการณ์จังหวัดระยอง':'รายงานติดตามแปลง '+esc(view.plot))+'</h2>'+
 '<p>'+esc(subtitle)+'</p><div class="mcr-poster-tags"><span>'+esc(plot)+'</span><span>'+esc(modeLabel(mode))+'</span><span>PDD + Sentinel-2 L2A</span></div></div>'+
 '<div class="mcr-satellite" aria-hidden="true"><span class="mcr-satellite-array"></span><span class="mcr-satellite-core"></span><span class="mcr-satellite-array"></span><span class="mcr-sat-signal">◔</span></div></div>'+
 '</div><div class="mcr-poster-land"><span class="mcr-canopy mcr-canopy-1"></span><span class="mcr-canopy mcr-canopy-2"></span><span class="mcr-canopy mcr-canopy-3"></span><span class="mcr-water"></span>'+
 '<div class="mcr-poster-strip">ข้อมูลภาพดาวเทียม · คุณภาพพิกเซล (QA) · ขอบเขต PDD · ติดตามการเปลี่ยนแปลงตามเวลา</div></div></header>';
}
function intro(view){
 const province=view.kind==="province";
 return section("1","ที่มาและความสำคัญ",
 '<div class="mcr-intro"><div class="mcr-nature-art"><span class="mcr-tree t1"></span><span class="mcr-tree t2"></span><span class="mcr-tree t3"></span><span class="mcr-art-river"></span></div>'+
 '<p>'+(province?
 'พื้นที่ป่าชายเลนมีน้ำขึ้นลงตามธรรมชาติ การติดตามระดับจังหวัดจึงควรเปรียบเทียบผลจากวันที่เดียวกันและผ่านการตรวจคุณภาพภาพ เพื่อระบุแปลงที่ควรตรวจสอบเพิ่มเติม':
 'พื้นที่ป่าชายเลนตอบสนองต่อสภาพน้ำและตะกอนที่เปลี่ยนแปลงได้ การใช้ภาพ Sentinel-2 ร่วมกับขอบเขต PDD ช่วยติดตามสภาพพื้นที่ตามช่วงเวลา โดยต้องพิจารณาเมฆและน้ำขึ้น–ลงก่อนตีความ')+
 '</p></div>','mcr-intro-section');
}
function objectives(view){
 return section("2","วัตถุประสงค์",
 '<div class="mcr-objectives">'+
 ['ตรวจติดตามพื้นที่น้ำเปิดตามช่วงเวลาที่เลือก','เปรียบเทียบผลที่ผ่านการตรวจคุณภาพ (QA)',
 view.kind==="province"?'จัดลำดับแปลงที่ควรสำรวจและติดตามเพิ่มเติม':'ตรวจแนวโน้มดัชนี NDVI, NDRE, NDMI, MNDWI และ BSI']
 .map((x,i)=>'<div class="mcr-objective"><b>'+String(i+1)+'</b><span>'+esc(x)+'</span></div>').join("")+
 '</div>','mcr-objectives-section');
}
function methods(view){
 const labels=view.kind==="province"?
 [["Sentinel-2","ภาพดาวเทียม L2A"],["PDD","ขอบเขตจริง"],["QA","คัดข้อมูลที่ใช้ได้"],["ดัชนี","ใช้งานผลที่มี"],["ภาพรวม","สรุปแบบวันเดียวกัน"]]:
 [["Sentinel-2","ภาพดาวเทียม L2A"],["PDD","ขอบเขตแปลง"],["QA","เมฆและพิกเซล"],["NDVI / น้ำ","ผลคำนวณที่มี"],["เปรียบเทียบ","วัน A / B / C"]];
 return section("3","ขั้นตอนวิเคราะห์จากข้อมูลดาวเทียม",
 '<div class="mcr-process-line">'+labels.map((x,i)=>process(x[0],x[1],i+1)).join('<span class="mcr-process-arrow">›</span>')+'</div>'+
 '<div class="mcr-date-row"><b>ช่วงเวลาวิเคราะห์</b>'+
 view.dates.filter(Boolean).map((d,i)=>'<span>'+["A","B","C"][i]+' : '+esc(dt(d))+'</span>').join("")+
 '</div>','mcr-method-section');
}
function waterChart(a,b,area){
 const va=trusted(a,"water_rai"),vb=trusted(b,"water_rai");
 const bars=[["A",va,a],["B",vb,b]];
 const max=Math.max(Number(area)||0,va||0,vb||0,1);
 return '<div class="mcr-water-bars">'+bars.map(([name,v,r])=>
 '<div class="mcr-waterbar"><span>'+name+'</span><div class="mcr-track"><i style="width:'+(v==null?0:Math.min(100,100*v/max).toFixed(1))+'%"></i></div><b>'+(v==null?'ไม่มีค่าผ่าน QA':fmt(v)+" ไร่")+'</b></div>').join("")+
 '<p>พื้นที่น้ำเปิดเฉพาะค่าที่ผ่าน QA • ขนาดแถบอิงพื้นที่ PDD ของแปลง</p></div>';
}
function plotResults(view){
 const r=view.records||[],a=r[0],b=r[1],c=r[2];
 const pairs=good(a)&&good(b);
 const values=[["NDVI","พืช", "V","ndvi"],["NDRE","Red Edge","R","ndre"],["NDMI","ความชื้น","H","ndmi"],["MNDWI","น้ำเปิด","W","mndwi"],["BSI","พื้นผิวดิน","S","bsi"]];
 const analysis=section("4","ผลการศึกษาและการติดตาม (ค่าจริง)",
 '<div class="mcr-report-kpis">'+
 kpi("พื้นที่ PDD",fmt(view.area)+" ไร่","พื้นที่ตามแปลง")+
 kpi("น้ำวันติดตาม B",view.areaWater==null?"—":fmt(view.areaWater)+" ไร่","เฉพาะผลผ่าน QA","water")+
 kpi("พื้นที่น้ำเปลี่ยนสุทธิ",view.change==null?"—":signed(view.change)+" ไร่",pairs?"น้ำวัน B − น้ำวัน A":"ยังไม่ผ่าน QA ครบ","delta")+
 kpi("คุณภาพวัน B",b?.valid_pct==null?"—":fmt(b.valid_pct,1)+"%","valid pixels")+
 '</div>'+
 '<div class="mcr-subheading">ภาพสีจริง 3 ช่วงเวลา (10 ม. เมื่อมีภาพชนิดนี้จริง)</div>'+
 '<div id="mcr-images" class="mcr-images"><div class="mcr-images-loading">กำลังโหลดภาพดาวเทียมตามวันที่ที่เลือก...</div></div>'+
 '<div class="mcr-subheading">ดัชนีสิ่งแวดล้อมรายช่วงเวลา</div>'+
 '<div class="mcr-index-strip">'+values.map(x=>indicator(x[0],x[1],measured(b,x[3]),"วัน B")).join("")+'</div>'+
 '<div class="mcr-result-bottom"><div class="mcr-result-chart"><strong>กราฟเปรียบเทียบพื้นที่น้ำ (ไร่)</strong>'+waterChart(a,b,view.area)+'</div>'+
 '<div class="mcr-result-qa"><strong>ความน่าเชื่อถือของข้อมูล</strong>'+
 r.map((x,i)=>'<div><span>วัน '+["A","B","C"][i]+' · '+esc(dt(view.dates[i]))+'</span>'+qaTag(x)+'</div>').join("")+
 '</div></div>'+
 '<div class="mcr-indices-note">ค่า B: NDVI '+esc(measured(b,"ndvi"))+' · NDRE '+esc(measured(b,"ndre"))+' · NDMI '+esc(measured(b,"ndmi"))+
 ' · MNDWI '+esc(measured(b,"mndwi"))+' · BSI '+esc(measured(b,"bsi"))+
 ' | C: '+esc(status(c))+' • เครื่องหมาย * คือค่าบางส่วน ไม่แทนค่าเฉลี่ยทั้งแปลง</div>','mcr-results-section');
 return analysis;
}
function provincialResults(view){
 const rows=view.items||[],date=view.dates[1];
 const qaCount={VERIFIED:0,AUTO_VALID:0,PARTIAL:0,NO_DATA:0,INDEX_PENDING:0};
 for(const x of rows){let st=status(x.rb);if((st==="VERIFIED"||st==="AUTO_VALID")&&!x.goodB)st="INDEX_PENDING";qaCount[st]=(qaCount[st]||0)+1}
 const goodCount=(qaCount.VERIFIED||0)+(qaCount.AUTO_VALID||0);
 const partial=qaCount.PARTIAL||0;
 const total=rows.length||1;
 const pGood=(100*goodCount/total).toFixed(2),pPart=(100*partial/total).toFixed(2);
 const pie='<div class="mcr-pie-box"><div class="mcr-donut" style="background:conic-gradient(#078663 0 '+pGood+'%,#e4a630 '+pGood+'% calc('+pGood+'% + '+pPart+'%),#bfcfd4 calc('+pGood+'% + '+pPart+'%) 100%)"><div><strong>'+view.covered+'</strong><small>ผ่าน QA</small></div></div>'+
 '<div class="mcr-legend"><span><i style="background:#078663"></i>ผ่าน QA '+view.covered+' แปลง</span><span><i style="background:#e4a630"></i>PARTIAL '+partial+' แปลง</span><span><i style="background:#bfcfd4"></i>อื่น/ไม่มีข้อมูล '+(rows.length-goodCount-partial)+' แปลง</span></div></div>';
 const cell=(x)=>{
  const delta=x.goodA&&x.goodB?Number(x.rb.water_rai)-Number(x.ra.water_rai):null;
  return '<tr><td>'+esc(x.p.plot)+'</td><td>'+esc(x.goodB?fmt(x.rb.water_rai,1):"—")+'</td><td>'+esc(delta==null?"—":signed(delta))+'</td><td>'+qaTag(x.rb)+'</td></tr>';
 };
 const half=Math.ceil(rows.length/2),tables=[rows.slice(0,half),rows.slice(half)].map(part=>
 '<table class="mcr-compact-table"><thead><tr><th>แปลง</th><th>น้ำวัน B (ไร่)</th><th>Δ น้ำ (ไร่)</th><th>QA</th></tr></thead><tbody>'+part.map(cell).join("")+'</tbody></table>');
 return section("4","ผลการศึกษาและการตรวจติดตาม 19 แปลง",
 '<div class="mcr-report-kpis">'+
 kpi("พื้นที่ PDD ทุกแปลง",fmt(view.area)+" ไร่","ผลบวกพื้นที่รายแปลง")+
 kpi("ผ่าน QA ในวัน B",view.covered+"/"+rows.length+" แปลง","วัน "+dt(date),"water")+
 kpi("น้ำเปิดรวมวัน B",view.areaWater==null?"—":fmt(view.areaWater)+" ไร่","รวมเฉพาะแปลงผ่าน QA")+
 kpi("น้ำเปลี่ยนสุทธิ",view.change==null?"—":signed(view.change)+" ไร่","เทียบคู่วันที่ผ่าน "+view.paired+" แปลง","delta")+
 '</div>'+
 '<div class="mcr-province-visual">'+pie+'<div class="mcr-province-explainer"><strong>การตรวจสอบคุณภาพภาพ</strong><p>ใช้วันเดียวกันเพื่อรวมพื้นที่น้ำเฉพาะแปลงที่ผ่าน QA และนับผลต่างเฉพาะคู่วันที่ A–B ที่ผ่าน QA ทั้งสองช่วง</p><div class="mcr-province-facts"><span>แปลงที่เทียบได้ <b>'+view.paired+'</b></span><span>ข้อมูลไม่ผ่าน/ขาด <b>'+view.missing+'</b></span></div></div></div>'+
 '<div class="mcr-subheading">สถานะแปลงและพื้นที่น้ำ (รายแปลงที่มีข้อมูล)</div>'+
 '<div class="mcr-tables-two">'+tables.join("")+'</div>'+
 '<p class="mcr-result-disclaimer">Δ น้ำ = พื้นที่น้ำวัน B − วัน A เฉพาะคู่ที่ผ่าน QA • — = ไม่สามารถคำนวณได้ • ไม่ใช่พื้นที่น้ำท่วมที่ยืนยันแล้ว</p>',
 'mcr-results-section mcr-prov-results');
}
function summary(view){
 if(view.kind==="province"){
  const text=view.paired?
   "สรุปผลได้เฉพาะ "+view.paired+" แปลงที่มีข้อมูลผ่าน QA ทั้งวัน A และ B โดยพื้นที่น้ำเปลี่ยนสุทธิ "+signed(view.change)+" ไร่":
   "ยังไม่มีคู่วันที่ผ่าน QA เพียงพอสำหรับการสรุปพื้นที่น้ำเปลี่ยนสุทธิระดับจังหวัด";
  return section("5","สรุปผลการติดตาม",
  '<div class="mcr-summary-note">'+check(text)+check("พื้นที่น้ำวัน B มีข้อมูลใช้ได้ "+view.covered+" จาก "+view.items.length+" แปลง")+
  check("การเปลี่ยนแปลงระดับจังหวัดไม่ใช่หลักฐานยืนยันน้ำท่วมโดยปราศจากข้อมูลน้ำขึ้นลงและภาคสนาม")+'</div>',
  'mcr-summary-section');
 }
 const r=view.records||[],a=r[0],b=r[1],nA=trusted(a,"ndvi"),nB=trusted(b,"ndvi");
 const ndvi=nA!=null&&nB!=null?"NDVI วัน A "+fmt(nA,3)+" → วัน B "+fmt(nB,3)+" (ต่าง "+(nB-nA>=0?"+":"")+fmt(nB-nA,3)+")":
 "ค่าความเขียวพืชระหว่าง A และ B ยังเปรียบเทียบไม่ได้จากข้อมูลที่ผ่าน QA";
 const sum=view.paired?"น้ำเปิดเปลี่ยนสุทธิ "+signed(view.change)+" ไร่ ระหว่างวันที่ผ่าน QA ทั้งสองช่วง":"ข้อมูลวันที่ A และ B ยังไม่ผ่าน QA ครบ จึงสรุปน้ำเพิ่ม/ลดไม่ได้";
 return section("5","สรุปผลการติดตาม",
 '<div class="mcr-summary-note">'+check(sum)+check(ndvi)+check("ดัชนีไม่ยืนยันการรอดตายของต้นไม้โดยลำพัง และต้องคำนึงถึงเมฆ/น้ำขึ้นลง")+'</div>',
 'mcr-summary-section');
}
function benefits(view){
 const pts=view.kind==="province"?
  [["ต้นไม้","ระบุแปลงที่ควรติดตาม"],["สถิติ","เปรียบเทียบผลตามวัน"],["ตรวจสอบ","เห็นข้อจำกัดของ QA"],["ภาคสนาม","วางแผนสำรวจต่อ"]]:
  [["ต้นไม้","ติดตามสัญญาณพืช"],["สถิติ","เห็นความเปลี่ยนแปลง"],["ตรวจสอบ","ดูหลักฐานรายวัน"],["ภาคสนาม","วางแผนตรวจ PDD"]];
 const letters=[icons.leaf,icons.chart,icons.clock,icons.pin];
 return section("6","การนำผลรายงานไปใช้ประโยชน์",
 '<div class="mcr-benefits">'+pts.map(([h,t],i)=>'<div class="mcr-benefit">'+letters[i]+'<strong>'+esc(h)+'</strong><span>'+esc(t)+'</span></div>').join("")+'</div>',
 'mcr-benefits-section');
}
function foot(generated){
 const g=generated?new Date(generated).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่ระบุ";
 return '<footer class="mcr-poster-foot"><div><b>DATA SOURCE</b> · Sentinel-2 L2A, PDD Boundaries, analysis_history.json<br>'+
 'ข้อมูลวิเคราะห์เผยแพร่: '+esc(g)+' • ข้อมูลว่างเป็น — • ตรวจการเปรียบเทียบ QA ก่อนใช้อ้างอิง</div>'+
 '<span>ENVIRONMENTAL MONITORING • 01 / 01</span></footer>';
}
function plotReport(view,mode,generated){
 return head(view,mode,generated)+
 '<div class="mcr-top-two">'+intro(view)+objectives(view)+'</div>'+
 methods(view)+plotResults(view)+
 '<div class="mcr-bottom-two">'+summary(view)+benefits(view)+'</div>'+
 foot(generated);
}
function provinceReport(view,mode,generated){
 return head(view,mode,generated)+
 '<div class="mcr-top-two">'+intro(view)+objectives(view)+'</div>'+
 methods(view)+provincialResults(view)+
 '<div class="mcr-bottom-two">'+summary(view)+benefits(view)+'</div>'+
 foot(generated);
}
let activeKey="";
function render({view,mode,generated}){
 const el=$("mc-report-paper");
 if(!el||!view)return;
 const key=view.kind+"|"+(view.plot||"province")+"|"+view.dates.join("|");
 activeKey=key;el.dataset.reportKind=view.kind;
 el.innerHTML=view.kind==="province"?provinceReport(view,mode,generated):plotReport(view,mode,generated);
}
function setPreview({plot,dates,html}){
 const el=$("mcr-images");
 if(!el||$("mc-report-paper")?.dataset.reportKind!=="plot")return;
 const key="plot|"+plot+"|"+(dates||[]).join("|");
 if(key!==activeKey)return;
 const container=document.createElement("div");container.innerHTML=html||"";
 const cards=[...container.querySelectorAll(".mc-scene")];
 if(!cards.length){
  el.innerHTML='<div class="mcr-no-scenes">ไม่พบภาพสีจริงสำหรับช่วงเวลาที่เลือก • ไม่ใช้ภาพอื่นแทนโดยอัตโนมัติ</div>';
  return;
 }
 el.innerHTML=cards.map((card,i)=>{
  const frame=card.querySelector(".mc-image");
  const image=frame?.querySelector("img");
  const aspect=frame?.style.aspectRatio||"1 / 1";
  // Keep both the pixel frame and the SVG polygon in exactly the same geometry.
  const content=image?frame.innerHTML:'<div class="mcr-img-missing">ไม่มีภาพสีจริงของวันนี้</div>';
  const label=card.querySelector("header")?.textContent||["A","B","C"][i];
  const qa=card.querySelector(".mc-qa")?.textContent||"INDEX_PENDING";
  return '<div class="mcr-image-card"><div class="mcr-img" style="aspect-ratio:'+esc(aspect)+'">'+content+'</div>'+
   '<div class="mcr-img-caption"><b>'+esc(label)+'</b><span>'+esc(qa)+'</span></div></div>';
 }).join("");
}
function ready(){const el=$("mc-report-paper");return !!el?.innerHTML.trim()&&!el.querySelector(".mcr-images-loading")}
async function print(){
 if(!ready())return;
 const el=$("mc-report-paper");
 document.body.classList.add("mc-print-report");
 try{
  const images=[...el.querySelectorAll("img")];
  await Promise.all(images.map(im=>im.complete?Promise.resolve():new Promise(resolve=>{
   im.addEventListener("load",resolve,{once:true});im.addEventListener("error",resolve,{once:true});
   setTimeout(resolve,4000);
  })));
  if(document.fonts?.ready)await document.fonts.ready.catch(()=>{});
  root.print();
 }finally{
  setTimeout(()=>document.body.classList.remove("mc-print-report"),1200);
 }
}
function bind(){root.addEventListener("afterprint",()=>document.body.classList.remove("mc-print-report"))}
root.MonitoringReport={render,setPreview,ready,print,bind,model:{plotReport,provinceReport,good,trusted}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})(window);