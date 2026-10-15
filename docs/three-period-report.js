/* Three-period, four-page print report. Raster pixels and scientific metrics stay separate. */
(function(global){
"use strict";
const $=id=>document.getElementById(id);
const modeNames={true_color:"ภาพสีจริง · True Color (B4–B3–B2)",false_color:"ภาพสีเท็จ · False Color (B8–B4–B3)",ndvi:"NDVI · ดัชนีความเขียวของพืช",mndwi:"MNDWI · ดัชนีเน้นน้ำเปิด",bsi:"BSI · ดัชนีดินโล่ง/พื้นผิวเปิด"};
const descriptions={true_color:"แสดงสภาพน้ำ พืช และดินตามสีใกล้เคียงธรรมชาติ",false_color:"พืชพรรณมักปรากฏสีแดงในภาพ NIR–Red–Green",ndvi:"ค่าที่สูงขึ้นมักสัมพันธ์กับความเขียวมากขึ้น ไม่ยืนยันการรอดตาย",mndwi:"ค่าที่สูงขึ้นอาจบ่งชี้น้ำเปิดมากขึ้น ต้องดูน้ำขึ้นลงและเมฆ",bsi:"ค่าที่สูงขึ้นอาจบ่งชี้ดิน/พื้นผิวเปิดมากขึ้น ต้องดูดินเปียกและตะกอน"};
const names=["true_color","false_color","ndvi","mndwi","bsi"];
const perPlot=new Map();
let catalog=null,geo=null;
const escape=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=(x,dp=3)=>x==null||!Number.isFinite(Number(x))?"—":Number(x).toFixed(dp);
const dateLabel=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))?d.slice(8)+"/"+d.slice(5,7)+"/"+(Number(d.slice(0,4))+543):"ยังไม่มีวันที่";
const iso=s=>{const x=String(s||"");return /^\d{8}$/.test(x)?x.slice(0,4)+"-"+x.slice(4,6)+"-"+x.slice(6):x};
const trusted=r=>r&&["VERIFIED","AUTO_VALID"].includes(r.analysis_status)&&Number(r.valid_pct)>=70;
const qtext=r=>!r?"มีภาพ • รอค่าดัชนี":r.analysis_status==="VERIFIED"?"ตรวจยืนยัน (VERIFIED)":r.analysis_status==="AUTO_VALID"?"ผ่าน QA อัตโนมัติ":r.analysis_status==="PARTIAL"?"ข้อมูลบางส่วน (PARTIAL)":"ข้อมูลไม่เพียงพอ";
function getMetric(r,key){
 if(!r||r.analysis_status==="NO_DATA")return null;
 if(r[key]!=null&&Number.isFinite(Number(r[key]))&& (trusted(r)||r.analysis_status==="PARTIAL"))return {value:Number(r[key]),provisional:!trusted(r)};
 const alt=r["observed_"+key];
 return r.analysis_status==="PARTIAL"&&alt!=null&&Number.isFinite(Number(alt))?{value:Number(alt),provisional:true}:null;
}
function valueText(r,key){
 const a=getMetric(r,key);
 return !a?"—":n(a.value)+" "+(a.provisional?"*":"");
}
function sourceInfo(r){return r&&r.valid_pct!=null?n(r.valid_pct,1)+"% usable":"ยังไม่มีผล QA";}
async function fetchJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error(url+" HTTP "+r.status);return r.json()}
async function loadCommon(){
 if(!catalog)catalog=await fetchJson("data/satellite_parts.json");
 if(!geo)geo=await fetchJson("data/boundaries.geojson");
}
function chooseDefaults(plot,files){
 const all=[...new Set((files||[]).filter(x=>x.plot===plot).map(x=>x.date).filter(Boolean))].sort();
 const p=global.plots?.find(x=>x.plot===plot); // only if explicitly exported; dates from catalog otherwise
 let baseline=iso(p?.baseline),event=iso(p?.current);
 if(!all.includes(baseline))baseline=all[0]||"";
 if(!all.includes(event)||event===baseline)event=all.find(x=>x>baseline)||all.find(x=>x!==baseline)||"";
 const latest=[...all].reverse().find(x=>x!==event&&x!==baseline)||"";
 return [baseline,event,latest];
}
function datesFromData(plot,files,rows){
 return [...new Set([...(files||[]).filter(x=>x.plot===plot).map(x=>x.date),...(rows||[]).map(x=>x.date)].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x))))].sort();
}
function selectDates(plot,files,rows,p){
 const all=datesFromData(plot,files,rows);
 let saved=perPlot.get(plot);
 if(!saved){const d=chooseDefaults(plot,files);const baseline=iso(p.baseline),event=iso(p.current);
 saved=[all.includes(baseline)?baseline:d[0],all.includes(event)?event:d[1],d[2]];
 perPlot.set(plot,saved);}
 const uniq=[];
 for(const d of saved){if(d&&all.includes(d)&&!uniq.includes(d))uniq.push(d);}
 let next=all.slice().reverse().find(d=>!uniq.includes(d))||"";
 const out=saved.map(d=>all.includes(d)?d:"");
 // preserve intentionally empty third if no distinct third date
 for(let i=0;i<3;i++){if(out[i]&&out.indexOf(out[i])!==i)out[i]="";}
 return {all,dates:out};
}
function showControls(plot,files,rows,p){
 const selected=selectDates(plot,files,rows,p);
 const ids=["three-date-a","three-date-b","three-date-c"];
 for(let i=0;i<3;i++){
  const select=$(ids[i]);if(!select)continue;
  select.innerHTML='<option value="">— ยังไม่มีวันที่ —</option>'+selected.all.map(d=>'<option value="'+escape(d)+'">'+escape(dateLabel(d))+'</option>').join("");
  select.value=selected.dates[i]||"";
  select.onchange=()=>{const previous=perPlot.get(plot)||selected.dates.slice();previous[i]=select.value;perPlot.set(plot,previous);if(typeof renderReportPreview==="function")renderReportPreview();};
 }
 const hint=$("three-report-note");
 if(hint)hint.textContent="ภาพแสดงได้แม้ไม่ผ่าน QA แต่ค่าที่ไม่ผ่าน QA จะมีเครื่องหมาย * หรือเว้นว่าง • หากเลือกวันที่ซ้ำ จะไม่ใช้ภาพซ้ำแทนอีกช่วงเวลา";
 return selected.dates;
}
function geometryFeature(plot){return geo?.features?.filter(f=>f.properties?.plot===plot&&f.geometry)||[]}
function ringsFrom(g){
 if(!g)return[];
 if(g.type==="Polygon")return g.coordinates||[];
 if(g.type==="MultiPolygon")return(g.coordinates||[]).flat();
 return [];
}
function outline(plot,bounds){
 const parts=geometryFeature(plot);if(!parts.length||!Array.isArray(bounds))return"";
 const sw=bounds[0],ne=bounds[1],dx=ne[1]-sw[1],dy=ne[0]-sw[0];if(dx<=0||dy<=0)return"";
 let paths=[];
 for(const f of parts)for(const ring of ringsFrom(f.geometry)){
  let points=ring.map(p=>{const x=(p[0]-sw[1])/dx*1000,y=(ne[0]-p[1])/dy*1000;return x.toFixed(2)+","+y.toFixed(2)}).join(" ");
  if(points)paths.push('<polygon points="'+points+'" />');
 }
 return '<svg class="three-boundary" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+paths.join("")+'</svg>';
}
function fullLayer(layers,plot,date,mode){
 if(!date)return null;
 const sources=layers.filter(l=>l.plot===plot&&l.date===date&&l.mode===mode&&l.src);
 const priority={DIRECT:0,LATEST_RECT:1,HIST_CLEAR_RECT_SCL0:2,NO_CLOUD_FILTER:3};
 sources.sort((a,b)=>(priority[a.source_suffix]??5)-(priority[b.source_suffix]??5));
 return sources[0]||null;
}
function figure(plot,date,layer,record,mode){
 if(!date)return'<div class="three-missing">ไม่มีภาพวันที่สามที่แตกต่างจากสองช่วงแรก</div>';
 if(!layer)return'<div class="three-missing">ยังไม่มีชั้นภาพ '+escape(mode.toUpperCase())+'<small>'+escape(dateLabel(date))+' • ไม่แสดงภาพจากวันอื่นแทน</small></div>';
 const w=Number(layer.width)||128,h=Number(layer.height)||128,ratio=Math.min(2.5,Math.max(.45,w/h));
 const lbl=mode==="true_color"||mode==="false_color"?"ภาพแสดงผลจาก Sentinel-2":escape(mode.toUpperCase())+" เฉลี่ย: "+escape(valueText(record,mode));
 const result='<div class="three-photo" style="aspect-ratio:'+w+'/'+h+';width:min(100%,'+Math.round(158*ratio)+'px)">'+
  '<img src="'+escape(layer.src)+'" alt="'+escape(modeNames[mode])+'" loading="eager" />'+outline(plot,layer.bounds)+'</div>';
 return result+'<div class="three-cell-stat">'+lbl+'</div><div class="three-cell-meta">'+escape(dateLabel(date))+' • '+escape(qtext(record))+' • '+escape(sourceInfo(record))+'</div>'+
 '<div class="three-cell-source">Sentinel-2 '+escape(layer.resolution_m||"")+' • raster '+w+'×'+h+' px</div>';
}
function periodBand(plot,dates,byDate,layers,mode,number){
 return '<section class="three-band"><header><b>'+number+' · '+escape(modeNames[mode])+'</b><span>'+escape(descriptions[mode])+'</span></header><div class="three-band-row">'+
 dates.map(d=>'<div class="three-cell">'+figure(plot,d,fullLayer(layers,plot,d,mode),byDate.get(d),mode)+'</div>').join("")+'</div></section>';
}
function heading(plot,area,kicker,title,subtitle){
 return '<div class="three-doc-head"><div><div class="three-eyebrow">'+escape(kicker)+'</div><h2>'+escape(title)+'</h2><p>'+escape(subtitle)+'</p></div><div class="three-head-side"><b>'+escape(plot)+'</b><span>จังหวัดระยอง</span><small>พื้นที่ PDD '+escape(n(area,2))+' ไร่</small></div></div>';
}
function foot(page){return'<div class="three-page-foot"><span>Sentinel-2 L2A • วิเคราะห์ภายในขอบเขต PDD • ตรวจ QA ก่อนสรุป</span><strong>'+page+' / 04</strong></div>'}
function periodHead(dates){return'<div class="three-period-head">'+dates.map((d,i)=>'<div><b>0'+(i+1)+' · '+["ก่อนพบเหตุ / วันฐาน","รอบตรวจพบการเปลี่ยนแปลง","ติดตามล่าสุด"][i]+'</b><span>'+escape(dateLabel(d))+'</span></div>').join("")+'</div>'}
function table(plot,dates,byDate){
 const k=[["ndvi","NDVI (ความเขียวพืช)"],["mndwi","MNDWI (ดัชนีน้ำเปิด)"],["bsi","BSI (ดัชนีดินเปิดโล่ง)"]];
 return '<table class="three-index-table"><thead><tr><th>ดัชนี</th>'+dates.map(d=>'<th>'+escape(dateLabel(d))+'</th>').join("")+'<th>เทียบช่วง 1 → 2</th></tr></thead><tbody>'+k.map(([key,label])=>{
  const vals=dates.map(d=>getMetric(byDate.get(d),key));const a=vals[0],b=vals[1],delta=a&&!a.provisional&&b&&!b.provisional?b.value-a.value:null;
  return'<tr><td><b>'+escape(label)+'</b></td>'+vals.map((m,i)=>'<td'+(i===2?' class="three-last-col"':'')+'>'+(m?escape(n(m.value))+(m.provisional?'<sup>*</sup>':''):'—')+'</td>').join("")+'<td>'+(delta==null?'—':(delta>=0?'+':'')+escape(n(delta)))+'</td></tr>';
 }).join("")+'</tbody></table>';
}
function evidence(dates,byDate){
 const r0=byDate.get(dates[0]),r1=byDate.get(dates[1]),r2=byDate.get(dates[2]);
 const w0=trusted(r0)&&r0.water_rai!=null?r0.water_rai:null,w1=trusted(r1)&&r1.water_rai!=null?r1.water_rai:null;
 const change=w0!=null&&w1!=null?w1-w0:null;
 const delta=change==null?'ยังไม่สามารถเปรียบเทียบพื้นที่น้ำระหว่างสองรอบแรกได้':"พื้นที่น้ำเปิดจากสองรอบที่ผ่าน QA "+(change>0?"เพิ่ม":change<0?"ลด":"ไม่เปลี่ยน")+
 'สุทธิ '+n(Math.abs(change),2)+' ไร่ ('+n(w0,2)+' → '+n(w1,2)+' ไร่)';
 const recent=r2?(qtext(r2)+' • พื้นที่ข้อมูลที่ใช้ได้ '+sourceInfo(r2)):'ไม่มีค่าดัชนีล่าสุด';
 return {delta,summary:delta+' ข้อมูลติดตามล่าสุด '+dateLabel(dates[2])+' มีสถานะ '+recent+
 '. ค่าที่มีเครื่องหมาย * เป็นข้อมูลบางส่วนและยังไม่ถือเป็นผลยืนยันของแปลงทั้งหมด ควรตรวจน้ำขึ้นลง ฝน ภาพดาวเทียมและข้อมูลภาคสนามก่อนสรุปผลกระทบต่อต้นไม้',
   qa:[r0,r1,r2].map((r,i)=>dateLabel(dates[i])+': '+qtext(r)+' ('+sourceInfo(r)+')').join(' • ')};
}
function thirdPage(p,dates,byDate){
 const e=evidence(dates,byDate);const qaRow=dates.map((d,i)=>'<div><strong>ช่วงที่ '+(i+1)+'</strong><span>'+escape(dateLabel(d))+'</span><small>'+escape(qtext(byDate.get(d)))+'</small><small>'+escape(sourceInfo(byDate.get(d)))+'</small></div>').join("");
 return '<section class="three-page">'+heading(p.plot,p.area_rai,'FLOOD MONITORING / DATA REVIEW','สรุปค่าดัชนีตามช่วงเวลา','ค่าตรวจยืนยันและค่าชั่วคราวแยกสถานะชัดเจน')+
 '<h3 class="three-section-title">ดัชนีจากภาพ 3 ช่วงเวลา</h3>'+table(p.plot,dates,byDate)+
 '<p class="three-footnote"><b>*</b> ค่าชั่วคราวจากพื้นที่ที่ผ่าน QA บางส่วนเท่านั้น; ช่องว่างหมายถึงไม่มีผลที่รองรับ ไม่ใช่ค่า 0 • แถวพื้นที่น้ำเปิด (ไร่) ไม่แสดงตามรูปแบบที่กำหนด</p>'+
 '<h3 class="three-section-title">คุณภาพภาพและความน่าเชื่อถือ</h3><div class="three-qa-tiles">'+qaRow+'</div>'+
 '<h3 class="three-section-title">การเปลี่ยนแปลงที่ควรบันทึก</h3><div class="three-analysis">'+escape(e.delta)+'</div>'+
 '<div class="three-analysis"><b>ข้อสังเกตจากภาพ:</b> เปรียบเทียบภาพสีจริง สีเท็จ NDVI MNDWI และ BSI จากวันเดียวกัน และใช้เกณฑ์สีเดียวกันในการอ่านแนวโน้มเมื่อเป็นไปได้</div>'+
 '<h3 class="three-section-title">สรุปสถานการณ์สำหรับผู้บริหาร</h3><div class="three-summary">'+escape(e.summary)+'</div>'+
 '<p class="three-footnote">หมายเหตุ: ค่าเฉลี่ยพืชระหว่างวันอาจใช้พื้นที่ที่ผ่าน QA ต่างกัน จึงไม่ใช่การเปรียบเทียบพืชรายพิกเซลแบบ Common Valid Mask</p>'+foot("03")+'</section>';
}
function fourthPage(p,dates){
 const items=[
 ["NDVI (ดัชนีความเขียวพืช)","ค่าสูงขึ้นมักสัมพันธ์กับความเขียวมากขึ้น แต่เมฆ เงาและน้ำบนผิวดินเปลี่ยนค่าได้ ไม่ใช้ยืนยันต้นไม้รอดตาย"],
 ["MNDWI (ดัชนีน้ำเปิด)","ค่าสูงขึ้นอาจสะท้อนน้ำเปิดมากขึ้น ต้องตรวจเวลาน้ำขึ้น–น้ำลง ดินเปียก ตะกอนและเมฆก่อนระบุว่าน้ำท่วม"],
 ["BSI (ดัชนีดินเปิดโล่ง)","ค่าสูงขึ้นอาจแสดงดินหรือพื้นผิวเปิดเด่นขึ้น แต่ความชื้น/ตะกอนทำให้ค่าผันผวนได้"],
 ["ภาพสีจริง (B4–B3–B2)","ตรวจสีของน้ำ พื้นดิน และพืชจากภาพตามธรรมชาติ ระวังเมฆและเงา"],
 ["ภาพสีเท็จ (B8–B4–B3)","ช่วยเน้นบริเวณพืชพรรณที่มักเป็นสีแดง โทนสีขึ้นกับวิธี stretch"]
 ];
 return '<section class="three-page">'+heading(p.plot,p.area_rai,'FLOOD MONITORING / INTERPRETATION GUIDE','คู่มืออ่านภาพและแปลผลร่วมกัน','คำอธิบายดัชนีและข้อจำกัดสำหรับการใช้ประกอบการตัดสินใจ')+
 '<div class="three-interpretation">'+items.map(([a,b])=>'<div><strong>'+escape(a)+'</strong><span>'+escape(b)+'</span></div>').join("")+'</div>'+
 '<h3 class="three-section-title">ข้อควรระวังในการตรวจสอบ</h3><ul class="three-checks"><li>แสดงภาพได้แม้ไม่ผ่าน QA แต่ไม่เอาข้อมูลใช้ไม่ได้ไปคำนวณแทนพื้นที่ไม่มีข้อมูล</li><li>ใช้ขอบเขตแปลง PDD เดียวกันและตรวจวันที่ทุกภาพให้ตรงกับค่าดัชนี</li><li>ตรวจเมฆ เงา ความครอบคลุม และการเปลี่ยนแปลงระดับน้ำขึ้นลง</li><li>ไม่สรุปการรอดตายของต้นไม้จากค่า NDVI / MNDWI / BSI เพียงค่าเดียว</li><li>แหล่งตัวเลข: analysis_history.json; แหล่งภาพ: full_preview_part_N.json จาก Sentinel-2</li></ul>'+
 '<div class="three-provenance"><b>ข้อมูลอ้างอิง</b><div>แปลง: '+escape(p.plot)+' · พื้นที่ PDD: '+escape(n(p.area_rai,2))+' ไร่</div><div>วันภาพ: '+dates.map(dateLabel).map(escape).join(' | ')+'</div><div>แหล่งภาพ: Sentinel-2 L2A; Full Preview จาก GeoTIFF จริง; native raster pixels เท่ากับขนาดในแต่ละภาพ</div><div>NDVI = (B8−B4)/(B8+B4) · MNDWI = (B3−B11)/(B3+B11) · BSI = (B11+B4−B8−B2)/(B11+B4+B8+B2)</div><div>ภาพสำหรับประกอบรายงานไม่ใช่หลักฐานยืนยันความเสียหายและอาจมีบริเวณไม่มีข้อมูล</div></div>'+foot("04")+'</section>';
}
async function render(paper,p,files){
 if(!paper||!p)throw Error("Missing report plot");
 paper.innerHTML='<div class="three-loading">กำลังจัดภาพและค่าดัชนีจาก GeoTIFF...</div>';
 const history=await fetchJson("data/analysis_history.json"),rows=history.plots?.[p.plot]||[];
 await loadCommon();
 const part=(catalog.parts||[]).findIndex(x=>(x.plots||[]).includes(p.plot));
 if(part<0)throw Error("ไม่พบกลุ่มข้อมูลภาพสำหรับ "+p.plot);
 const layerData=await fetchJson("data/full_preview_part_"+(part+1)+".json");
 const layers=Array.isArray(layerData.layers)?layerData.layers:[];
 const dates=showControls(p.plot,files,rows,p);
 const byDate=new Map(rows.map(r=>[r.date,r]));
 const imRows=[periodBand(p.plot,dates,byDate,layers,names[0],"01"),periodBand(p.plot,dates,byDate,layers,names[1],"02"),periodBand(p.plot,dates,byDate,layers,names[2],"03"),periodBand(p.plot,dates,byDate,layers,names[3],"04"),periodBand(p.plot,dates,byDate,layers,names[4],"05")];
 const common="ภาพเต็มตามขอบเขต GeoTIFF พร้อมแนว PDD สีแดง • ค่าเฉลี่ยคำนวณเฉพาะในขอบเขตแปลง";
 paper.classList.add("three-report-paper");
 paper.innerHTML='<div class="three-document">'+
 '<section class="three-page">'+heading(p.plot,p.area_rai,"FLOOD & ENVIRONMENTAL MONITORING / 3 PERIODS","รายงานติดตามการเปลี่ยนแปลงจากน้ำท่วม",common)+periodHead(dates)+imRows.slice(0,3).join("")+'<p class="three-footnote">ภาพแสดงทุกวันที่มี ไม่คัดออกตาม QA • ขนาดภาพเท่ากับข้อมูล Raster ที่มีอยู่ ไม่เพิ่มความละเอียดเทียม</p>'+foot("01")+'</section>'+
 '<section class="three-page">'+heading(p.plot,p.area_rai,"FLOOD & ENVIRONMENTAL MONITORING / MAP COMPARISON","แผนที่ดัชนีน้ำและดิน",common)+periodHead(dates)+imRows.slice(3).join("")+'<p class="three-footnote">ค่าดัชนีด้านนอกแปลงเป็นภาพประกอบเท่านั้น • ค่าสถิติในตารางใช้เฉพาะพิกเซลที่มีข้อมูลรองรับภายใน PDD</p>'+foot("02")+'</section>'+
 thirdPage(p,dates,byDate)+fourthPage(p,dates)+'</div>';
 return dates;
}
global.ThreePeriodReport={render,clear:()=>{const p=$("report-paper");p?.classList.remove("three-report-paper")}};
})(window);
