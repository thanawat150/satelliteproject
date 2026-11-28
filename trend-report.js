/* Live Report Trends — reads append-only analysis_history.json. */
(function(){
"use strict";
let history=null,waterFC=null,loading=null,charts=[],miniMap=null,miniLayers=[];
const fmt=n=>n==null||Number.isNaN(Number(n))?"—":Number(n).toLocaleString("th-TH",{maximumFractionDigits:2});
const fmtIndex=n=>n==null||Number.isNaN(Number(n))?"—":Number(n).toLocaleString("th-TH",{minimumFractionDigits:3,maximumFractionDigits:5});
const dth=d=>{if(!d)return"—";const [y,m,dd]=d.split("-");return `${dd}/${m}/${y}`};
const trusted=x=>x&&["VERIFIED","AUTO_VALID"].includes(x.analysis_status)&&(x.valid_pct==null||x.valid_pct>=70);
async function load(force=false){
 if(loading)return loading;
 if(history&&!force)return history;
 loading=Promise.all([
   fetch("data/analysis_history.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("analysis_history HTTP "+r.status);return r.json()}),
   fetch("data/water_history.geojson",{cache:"no-store"}).then(r=>r.ok?r.json():({type:"FeatureCollection",features:[]})).catch(()=>({type:"FeatureCollection",features:[]}))
 ]).then(([h,w])=>{history=h;waterFC=w;return h}).finally(()=>{loading=null});
 return loading;
}
function allRows(plot){return [...(history?.plots?.[plot]||[])].sort((a,b)=>a.date.localeCompare(b.date))}
function selection(plot){return window.ReportSelector?.view(plot,history,typeof satelliteFiles==="undefined"?[]:satelliteFiles)||{dates:allRows(plot).map(x=>x.date),graphKeys:["water","water-change","ndvi","ndre","ndmi","mndwi","bsi","qa"],mode:"dates",scenes:[]}}
function rows(plot){const chosen=new Set(selection(plot).dates);return allRows(plot).filter(x=>chosen.has(x.date))}
function imageDates(plot){
  try{
    if(typeof satelliteFiles==='undefined')return[];
    return [...new Set(satelliteFiles.filter(x=>x.plot===plot&&x.sensor==='Sentinel-2').map(x=>x.date).filter(Boolean))].sort();
  }catch(_){return[]}
}
function pendingIndexDates(plot){
  const analyzed=new Set(allRows(plot).filter(x=>["VERIFIED","AUTO_VALID","PARTIAL"].includes(x.analysis_status)).map(x=>x.date));
  return imageDates(plot).filter(d=>new Set(selection(plot).dates).has(d)&&!analyzed.has(d));
}
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
 const qaSkipped=all.filter(x=>x.bsi==null&&x.bsi_issue).map(x=>dth(x.date)+" (พิกเซลใช้ได้ "+fmt(x.bsi_valid_pct)+"%)");
 if(qaSkipped.length && root){
  const info=document.createElement("p");info.className="live-footnote";
  info.textContent="BSI ไม่มีค่าในบางวันที่เลือกเพราะไม่ผ่าน QA: "+qaSkipped.join(", ")+" — ไม่เติมตัวเลขสมมติ";
  root.querySelector(".live-grid")?.after(info);
 }
 
 const verifiedWater=all.map(x=>trusted(x)?x.water_rai:null);
 const partialWater=all.map(x=>x.analysis_status==="PARTIAL"?x.observed_water_rai:null);
 makeChart(root.querySelector('[data-chart="water"]'),"line",labels,[
  {label:"พื้นที่น้ำที่ผ่าน QA (ไร่)",data:verifiedWater,borderColor:"#1688bd",backgroundColor:"rgba(22,136,189,.12)",pointRadius:3,tension:.25,spanGaps:false},
  {label:"น้ำที่ตรวจพบในพื้นที่ข้อมูลบางส่วน",data:partialWater,borderColor:"#d98b27",backgroundColor:"rgba(217,139,39,.12)",borderDash:[5,4],pointRadius:4,tension:.2,spanGaps:false}
 ],"ไร่");
 const changes=all.map((x,i)=>{if(i===0||!trusted(x))return null;const prev=[...all.slice(0,i)].reverse().find(trusted);return prev&&x.water_rai!=null&&prev.water_rai!=null?+(x.water_rai-prev.water_rai).toFixed(2):null});
 makeChart(root.querySelector('[data-chart="water-change"]'),"bar",labels,[{label:"น้ำเพิ่ม/ลดจากรอบก่อน (ไร่)",data:changes,backgroundColor:changes.map(v=>v==null?"rgba(120,130,140,.25)":v>=0?"rgba(43,151,196,.65)":"rgba(219,111,83,.65)"),borderWidth:0}],"ไร่");
 makeChart(root.querySelector('[data-chart="ndvi"]'),"line",labels,[{label:"NDVI",data:all.map(x=>trusted(x)?x.ndvi:null),borderColor:"#4b9253",pointRadius:3,tension:.25}],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="ndre"]'),"line",labels,[{label:"NDRE",data:all.map(x=>trusted(x)?x.ndre:null),borderColor:"#7c6dad",pointRadius:3,tension:.25}],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="ndmi"]'),"line",labels,[{label:"NDMI",data:all.map(x=>trusted(x)?x.ndmi:null),borderColor:"#398aa3",pointRadius:3,tension:.25}],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="mndwi"]'),"line",labels,[{label:"MNDWI",data:all.map(x=>trusted(x)?x.mndwi:null),borderColor:"#2a64a0",pointRadius:3,tension:.25}],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="bsi"]'),"line",labels,[{label:"BSI (ดินเปิดโล่ง)",data:all.map(x=>trusted(x)?x.bsi:null),borderColor:"#ae8853",pointRadius:3,tension:.25}],"ค่าดัชนี");
 makeChart(root.querySelector('[data-chart="qa"]'),"bar",labels,[{label:"พื้นที่ข้อมูลที่ใช้ได้ (%)",data:all.map(x=>x.valid_pct),backgroundColor:all.map(x=>x.valid_pct>=70?"rgba(46,144,93,.62)":x.valid_pct>=20?"rgba(218,145,43,.65)":"rgba(161,84,84,.55)"),borderWidth:0}],"%");
}
function tableRows(plot){
 return rows(plot).map(x=>{
   const change=x.change_water_rai!=null?x.change_water_rai:null;
   const status=x.analysis_status==="VERIFIED"?"Verified":x.analysis_status==="AUTO_VALID"?"Auto QA ผ่าน":x.analysis_status==="PARTIAL"?"ข้อมูลบางส่วน":"ไม่ใช้วิเคราะห์";
   const water=x.water_rai!=null?fmt(x.water_rai):(x.observed_water_rai!=null?fmt(x.observed_water_rai)+"*":"—");
   return `<tr><td>${dth(x.date)}</td><td><span class="live-status live-${x.analysis_status.toLowerCase()}">${status}</span></td><td>${fmt(x.valid_pct)}%</td><td>${water}</td><td>${x.water_pct==null?"—":fmt(x.water_pct)+"%"}</td><td>${change==null?"—":(change>=0?"+":"")+fmt(change)}</td><td>${fmtIndex(x.ndvi)}</td><td>${fmtIndex(x.ndre)}</td><td>${fmtIndex(x.ndmi)}</td><td>${fmtIndex(x.mndwi)}</td><td>${fmtIndex(x.bsi)}</td></tr>`;
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
 const wanted=new Set(selection(plot).dates);
 const fs=waterFeatures(plot).filter(f=>wanted.has(f.properties.date));
 const wrap=root.querySelector(".live-water-map-wrap");if(!wrap)return;
 if(!fs.length){wrap.innerHTML='<div class="live-empty">ยังไม่มี Polygon พื้นที่น้ำของวันที่เลือก • กราฟใช้ผลวิเคราะห์ที่มีอยู่จริง</div>';return;}
 wrap.innerHTML='<div class="live-water-map-head"><strong>เปรียบเทียบขอบเขตน้ำตามวันที่ติ๊กเลือก</strong><span>สีแต่ละชั้นแทนวันที่ต่างกัน • เป็นผลวิเคราะห์จาก Raster</span></div><div class="live-water-map"></div><div class="live-footprint-legend"></div>';
 miniMap=L.map(wrap.querySelector(".live-water-map"),{zoomControl:true,attributionControl:false});
 L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19}).addTo(miniMap);
 const boundary=boundaryByPlot?.get(plot);
 if(boundary){miniLayers.push(L.geoJSON(boundary,{style:{color:"#d75b4d",weight:2,fill:false}}).addTo(miniMap))}
 const colors=["#1776b6","#22a3c2","#27a088","#8ab85a","#e0a146","#ce685c","#805fc0","#d05c9c"];
 const legend=wrap.querySelector(".live-footprint-legend");
 fs.forEach((f,i)=>{
  const color=colors[i%colors.length],p=f.properties;
  miniLayers.push(L.geoJSON(f,{style:{color,weight:2,fillColor:color,fillOpacity:.17}}).addTo(miniMap));
  const chip=document.createElement("span");chip.className="live-footprint-chip";
  const square=document.createElement("i");square.style.background=color;chip.append(square);
  chip.append(document.createTextNode(dth(p.date)+" • "+fmt(p.derived_water_rai)+" ไร่"+(p.analysis_status==="PARTIAL"?" (บางส่วน)":"")));
  legend.appendChild(chip);
 });
 const group=L.featureGroup(miniLayers);
 setTimeout(()=>{if(!miniMap)return;miniMap.invalidateSize();if(group.getBounds().isValid())miniMap.fitBounds(group.getBounds(),{padding:[12,12],maxZoom:17})},30);
}

const explain={
 ndvi:["NDVI (ความเขียวพืช)","สะท้อนความเขียวจากการสะท้อนแสง Red/NIR","ลดลงอาจหมายถึงความเขียวหรือใบพืชลดลง แต่ยังไม่พิสูจน์ว่าต้นไม้ตาย","เพิ่มขึ้นอาจหมายถึงพืชเขียวมากขึ้น"],
 ndre:["NDRE (ดัชนีขอบแดงของพืช)","สัมพันธ์กับการเปลี่ยนแปลงคลอโรฟิลล์บริเวณ Red Edge","ลดลงอาจมีความเครียดหรือคลอโรฟิลล์เปลี่ยน ควรตรวจภาคสนาม","เพิ่มขึ้นอาจสะท้อนสัญญาณคลอโรฟิลล์มากขึ้น"],
 ndmi:["NDMI (ความชื้นพืช/พื้นที่)","ใช้ NIR/SWIR ติดตามสัญญาณความชื้น","ลดลงอาจบ่งชี้ความชื้นลดลง","เพิ่มขึ้นอาจมีความชื้นเพิ่ม แต่ไม่ได้แปลว่าพืชสุขภาพดีเสมอ"],
 mndwi:["MNDWI (ดัชนีน้ำเปิด)","ใช้ Green/SWIR เพื่อเน้นบริเวณที่มีลักษณะคล้ายน้ำเปิด","ลดลงอาจมีน้ำเปิดน้อยลง หรือผลของน้ำขึ้นน้ำลง","เพิ่มขึ้นอาจมีน้ำเปิดมากขึ้น ต้องตรวจข้อมูลน้ำขึ้นน้ำลง"],
 bsi:["BSI (ดินเปิดโล่ง)","ใช้การสะท้อนแสงหลายช่วงคลื่นชี้พื้นผิวดินที่เปิดโล่ง","ลดลงอาจมีพืชหรือน้ำปกคลุมดินเพิ่ม","เพิ่มขึ้นอาจมีดินเปิดโล่งมากขึ้น"],
 water_rai:["พื้นที่น้ำ (ไร่)","พื้นที่ที่จำแนกเป็นน้ำและผ่าน QA ภายในขอบเขตแปลง","ลดลงไม่ได้ยืนยันว่าผลกระทบจากน้ำท่วมสิ้นสุด","เพิ่มขึ้นไม่ได้ยืนยันอุทกภัยโดยไม่มีบริบท"]
};
function story(plot,key){
 const a=rows(plot).filter(trusted).filter(x=>Number.isFinite(Number(x[key]))&&x[key]!=null);
 if(a.length<2)return explain[key][0]+": ยังมีข้อมูลผ่าน QA ไม่ถึงสองวัน";
 const first=a[0],last=a.at(-1),diff=Number(last[key])-Number(first[key]);
 const note=Math.abs(diff)<0.0005?"ค่าค่อนข้างคงที่":(diff<0?explain[key][2]:explain[key][3]);
 const f=key==="water_rai"?fmt:fmtIndex;
 return explain[key][0]+": "+f(first[key])+" → "+f(last[key])+" ("+(diff>0?"+":"")+f(diff)+") — "+note;
}
function addExplanations(plot,root){
 const sections=[
 ["water","พื้นที่น้ำ",["water_rai"]],
 ["water-change","น้ำเพิ่ม/ลด",["water_rai"]],
 ["ndvi","NDVI",["ndvi"]],["ndre","NDRE",["ndre"]],
 ["ndmi","NDMI",["ndmi"]],["mndwi","MNDWI",["mndwi"]],
 ["bsi","ดินเปิดโล่ง",["bsi"]],["qa","คุณภาพข้อมูล",[]]
 ];
 for(const [chart,label,keys] of sections){
   const canvas=root.querySelector('[data-chart="'+chart+'"]');if(!canvas)continue;
   const card=canvas.closest("article");
   if(!card)return;
   const box=document.createElement("div");box.className="live-explanation";
   const text=keys.length?keys.map(k=>story(plot,k)).join(" • "):"QA (ข้อมูลใช้ได้): เปอร์เซ็นต์พื้นที่ที่ไม่ถูกเมฆ เงา หรือค่าผิดปกติบดบัง ต้องอ่านควบคู่กับทุกกราฟ";
   box.textContent=label+" — "+text;card.appendChild(box);
 }
 const overview=document.createElement("div");overview.className="live-interpretations";
 const h=document.createElement("h4");h.textContent="สรุปภาพรวมจากวันที่ที่เลือก";overview.appendChild(h);
 for(const key of ["water_rai","ndvi","ndre","ndmi","mndwi","bsi"]){const p=document.createElement("p");p.textContent=story(plot,key);overview.appendChild(p)}
 const disclaimer=document.createElement("p");disclaimer.className="disclaimer";disclaimer.textContent="ค่าดัชนีบอกสัญญาณเชิงภาพดาวเทียม ไม่ใช่การยืนยันสาเหตุหรือความเสียหาย ต้องพิจารณาน้ำขึ้นลง เมฆ ฤดูกาล และสำรวจภาคสนาม";overview.appendChild(disclaimer);
 root.querySelector(".live-grid")?.after(overview);
}
function appendSelectedSatelliteImages(plot,root){
 const sel=selection(plot);
 const scenes=sel.scenes||[];
 const section=document.createElement("section");section.className="report-section report-imagery";
 const title=document.createElement("h4");title.textContent=sel.mode==="annual"?"ภาพดาวเทียมตัวแทนรายปี (ปีละ 1 ภาพ)":"ภาพดาวเทียมตามวันที่เลือก";section.appendChild(title);
 const note=document.createElement("p");note.className="report-imagery-note";
 note.textContent=sel.mode==="annual"?"ภาพตัวแทนเป็นภาพจริงจากวันที่มีข้อมูลที่ดีที่สุดเท่าที่มี ไม่ใช่ค่าเฉลี่ยตลอดทั้งปี • ปีที่ไม่มีภาพจะไม่แสดง":"แสดงภาพที่มีอยู่จริงตามวันที่เลือก • วันที่ไม่มีภาพแสดงผลหรือไม่มีข้อมูล 10m จะระบุไว้ตามจริง";
 section.appendChild(note);
 const grid=document.createElement("div");grid.className="report-imagery-grid";
 const obs=new Map((sel.observations||[]).map(r=>[r.date,r]));
 for(const d of sel.dates){
  const candidates=scenes.filter(x=>x.date===d&&x.web_preview_url);
  candidates.sort((a,b)=>{
   const pri=x=>x.resolution==="10m"?0:x.resolution==="20m"?1:2;
   return pri(a)-pri(b);
  });
  const file=candidates[0];
  const item=document.createElement("figure");item.className="report-imagery-item";
  const v=obs.get(d);const qa=v?.analysis_status||"NOT_ANALYZED";
  if(file){
   const im=document.createElement("img");im.src=file.web_preview_url;im.alt=plot+" ภาพ Sentinel-2 "+d+" "+file.resolution;
   im.loading="eager";im.decoding="async";item.appendChild(im);
  }else{
   const missing=document.createElement("div");missing.className="report-imagery-missing";missing.textContent="ยังไม่มีภาพ Preview ที่แสดงได้";item.appendChild(missing);
  }
  const caption=document.createElement("figcaption");
  caption.textContent=(sel.mode==="annual"?d.slice(0,4)+" • ":"")+dth(d)+" • "+(file?.resolution||"ไม่ระบุความละเอียด")+" • "+(file?.preview_kind||"ยังไม่มีภาพ")+" • "+(statusTextLabel(qa))+" • QA "+fmt(v?.valid_pct)+"%";
  item.appendChild(caption);grid.appendChild(item);
 }
 if(!sel.dates.length){const p=document.createElement("p");p.className="live-empty";p.textContent="ยังไม่ได้เลือกวันที่หรือปี";grid.appendChild(p)}
 section.appendChild(grid);
 const table=root.querySelector(".live-table-wrap");if(table)table.before(section);else root.appendChild(section);
}
function statusTextLabel(code){return {VERIFIED:"ตรวจยืนยัน",AUTO_VALID:"ผ่าน QA อัตโนมัติ",PARTIAL:"ข้อมูลบางส่วน",NO_DATA:"ไม่ผ่าน QA",NOT_ANALYZED:"ยังไม่วิเคราะห์"}[code]||code}
const graphItems={water:"พื้นที่น้ำที่ผ่าน QA (ไร่)","water-change":"น้ำเพิ่ม/ลด (ไร่)",ndvi:"NDVI — ความเขียวพืช",ndre:"NDRE — ขอบแดงพืช",ndmi:"NDMI — ความชื้นพืช/พื้นที่",mndwi:"MNDWI — น้ำเปิด",bsi:"BSI — ดินเปิดโล่ง",qa:"คุณภาพข้อมูล (%)"};
function graphCards(plot){
 const keys=selection(plot).graphKeys||[];
 if(!keys.length)return '<p class="live-empty">ยังไม่ได้ติ๊กเลือกกราฟที่จะนำมาแสดง</p>';
 return keys.filter(k=>graphItems[k]).map(k=>'<article><h5>'+graphItems[k]+'</h5><div class="live-chart"><canvas data-chart="'+k+'"></canvas></div></article>').join("");
}
async function render(plot,paper){
 await load();
 if(!paper||!history?.plots?.[plot])return;
 // Report headline is rendered from this same history by LiveReportModel.
 const old=paper.querySelector(".live-trend-section");if(old)old.remove();
 window.ReportSelector?.renderControls(plot,history,typeof satelliteFiles==="undefined"?[]:satelliteFiles);
 const snap=liveSnapshot(plot),all=rows(plot);
 const root=document.createElement("section");root.className="report-section live-trend-section";
 const imgDates=imageDates(plot),pending=pendingIndexDates(plot),latestImage=imgDates.at(-1)||null;
 root.innerHTML=`<div class="live-title-row"><div><h4>แนวโน้มตามเวลา / Live Analysis History</h4><p>${summarize(plot)}</p></div><span class="live-update">ข้อมูลวิเคราะห์ ${all.length} รอบ • history updated ${history.generated_at?new Date(history.generated_at).toLocaleString("th-TH"):"—"}</span></div>
 <div class="live-kpis"><div><span>ภาพล่าสุด</span><strong>${latestImage?dth(latestImage):"—"}</strong></div><div><span>Current ที่ผ่าน QA</span><strong>${snap?dth(snap.current.date):"—"}</strong></div><div><span>พื้นที่น้ำ Current</span><strong>${snap?fmt(snap.current.water_rai)+" ไร่":"—"}</strong></div><div><span>รอดัชนี</span><strong>${pending.length}</strong></div></div>
 ${pending.length?`<div class="live-pending"><b>ภาพพร้อม แต่ดัชนียังไม่ครบ:</b> ${pending.map(d=>dth(d)).join(", ")} • วันที่เหล่านี้เปิดดูภาพได้ แต่ยังไม่ใช้คำนวณ Report จนกว่าไฟล์ดัชนีจริงจะถูกอัปโหลด</div>`:""}
 <div class="live-grid">${graphCards(plot)}</div>
 <div class="live-water-map-wrap"></div>
 <div class="live-table-wrap"><table class="live-table"><thead><tr><th>วันที่</th><th>QA</th><th>Usable</th><th>น้ำ (ไร่)</th><th>น้ำ (%)</th><th>Δน้ำ (ไร่)</th><th>NDVI</th><th>NDRE</th><th>NDMI</th><th>MNDWI</th><th>BSI</th></tr></thead><tbody>${tableRows(plot)}</tbody></table></div>
 <p class="live-footnote">* ค่าที่มีเครื่องหมาย * เป็นพื้นที่น้ำที่ตรวจพบเฉพาะส่วนของภาพที่ผ่าน QA ไม่ใช้แทนค่าปัจจุบันโดยอัตโนมัติ</p>`;
 const footer=paper.querySelector(".report-footer");if(footer)footer.before(root);else paper.appendChild(root);
 
 renderCharts(plot,root);addExplanations(plot,root);renderWaterMap(plot,root);appendSelectedSatelliteImages(plot,root);
}
window.TrendReport={load,render,snapshot:plot=>history?liveSnapshot(plot):null,rows:plot=>history?rows(plot):[]};
load().catch(e=>console.warn("Trend history unavailable",e));
})();