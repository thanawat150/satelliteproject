/* Date, annual imagery and graph selectors for Report Center.  Never fabricates observations. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const statusText={VERIFIED:"ตรวจยืนยัน",AUTO_VALID:"ผ่าน QA อัตโนมัติ",PARTIAL:"ข้อมูลบางส่วน",NO_DATA:"ไม่ผ่าน QA"};
const graphSpecs=[["water","พื้นที่น้ำ (ไร่)"],["water-change","น้ำเพิ่ม/ลด"],["ndvi","NDVI"],["ndre","NDRE"],["ndmi","NDMI"],["mndwi","MNDWI"],["bsi","BSI"],["qa","คุณภาพภาพ (QA)"]];
const perPlot=new Map(),graphSelection=new Set(graphSpecs.map(([k])=>k));
let activePlot=null,busy=false;
const dateLabel=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8)+"/"+d.slice(5,7)+"/"+d.slice(0,4):d;
function scenesFor(plot,files){return (files||[]).filter(x=>x.plot===plot && x.date && x.sensor==="Sentinel-2");}
function view(plot,history,files){
 const obs=history?.plots?.[plot]||[];
 const scenes=scenesFor(plot,files);
 const dates=[...new Set([...obs.map(x=>x.date),...scenes.map(x=>x.date)].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();
 const years=[...new Set(dates.map(d=>d.slice(0,4)))].sort();
 let state=perPlot.get(plot);
 if(!state){state={mode:"dates",dates:new Set(dates),years:new Set(years)};perPlot.set(plot,state);}
 // New observations participate by default; manually unchecked dates stay unchecked.
 const previous=new Set(state.knownDates||[]);
 dates.filter(d=>!previous.has(d)).forEach(d=>state.dates.add(d));
 state.knownDates=dates;
 for(const y of years)if(!state.knownYears?.includes(y))state.years.add(y);
 state.knownYears=years;
 const byDate=new Map(obs.map(x=>[x.date,x]));
 const hasPreview=new Map();for(const file of scenes){
  if(file.web_preview_url&&file.resolution==="10m")hasPreview.set(file.date,true);
 }
 const chooseRepresentative=y=>{
  const datesWithImages=scenes.filter(x=>x.date.startsWith(y)&&x.web_preview_url).map(x=>x.date);
  const candidates=[...new Set(datesWithImages.length?datesWithImages:scenes.filter(x=>x.date.startsWith(y)).map(x=>x.date))];
  const score=d=>{
   const o=byDate.get(d);
   const trusted=o&&["VERIFIED","AUTO_VALID"].includes(o.analysis_status)&&Number(o.valid_pct)>=70;
   // One actual Sentinel-2 image per year. Prefer QA-approved, then coverage and display readiness.
   return [trusted?3:o?.analysis_status==="PARTIAL"?2:1,Number(o?.valid_pct)||0,hasPreview.get(d)?1:0,d];
  };
  candidates.sort((a,b)=>{const sa=score(a),sb=score(b);for(let i=0;i<sa.length;i++){if(sa[i]>sb[i])return -1;if(sa[i]<sb[i])return 1;}return 0});
  return candidates[0]||null;
 };
 let usedDates=state.mode==="dates"?dates.filter(d=>state.dates.has(d)):
   state.mode==="years"?dates.filter(d=>state.years.has(d.slice(0,4))):
   years.filter(y=>state.years.has(y)).map(chooseRepresentative).filter(Boolean).sort();
 const selection={
  plot,mode:state.mode,dates:usedDates,years,
  checkedYears:years.filter(y=>state.years.has(y)),allDates:dates,observations:obs,scenes,
  graphKeys:[...graphSelection],yearlySamples:state.mode==="annual"?usedDates:[],
  annualInfo:state.mode==="annual"?"เลือกภาพจริงปีละหนึ่งวัน โดยให้ความสำคัญกับผลที่ผ่าน QA และความครอบคลุมของข้อมูล":null
 };
 return selection;
}
function renderControls(plot,history,files){
 activePlot=plot;
 const info=view(plot,history,files),state=perPlot.get(plot);
 const dateBox=$("report-date-checkboxes"),yearBox=$("report-year-checkboxes"),yearPanel=$("report-year-panel"),datePanel=$("report-date-panel");
 if(dateBox){
  dateBox.innerHTML=info.allDates.length?info.allDates.map(d=>{
   const v=info.observations.find(o=>o.date===d);
   const status=v?(statusText[v.analysis_status]||v.analysis_status):"มีภาพ • ยังไม่วิเคราะห์";
   return '<label class="report-date-chip"><input data-report-date="'+d+'" type="checkbox" '+(state.dates.has(d)?"checked":"")+'><span>'+dateLabel(d)+'</span><small>'+status+'</small></label>';
  }).join(""):'<p>ยังไม่มีภาพหรือผลวิเคราะห์สำหรับแปลงนี้</p>';
 }
 if(yearBox)yearBox.innerHTML=info.years.map(y=>'<label class="report-year-chip"><input type="checkbox" data-report-year="'+y+'" '+(state.years.has(y)?"checked":"")+'><span>'+y+' / '+(Number(y)+543)+'</span></label>').join("");
 for(const radio of document.querySelectorAll('[name="report-period-mode"]'))radio.checked=radio.value===state.mode;
 if(yearPanel)yearPanel.hidden=state.mode==="dates";
 if(datePanel)datePanel.hidden=state.mode!=="dates";
 if($("report-scope-caption"))$("report-scope-caption").textContent=info.dates.length+" วันในรายงาน • "+new Set(info.dates.map(d=>d.slice(0,4))).size+" ปี"+(info.annualInfo?" • "+info.annualInfo:"");
 const graphBox=$("report-graph-checkboxes");
 if(graphBox)graphBox.innerHTML=graphSpecs.map(([key,label])=>'<label class="report-graph-chip"><input type="checkbox" data-report-graph="'+key+'" '+(graphSelection.has(key)?"checked":"")+'><span>'+label+'</span></label>').join("");
 return info;
}
function change(e){
 const target=e.target,plot=activePlot;if(!plot||!target)return;
 const state=perPlot.get(plot);if(!state)return;
 if(target.matches('[name="report-period-mode"]'))state.mode=target.value;
 else if(target.matches('[data-report-date]')){if(target.checked)state.dates.add(target.dataset.reportDate);else state.dates.delete(target.dataset.reportDate)}
 else if(target.matches('[data-report-year]')){if(target.checked)state.years.add(target.dataset.reportYear);else state.years.delete(target.dataset.reportYear)}
 else if(target.matches('[data-report-graph]')){if(target.checked)graphSelection.add(target.dataset.reportGraph);else graphSelection.delete(target.dataset.reportGraph)}
 else return;
 if(typeof renderReportPreview==="function")renderReportPreview();
}
function bind(){
 const panel=$("report-selection-panel");if(!panel||panel.dataset.bound)return;
 panel.dataset.bound="yes";panel.addEventListener("change",change);
 const all=$("report-date-select-all"),none=$("report-date-select-none");
 if(all)all.onclick=()=>{const s=perPlot.get(activePlot);if(s){(s.knownDates||[]).forEach(x=>s.dates.add(x));renderReportPreview();}};
 if(none)none.onclick=()=>{const s=perPlot.get(activePlot);if(s){s.dates.clear();renderReportPreview();}};
}
function setTwoDates(plot,a,b,history,files){
 const all=view(plot,history,files),s=perPlot.get(plot);s.mode="dates";s.dates=new Set([a,b].filter(Boolean));return all;
}
window.ReportSelector={bind,view,renderControls,selectedGraphs:()=>[...graphSelection],setTwoDates};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();