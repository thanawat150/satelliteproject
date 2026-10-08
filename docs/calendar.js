/* Satellite Monitoring Calendar: dates are observed scenes; schedules are plans, not execution logs. */
(function(){
'use strict';
const root=document.getElementById('calendar-root'); if(!root)return;
const state={month:new Date(),date:null,plot:'ALL',files:[],analysis:{},loaded:false,error:null};
state.month.setDate(1);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const parse=s=>new Date(Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8,10)));
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelDate=s=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(parse(s));
const labelMonth=d=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(d);
function schedule(s){
 const d=parse(s),utc=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 const every3=utc>=Date.UTC(2026,9,11)&&(utc-Date.UTC(2026,9,11))/86400000%3===0;
 const monday=d.getDay()===1&&utc>=Date.UTC(2026,9,12);
 return {every3,monday,has:every3||monday};
}
const rows=()=>state.files.filter(x=>state.plot==='ALL'||x.plot===state.plot);
function summary(date){
 const files=rows().filter(x=>x.date===date),plots=[...new Set(files.map(x=>x.plot))];
 return {files,plots,qa:plots.map(p=>(state.analysis[p]||[]).find(x=>x.date===date)).filter(Boolean),schedule:schedule(date)};
}
function quality(x){
 if(!x)return ['pending','ยังไม่มีผลวิเคราะห์'];
 return ({VERIFIED:['verified','ตรวจสอบแล้ว'],AUTO_VALID:['valid','ผ่าน QA อัตโนมัติ'],PARTIAL:['partial','ข้อมูลบางส่วน'],NO_DATA:['nodata','ข้อมูลไม่พอ']})[x.analysis_status]||['pending','ยังไม่มีผลวิเคราะห์'];
}
function render(){
 if(!state.loaded){root.innerHTML='<p class="cal-loading">'+(state.error?'โหลดปฏิทินไม่สำเร็จ: '+esc(state.error):'กำลังอ่านรายการภาพดาวเทียม...')+'</p>';return}
 const first=state.month,y=first.getFullYear(),m=first.getMonth(),total=new Date(y,m+1,0).getDate(),offset=new Date(y,m,1).getDay();
 const thisMonth=iso(first).slice(0,7),currentRows=rows().filter(x=>x.date&&x.date.slice(0,7)===thisMonth);
 const uniqueDates=new Set(currentRows.map(x=>x.date)),uniquePlots=new Set(currentRows.map(x=>x.plot));
 const allPlots=[...new Set(state.files.map(x=>x.plot).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const options='<option value="ALL">ทุกแปลง</option>'+allPlots.map(p=>'<option value="'+esc(p)+'"'+(state.plot===p?' selected':'')+'>'+esc(p)+'</option>').join('');
 let cells='';
 for(let i=0;i<Math.ceil((offset+total)/7)*7;i++){
   const n=i-offset+1;if(n<1||n>total){cells+='<div class="cal-cell cal-outside"></div>';continue}
   const date=y+'-'+pad(m+1)+'-'+pad(n),s=summary(date);
   const good=s.qa.some(x=>['VERIFIED','AUTO_VALID'].includes(x.analysis_status));
   const caution=s.qa.some(x=>['PARTIAL','NO_DATA'].includes(x.analysis_status));
   let markers='';
   if(s.files.length)markers+='<span class="cal-marker cal-sat">'+s.plots.length+' แปลง</span>';
   if(good)markers+='<i class="cal-dot cal-qa-ok"></i>';
   else if(caution)markers+='<i class="cal-dot cal-qa-warn"></i>';
   if(s.schedule.has)markers+='<i class="cal-dot cal-planned"></i>';
   const classes='cal-cell'+(date===iso(new Date())?' cal-today':'')+(date===state.date?' cal-selected':'')+(s.files.length?' cal-has-images':'');
   cells+='<button type="button" class="'+classes+'" data-date="'+date+'" aria-label="'+esc(labelDate(date))+'"><span class="cal-day">'+n+'</span><span class="cal-cell-markers">'+markers+'</span></button>';
 }
 root.innerHTML='<div class="cal-controls"><div class="cal-month-tools"><button type="button" data-nav="-1" class="ghost-btn" aria-label="เดือนก่อน">‹</button><h3>'+esc(labelMonth(first))+'</h3><button type="button" data-nav="1" class="ghost-btn" aria-label="เดือนถัดไป">›</button><button type="button" data-nav="today" class="ghost-btn">เดือนนี้</button></div><label>เลือกแปลง <select id="cal-plot">'+options+'</select></label></div>'+
 '<div class="cal-kpis"><div><strong>'+uniqueDates.size+'</strong><span>วันที่มีภาพในเดือนนี้</span></div><div><strong>'+currentRows.length+'</strong><span>ไฟล์ภาพในเดือนนี้</span></div><div><strong>'+uniquePlots.size+'</strong><span>แปลงที่มีภาพ</span></div></div>'+
 '<div class="cal-weekdays">'+['อา','จ','อ','พ','พฤ','ศ','ส'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="cal-grid">'+cells+'</div>'+
 '<div class="cal-legend"><span><i class="cal-legend-square"></i> มีภาพ</span><span><i class="cal-dot cal-qa-ok"></i> ผ่าน QA</span><span><i class="cal-dot cal-qa-warn"></i> QA จำกัด</span><span><i class="cal-dot cal-planned"></i> รอบตรวจตามแผน</span></div><div id="cal-detail" class="cal-detail"></div>';
 renderDetail();
}
function renderDetail(){
 const el=document.getElementById('cal-detail');if(!el)return;
 const date=state.date||iso(new Date()),s=summary(date),plans=[];
 if(s.schedule.every3)plans.push('รอบทุก 3 วัน');
 if(s.schedule.monday)plans.push('รอบวันจันทร์');
 let html='<div class="cal-detail-head"><div><div class="eyebrow">SELECTED DATE</div><h3>'+esc(labelDate(date))+'</h3></div><span class="cal-count">'+s.plots.length+' แปลง • '+s.files.length+' ไฟล์</span></div>';
 if(plans.length)html+='<div class="cal-schedule-note">กำหนดตรวจ Google Drive: '+esc(plans.join(' + '))+'<small>กำหนดการ ไม่ใช่หลักฐานว่าตรวจสำเร็จแล้ว</small></div>';
 if(!s.files.length)html+='<p class="cal-no-images">ไม่มีภาพดาวเทียมในรายการของวันที่เลือก'+(state.plot!=='ALL'?' สำหรับแปลง '+esc(state.plot):'')+'</p>';
 else html+='<div class="cal-detail-list">'+s.plots.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(p=>{
   const files=s.files.filter(x=>x.plot===p),a=(state.analysis[p]||[]).find(x=>x.date===date),[q,label]=quality(a);
   const resolutions=[...new Set(files.map(x=>x.resolution).filter(Boolean))].sort((a,b)=>parseInt(a)-parseInt(b));
   const coverage=a&&a.valid_pct!=null?' • usable '+Number(a.valid_pct).toLocaleString('th-TH',{maximumFractionDigits:1})+'%':'';
   return '<article class="cal-file-row"><div class="cal-file-info"><strong>'+esc(p)+'</strong><span>'+files.length+' ไฟล์ • '+esc(resolutions.join(', '))+'</span><small class="cal-quality cal-quality-'+q+'">'+label+esc(coverage)+'</small></div><div class="cal-file-actions"><button type="button" class="ghost-btn" data-action="image" data-plot="'+esc(p)+'" data-date="'+date+'">ดูภาพ</button><button type="button" class="ghost-btn" data-action="report" data-plot="'+esc(p)+'">Report</button></div></article>';
 }).join('')+'</div>';
 el.innerHTML=html;
}
function jumpImage(p,date){
 if(typeof plots!=='undefined'&&typeof selectPlot==='function'){const row=plots.find(x=>x.plot===p);if(row)selectPlot(row,false)}
 const plotSel=document.getElementById('sat-filter-plot'),dateSel=document.getElementById('sat-filter-date');
 if(plotSel)plotSel.value=p;
 if(dateSel)dateSel.value=date;
 if(typeof switchTab==='function')switchTab('satellite');
 if(typeof renderSatelliteGallery==='function')renderSatelliteGallery();
}
function jumpReport(p){
 const sel=document.getElementById('report-plot');if(sel)sel.value=p;
 if(typeof switchTab==='function')switchTab('report');
 if(typeof renderReportPreview==='function')renderReportPreview();
}
root.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn||!root.contains(btn))return;
 if(btn.dataset.date){state.date=btn.dataset.date;if(typeof updateQuery==='function')updateQuery({cal_date:state.date});render();return}
 if(btn.dataset.nav){if(btn.dataset.nav==='today'){state.month=new Date();state.month.setDate(1);state.date=iso(new Date())}
 else{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(btn.dataset.nav),1);state.date=null}
 render();return}
 if(btn.dataset.action==='image')jumpImage(btn.dataset.plot,btn.dataset.date);
 if(btn.dataset.action==='report')jumpReport(btn.dataset.plot);
});
root.addEventListener('change',e=>{
 if(e.target.id==='cal-plot'){state.plot=e.target.value;if(typeof updateQuery==='function')updateQuery({cal_plot:state.plot==='ALL'?null:state.plot});render()}
});
async function load(){
 try{
  const [partRes,historyRes]=await Promise.all([fetch('data/satellite_parts.json',{cache:'no-store'}),fetch('data/analysis_history.json',{cache:'no-store'})]);
  if(!partRes.ok)throw Error('satellite_parts.json HTTP '+partRes.status);
  const meta=await partRes.json(),chunks=await Promise.all(meta.parts.map(async x=>{const r=await fetch('data/'+x.file,{cache:'no-store'});if(!r.ok)throw Error(x.file+' HTTP '+r.status);return r.json()}));
  state.files=[...new Map(chunks.flat().filter(x=>x.id&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).map(x=>[x.id,x])).values()];
  if(historyRes.ok)state.analysis=(await historyRes.json()).plots||{};
  state.loaded=true;
  const p=new URLSearchParams(location.search),date=p.get('cal_date'),plot=p.get('cal_plot');
  if(plot&&state.files.some(x=>x.plot===plot))state.plot=plot;
  if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)){state.date=date;state.month=parse(date);state.month.setDate(1)}
  else{const latest=state.files.map(x=>x.date).sort().at(-1);state.date=latest||iso(new Date());if(latest){state.month=parse(latest);state.month.setDate(1)}}
  render();
 }catch(e){state.error=e.message||String(e);render()}
}
load();
})();