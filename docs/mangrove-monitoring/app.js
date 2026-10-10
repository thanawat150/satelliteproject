'use strict';
(function () {
const $=id=>document.getElementById(id);
const root=$('view-root');
const DATA='../data/nationwide/';
const state={view:(new URLSearchParams(location.search).get('view')||'overview'),plot:(new URLSearchParams(location.search).get('plot')||'13-STC'),company:'ALL',province:'ALL',metric:'ndvi',riskKind:'water',riskThreshold:10,riskUnit:'percent',waterDate:'',waterDatePlot:'',waterPlot:'',map:null,mapLayers:null,filter:'',showValidOnly:true};
const cache={data:null,plots:[],byCode:new Map(),byScene:new Map(),changes:new Map(),canonical:new Set(),status:null,when:null,imagery:null,environment:null};
const TITLES={overview:'Nationwide Overview',map:'GIS Map Center',plots:'Plot Registry & Details',insights:'Plot Intelligence & Decisions',analysis:'Environmental Analytics',change:'Change Detection',satellite:'Satellite Catalog',alerts:'Early Warning',field:'Field Operations & Growth',carbon:'Carbon & MRV',qa:'Data Quality & Boundaries',reports:'Report Center',modules:'All 26 Modules'};
const METRICS={ndvi:['NDVI','ดัชนีพืช'],ndre:['NDRE','คลอโรฟิลล์ / Red Edge'],evi:['EVI','สัญญาณเรือนยอด'],savi:['SAVI','พืชปรับผลดิน'],ndmi:['NDMI','ความชื้นพืช'],ndwi:['NDWI','สัญญาณน้ำ'],mndwi:['MNDWI','ผิวน้ำ'],bsi:['BSI','ดินเปิดโล่ง'],gli:['GLI','ดัชนีสีเขียว'],water_rai:['Water (rai)','พื้นที่น้ำ ไร่'],vegetation_rai:['Vegetation (rai)','พื้นที่พืช ไร่'],bare_soil_rai:['Bare soil (rai)','พื้นที่ดิน ไร่'],wetness_rai:['Wetness (rai)','พื้นที่ชื้น ไร่']};
const qaOk=r=>r&&r.analysis_status==='AUTO_VALID';
const fmt=(n,k=2)=>Number.isFinite(Number(n))&&n!==null&&n!==''?Number(n).toLocaleString('th-TH',{maximumFractionDigits:k}):'—';
const html=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const tag=(s,t='neutral')=>'<span class="tag '+t+'">'+html(s)+'</span>';
const message=(s,kind='')=>'<div class="notice '+kind+'">'+s+'</div>';
const empty=(heading,sub)=>'<div class="empty"><span class="empty-icon">◌</span><b>'+html(heading)+'</b><small>'+html(sub)+'</small></div>';
const btn=(text,action,val='',kind='')=>'<button class="btn '+kind+'" data-action="'+action+'" data-value="'+html(val)+'">'+html(text)+'</button>';
function toast(s){const d=$('toast');d.textContent=s;d.hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>d.hidden=true,3400);}
function setView(view,code){if(!TITLES[view])view='overview';state.view=view;if(code)state.plot=code;state.filter='';draw();let u=new URL(location.href);u.searchParams.set('view',view);if(state.plot)u.searchParams.set('plot',state.plot);history.replaceState({},'',u.pathname+u.search+u.hash);window.scrollTo({top:0,behavior:'instant'});$('sidebar').classList.remove('open');}
function plotScenes(code){return cache.byScene.get(code)||[];}
function plotChanges(code){return cache.changes.get(code)||[];}
function waterScreen(){
 const engine=window.MMCWaterIntelligence;
 if(!engine)return null;
 const areas=Object.fromEntries(cache.plots.map(p=>[p.code,p.geometry?p.area:null]));
 return engine.derive(allChangesFiltered(),areas);
}
function rainfallEvidencePanel(code){
 const ctx=cache.environment;
 if(!ctx?.plots)return '<p class="muted">NASA POWER: รอข้อมูลจาก GitHub Actions • ไม่แสดงฝนที่ไม่ได้ตรวจสอบ</p>';
 const entries=[];
 const priority=['16-STC','14-STC','92-STC'];
 for(const p of Object.values(ctx.plots)){
  if(code&&p.plot!==code)continue;
  for(const scene of p.scenes||[])entries.push({plot:p.plot,...scene});
 }
 entries.sort((a,b)=>(priority.indexOf(a.plot)<0?99:priority.indexOf(a.plot))-
                    (priority.indexOf(b.plot)<0?99:priority.indexOf(b.plot))||
                    (b.date||'').localeCompare(a.date||''));
 const count=entries.filter(x=>x.data_quality==='COMPLETE').length;
 const rows=entries.slice(0,code?15:30).map(x=>
  '<tr><td>'+btn(x.plot,'insight',x.plot,'mini')+'</td><td>'+html(x.date)+
  '</td><td class="num">'+(x.rain_prev_1_utc_day_mm==null?'ไม่มีข้อมูล':fmt(x.rain_prev_1_utc_day_mm,2))+
  '</td><td class="num">'+(x.rain_prev_3_utc_days_mm==null?'ไม่มีข้อมูล':fmt(x.rain_prev_3_utc_days_mm,2))+
  '</td><td>'+html(x.data_quality==='COMPLETE'?'ครบ':'ข้อมูลบางวันขาด')+'</td></tr>').join('');
 return '<div class="panel"><h3>ฝนจาก NASA POWER · แหล่งข้อมูลจริง</h3>'+
 '<p class="muted">เชื่อมสำเร็จ '+ctx.plot_count+' แปลง / '+ctx.scenes_with_complete_rain+
 ' วันภาพทั้งระบบ • ในตัวกรอง '+count+' วัน • หน่วยมิลลิเมตร (มม.)</p>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>วันภาพ</th><th>ฝนก่อนหน้า 1 วัน (UTC)</th><th>ฝนก่อนหน้า 3 วัน (UTC)</th><th>QA ฝน</th></tr></thead><tbody>'+
 (rows||'<tr><td colspan="5">แปลงนี้ยังไม่มีข้อมูลฝนที่เชื่อมแล้ว</td></tr>')+'</tbody></table></div>'+
 '<p class="muted tiny">แหล่งข้อมูล: NASA POWER / PRECTOTCORR (ค่าประมาณจากแบบจำลอง/ข้อมูลผสาน ไม่ใช่สถานีวัดฝนหรือ GPM IMERG) • ใช้วัน UTC ก่อนวันถ่ายภาพ ไม่ใช่ฝนย้อนหลัง 24/72 ชั่วโมงจากเวลาที่ถ่ายจริง • ระดับน้ำทะเลยังไม่เชื่อมและยังไม่มี datum/สถานียืนยัน</p></div>';
}
function waterDatePanel(code){
 const plot=code||state.waterPlot||state.plot;
 const scenes=plotScenes(plot);
 const latest=scenes.at(-1)?.date||'';
 const selected=state.waterDatePlot===plot&&scenes.some(x=>x.date===state.waterDate)
     ?state.waterDate:latest;
 const rain=cache.environment?.plots?.[plot]?.scenes||[];
 const snapshot=window.MMCWaterIntelligence?.daySnapshot(scenes,selected,rain);
 const options=scenes.slice().reverse().map(x=>'<option value="'+html(x.date)+'" '+
      (x.date===selected?'selected':'')+'>'+html(x.date)+
      (qaOk(x)?' · ผ่าน QA':' · '+html(x.analysis_status||'ยังไม่ผ่าน QA'))+'</option>').join('');
 const plotSelector=code?'':'<label>เลือกแปลงน้ำ<select id="water-plot-select">'+
      [...cache.byScene].filter(([,rows])=>rows.length).map(([k])=>
      '<option value="'+html(k)+'" '+(k===plot?'selected':'')+'>'+html(k)+'</option>').join('')+
      '</select></label>';
 const dateSelect='<label>เลือกวันภาพ Sentinel-2<select id="water-date-select" '+
      (scenes.length?'':'disabled')+'>'+options+'</select></label>';
 if(!snapshot)return '<div class="panel"><h3>ค่าน้ำรายวัน</h3>'+
      '<div class="controls">'+plotSelector+dateSelect+'</div>'+
      '<p class="muted">แปลงนี้ยังไม่มีวันภาพ Sentinel-2 ในฐานข้อมูลวิเคราะห์ PDD</p></div>';
 const ok=snapshot.analytical_values_approved_for_screening;
 const idx=(v,n=4)=>v===null?'—':fmt(v,n);
 const rain1=snapshot.rainfall_prev_1_utc_day_mm,rain3=snapshot.rainfall_prev_3_utc_days_mm;
 const status=ok?tag('ผ่าน QA · ใช้ตรวจแนวโน้มได้'):tag('ไม่ผ่าน QA · ใช้ดูภาพเท่านั้น','warn');
 const caution=ok?
    'พื้นที่น้ำเป็นพื้นที่จำแนกในภาพของวันนั้น ไม่ใช่ระดับน้ำทะเล และยังไม่ปรับน้ำขึ้นน้ำลง':
    'ไม่มีตัวเลขน้ำหรือดัชนีที่ผ่าน QA สำหรับวันนี้ ภาพ MNDWI/NDWI จาก TIFF เปิดดูได้ แต่ห้ามใช้สรุปน้ำท่วม';
 return '<div class="panel" id="water-daily-panel"><div class="panel-header"><div><h3>ค่าน้ำตามวันภาพ · '+html(plot)+'</h3>'+
      '<p class="muted">เลือกวันที่มีภาพจริง ค่า NDWI / MNDWI / พื้นที่น้ำ / ฝน จะแสดงวันเดียวกัน</p></div>'+
      status+'</div>'+
      '<div class="controls">'+plotSelector+dateSelect+
      btn('ดูภาพ MNDWI วันที่เลือก','waterimage',plot,'primary')+'</div>'+
      '<p class="muted" id="water-selected-date">กำลังแสดงวัน '+html(selected)+' • '+html(snapshot.qa_status)+
      ' • SCL ใช้ได้ '+idx(snapshot.qa_valid_pct,1)+'%</p>'+
      '<div class="grid half">'+
      kpi('พื้นที่น้ำในภาพ',idx(snapshot.water_rai,3)+(ok?' ไร่':''),'เฉพาะวันผ่าน QA • ไม่ใช่ระดับน้ำทะเล')+
      kpi('MNDWI',idx(snapshot.mndwi),'(B3−B11)/(B3+B11)')+
      kpi('NDWI',idx(snapshot.ndwi),'(B3−B8)/(B3+B8)')+
      kpi('ฝนก่อนหน้า 1 วัน',rain1===null?'ไม่มีข้อมูล':fmt(rain1,2)+' มม.','NASA POWER · วัน UTC ก่อนวันภาพ')+
      kpi('ฝนก่อนหน้า 3 วัน',rain3===null?'ไม่มีข้อมูล':fmt(rain3,2)+' มม.','NASA POWER · 3 วัน UTC ก่อนวันภาพ')+
      kpi('ระดับน้ำทะเล','ยังไม่เชื่อม','ไม่มีสถานี / Datum ที่ตรวจสอบแล้ว')+'</div>'+
      '<p class="muted">'+html(caution)+'</p></div>';
}
function waterIntelligencePanel(code){
 const result=waterScreen();
 if(!result)return message('Water Anomaly Engine ยังไม่พร้อม โปรดโหลดหน้าใหม่','warn');
 const viewedPlot=code||state.waterPlot||state.plot;
 const match=x=>x.plot===viewedPlot;
 const reversals=result.reversals.filter(match);
 const increases=result.water_increases.filter(match);
 const held=result.held.filter(match);
 const rows=reversals.slice(0,25).map(x=>'<tr><td>'+btn(x.plot,'insight',x.plot,'mini')+
 '</td><td>'+html(x.first_date)+' → '+html(x.second_date)+'</td>'+
 '<td class="num">+'+fmt(x.first_delta_rai,3)+'</td><td class="num">'+fmt(x.second_delta_rai,3)+'</td>'+
 '<td>'+tag(x.status==='WATER_REVERSAL_REVIEW'?'น้ำเพิ่มแล้วลด · รอตรวจ':'ข้อมูลไม่พอ','warn')+'</td></tr>').join('');
 return '<section class="panel" id="water-intelligence"><div class="panel-header"><div><div class="eyebrow">WATER ANOMALY INTELLIGENCE · SCREENING ONLY</div><h2>น้ำผิดปกติ / เพิ่มแล้วลดกลับ</h2><p class="muted">วิเคราะห์รูปแบบภาพย้อนหลังจากผล Change ที่เผยแพร่แล้ว ไม่ยืนยันน้ำท่วมหรือการกลับสู่สภาพปกติ</p></div></div>'+
 waterDatePanel(code)+
 '<div class="grid half">'+kpi('น้ำเพิ่ม · Candidate',increases.length,'ผ่านจำนวนพิกเซลและพื้นที่ร่วมขั้นต่ำ')+
 kpi('น้ำเพิ่มแล้วลด · Review',reversals.length,'ยังไม่ใช่การยืนยันเหตุการณ์')+
 kpi('หลักฐานไม่พอ',held.length,'ไม่ใช้เป็น Early Warning อัตโนมัติ')+
 kpi('ฝน NASA POWER / น้ำขึ้นน้ำลง',cache.environment?.plot_count?'ฝน '+cache.environment.plot_count+' แปลง':'รอข้อมูลฝน','น้ำขึ้นน้ำลงยังไม่เชื่อม')+'</div>'+
 '<p class="muted">การยืนยันต้องมีเวลาถ่ายภาพจาก Scene ID, ระดับน้ำทะเลที่ตรวจสอบแหล่งและ Datum ได้, ฝนย้อนหลัง และข้อมูลภาคสนาม • การลดลงในภาพถัดไปไม่ได้แปลว่าระดับน้ำกลับสู่ปกติ</p>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>ช่วงภาพหลัง</th><th>น้ำเพิ่ม ไร่</th><th>น้ำลด ไร่</th><th>สถานะ</th></tr></thead><tbody>'+
 (rows||'<tr><td colspan="5">ยังไม่พบรูปแบบน้ำเพิ่มแล้วลดที่เข้าเกณฑ์จากข้อมูลในตัวกรอง</td></tr>')+
 '</tbody></table></div>'+rainfallEvidencePanel(viewedPlot)+'</section>';
}

function validScenes(code){return plotScenes(code).filter(qaOk);}
function currentValid(code){return validScenes(code).slice(-1)[0]||null;}
function plotStatus(code){const p=cache.data?.plots?.[code];if(!p)return 'UNPROCESSED';if(p.qa_valid_dates>0)return 'VALID';if(p.completed_dates>0)return 'NO_VALID';return 'UNPROCESSED';}
function statusTag(code){const s=plotStatus(code);return s==='VALID'?tag('ผ่าน QA',''):s==='NO_VALID'?tag('ไม่มีภาพผ่าน QA','warn'):tag('ยังไม่ประมวลผล','neutral');}
function allPlots(){return cache.plots;}
function filtered(){let f=cache.plots;if(state.company!=='ALL')f=f.filter(x=>x.company===state.company);if(state.province!=='ALL')f=f.filter(x=>x.province===state.province);return f;}
function plotOf(code){return cache.byCode.get(code)||null;}
function commonHead(title,desc,actions=''){return '<div class="page-intro"><div><div class="eyebrow">MANGROVE INTELLIGENCE</div><h2>'+html(title)+'</h2><p>'+html(desc)+'</p></div><div class="button-row">'+actions+'</div></div>';}
function infoBox(){return message('<b>ขอบเขตการแสดงผล:</b> แผนที่ MOC 159 รหัสแปลง + 1 รหัสจากทะเบียนที่ยังไม่มี Polygon แยก • ผลวิเคราะห์เดิม 136 แปลง • EVR ยังไม่ได้ยืนยันทะเบียน/ขอบเขต จึงไม่รวมในยอดแปลงที่ยืนยันแล้ว','blue');}
function kpi(label,value,foot){return '<div class="kpi"><small>'+html(label)+'</small><strong>'+html(value)+'</strong><span class="foot">'+html(foot)+'</span></div>';}
function latestDate(){let m='';for(const r of cache.data.scenes||[])if(r.date>m)m=r.date;return m||'ไม่มีข้อมูล';}
function clearMap(){if(state.map){try{state.map.remove()}catch(e){}state.map=null;}}
function initMap(where,plots,tall=false){clearMap();const div=$(where);if(!div)return;if(!window.L){div.innerHTML=empty('แผนที่โหลดไม่สำเร็จ','สามารถดูข้อมูลในตารางและเปิด Geometry ได้');return;}
 const map=L.map(div,{preferCanvas:true,zoomControl:true}).setView([10.2,100.5],6);state.map=map;
 L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Tiles © Esri'}).addTo(map);
 const group=L.featureGroup().addTo(map);
 for(const p of plots){if(!p.geometry)continue;const qa=plotStatus(p.code);const isMOC3=p.group==='MOC3';const color=isMOC3?'#86badf':qa==='VALID'?'#68eaa1':qa==='NO_VALID'?'#ffbd77':'#e99191';
  try{const layer=L.geoJSON({type:'Feature',geometry:p.geometry,properties:{plot:p.code}},{style:{color:color,weight:p.code===state.plot?3:1.4,fillColor:color,fillOpacity:p.code===state.plot?.18:.07}}).addTo(group);layer.on('click',()=>{state.plot=p.code;const u=new URL(location.href);u.searchParams.set('plot',p.code);history.replaceState({},'',u.pathname+u.search);});
   layer.bindPopup('<b>'+html(p.code)+'</b><br>'+html(p.province)+'<br>'+html(isMOC3?'MOC 3 (ยังไม่ประมวลผล)':'PDD Cohort')+'<br><a href="?view=plots&amp;plot='+encodeURIComponent(p.code)+'">ดูข้อมูลแปลง ↗</a>');
 }catch(e){console.warn('Unsupported geometry',p.code,e);}
 }
 if(group.getLayers().length){try{map.fitBounds(group.getBounds(),{padding:[18,18],maxZoom:16});}catch(e){}}
 setTimeout(()=>{try{map.invalidateSize()}catch(e){}},120);
}
function svgChart(rows,key){const good=rows.filter(x=>qaOk(x)&&x[key]!=null&&Number.isFinite(Number(x[key])));if(!good.length)return empty('ยังไม่มีค่าผ่าน QA','ไม่ใช้ค่าจากวันภาพ NO_DATA หรือ PARTIAL');
 const v=good.map(x=>Number(x[key])),min=Math.min(...v),max=Math.max(...v),span=Math.max(max-min,.05),base=min-span*.20,top=max+span*.20;
 const w=680,h=210,pad=28,xx=i=>pad+(w-2*pad)*(good.length===1?.5:i/(good.length-1)),yy=n=>h-pad-(Number(n)-base)/(top-base)*(h-2*pad);
 const points=good.map((r,i)=>xx(i).toFixed(1)+','+yy(r[key]).toFixed(1)).join(' ');
 const axes=[.2,.5,.8].map(q=>'<line x1="'+pad+'" y1="'+(h-pad-q*(h-2*pad))+'" x2="'+(w-pad)+'" y2="'+(h-pad-q*(h-2*pad))+'" stroke="#305747" stroke-dasharray="3 5"/><text x="'+(pad+2)+'" y="'+(h-pad-q*(h-2*pad)-5)+'" fill="#7ba592" font-size="10">'+fmt(base+q*(top-base),3)+'</text>').join('');
 const dots=good.map((r,i)=>'<circle cx="'+xx(i)+'" cy="'+yy(r[key])+'" r="4" fill="#99f2bc"><title>'+html(r.date)+' • '+html(key)+': '+fmt(r[key],4)+'</title></circle>').join('');
 return '<div class="mini-chart"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="กราฟ '+html(key)+' '+good.length+' ภาพผ่าน QA">'+axes+'<polyline fill="none" stroke="#79dfaa" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="'+points+'"/>'+dots+'</svg></div><div class="timeline-labels"><span>'+html(good[0].date)+'</span><span>'+html(good[good.length-1].date)+'</span></div>';
}

function previewCoverage(){
 if(!cache.imagery)return null;
 return new Set([...(cache.imagery.items||[]),...(cache.imagery.generated_items||[])].map(x=>x.plot+'|'+x.date));
}
function missingQaRecords(){
 const available=previewCoverage();if(!available)return [];
 return (cache.data.scenes||[]).filter(x=>qaOk(x)&&!available.has(x.plot+'|'+x.date)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function incompleteModeRecords(){
 const generated=new Map((cache.imagery?.generated_items||[]).map(x=>[x.plot+'|'+x.date,x]));
 const required=['true_color','false_color','ndvi','ndre','ndmi','mndwi','bsi','ndwi'];
 return (cache.data?.scenes||[]).map(x=>{
  const item=generated.get(x.plot+'|'+x.date);
  const missing=required.filter(k=>!item?.assets?.[k]);
  return {...x,missing_modes:missing};
 }).filter(x=>x.missing_modes.length).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function missingVisualRecords(){
 const available=previewCoverage();
 if(!available)return [];
 return (cache.data?.scenes||[]).filter(x=>!qaOk(x)&&!available.has(x.plot+'|'+x.date))
  .sort((x,y)=>(y.date||'').localeCompare(x.date||''));
}
function twinQuality(code){
 const images=(cache.imagery?.generated_items||[]).filter(x=>x.plot===code);
 const scenes=plotScenes(code),valid=scenes.filter(qaOk),latest=valid.at(-1);
 const missing=valid.filter(x=>!images.some(y=>y.date===x.date));
 const reviewIndex=images.filter(x=>(x.index_parity_warnings||[]).length);
 const reviewVisual=images.filter(x=>x.rgb_display_warning||Number(x.rgb_invalid_pct)>=30||Number(x.rgb_unclassified_scl_pct)>=20);
 const changes=plotChanges(code),comparable=changes.filter(x=>x.status==='AUTO_VALID'&&Number(x.common_clear_rai)>0);
 const issues=[];
 if(!plotOf(code)?.geometry)issues.push('ไม่มีขอบเขต GIS');
 if(!valid.length)issues.push('ไม่มีวันภาพผ่าน QA');
 if(missing.length)issues.push('ขาดภาพ Preview '+missing.length+' วัน');
 if(reviewIndex.length)issues.push('Index QA ต้องทบทวน '+reviewIndex.length+' วัน');
 if(reviewVisual.length)issues.push('Visual QA ต้องทบทวน '+reviewVisual.length+' วัน');
 if(latest&&Number(latest.total_pixels)<30)issues.push('พิกเซลวิเคราะห์ต่ำกว่า 30');
 if(valid.length>1&&!comparable.length)issues.push('ยังไม่มี Pixel Change ที่เปรียบเทียบได้');
 return {images,scenes,valid,latest,missing,reviewIndex,reviewVisual,changes,comparable,issues};
}
function plotTwin(code){
 const q=twinQuality(code),latest=q.latest;
 const imgs=q.images.filter(x=>x.date===latest?.date),idx=imgs[0]?.index_stats||{};
 const metric=['ndvi','ndre','ndmi','ndwi','mndwi','bsi'].map(k=>{
  const v=idx[k],raw=latest?.[k],n=v?.plot_mean??raw;
  return '<tr><td>'+html(k.toUpperCase())+'</td><td class="num">'+(n==null?'—':fmt(n,4))+'</td><td>'+html(v?.formula||'ดูวิธีคำนวณใน Index QA')+'</td></tr>';
 }).join('');
 const changes=q.comparable.slice(-3).reverse().map(c=>'<tr><td>'+html(c.date_a)+' → '+html(c.date_b)+'</td><td>'+fmt(c.common_clear_rai,3)+'</td><td>'+fmt(c.water_net_change_rai,3)+'</td><td>'+fmt(c.vegetation_net_change_rai,3)+'</td><td>'+html(c.comparison_review||c.comparison_confidence||'Screening only')+'</td></tr>').join('');
 const alert=q.issues.length?'<p class="muted">ประเด็นต้องตรวจ: '+q.issues.map(html).join(' • ')+'</p>':'<p class="muted">ไม่พบประเด็น QA ตามเกณฑ์คัดกรองอัตโนมัติ แต่ยังไม่ยืนยันผลภาคสนาม</p>';
 return '<section class="panel" id="plot-digital-twin"><div class="panel-header"><div><div class="eyebrow">READ-ONLY PLOT DIGITAL TWIN</div><h2>'+html(code)+' · ภาพรวมหลักฐานเชิงพื้นที่</h2><p class="muted">รวม QA ภาพ ดัชนี การเปลี่ยนแปลง และข้อจำกัด โดยไม่อ้างว่าได้รับการรับรอง</p></div>'+btn('Export Evidence','exportevidence',code,'primary')+'</div>'+
 '<div class="grid half">'+kpi('วันภาพผ่าน QA',q.valid.length+' / '+q.scenes.length,'รายการผลวิเคราะห์')+kpi('Visual / Index Review',q.reviewVisual.length+' / '+q.reviewIndex.length,'จำนวนวันที่มีข้อสังเกต')+kpi('Preview ที่ขาด',q.missing.length,'เทียบวันผ่าน QA')+kpi('Pixel Change ที่ใช้เปรียบเทียบ',q.comparable.length,'ไม่ใช่การยืนยันน้ำท่วมหรือป่าเสื่อมโทรม')+'</div>'+alert+
 '<h3>ดัชนีล่าสุดจาก TIFF / ผลวิเคราะห์</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>ดัชนี</th><th>ค่าเฉลี่ยในแปลง</th><th>สูตร/แหล่งอ้างอิง</th></tr></thead><tbody>'+metric+'</tbody></table></div>'+
 '<h3>Pixel Change จากคู่วันที่ผ่าน QA</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>พื้นที่ร่วม (ไร่)</th><th>น้ำ Δ ไร่</th><th>พืช Δ ไร่</th><th>ข้อควรระวัง</th></tr></thead><tbody>'+(changes||'<tr><td colspan="5">ยังไม่มีคู่วันที่ประมวลผล Pixel Change ที่เปรียบเทียบได้</td></tr>')+'</tbody></table></div>'+
 '<p class="muted tiny">ยังไม่มีข้อมูลน้ำขึ้นน้ำลง/ฤดูกาล ภาคสนาม และผู้อนุมัติที่ผูกกับแปลง จึงเป็น Digital Twin สำหรับคัดกรองและตรวจหลักฐานเท่านั้น</p></section>';
}
function plotDecision(code){
 const p=plotOf(code),rows=plotScenes(code),good=validScenes(code),last=good.at(-1),prev=good.at(-2),available=previewCoverage();
 if(!p)return empty('ยังไม่มีข้อมูลแปลง','เลือกจากทะเบียน');
 const hasPreview=last&&available?.has(code+'|'+last.date);
 const previewText=!available?'ยังเชื่อมรายการภาพไม่ได้':!last?'ไม่มีภาพผ่าน QA':hasPreview?'ตรงกับวัน QA ล่าสุด':'ยังไม่มี Preview ตรงกับวัน QA ล่าสุด';
 const compare=prev&&last?'<div class="grid half">'+
  kpi('NDVI เปลี่ยน',fmt(last.ndvi-prev.ndvi,4),prev.date+' → '+last.date)+
  kpi('พื้นที่น้ำเปลี่ยน',fmt(last.water_rai-prev.water_rai,3)+' ไร่','เทียบยอดรวมสองวัน ยังไม่ใช่ Pixel Change')+
  kpi('พื้นที่พืชเปลี่ยน',fmt(last.vegetation_rai-prev.vegetation_rai,3)+' ไร่','ไม่ใช่ต้นไม้รอดตายหรือเจริญเติบโต')+
  kpi('QA ล่าสุด',fmt(last.qa_valid_pct,0)+'%','ประเมินจาก '+fmt(last.total_pixels,0)+' พิกเซล')+'</div>':
  message('ยังไม่มีข้อมูล QA ผ่านสองวันสำหรับการเปรียบเทียบ');
 return '<section class="panel decision-panel"><div class="panel-header"><div><div class="eyebrow">PLOT INTELLIGENCE · CANDIDATE ONLY</div><h2>'+html(code)+' · บันทึกการตัดสินใจ</h2><p class="muted">สรุปจากภาพดาวเทียมและ QA ไม่ใช่ผลการรับรองด้านสิ่งแวดล้อม</p></div>'+statusTag(code)+'</div>'+
 '<div class="grid half"><div class="kv"><span>พื้นที่ Geometry</span><b>'+(p.geometry?fmt(p.area,3)+' ไร่':'ไม่มี Geometry')+'</b><span>Boundary</span><b>'+html(p.group)+'</b><span>วัน QA ผ่านล่าสุด</span><b>'+html(last?.date||'ไม่มี')+'</b><span>Raster Preview</span><b>'+html(previewText)+'</b></div>'+
 '<div class="kv"><span>วันภาพที่มีในผลวิเคราะห์</span><b>'+rows.length+'</b><span>วันภาพผ่าน QA</span><b>'+good.length+'</b><span>สถานะสิ่งแวดล้อม</span><b>ยังไม่ยืนยันภาคสนาม</b><span>ผู้อนุมัติ/หลักฐานภาคสนาม</span><b>ยังไม่เชื่อมระบบ</b></div></div>'+
 compare+
 (last&&available&&!hasPreview?message('ภาพวันที่ '+html(last.date)+' ผ่าน QA แต่ยังไม่มี Raster Preview จาก TIFF จึงห้ามใช้ภาพวันที่อื่นแทน','warn'):'')+
 (last&&Number(last.total_pixels)<30?message('Small Plot Warning: การประเมินใช้เพียง '+fmt(last.total_pixels,0)+' พิกเซลบนกริดวิเคราะห์ ควรตรวจสอบด้วย Drone หรือข้อมูลภาคสนาม','warn'):'')+
 '<div class="decision-next"><b>ขั้นตอนตรวจสอบต่อ</b><p>ตรวจ RGB/False Color, SCL, ระดับน้ำขึ้นลง/ฝน, ขอบเขตเวอร์ชันเดียวกัน และหลักฐานภาคสนามก่อนสรุปน้ำท่วม การเสื่อมโทรมหรือการเติบโต</p><div class="button-row">'+btn('เปิด Satellite','setview','satellite','primary')+btn('ดูดัชนี','setview','analysis')+btn('Export Evidence','exportevidence',code)+'</div></div></section>';
}
function insightsPage(){
 root.innerHTML=commonHead('Plot Intelligence & Decisions','หน้าสรุปแปลงสำหรับผู้บริหาร GIS นักวิชาการป่าไม้ และ Auditor ที่แยกข้อมูลสังเกตกับข้อสรุปที่ผ่านการรับรอง')+
 '<div class="controls"><label>แปลง<select id="plot-select">'+allPlots().map(x=>'<option value="'+html(x.code)+'" '+(x.code===state.plot?'selected':'')+'>'+html(x.code)+'</option>').join('')+'</select></label></div>'+
 plotDecision(state.plot)+plotTwin(state.plot)+waterIntelligencePanel(state.plot)+'<section class="panel" id="imagery-explorer"></section>'+
 '<div class="panel"><h2>Audit Readiness Checklist</h2><div class="grid half">'+
 ['ขอบเขต PDD / ยืนยันกรม / เวอร์ชัน','Scene ID, วันที่ภาพ, 10m / 20m และ SCL','Raw TIFF กับ Raster Preview วันที่เดียวกัน','Common-clear pixels และวิธีเปรียบเทียบ','ระดับน้ำขึ้นน้ำลงและบริบทฤดูกาล','หลักฐานสำรวจ GPS และภาพถ่าย','สูตรคำนวณและความไม่แน่นอน','ผู้ตรวจทานและรายงานล็อกเวอร์ชัน'].map(x=>'<div class="audit-item"><span>□</span> '+html(x)+'</div>').join('')+
 '</div><p class="muted">เช็กลิสต์เพื่อเตรียมตรวจสอบ ไม่ใช่ระบบอนุมัติจริงหรือใบรับรอง</p></div>';
}
function integrityTable(){
 if(!cache.imagery)return message('ยังอ่าน Raster Manifest ไม่สำเร็จ ไม่สามารถยืนยันจำนวน Preview ที่ขาด');
 const gaps=missingQaRecords(),valid=(cache.data.scenes||[]).filter(qaOk),nonQa=(cache.data.scenes||[]).filter(x=>!qaOk(x)),unavailable=missingVisualRecords(),modeGaps=incompleteModeRecords(),visual=(cache.imagery?.generated_items||[]).filter(x=>x.preview_kind==='VISUAL_ONLY_NON_QA');
 return '<div class="panel"><div class="panel-header"><div><h2>QA / Raster Preview Integrity</h2><p class="muted">ตรวจความครบถ้วนรายคู่รหัสแปลง-วันภาพ (ไม่ใช่การตรวจ Scene ID)</p></div>'+btn('Export Gap CSV','exportgaps','','primary')+'</div>'+
 '<div class="grid half">'+kpi('วันภาพผ่าน QA',valid.length,'ในข้อมูล PDD')+kpi('QA ผ่านแต่ไม่มี Preview',gaps.length,'ต้องสร้างภาพจาก GeoTIFF จริง')+kpi('ภาพไม่ผ่าน QA',nonQa.length,'แสดงได้เฉพาะ RGB จากต้นฉบับ')+kpi('RGB ไม่ผ่าน QA ที่สร้างเพิ่ม',visual.length,'สีจริง/สีเท็จ รวมเมฆจริง ไม่สร้างดัชนี')+kpi('ภาพไม่ผ่าน QA ที่ยังไม่มี Preview',unavailable.length,'ดูรายการด้านล่างและไฟล์ TIFF ต้นฉบับ')+kpi('วันภาพที่ยังไม่ครบ 8 ชนิด',modeGaps.length,'ตรวจแยกรายไฟล์ ไม่ใช่แค่นับวันภาพ')+'</div>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>วันภาพ</th><th>QA</th><th>10m TIFF</th></tr></thead><tbody>'+
 gaps.slice(0,100).map(x=>'<tr><td>'+btn(x.plot,'plot',x.plot,'mini')+'</td><td>'+html(x.date)+'</td><td>'+fmt(x.qa_valid_pct,0)+'%</td><td>'+assetLink(x.original_tif10,x.original_tif10_file_id)+'</td></tr>').join('')+
 '</tbody></table></div><p class="muted">แสดง '+Math.min(gaps.length,100)+' จาก '+gaps.length+' รายการ ดาวน์โหลด CSV เพื่อดูทั้งหมด</p>'+'<h3>รายการภาพสีจริงวันไม่ผ่าน QA ที่ยังขาด</h3>'+btn('Export Visual Gap CSV','exportnonqagaps','','primary')+'<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>วันที่</th><th>ผล QA</th><th>10m TIFF ต้นฉบับ</th></tr></thead><tbody>'+unavailable.slice(0,100).map(x=>'<tr><td>'+html(x.plot)+'</td><td>'+html(x.date)+'</td><td>'+html(x.analysis_status)+'</td><td>'+assetLink(x.original_tif10,x.original_tif10_file_id)+'</td></tr>').join('')+'</tbody></table></div><p class="muted">แสดง '+Math.min(unavailable.length,100)+' / '+unavailable.length+' วันที่ไม่มี Preview • ไม่มีการสร้างภาพแทนจากวันอื่น</p>'+'<h3>ตรวจครบ 8 ภาพต่อวัน · สีจริง/สีเท็จ/ดัชนี</h3>'+btn('Export Missing Modes CSV','exportmissingmodes','','primary')+'<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>วันภาพ</th><th>สถานะ QA</th><th>ชนิดที่ขาด</th><th>ตรวจ</th></tr></thead><tbody>'+modeGaps.slice(0,100).map(x=>'<tr><td>'+html(x.plot)+'</td><td>'+html(x.date)+'</td><td>'+html(x.analysis_status)+'</td><td>'+html(x.missing_modes.join(', '))+'</td><td>'+btn('เปิดภาพ','insight',x.plot,'mini')+'</td></tr>').join('')+'</tbody></table></div><p class="muted">แสดง '+Math.min(modeGaps.length,100)+' / '+modeGaps.length+' คู่แปลง-วันภาพที่ยังไม่ครบ 8 ชนิด</p></div>';
}
function displayQualityIssues(){
 const rows=cache.imagery?.generated_items||[];
 return rows.filter(x=>x.rgb_display_warning||Number(x.rgb_invalid_pct)>=30||Number(x.rgb_unclassified_scl_pct)>=20||!x.rgb_renderer_version);
}
function displayQualityTable(){
 if(!cache.imagery)return message('ยังไม่พบ Raster Manifest จึงตรวจคุณภาพภาพทั้งหมดไม่ได้');
 const imgs=cache.imagery.generated_items||[],issues=displayQualityIssues();
 const fixed=imgs.filter(x=>x.rgb_renderer_version==='mmc-rgb-fixed-reflectance-v2');
 return '<section class="panel"><div class="panel-header"><div><h2>Raster Visual QA • ทุกภาพทุกแปลง</h2><p class="muted">ตรวจคุณภาพการแสดงภาพแยกจากเกณฑ์ SCL และแยกจากการตรวจสอบภาคสนาม</p></div>'+btn('Export Visual QA CSV','exportvisualqa','','primary')+'</div>'+
 '<div class="grid half">'+kpi('ภาพจาก renderer ใหม่',fixed.length+' / '+imgs.length,'สีจริงใช้ช่วง reflectance เดียวกัน · NoData โปร่งใส')+
 kpi('ภาพรอตรวจด้วยสายตา',issues.length,'เกือบขาว ≥30% / NoData ≥30% / SCL 7 ≥20% หรือ renderer เก่า')+'</div>'+
 '<p class="muted tiny">ค่าเหล่านี้เป็นเกณฑ์คัดกรองคุณภาพการแสดงผล ไม่ใช่หลักฐานยืนยันว่าเมฆปกคลุมหรือป่าเสื่อมโทรม</p>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>วันภาพ</th><th>เกือบขาว</th><th>NoData/SCL</th><th>SCL 7</th><th>เปิดภาพ</th></tr></thead><tbody>'+
 issues.slice(0,100).map(x=>'<tr><td>'+html(x.plot)+'</td><td>'+html(x.date)+'</td><td>'+fmt(x.rgb_near_white_pct,1)+'%</td><td>'+fmt(x.rgb_invalid_pct,1)+'%</td><td>'+fmt(x.rgb_unclassified_scl_pct,1)+'%</td><td>'+btn('ตรวจ','insight',x.plot,'mini')+'</td></tr>').join('')+
 '</tbody></table></div><p class="muted">แสดง '+Math.min(100,issues.length)+' จาก '+issues.length+' วันที่ควรตรวจเพิ่ม • กดเปิดแปลงเพื่อดู Raster และผล QA</p></section>';
}
function spectralQualityTable(){
 if(!cache.imagery)return message('ไม่พบ Raster Manifest สำหรับตรวจดัชนี');
 const rows=(cache.imagery.generated_items||[]).filter(x=>x.preview_kind!=='VISUAL_ONLY_NON_QA');
 const audited=rows.filter(x=>x.index_renderer_version==='mmc-index-source-verified-v1');
 const flagged=rows.filter(x=>(x.index_parity_warnings||[]).length);
 return '<section class="panel" id="index-audit"><div class="panel-header"><div><h2>Index QA · ตรวจดัชนีจาก GeoTIFF ทุกแปลง</h2><p class="muted">ตรวจสูตร NDVI / NDRE / NDMI (B8A) / NDWI / MNDWI / BSI เทียบกับค่ารายงาน และ NDRE/NDMI/MNDWI ที่ฝังใน TIFF</p></div>'+
 btn('Export Index QA CSV','exportindexqa','','primary')+'</div>'+
 '<div class="grid half">'+kpi('มีผลตรวจจาก TIFF',audited.length+' / '+rows.length,'ค่าเฉลี่ยเฉพาะ PDD ไม่ใช่ค่าทั้งกรอบ Raster')+
 kpi('วันที่มีค่าต่างต้องตรวจ',flagged.length,'ผลต่าง > 0.03 หรือ Index Band ใน TIFF ไม่ตรง')+'</div>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>วันภาพ</th><th>ดัชนีที่ต้องตรวจ</th><th>ส่วนต่างสูงสุด</th><th>เปิด</th></tr></thead><tbody>'+
 flagged.slice(0,100).map(x=>'<tr><td>'+html(x.plot)+'</td><td>'+html(x.date)+'</td><td>'+html((x.index_parity_warnings||[]).join(', '))+'</td><td class="num">'+fmt(Math.max(0,...Object.values(x.index_parity||{}).map(z=>Math.abs(Number(z.difference)||0))),4)+'</td><td>'+btn('ดูดัชนี','analyse',x.plot,'mini')+'</td></tr>').join('')+
 '</tbody></table></div><p class="muted tiny">การตรวจนี้เปรียบเทียบข้อมูลภาพที่คำนวณจริงกับรายงานเดิม ไม่ใช่การยืนยันสภาพป่า สุขภาพต้นไม้ หรืออุทกภัย • เกณฑ์ต่าง 0.03 เป็นค่าเตือนตรวจความสอดคล้อง ไม่ใช่ความคลาดเคลื่อนเซนเซอร์</p></section>';
}
function overview(){const p=filtered(),qa= p.filter(x=>plotStatus(x.code)==='VALID').length;
 const companies={STC:p.filter(x=>x.company==='STC').length,VSD:p.filter(x=>x.company==='VSD').length,EVR:p.filter(x=>x.company==='EVR').length};
 const byProv={};p.forEach(x=>byProv[x.province]=(byProv[x.province]||0)+1);
 const prov=Object.entries(byProv).sort((a,b)=>b[1]-a[1]).slice(0,10);
 const w=Math.max(1,...prov.map(x=>x[1]));
 const st=cache.status;
 root.innerHTML=commonHead('ศูนย์ติดตามป่าชายเลนทั่วประเทศ','รวมขอบเขต GIS และผลภาพดาวเทียม โดยไม่ใช้ข้อมูลที่ยังไม่ผ่าน QA ตัดสินสุขภาพป่า',btn('ดูทุกแปลง','setview','plots','primary'))+
 infoBox()+'<div class="grid kpis">'+kpi('รายการแปลงตามขอบเขตที่เลือก',state.company==='EVR'?'ไม่ทราบ':String(p.length),'ทะเบียน STC/VSD 160 • EVR ยังไม่มีแหล่งทะเบียนที่ยืนยัน')+
 kpi('มี Geometry ที่จับคู่ได้',state.company==='EVR'?'ยังไม่เชื่อม':String(p.filter(x=>x.geometry).length),'MOC 159 • อีก 1 รหัสรอตรวจสอบ')+
 kpi('แปลงที่มีภาพผ่าน QA',state.company==='EVR'?'ยังไม่เชื่อม':String(qa),'ต้องมีอย่างน้อยหนึ่งภาพที่ผ่านเกณฑ์')+
 kpi('ภาพในผลวิเคราะห์ทั่วระบบ',fmt(st.totals.processed_dates,0),'ผ่าน QA '+fmt(st.totals.qa_valid_dates,0)+' วันภาพ')+'</div>'+
 '<div class="grid two"><div class="panel"><div class="panel-header"><h2>GIS Map • STC / VSD / MOC</h2>'+btn('ขยายแผนที่','setview','map','mini')+'</div><div class="map" id="home-map"></div><div class="legend"><span><i class="valid"></i>มีภาพผ่าน QA</span><span><i class="notvalid"></i>ไม่ผ่าน QA</span><span><i class="extra"></i>MOC 3</span><span><i class="unknown"></i>ยังไม่ประมวลผล</span></div></div>'+
 '<div class="panel"><div class="panel-header"><h2>ภาพรวมพื้นที่และหน่วยงาน</h2></div><div class="grid half">'+kpi('STC',companies.STC,'แปลงในตัวกรอง')+kpi('VSD',companies.VSD,'แปลงในตัวกรอง')+'</div><div class="panel-divider"></div><h3>จำนวนแปลงตามจังหวัด (10 อันดับแรก)</h3><div class="stats-list">'+prov.map(x=>'<div class="stats-row"><span>'+html(x[0])+'</span><div class="track"><i style="width:'+100*x[1]/w+'%"></i></div><strong>'+x[1]+'</strong></div>').join('')+'</div></div></div>'+
 '<div class="grid half"><div class="panel"><h2>Data Coverage</h2><div class="kv"><span>ทะเบียน STC/VSD</span><b>160 รหัส (16 จังหวัด)</b><span>Boundary MOC</span><b>159 รหัส รวม MOC 3</b><span>PDD วิเคราะห์เดิม</span><b>136 / 136</b><span>ผ่าน QA อย่างน้อย 1 วัน</span><b>126 / 136</b><span>EVR</span><b>รอทะเบียนและขอบเขตยืนยัน</b><span>วันภาพล่าสุดในชุดวิเคราะห์</span><b>'+html(latestDate())+'</b></div></div>'+
 '<div class="panel"><h2>งานที่ควรดำเนินการ</h2><div class="issue"><div class="issue-icon">!</div><div><b>ตรวจ Boundary 66(1)-STC</b><small>มีในทะเบียน แต่ยังไม่มี Geometry แยกที่ยืนยันได้</small></div></div><div class="issue"><div class="issue-icon">!</div><div><b>10 แปลงยังไม่มีภาพผ่าน QA</b><small>ข้อมูลไม่ครบ ไม่ถือว่าแปลงผิดปกติหรือปกติ</small></div></div><div class="issue"><div class="issue-icon">↗</div><div><b>แปลง MOC 3 เพิ่มเติม 23 รหัส</b><small>รอจับคู่ภาพและประมวลผลภายใต้ขอบเขตที่อนุมัติ</small></div></div></div></div>';
 initMap('home-map',p);
 root.insertAdjacentHTML('beforeend',integrityTable());
}
function mapPage(){const p=filtered();root.innerHTML=commonHead('ศูนย์แผนที่ GIS','แสดง Polygon ที่มีในแหล่ง MOC เดิม แยก QA และ MOC 3 อย่างชัดเจน',btn('ส่งออก GeoJSON ตัวกรอง','exportgeo','filter'))+infoBox()+'<div class="panel"><div class="panel-header"><h2>Spatial Plot Layers</h2><small>คลิก Polygon เพื่อดูชื่อแปลงและเปิดข้อมูล</small></div><div class="map tall" id="main-map"></div><div class="legend"><span><i class="valid"></i>QA ผ่าน</span><span><i class="notvalid"></i>QA ไม่ผ่าน</span><span><i class="extra"></i>MOC 3</span><span><i class="unknown"></i>ยังไม่ประมวลผล</span></div></div>'+message('Map แสดงขอบเขตแปลงตามเวอร์ชันที่มีอยู่ ไม่ใช่การรับรองสิทธิ์ที่ดิน และไม่แสดงตำแหน่งสำหรับแปลงที่ไม่มี Geometry','blue');initMap('main-map',p,true);}
function plotsPage(){const p=filtered().filter(x=>!state.filter||x.code.toLowerCase().includes(state.filter.toLowerCase())||x.province.includes(state.filter));const sel=plotOf(state.plot);
 root.innerHTML=commonHead('Plot Registry','ทุกแปลงในทะเบียนเป็น Entity แยกจาก Boundary และไม่บังคับว่าต้องมีภาพดาวเทียม',btn('Export รายการ CSV','exportplots','','primary'))+infoBox()+
 '<div class="panel"><div class="panel-header"><h2>รายการแปลง <small>'+p.length+' รายการ</small></h2><input class="search" id="plot-search" type="search" placeholder="ค้นหารหัสแปลง / จังหวัด" value="'+html(state.filter)+'" aria-label="ค้นหารหัสแปลง"></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Plot Code</th><th>บริษัท</th><th>จังหวัด</th><th>ขอบเขต</th><th>พื้นที่ Geometry (ไร่)</th><th>ภาพดาวเทียม</th><th></th></tr></thead><tbody>'+p.map(x=>'<tr><td><b>'+html(x.code)+'</b></td><td>'+html(x.company)+'</td><td>'+html(x.province)+'</td><td>'+(!x.geometry?tag('ต้องจับคู่','danger'):x.group==='MOC3'?tag('MOC 3','blue'):tag('PDD',''))+'</td><td class="num">'+(x.geometry?fmt(x.area,2):'—')+'</td><td>'+statusTag(x.code)+'</td><td class="action">'+btn('ดู','plot',x.code,'mini')+'</td></tr>').join('')+'</tbody></table></div></div>'+
 (sel?plotDetail(sel):'');
 bindSearch();
}
function plotDetail(p){const scenes=plotScenes(p.code),valid=validScenes(p.code),last=valid.slice(-1)[0],b=p.props||{};
 return '<div class="panel" id="plot-detail"><div class="plot-header"><div><div class="eyebrow">PLOT PROFILE</div><h2 class="plot-name">'+html(p.code)+'</h2><p>'+html(p.province)+' · '+html(p.company)+' · '+statusTag(p.code)+'</p></div><div class="button-row">'+btn('วิเคราะห์ดัชนี','analyse',p.code,'primary')+btn('Plot Intelligence','insight',p.code)+btn('ดู GeoJSON','exportgeo',p.code)+'</div></div><div class="grid half">'+
 '<div class="panel"><h3>ข้อมูลขอบเขต</h3><div class="kv"><span>Boundary Group</span><b>'+html(p.group)+'</b><span>พื้นที่ Geometry</span><b>'+(p.geometry?fmt(p.area,4)+' ไร่':'ยังไม่ได้ยืนยัน')+'</b><span>แหล่งที่มา</span><b>'+html(b.source_path||'ทะเบียนโครงการ (ยังไม่มีขอบเขต)')+'</b><span>CRS ต้นฉบับ</span><b>'+html(b.source_crs||'ไม่ระบุ')+'</b><span>จำนวนส่วน</span><b>'+html(b.geometry_parts??'ไม่ระบุ')+'</b></div></div>'+
 '<div class="panel"><h3>ผลภาพดาวเทียม</h3><div class="kv"><span>จำนวนวันภาพ</span><b>'+scenes.length+'</b><span>วันที่ผ่าน QA</span><b>'+valid.length+'</b><span>วันภาพผ่าน QA ล่าสุด</span><b>'+html(last?.date||'ไม่มี')+'</b><span>NDVI (ล่าสุดที่ผ่าน QA)</span><b>'+(last?fmt(last.ndvi,4):'ไม่มีข้อมูล')+'</b><span>พื้นที่น้ำ</span><b>'+(last?fmt(last.water_rai)+' ไร่':'ไม่มีข้อมูล')+'</b></div></div></div>'+
 (p.geometry?'<div class="map" id="plot-map"></div>':message('ไม่มี Boundary ที่จับคู่กับรหัสนี้อย่างปลอดภัย ระบบไม่เดาตำแหน่งจากพื้นที่ข้างเคียง'))+'<section class="panel" id="imagery-explorer"></section>'+
 '</div>';
}
function analysisPage(){const p=plotOf(state.plot),sc=plotScenes(state.plot),good=validScenes(state.plot);
 const metricChoices=Object.entries(METRICS).map(([k,v])=>'<option value="'+k+'" '+(state.metric===k?'selected':'')+'>'+html(v[0])+'</option>').join('');
 const last=good.slice(-1)[0]||{},first=good[0]||{},key=state.metric;
 root.innerHTML=commonHead('Environmental Analytics','วิเคราะห์จาก Sentinel-2 ดัชนีจริงในพื้นที่ PDD โดยคัดเฉพาะวันที่ QA ผ่าน',btn('Export CSV','exportscenes',state.plot,'primary'))+
 '<div class="controls"><label>แปลง <select id="plot-select">'+allPlots().map(x=>'<option value="'+html(x.code)+'" '+(x.code===state.plot?'selected':'')+'>'+html(x.code)+'</option>').join('')+'</select></label><label>ดัชนี <select id="metric-select">'+metricChoices+'</select></label>'+btn('ดูแปลงบนแผนที่','setview','map')+'</div>'+
 (p?'<div class="grid kpis">'+kpi('วันภาพที่ผ่าน QA',String(good.length),'ทั้งหมด '+sc.length+' ภาพ')+kpi(METRICS[key][0]+' ล่าสุด',last[key]!=null?fmt(last[key],4):'—',html(last.date||'ไม่มีภาพ QA ผ่าน'))+kpi('ค่าแรกที่ผ่าน QA',first[key]!=null?fmt(first[key],4):'—',html(first.date||'ไม่มี'))+kpi('ต่างจากครั้งแรก',good.length>=2?fmt(last[key]-first[key],4):'—','เทียบวันที่ผ่าน QA ไม่ใช่การอนุมานเหตุการณ์')+'</div>':'')+
 '<section class="panel" id="imagery-explorer"></section><div class="panel"><div class="section-title"><div><h2>Time Series · '+html(METRICS[key][0])+'</h2><p>'+html(METRICS[key][1])+' · เฉพาะ AUTO_VALID</p></div></div>'+svgChart(sc,key)+'</div>'+
 '<div class="panel"><div class="panel-header"><h2>ประวัติค่าดัชนีและคุณภาพภาพ</h2><small>NO_DATA / PARTIAL แสดง — แทนค่าที่เชื่อถือไม่ได้</small></div><div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่ถ่ายภาพ</th><th>QA</th><th>% ใช้ได้</th><th>NDVI</th><th>NDRE</th><th>NDMI (B8A)</th><th>NDWI</th><th>MNDWI</th><th>BSI</th><th>Water ไร่</th><th>Vegetation ไร่</th></tr></thead><tbody>'+sc.map(x=>'<tr><td>'+html(x.date)+'</td><td>'+tag(x.analysis_status,qaOk(x)?'':x.analysis_status==='PARTIAL'?'warn':'danger')+'</td><td class="num">'+fmt(x.qa_valid_pct)+'</td>'+['ndvi','ndre','ndmi','ndwi','mndwi','bsi','water_rai','vegetation_rai'].map(k=>'<td class="num">'+(qaOk(x)?fmt(x[k],k.includes('rai')?2:4):'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></div>'+
 message('การเพิ่มน้ำไม่ได้แปลว่า “น้ำท่วม” ทุกครั้ง โดยเฉพาะป่าชายเลนที่มีอิทธิพลน้ำขึ้นน้ำลง ต้องพิจารณาเวลา ฤดูกาล ภาพหลายวัน และหลักฐานภาคสนาม','blue')+
 message('คำอธิบายดัชนี: NDMI ชุดนี้ใช้ B8A/B11 ตาม TIFF • NDWI ใช้ Green B3 กับ NIR B8 (McFeeters) จึงติดลบได้ตามปกติในพื้นที่ป่าที่พืชสะท้อน NIR สูง • MNDWI ติดลบในป่าเป็นเรื่องปกติ และ BSI ติดลบในพื้นที่พืชไม่ได้หมายความว่าข้อมูลผิด • ค่ารายงานเดิมเทียบได้กับค่า TIFF ตรวจใหม่ใน Satellite Explorer','blue');
}
function changePage(){const a=allChangesFiltered();const risk=a.filter(x=>x.status==='AUTO_VALID');
 root.innerHTML=commonHead('Change Detection','ผลเปรียบเทียบที่อ้างอิงพิกเซลใช้ได้ร่วมกันและขอบเขต PDD ชุดเดียวกัน',btn('Export Changes CSV','exportchanges','','primary'))+
 message('ตัวเลขในหน้านี้ยังเป็นผลเผยแพร่เดิม • v1.3 (MNDWI Average + Polygon Clip) อยู่ใน Staging QA ไม่ได้อนุมัติหรือเขียนทับข้อมูลหลัก','warn')+
 waterIntelligencePanel()+
 '<div class="grid kpis">'+kpi('Change records',String(a.length),'ผลเปรียบเทียบจริง')+kpi('ผ่านเกณฑ์เปรียบเทียบ',String(risk.length),'ไม่รวมคู่ที่ QA ไม่พร้อม')+kpi('แปลงที่พบ Change',String(new Set(a.map(x=>x.plot)).size),'เฉพาะแปลงในตัวกรอง')+kpi('สัญญาณน้ำเพิ่ม',String(a.filter(x=>x.status==='AUTO_VALID'&&signalPercent(x,'water')>=10).length),'น้ำเพิ่ม ≥10% ของพื้นที่เทียบได้ (รอตรวจยืนยัน)')+'</div>'+
 '<div class="panel"><div class="panel-header"><h2>Water / Vegetation / Soil change</h2><small>ค่าอาจเป็นลบหรือบวก ขึ้นกับทิศทาง</small></div><div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>ภาพก่อน</th><th>ภาพหลัง</th><th>พื้นที่เทียบได้ (ไร่)</th><th>Water net ไร่</th><th>Vegetation net ไร่</th><th>Soil net ไร่</th><th>ตรวจ</th></tr></thead><tbody>'+a.sort((x,y)=>(y.date_b||'').localeCompare(x.date_b||'')).map(x=>'<tr><td><b>'+html(x.plot)+'</b></td><td>'+html(x.date_a)+'</td><td>'+html(x.date_b)+'</td><td class="num">'+fmt(x.common_clear_rai)+'</td><td class="num">'+fmt(x.water_net_change_rai)+'</td><td class="num">'+fmt(x.vegetation_net_change_rai)+'</td><td class="num">'+fmt(x.bare_soil_net_change_rai)+'</td><td>'+btn('แปลง','plot',x.plot,'mini')+'</td></tr>').join('')+'</tbody></table></div></div>'+
 message('สัญญาณน้ำและพืชที่เปลี่ยนแปลงเป็น “Candidate” ไม่ใช่หลักฐานยืนยันน้ำท่วม การบุกรุก หรือการตายของต้นไม้ และไม่ใช้ค่าเปลี่ยนแปลงเมื่อช่วงเวลา/Geometry เทียบกันไม่ได้','blue');
}
function allChangesFiltered(){const allowed=new Set(filtered().map(x=>x.code));return (cache.data.changes||[]).filter(x=>allowed.has(x.plot));}
function satellitePage(){const scenes=plotScenes(state.plot),p=plotOf(state.plot);
 root.innerHTML=commonHead('Satellite Catalog','รายการภาพจากไฟล์ผลวิเคราะห์เดิม เชื่อมไฟล์ TIFF ต้นฉบับเมื่อมี File ID',btn('ดูคลัง 2020–2026','external','../nationwide.html#national-library'))+
 '<div class="controls"><label>เลือกแปลง<select id="plot-select">'+allPlots().map(x=>'<option value="'+html(x.code)+'" '+(x.code===state.plot?'selected':'')+'>'+html(x.code)+'</option>').join('')+'</select></label></div>'+
 '<div class="grid kpis">'+kpi('แปลงที่เลือก',state.plot,p?.province||'')+kpi('ฉากภาพประมวลผล',String(scenes.length),'แสดงวันที่จากต้นฉบับ')+kpi('ผ่าน QA',String(scenes.filter(qaOk).length),'AUTO_VALID')+kpi('ไม่ผ่าน / บางส่วน',String(scenes.filter(x=>!qaOk(x)).length),'NO_DATA / PARTIAL')+'</div>'+
 '<section class="panel" id="imagery-explorer"></section><div class="panel"><div class="panel-header"><h2>GeoTIFF Scenes</h2><small>10 m / 20 m / SCL ตรวจจากไฟล์ที่ประมวลผล</small></div>'+
 (scenes.length?'<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>QA</th><th>ใช้ได้ %</th><th>10 m ต้นฉบับ</th><th>20 m / SCL ต้นฉบับ</th></tr></thead><tbody>'+scenes.map(x=>'<tr><td>'+html(x.date)+'</td><td>'+tag(x.analysis_status,qaOk(x)?'':x.analysis_status==='PARTIAL'?'warn':'danger')+'</td><td>'+fmt(x.qa_valid_pct)+'</td><td>'+assetLink(x.original_tif10,x.original_tif10_file_id)+'</td><td>'+assetLink(x.original_tif20,x.original_tif20_file_id)+'</td></tr>').join('')+'</tbody></table></div>':empty('ยังไม่มีรายการภาพประมวลผล','แปลงนอก PDD 136 ยังไม่ได้เข้ากระบวนการภาพ TIFF ชุดนี้'))+'</div>'+
 '<div class="grid half"><div class="panel"><h3>Satellite Sources</h3><div class="kv"><span>Sentinel-2</span><b>10m/20m GeoTIFF และผล QA มีในคลังเดิม</b><span>Landsat 8/9</span><b>มีรายการภาพย้อนหลัง แยกการวิเคราะห์</b><span>Sentinel-1</span><b>มีในชุด Median ย้อนหลัง ไม่ใช่ผลวิเคราะห์หลัก</b><span>ข้อมูลใหม่</span><b>ตรวจ scene ID, acquisition, band, source CRS</b></div></div><div class="panel"><h3>คำเตือนเกี่ยวกับวันที่</h3><p class="muted">ภาพ Median รายปีเป็นข้อมูลสรุปหลายวัน ไม่ใช่ภาพ acquisition วันเดียว และภาพ Latest ใน Catalog อาจไม่ใช่วันเดียวกับผลวิเคราะห์ล่าสุด ควรแสดงวันถ่ายและวันประมวลผลแยกกัน</p></div></div>';
}
function assetLink(name,id){if(!name)return tag('ไม่มีรายการ','neutral');const uri=id?'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view':'https://drive.google.com/drive/u/0/search?q='+encodeURIComponent(name);return '<a href="'+html(uri)+'" target="_blank" rel="noopener noreferrer" title="'+html(name)+'">'+html(name.length>42?name.slice(0,38)+'…':name)+' ↗</a>';}
function changeSignal(x,kind){
 const w=Math.max(0,Number(x.water_net_change_rai)||0);
 const v=Math.max(0,-(Number(x.vegetation_net_change_rai)||0));
 const soil=Math.max(0,Number(x.bare_soil_net_change_rai)||0);
 return kind==='water'?w:kind==='vegetation'?v:kind==='soil'?soil:Math.max(w,v,soil);
}
function signalPercent(x,kind){const area=Number(x.common_clear_rai)||0;return area>0?100*changeSignal(x,kind)/area:0;}
function comparisonQuality(x){
 const reasons=[],pixels=Number(x.common_clear_pixels),area=Number(x.common_clear_rai);
 const plotArea=Number(plotOf(x.plot)?.area);
 if(!Number.isFinite(pixels)||pixels<30)reasons.push('ตัวอย่างพิกเซลร่วมต่ำกว่า 30');
 if(!Number.isFinite(area)||area<=0)reasons.push('ไม่มีพื้นที่ภาพที่เทียบร่วมกันได้');
 if(Number.isFinite(plotArea)&&plotArea>0&&area/plotArea<0.5)reasons.push('พื้นที่ร่วมต่ำกว่า 50% ของแปลง');
 return reasons;
}
function alertRows(){
 return allChangesFiltered().filter(x=>x.status==='AUTO_VALID'&&Number(x.common_clear_rai)>0&&!comparisonQuality(x).length).filter(x=>{
  const score=state.riskUnit==='percent'?signalPercent(x,state.riskKind):changeSignal(x,state.riskKind);
  return score>=state.riskThreshold;
 });
}
function alertsPage(){const changes=alertRows(),withheld=allChangesFiltered().filter(x=>x.status==='AUTO_VALID'&&comparisonQuality(x).length);
 root.innerHTML=commonHead('Early Warning Candidates','คัดกรองเหตุการณ์ที่อาจต้องสำรวจเพิ่มเติม ไม่ใช่ข้อสรุปว่ามีการบุกรุกหรือน้ำท่วมจริง',btn('ดูผลเปรียบเทียบทั้งหมด','setview','change'))+
 '<div class="notice">เกณฑ์สัญญาณ: น้ำเพิ่ม / พืชลด / ดินเพิ่ม โดยเริ่มที่ 10% ของพื้นที่ที่เปรียบเทียบได้ และสามารถเลือกหน่วยไร่ <b>ยังไม่มีการปรับน้ำขึ้นน้ำลงและการยืนยันภาคสนาม</b> จึงเป็น Candidate เท่านั้น</div>'+
 waterIntelligencePanel()+
 '<div class="controls"><label>ประเภทสัญญาณ<select id="risk-kind"><option value="water" '+(state.riskKind==='water'?'selected':'')+'>พื้นที่น้ำเปลี่ยน</option><option value="vegetation" '+(state.riskKind==='vegetation'?'selected':'')+'>พื้นที่พืชเปลี่ยน</option><option value="soil" '+(state.riskKind==='soil'?'selected':'')+'>พื้นที่ดินเปลี่ยน</option><option value="any" '+(state.riskKind==='any'?'selected':'')+'>ทุกประเภท</option></select></label><label>หน่วย<select id="risk-unit"><option value="percent" '+(state.riskUnit==='percent'?'selected':'')+'>% พื้นที่เทียบได้</option><option value="rai" '+(state.riskUnit==='rai'?'selected':'')+'>ไร่</option></select></label><label>เกณฑ์ตั้งแต่<input type="number" id="risk-threshold" min="0" step="0.25" value="'+state.riskThreshold+'"></label></div>'+
 '<div class="grid half"><div class="panel"><h3>รายการเข้าเงื่อนไข</h3><div class="metric-value">'+changes.length+'</div><p class="muted">จาก '+allChangesFiltered().length+' ช่วงเปรียบเทียบในตัวกรอง</p></div><div class="panel"><h3>สถานะการยืนยัน</h3><div class="metric-value" style="color:#ebc18e">รอตรวจ</div><p class="muted">ยังไม่ผูก Workflow ยืนยันเหตุการณ์กับผู้ใช้งาน</p></div></div>'+
 '<div class="panel"><h3>Screening Queue</h3>'+(changes.length?'<div class="table-wrap"><table class="tbl"><thead><tr><th>รหัสแปลง</th><th>วันภาพ</th><th>Water net ไร่</th><th>Vegetation net ไร่</th><th>Soil net ไร่</th><th>สัญญาณ</th><th>สถานะ</th></tr></thead><tbody>'+changes.sort((x,y)=>Math.abs(y.water_net_change_rai||0)-Math.abs(x.water_net_change_rai||0)).slice(0,150).map(x=>'<tr><td>'+btn(x.plot,'plot',x.plot,'mini')+'</td><td>'+html(x.date_b)+'</td><td class="num">'+fmt(x.water_net_change_rai)+'</td><td class="num">'+fmt(x.vegetation_net_change_rai)+'</td><td class="num">'+fmt(x.bare_soil_net_change_rai)+'</td><td class="num">'+fmt(state.riskUnit==='percent'?signalPercent(x,state.riskKind):changeSignal(x,state.riskKind))+(state.riskUnit==='percent'?'%':' ไร่')+'</td><td>'+tag('Candidate','warn')+'</td></tr>').join('')+'</tbody></table></div>':empty('ไม่มีรายการเข้าเกณฑ์นี้','อาจปรับเกณฑ์พื้นที่หรือจังหวัดที่ต้องการตรวจ'))+'</div>'+
 '<div class="panel"><h3>พักแจ้งเตือนอัตโนมัติ · ข้อมูลร่วมไม่เพียงพอ</h3><p class="muted">จำนวน '+withheld.length+' คู่วันที่ ต้องตรวจ QA หรือภาคสนามก่อน ไม่ถือว่าไม่มีความเสี่ยง</p>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>คู่วันที่</th><th>พิกเซลร่วม</th><th>เหตุผล</th><th>เปิด</th></tr></thead><tbody>'+
 withheld.slice(0,100).map(x=>'<tr><td>'+html(x.plot)+'</td><td>'+html(x.date_a)+' → '+html(x.date_b)+'</td><td>'+fmt(x.common_clear_pixels,0)+'</td><td>'+html(comparisonQuality(x).join(' / '))+'</td><td>'+btn('ตรวจ','insight',x.plot,'mini')+'</td></tr>').join('')+
 '</tbody></table></div></div>';
}
function qaPage(){const registry=filtered(),notValid=registry.filter(x=>plotStatus(x.code)==='NO_VALID'),unprocessed=registry.filter(x=>plotStatus(x.code)==='UNPROCESSED'),missing=registry.filter(x=>!x.geometry),issues=[
 ['66-STC / 66(1)-STC','แปลงคนละรหัส แต่ GeoJSON รวมมีความขัดแย้งเรื่องเวอร์ชันและรหัส Geometry'],
 ['9-STC','พื้นที่ Geometry เดิมเป็น 0 ไร่ แต่ทะเบียนโครงการระบุประมาณ 47.39 ไร่'],
 ['89(1)-STC','พื้นที่ทะเบียนต่างจาก Geometry ประมาณ 17.56 ไร่'],
 ['4-STC','พื้นที่ทะเบียนต่างจาก Geometry ประมาณ 15.36 ไร่'],
 ['13-VSD','พื้นที่ทะเบียนต่างจาก Geometry ประมาณ 14.22 ไร่'],
 ['11-VSD','พื้นที่ทะเบียนต่างจาก Geometryประมาณ 12.31 ไร่'],
 ['1-STC','พื้นที่ทะเบียนต่างจาก Geometry ประมาณ 7.03 ไร่'],
 ['2-STC','พื้นที่ทะเบียนต่างจาก Geometry ประมาณ 5.67 ไร่']
 ];
 root.innerHTML=commonHead('Data QA / Boundary Reconciliation','ประเมินความพร้อมข้อมูลแยกจากสุขภาพป่าและความเสี่ยงสิ่งแวดล้อม',btn('ดู Blueprint','external','https://github.com/thanawat150/satelliteproject/blob/main/architecture/MMC_MASTER_SPEC_v2.md'))+
 '<div class="grid kpis">'+kpi('ทั้งหมดในตัวกรอง',String(registry.length),'STC/VSD / Polygon candidate')+kpi('ไม่มี Geometry',String(missing.length),'ต้องตรวจข้อมูลต้นทาง')+kpi('ไม่มีวันผ่าน QA',String(notValid.length),'มีภาพแต่ยังใช้สรุปไม่ได้')+kpi('ยังไม่ประมวลผล',String(unprocessed.length),'ส่วนใหญ่เป็น MOC 3 หรือรหัสขอบเขตไม่ครบ')+'</div>'+
 '<div class="grid half"><div class="panel"><h2>Boundary Review Queue</h2>'+issues.map(x=>'<div class="issue"><div class="issue-icon">!</div><div><b>'+html(x[0])+'</b><small>'+html(x[1])+'</small></div></div>').join('')+'</div><div class="panel"><h2>Satellite QA Backlog</h2><p class="muted">แปลงที่มีภาพประมวลผล แต่ยังไม่มีวันผ่านเกณฑ์ QA ≥70%</p>'+ (notValid.length?'<div class="table-wrap"><table class="tbl"><thead><tr><th>แปลง</th><th>จังหวัด</th><th>จำนวนภาพ</th><th>เปิด</th></tr></thead><tbody>'+notValid.map(x=>'<tr><td>'+html(x.code)+'</td><td>'+html(x.province)+'</td><td>'+plotScenes(x.code).length+'</td><td>'+btn('ตรวจ','plot',x.code,'mini')+'</td></tr>').join('')+'</tbody></table></div>':empty('ไม่มีแปลงในเงื่อนไขนี้','เปลี่ยนตัวกรองเพื่อดูจังหวัดอื่น'))+'</div></div>'+
 '<div class="panel"><h3>การตรวจสอบที่ต้องมีสำหรับข้อมูลทุกชุด</h3><p class="muted">Geometry ST_IsValid, พื้นที่เป็นศูนย์, MultiPolygon และ holes, CRS 32647/32648, datum, เวอร์ชัน PDD, file hash, band order, Sentinel-2 SCL 2/4/5/6/7, unique scene ID, วันที่ภาพ, ข้อมูลซ้ำ, สิทธิ์ข้อมูลและประวัติการตรวจรับ</p></div>';
 root.insertAdjacentHTML('beforeend',integrityTable()+displayQualityTable()+spectralQualityTable());
}
function fieldPage(){root.innerHTML=commonHead('Field Operations & Forest Growth','งานปลูก การรอดตาย ความโตของต้นไม้ โดรน และหลักฐานจากภาคสนาม')+
 message('<b>ยังไม่เชื่อมข้อมูลส่วนตัวเข้าหน้าเว็บสาธารณะ:</b> ฐานข้อมูลโครงการมีวันปลูก พันธุ์ไม้ อัตรารอดตาย และบันทึกการสำรวจ แต่ต้องนำเข้าผ่านระบบที่มีการยืนยันตัวตนและตรวจรหัสแปลงก่อน','blue')+
 '<div class="grid three">'+['Planting & Survival','Tree Growth','Field Survey & Patrol','Drone & LiDAR','Restoration & Action Plans','Offline Mobile & GPS'].map((x,i)=>'<div class="panel"><div class="eyebrow">'+String(i+1).padStart(2,'0')+' / FIELD</div><h2>'+html(x)+'</h2><p class="muted">'+html(['วันที่ปลูก, จำนวนต้น, ต้นต่อไร่, % รอดตาย','ความสูง DBH ชนิดพันธุ์ อายุ และแปลงตัวอย่าง','ภาพถ่าย พิกัด การรบกวน ดิน น้ำและสิ่งมีชีวิต','Orthomosaic, CHM, ต้นไม้ที่ AI ตรวจพบ, QA','กิจกรรมฟื้นฟู เป้าหมาย ความคืบหน้าและผู้รับผิดชอบ','ใช้งานออฟไลน์ บันทึก GPS แล้วซิงก์เมื่อมีสัญญาณ'][i])+'</p>'+tag('รอเชื่อมระบบสิทธิ์','warn')+'</div>').join('')+'</div>'+
 '<div class="panel"><h2>เตรียมแบบฟอร์มสำรวจภาคสนาม</h2><p class="muted">ดาวน์โหลด CSV Template สำหรับเก็บข้อมูลของแต่ละแปลง โดยข้อมูลนี้ยังไม่ถูกบันทึกบน Server</p>'+btn('ดาวน์โหลด Field Survey Template','template','field','primary')+' '+btn('ดาวน์โหลด Tree Growth Template','template','growth')+'</div>';
}
function carbonPage(){root.innerHTML=commonHead('Carbon & MRV','ข้อมูลที่ตรวจสอบย้อนกลับได้สำหรับการติดตามป่าฟื้นฟูและคาร์บอนเครดิต')+
 message('ยังไม่มีผล Biomass หรือ Carbon Stock ที่ผ่านวิธีคำนวณและการตรวจสอบตามมาตรฐาน จึงไม่แสดงตัวเลข tCO₂e ที่คิดขึ้นเอง')+
 '<div class="grid three">'+[
 ['Project & Strata','ขอบเขตโครงการ ช่วงเครดิต T-VER พื้นที่กิจกรรมและ Strata'],
 ['Biomass','AGB / BGB, allometry ชนิดไม้ DBH ความสูง ปัจจัยแปลง'],
 ['Carbon Stock & Gains','ค่าคาร์บอนและการเพิ่มพูนตามปี พร้อม uncertainty'],
 ['MRV Evidence','แผนสำรวจ จุดวัด ภาพถ่าย ผู้ตรวจสอบและเอกสาร'],
 ['Verification History','Version lock: geometry, method, sample, source and approval'],
 ['Restoration Priority','แปลงฟื้นฟู เป้าหมาย ลำดับความสำคัญและสถานะ']
 ].map((a,i)=>'<div class="panel"><div class="eyebrow">'+String(i+1).padStart(2,'0')+'/ MRV</div><h2>'+html(a[0])+'</h2><p class="muted">'+html(a[1])+'</p>'+tag('Module Design','blue')+'</div>').join('')+'</div>'+
 '<div class="panel"><h2>ข้อมูลจำเป็นก่อนคำนวณจริง</h2><p>ต้องมีขอบเขตที่รับรอง ประเภทป่า/Stratum ข้อมูลแปลงตัวอย่าง ชนิดพันธุ์ DBH/ความสูง สมการ Allometry ปัจจัยและหน่วย วิธีคำนวณ Carbon และความไม่แน่นอน โดยทุกค่าอ้างอิงแหล่งข้อมูลได้</p>'+btn('ดาวน์โหลด Carbon MRV Template','template','carbon','primary')+'</div>';
}
function reportsPage(){const p=plotOf(state.plot),v=validScenes(state.plot),last=v.at(-1);
 root.innerHTML=commonHead('Report Center','สรุปข้อมูลตามแปลง พร้อมวันที่ภาพและ QA ที่อ้างอิงได้ และส่งออก CSV / GeoJSON / พิมพ์ PDF')+
 '<div class="controls"><label>แปลง<select id="plot-select">'+allPlots().map(x=>'<option value="'+html(x.code)+'" '+(x.code===state.plot?'selected':'')+'>'+html(x.code)+'</option>').join('')+'</select></label>'+btn('พิมพ์/บันทึก PDF','print','','primary')+btn('Export วันภาพ CSV','exportscenes',state.plot)+btn('Export Boundary','exportgeo',state.plot)+btn('Evidence JSON','exportevidence',state.plot)+'</div>'+
 '<div class="panel"><div class="eyebrow">MONITORING EVIDENCE REPORT</div><h2>รายงานติดตามแปลง '+html(state.plot)+'</h2><p class="muted">'+html(p?.province||'')+' · '+html(p?.company||'')+'</p>'+
 '<div class="grid kpis">'+kpi('Geometry Area',p?.geometry?fmt(p.area)+' ไร่':'—',p?.geometry?'ที่มา '+p.group:'รอข้อมูล')+kpi('วันภาพประมวลผล',String(plotScenes(state.plot).length),'จากชุด GeoTIFF จริง')+kpi('ผ่าน QA',String(v.length),'SCL usable ≥70%')+kpi('ภาพผ่าน QA ล่าสุด',last?.date||'—','แยกจากวันอัปโหลด/ประมวลผล')+'</div>'+
 '<h3>ค่าการเปลี่ยนแปลง/ดัชนีของภาพล่าสุดที่ใช้ได้</h3>'+(last?'<div class="kv"><span>NDVI</span><b>'+fmt(last.ndvi,4)+'</b><span>NDRE</span><b>'+fmt(last.ndre,4)+'</b><span>NDMI</span><b>'+fmt(last.ndmi,4)+'</b><span>MNDWI</span><b>'+fmt(last.mndwi,4)+'</b><span>BSI</span><b>'+fmt(last.bsi,4)+'</b><span>พื้นที่น้ำ</span><b>'+fmt(last.water_rai)+' ไร่</b><span>พื้นที่พืช</span><b>'+fmt(last.vegetation_rai)+' ไร่</b></div>':empty('ยังไม่มีภาพผ่าน QA','รายงานแสดงสถานะข้อมูลโดยไม่สร้างค่าขึ้นเอง'))+
 '<div class="panel-divider"></div><p class="muted">ข้อมูลนี้ใช้เพื่อการเฝ้าระวังเบื้องต้น ไม่ใช่เอกสารรับรองพื้นที่หรือหลักฐานยืนยันน้ำท่วม/การบุกรุก ต้องตรวจภาพ เวลา น้ำขึ้นลง และผลภาคสนามเพิ่มเติม</p></div>';
 root.insertAdjacentHTML('beforeend',plotDecision(state.plot)+
 '<section class="panel report-raster-section"><div class="panel-header"><div><h2>ภาพดาวเทียม / ภาพดัชนีประกอบรายงาน</h2><p class="muted">แสดงเฉพาะ Raster จริงพร้อมวันที่และ QA • วันที่ไม่มีภาพจะแสดงช่องว่างอย่างชัดเจน</p></div></div><div id="imagery-explorer"></div></section>');
}
const moduleNames=[
 ['Executive Dashboard','ภาพรวม KPI แปลงและผู้บริหาร','LIVE'],['GIS Map Center','แผนที่หลายชั้นและขอบเขต','LIVE'],['Plot Registry','ข้อมูลประจำแปลง STC/VSD/EVR','PARTIAL'],['Boundary Manager','PDD/ยืนยันกรม/เวอร์ชัน/ซ้อนทับ','PARTIAL'],['Satellite Explorer','Sentinel-2/Landsat แหล่งข้อมูลภาพ','PARTIAL'],['Vegetation Monitoring','NDVI/NDRE/EVI/SAVI/GLI','LIVE'],['Water Monitoring','NDWI/MNDWI/พื้นที่น้ำ','LIVE'],['Soil & Moisture','BSI/NDMI/พื้นที่ดิน','LIVE'],['Change Detection','ภาพก่อนหลังบน common clear pixels','LIVE'],['Forest Growth','DBH/Height/Survival/Species','PLANNED'],['Drone & LiDAR','Orthomosaic/CHM/Tree Detection','PLANNED'],['Field Operations','GPS/Photo/Patrol/Offline forms','PLANNED'],['Carbon & MRV','Biomass/Carbon/Uncertainty','PLANNED'],['Early Warning','Candidate Signals + Verification','PARTIAL'],['Report Center','Plot/Province/Period PDF/CSV','PARTIAL'],['QA/QC Center','SCL/CRS/Band/Geometry','LIVE'],['Data Catalog','TIFF/KML/SHP/Source lineage','PARTIAL'],['Processing Center','GEE/Python/Job Queue','PARTIAL'],['Project Management','งานปลูก/กำหนดการ/งบประมาณ','PLANNED'],['Admin & Security','Roles/RLS/Audit','PLANNED'],['Environmental Context','Tide/Rainfall/Salinity/DEM','PLANNED'],['Ground Verification','ตรวจภาคสนาม/หลักฐานยืนยัน','PLANNED'],['API & Integrations','Drive/Sheets/GEE/STAC/OGC','PLANNED'],['Spatial Analytics','Canopy/Density/Restoration priority','PLANNED'],['Notifications','Email/Chat digest & escalation','PLANNED'],['Backup & Recovery','Snapshots/Restore/Integrity check','PLANNED']];
function modulesPage(){root.innerHTML=commonHead('Master Module Directory','สถาปัตยกรรมครบ 26 โมดูล แยกสิ่งที่ใช้ได้ใน Preview ออกจากสิ่งที่ต้องเชื่อมเพิ่ม')+
 '<div class="grid module-grid">'+moduleNames.map((x,i)=>'<div class="module-card"><span class="module-number">'+String(i+1).padStart(2,'0')+' / 26</span><div>'+tag(x[2],x[2]==='LIVE'?'':x[2]==='PARTIAL'?'warn':'blue')+'</div><b>'+html(x[0])+'</b><small>'+html(x[1])+'</small></div>').join('')+'</div>'+
 '<div class="panel"><h2>แกนสถาปัตยกรรมสำหรับระบบจริง</h2><p>PostgreSQL / PostGIS + Spatial Versioning + Python Rasterio / GEE + Auth / RLS + React / Web GIS + Analysis Queue + Object Storage + Provenance Logs + MRV Workflow</p><p class="muted">หน้าเว็บนี้เป็น Public Data Preview — ไม่มีการเพิ่ม/แก้ไขข้อมูลจริง และไม่มีสิทธิ์เข้าถึง Google Sheets ส่วนตัวหรือ Drive ที่จำกัดสิทธิ์</p><div class="button-row">'+btn('อ่านสเปก 26 โมดูล','external','https://github.com/thanawat150/satelliteproject/blob/main/architecture/MMC_MASTER_SPEC_v2.md','primary')+btn('ดู Schema SQL','external','https://github.com/thanawat150/satelliteproject/blob/main/architecture/mmc_schema_v1.sql')+'</div></div>';
}
function draw(){if(!cache.data)return;window.MMCImagery?.clear();clearMap();$('screen-title').textContent=TITLES[state.view]||TITLES.overview;$('crumb-now').textContent=state.view.toUpperCase();document.querySelectorAll('.navitem').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));$('updated').textContent='ข้อมูลดาวเทียม '+(cache.data.generated_at||'มีในคลัง')+' • อ่านเมื่อ '+cache.when;
 switch(state.view){case 'map':mapPage();break;case 'plots':plotsPage();break;case 'insights':insightsPage();break;case 'analysis':analysisPage();break;case 'change':changePage();break;case 'satellite':satellitePage();break;case 'alerts':alertsPage();break;case 'field':fieldPage();break;case 'carbon':carbonPage();break;case 'qa':qaPage();break;case 'reports':reportsPage();break;case 'modules':modulesPage();break;default:overview();} if(['satellite','analysis','plots','insights','reports'].includes(state.view)){window.MMCImagery?.mount({container:'imagery-explorer',plot:state.plot,sceneRows:plotScenes(state.plot),geometry:plotOf(state.plot)?.geometry||null,boundaryType:plotOf(state.plot)?.group||'UNKNOWN'});}}
function bindSearch(){let d=$('plot-search');if(!d)return;d.addEventListener('input',ev=>{state.filter=ev.target.value;const p=filtered().filter(x=>!state.filter||x.code.toLowerCase().includes(state.filter.toLowerCase())||x.province.includes(state.filter));const body=root.querySelector('.tbl tbody');if(body)body.innerHTML=p.map(x=>'<tr><td><b>'+html(x.code)+'</b></td><td>'+html(x.company)+'</td><td>'+html(x.province)+'</td><td>'+(!x.geometry?tag('ต้องจับคู่','danger'):x.group==='MOC3'?tag('MOC 3','blue'):tag('PDD',''))+'</td><td class="num">'+(x.geometry?fmt(x.area):'—')+'</td><td>'+statusTag(x.code)+'</td><td>'+btn('ดู','plot',x.code,'mini')+'</td></tr>').join('');});if($('plot-map'))initMap('plot-map',[plotOf(state.plot)]);}
function populateProvinces(){const ps=[...new Set(cache.plots.map(x=>x.province))].sort((a,b)=>a.localeCompare(b,'th'));$('province').innerHTML='<option value="ALL">ทุกจังหวัด</option>'+ps.map(x=>'<option value="'+html(x)+'">'+html(x)+'</option>').join('');$('province').value=state.province;}
function parseData(geoAll,geoCanon,results,status){cache.data=results;cache.status=status;cache.when=new Date().toLocaleString('th-TH');
 for(const [code,s] of Object.entries(results.plots||{})){cache.byScene.set(code,[]);cache.changes.set(code,[]);}
 for(const s of results.scenes||[]){if(!cache.byScene.has(s.plot))cache.byScene.set(s.plot,[]);cache.byScene.get(s.plot).push(s);}
 for(const arr of cache.byScene.values())arr.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
 for(const s of results.changes||[]){if(!cache.changes.has(s.plot))cache.changes.set(s.plot,[]);cache.changes.get(s.plot).push(s);}
 cache.canonical=new Set(geoCanon.features.map(f=>f.properties.plot));
 const map=new Map(geoAll.features.map(f=>[f.properties.plot,f]));for(const f of geoCanon.features)map.set(f.properties.plot,f);cache.plots=[...map].map(([code,f])=>({code,company:code.split('-').at(-1),province:f.properties.province||'ไม่ระบุ',group:cache.canonical.has(code)?'PDD_136':'MOC3',geometry:f.geometry,area:f.properties.geometry_area_rai,props:f.properties}));
 if(!map.has('66(1)-STC'))cache.plots.push({code:'66(1)-STC',company:'STC',province:'ประจวบคีรีขันธ์',group:'UNRESOLVED',geometry:null,area:null,props:{}});
 cache.plots.sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));cache.byCode=new Map(cache.plots.map(x=>[x.code,x]));if(!cache.byCode.has(state.plot))state.plot='13-STC';
 populateProvinces();
 if(!TITLES[state.view])state.view='overview';draw();
}
async function load(){clearMap();root.innerHTML='<div class="loading"><span class="spinner"></span><h2>กำลังเชื่อมข้อมูล...</h2><p>GeoJSON / PDD / Sentinel-2 QA</p></div>';try{
 const paths=['boundaries_pdd_all.geojson','boundaries_pdd_136.geojson','nationwide_results.json','nationwide_run_status.json'];
 const manifest=fetch('./imagery_manifest.json?v=20261009-v3',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Raster manifest HTTP '+r.status);return r.json();}).catch(e=>{console.warn('No Raster Manifest',e);return null;});
 const env=fetch('./environmental_context.json?refresh=rain1',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 const a=await Promise.all([...paths.map(async f=>{const r=await fetch(DATA+f+'?v=mmc1');if(!r.ok)throw new Error('Cannot load '+f+': HTTP '+r.status);return r.json();}),manifest,env]);cache.imagery=a[4];cache.environment=a[5];parseData(a[0],a[1],a[2],a[3]);
 }catch(e){console.error(e);root.innerHTML=message('<b>เชื่อมข้อมูลไม่สำเร็จ</b> • '+html(e.message)+'<br>ลองเปิดหน้าใหม่ หรือดูข้อมูลต้นฉบับที่ SatelliteProject')+'<a class="btn" href="../nationwide.html">เปิด SatelliteProject</a>';toast('มีข้อผิดพลาดในการดึงข้อมูล');}}
function csvDownload(filename,headers,rows){const safe=x=>{let s=String(x??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const body='\uFEFF'+[headers,...rows].map(r=>r.map(safe).join(',')).join('\r\n');download(filename,body,'text/csv;charset=utf-8');}
function download(name,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
function doAction(action,value){if(action==='waterimage'){const plot=value||state.waterPlot||state.plot;setView('insights',plot);window.MMCImagery?.selectDate(state.waterDatePlot===plot?state.waterDate:plotScenes(plot).at(-1)?.date,'mndwi');return;}if(action==='setview'){setView(value);return;}if(action==='plot'){setView('plots',value);return;}if(action==='analyse'){setView('analysis',value);return;}if(action==='insight'){setView('insights',value);return;}if(action==='print'){window.print();return;}if(action==='external'){window.open(new URL(value,location.href).href,'_blank','noopener');return;}
 if(action==='exportgeo'){const arr=value==='filter'?filtered().filter(x=>x.geometry):[plotOf(value)].filter(x=>x&&x.geometry);if(!arr.length){toast('แปลงนี้ไม่มี Boundary ที่สามารถส่งออกได้');return;}download(value==='filter'?'mmc_filtered_plots.geojson':value+'_boundary.geojson',JSON.stringify({type:'FeatureCollection',features:arr.map(x=>({type:'Feature',properties:{plot:x.code,province:x.province,boundary_source:x.group},geometry:x.geometry}))}),'application/geo+json');return;}
 if(action==='exportindexqa'){
 const modes=['ndvi','ndre','ndmi','ndwi','mndwi','bsi'];
 const rows=[];
 for(const item of cache.imagery?.generated_items||[]){
  for(const m of modes){
   const stat=item.index_stats?.[m]||{},p=item.index_parity?.[m]||{};
   rows.push([item.plot,item.date,m,stat.formula||'',stat.plot_mean??'',p.published_mean??'',p.difference??'',stat.sample_pixels??'',stat.source_band_rmse??'',stat.embedded_tif_match??'',(item.index_parity_warnings||[]).includes(m)]);
  }
 }
 csvDownload('mmc_index_parity_original_tiff.csv',['plot','date','index','formula','new_mean','published_mean','difference','usable_20m_pixels','embedded_band_rmse','embedded_band_match','review_flag'],rows);return;
}
if(action==='exportvisualqa'){
 const rows=(cache.imagery?.generated_items||[]).map(x=>[x.plot,x.date,x.qa_valid_pct,x.rgb_native_width,x.rgb_native_height,x.rgb_near_white_pct,x.rgb_invalid_pct,x.rgb_unclassified_scl_pct,x.rgb_renderer_version||'legacy',x.rgb_display_warning]);
 csvDownload('mmc_raster_visual_qa.csv',['plot','date','scl_qa_pct','rgb_w','rgb_h','near_white_pct','nodata_pct','scl7_pct','renderer','display_warning'],rows);return;
 }
 if(action==='exportmissingmodes'){csvDownload('mmc_missing_image_modes.csv',['plot','date','qa_status','missing_modes','original_tif10_file_id','original_tif20_file_id'],incompleteModeRecords().map(x=>[x.plot,x.date,x.analysis_status,x.missing_modes.join(';'),x.original_tif10_file_id||'',x.original_tif20_file_id||'']));return;}
 if(action==='exportnonqagaps'){csvDownload('mmc_nonqa_visual_missing.csv',['plot','date','qa_status','qa_valid_pct','original_tif10','original_tif10_file_id'],missingVisualRecords().map(x=>[x.plot,x.date,x.analysis_status,x.qa_valid_pct,x.original_tif10||'',x.original_tif10_file_id||'']));return;}
 if(action==='exportgaps'){csvDownload('mmc_qa_preview_gaps.csv',['plot','date','qa','qa_valid_pct','usable_pixels','total_pixels','original_tif10','original_tif10_file_id'],missingQaRecords().map(x=>[x.plot,x.date,x.analysis_status,x.qa_valid_pct,x.usable_pixels,x.total_pixels,x.original_tif10||'',x.original_tif10_file_id||'']));return;}
 if(action==='exportplots'){const p=filtered();csvDownload('mmc_public_plot_registry.csv',['plot_code','company','province','boundary_group','geometry_rai','monitoring_state'],p.map(x=>[x.code,x.company,x.province,x.group,x.area??'',plotStatus(x.code)]));return;}
 if(action==='exportscenes'){const p=value||state.plot;csvDownload(p+'_satellite_qa.csv',['plot','date','status','qa_valid_pct','ndvi','ndre','ndmi','mndwi','bsi','water_rai','vegetation_rai','bare_soil_rai','original_tif10','original_tif20'],plotScenes(p).map(x=>[x.plot,x.date,x.analysis_status,x.qa_valid_pct,...['ndvi','ndre','ndmi','mndwi','bsi','water_rai','vegetation_rai','bare_soil_rai'].map(k=>qaOk(x)?x[k]??'':''),x.original_tif10||'',x.original_tif20||'']));return;}
 if(action==='exportevidence'){const code=value||state.plot,p=plotOf(code);const rows=plotScenes(code);const evidence={
  report_type:'MMC_EVIDENCE_PREVIEW_NOT_VERIFIED',
  preview_manifest_version:cache.imagery?.version||null,
  qa_valid_without_preview:missingQaRecords().filter(x=>x.plot===code).map(x=>x.date),
  plot_code:code,registry_group:p?.group||null,
  boundary:{type:p?.group||null,area_rai:p?.area??null,source_path:p?.props?.source_path||null,source_crs:p?.props?.source_crs||null,geometry:p?.geometry||null},
  scene_count:rows.length,qa_valid_dates:rows.filter(qaOk).length,
  observations:rows.map(x=>({date:x.date,qa_status:x.analysis_status,qa_valid_pct:x.qa_valid_pct,algorithm:x.algorithm,qa_rule:x.qa_rule,classification_rule:x.classification_rule,indices:Object.fromEntries(['ndvi','ndre','ndmi','ndwi','mndwi','bsi','evi','savi','gli','water_rai','vegetation_rai','bare_soil_rai'].map(k=>[k,qaOk(x)?x[k]??null:null])),source_tif_10m:x.original_tif10||null,source_file_id_10m:x.original_tif10_file_id||null,source_tif_20m:x.original_tif20||null,source_file_id_20m:x.original_tif20_file_id||null})),
  comparisons:plotChanges(code),
  rainfall_context:cache.environment?.plots?.[code]||null,
  rainfall_source_status:cache.environment?{provider:cache.environment.source,window_definition:cache.environment.rain_window_definition,gpm:cache.environment.gpm_imerg,tide:cache.environment.tide}:null,
  water_screening:{source:'published_legacy_change_records',scientific_status:'SCREENING_ONLY',context:'TIDE_RAIN_NOT_CONNECTED',observations:waterScreen()?.observations.filter(x=>x.plot===code)||[],reversal_candidates:waterScreen()?.reversals.filter(x=>x.plot===code)||[]},
  caveats:['This is a preview export and not a legally or scientifically verified MRV evidence pack.','No independent classification accuracy, tidal normalization or boundary approval certificate is included.','Missing/non-valid QA values are null and must not be interpreted as zeros.'],
  exported_at:new Date().toISOString()
 };
 download(code+'_evidence_preview.json',JSON.stringify(evidence,null,2),'application/json;charset=utf-8');return;}
 if(action==='exportchanges'){csvDownload('mmc_change_events.csv',['plot','date_a','date_b','common_clear_rai','water_net_change_rai','vegetation_net_change_rai','bare_soil_net_change_rai','status'],allChangesFiltered().map(x=>[x.plot,x.date_a,x.date_b,x.common_clear_rai,x.water_net_change_rai,x.vegetation_net_change_rai,x.bare_soil_net_change_rai,x.status]));return;}
 if(action==='template'){const schemas={field:['plot_code','survey_date','survey_type','latitude','longitude','method','sample_area_rai','observer','notes','photo_file_id','qa_status'],growth:['plot_code','survey_date','sample_plot_id','species','trees_planted','trees_alive','survival_pct','dbh_cm','height_m','sample_area_rai','method','verifier'],carbon:['plot_code','boundary_version','survey_date','stratum','species','dbh_cm','height_m','allometry_method','agb_kg','bgb_kg','carbon_fraction','uncertainty_pct','verifier']};csvDownload('mmc_'+value+'_blank_template.csv',schemas[value]||schemas.field,[]);return;}
}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}const b=e.target.closest('[data-action]');if(b){doAction(b.dataset.action,b.dataset.value||'');return;}if(e.target.id==='menu-btn')$('sidebar').classList.toggle('open');if(e.target.id==='refresh')load();});
document.addEventListener('change',e=>{const id=e.target.id;if(id==='company'||id==='province'){state[id]=e.target.value;draw();}if(id==='water-plot-select'){state.waterPlot=e.target.value;state.waterDate='';state.waterDatePlot='';draw();return;}if(id==='water-date-select'){state.waterDate=e.target.value;state.waterDatePlot=state.view==='insights'?state.plot:(state.waterPlot||state.plot);draw();if(state.view==='insights')window.MMCImagery?.selectDate(state.waterDate,'mndwi');return;}if(id==='plot-select'){state.plot=e.target.value;draw();let u=new URL(location.href);u.searchParams.set('plot',state.plot);history.replaceState({},'',u.pathname+u.search);}if(id==='metric-select'){state.metric=e.target.value;draw();}if(id==='risk-kind'){state.riskKind=e.target.value;draw();}if(id==='risk-unit'){state.riskUnit=e.target.value;state.riskThreshold=state.riskUnit==='percent'?10:1;draw();}if(id==='risk-threshold'){state.riskThreshold=Math.max(0,Number(e.target.value)||0);draw();}});
load();
})();
