/* MMC Report Copilot: local Thai request interpreter and source-verified A4 reporting.
   This static GitHub Pages edition uses rule-based language parsing, not hosted LLM. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const num=x=>x==null||x===''||!Number.isFinite(Number(x))?'—':Number(x).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateNow=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
const daysAgo=n=>{const date=new Date(dateNow()+'T12:00:00+07:00');date.setDate(date.getDate()-n);return date.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});};
const TYPE={plot:'Plot Monitoring',executive:'Executive Brief',atlas:'Satellite Atlas',change:'Change Detection',water:'Water Monitoring',forest:'Forest Condition',audit:'Technical & Audit',annual:'Annual Monitoring'};
const METRICS={ndvi:'NDVI · พืชพรรณ',ndre:'NDRE · Red Edge',ndmi:'NDMI · ความชื้นพืช',ndwi:'NDWI · น้ำ',mndwi:'MNDWI · ผิวน้ำ',bsi:'BSI · ดินเปิดโล่ง'};
const MODULES={summary:'Executive Summary',location:'ทะเบียนแปลง',satellite:'ภาพสีจริง',indices:'ภาพดัชนี',trend:'กราฟย้อนหลัง',change:'Change Detection',rain:'ข้อมูลฝน',qa:'QA/QC & Evidence'};
const DEFAULT={
 plot:['summary','location','satellite','indices','trend','qa'],
 executive:['summary','location','trend','qa'],
 atlas:['location','satellite','indices','qa'],
 change:['summary','satellite','indices','change','qa'],
 water:['summary','indices','trend','rain','change','qa'],
 forest:['summary','satellite','indices','trend','qa'],
 audit:['summary','location','qa','indices'],
 annual:['summary','satellite','indices','trend','change','qa']
};
const ui={text:'',type:'plot',scope:'plot',plot:'13-STC',province:'ALL',period:'180',density:'standard',metrics:new Set(['ndvi','mndwi','ndmi']),modules:new Set(DEFAULT.plot),notice:[]};
let ctx=null,started=false;
const plotList=()=>ctx?.plots||[];
const allScenes=()=>ctx?.scenes||[];
const allImages=()=>ctx?.imagery?.generated_items||[];
function provinceList(){return [...new Set(plotList().map(p=>p.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));}
function interpret(q){
 const text=String(q||'').trim(),d={type:'plot',scope:'plot',plot:ui.plot,province:'ALL',period:'180',density:'standard',metrics:new Set(),notice:[]};
 if(/audit|qa|ตรวจสอบ|ตรวจทาน|หลักฐาน|คุณภาพข้อมูล/i.test(text))d.type='audit';
 else if(/น้ำท่วม|อุทกภัย|น้ำเพิ่ม|พื้นที่น้ำ|mndwi|ndwi|water/i.test(text))d.type='water';
 else if(/เปลี่ยนแปลง|before|after|ก่อนหลัง|การบุกรุก|change/i.test(text))d.type='change';
 else if(/ต้นไม้|สภาพป่า|พืชพรรณ|ความเขียว|ndvi|ndre|ndmi|forest/i.test(text))d.type='forest';
 else if(/สมุดภาพ|ภาพดาวเทียมทุกวัน|atlas/i.test(text))d.type='atlas';
 else if(/ประจำปี|รายปี|annual/i.test(text))d.type='annual';
 else if(/ผู้บริหาร|สรุปภาพรวม|executive|brief/i.test(text))d.type='executive';
 const plotCode=text.match(/(\d{1,3}(?:\(\d+\))?-(?:STC|VSD|EVR))\b/i);
 const matched=plotCode&&plotList().find(p=>p.code.toUpperCase()===plotCode[1].toUpperCase());
 if(matched){d.plot=matched.code;d.scope='plot';}
 else{
  const province=provinceList().find(p=>text.includes(p));
  if(province){d.scope='province';d.province=province;}
  else if(/ทั่วประเทศ|ทั้งประเทศ|ทุกจังหวัด|ทุกแปลง/.test(text))d.scope='all';
 }
 const y=text.match(/(\d{1,2})\s*ปี/),m=text.match(/(\d{1,2})\s*เดือน/),dd=text.match(/(\d{1,3})\s*วัน/);
 if(y)d.period=String(Math.min(3650,Number(y[1])*365));
 else if(m)d.period=String(Math.min(3650,Number(m[1])*30));
 else if(dd)d.period=String(Math.min(3650,Number(dd[1])));
 else if(/ล่าสุด|เดือนนี้/.test(text))d.period='30';
 if(/ทั้งหมดที่มี|ย้อนหลังทั้งหมด|ตลอดช่วง|ตั้งแต่เริ่ม/.test(text))d.period='all';
 if(/ไม่เอาตาราง|เน้นภาพ|ภาพใหญ่|กระชับ|อ่านง่าย/.test(text))d.density='brief';
 if(/วิชาการ|เชิงลึก|ละเอียด|เทคนิค/.test(text))d.density='technical';
 for(const key of Object.keys(METRICS))if(new RegExp('(^|[^a-z])'+key+'([^a-z]|$)','i').test(text))d.metrics.add(key);
 if(!d.metrics.size)d.metrics=new Set(d.type==='water'?['mndwi','ndwi','ndvi']:d.type==='forest'?['ndvi','ndre','ndmi']:['ndvi','mndwi']);
 if(/ทุกดัชนี/.test(text))d.metrics=new Set(Object.keys(METRICS));
 if(/น้ำท่วม|ต้นไม้ตาย|บุกรุก|เสียหาย/.test(text))d.notice.push('ข้อความเกี่ยวกับผลกระทบเป็นสมมติฐานคัดกรอง ยังไม่ใช่ข้อเท็จจริงที่ยืนยัน');
 if(!text)d.notice.push('ยังไม่ได้พิมพ์คำสั่ง');
 d.modules=new Set(DEFAULT[d.type]);
 if(/ฝน|rain/i.test(text))d.modules.add('rain');
 return d;
}
function evidence(){
 const pp=plotList().filter(p=>ui.scope==='plot'?p.code===ui.plot:ui.scope==='province'?p.province===ui.province:true),codes=new Set(pp.map(p=>p.code));
 const threshold=ui.period==='all'?'0000-01-01':daysAgo(Number(ui.period)||180);
 const all=allScenes().filter(x=>codes.has(x.plot)&&x.date>=threshold&&x.date<=dateNow()).sort((a,b)=>a.date.localeCompare(b.date));
 const good=all.filter(x=>x.analysis_status==='AUTO_VALID');
 const images=allImages().filter(x=>codes.has(x.plot)&&good.some(y=>y.plot===x.plot&&y.date===x.date)&&x.source==='generated').sort((a,b)=>b.date.localeCompare(a.date));
 const changes=(ctx?.changes||[]).filter(c=>codes.has(c.plot)&&c.date_b>=threshold&&c.status==='AUTO_VALID'&&Number(c.common_clear_rai)>0);
 const cautions=[];
 if(!pp.length)cautions.push('ไม่มีแปลงในขอบเขตที่เลือก');
 if(!all.length)cautions.push('ไม่มีภาพในช่วงวันที่เลือก ไม่สร้างข้อมูลสมมติ');
 if(!good.length)cautions.push('ไม่มีภาพผ่าน QA จึงไม่แสดงค่าดัชนีที่ไม่รับรอง');
 if(pp.some(x=>!x.geometry))cautions.push('บางแปลงยังไม่มีขอบเขต GIS');
 if(ui.scope!=='plot')cautions.push('ไม่เฉลี่ยค่าดัชนีของหลายแปลงข้ามพื้นที่โดยไม่มีวิธีถ่วงน้ำหนักที่ตรวจสอบได้');
 cautions.push('ข้อมูลภาพดาวเทียมใช้คัดกรอง ไม่ใช่หลักฐานยืนยันน้ำท่วม ต้นไม้ตาย หรือการบุกรุก');
 return {pp,all,good,images,changes,cautions,threshold};
}
function imageURL(scene,mode){
 const name=scene?.assets?.[mode];
 if(typeof name!=='string'||!/^\.\/imagery\/[a-z0-9_()\/.\-]+\.(png|webp|jpe?g)$/i.test(name)||name.includes('..'))return null;
 return new URL(name,location.href).href;
}
function options(items,selected){return items.map(([k,v])=>'<option value="'+esc(k)+'"'+(k===selected?' selected':'')+'>'+esc(v)+'</option>').join('');}
function table(rows,cols){
 return '<table class="rpt-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c[1])+'</th>').join('')+'</tr></thead><tbody>'+
 (rows.length?rows.map(x=>'<tr>'+cols.map(([k])=>'<td>'+esc(x[k])+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+cols.length+'">ไม่มีข้อมูล</td></tr>')+'</tbody></table>';
}
function picture(im,mode){
 const src=imageURL(im,mode);
 return src?'<figure class="rpt-image"><img src="'+esc(src)+'" alt="'+esc(im.plot+' '+mode+' '+im.date)+'"><figcaption>'+esc(im.plot)+' · '+esc(mode.toUpperCase())+' · '+esc(im.date)+' · Raster Preview จาก TIFF</figcaption></figure>':
 '<p class="rpt-empty">ไม่มีภาพ '+esc(mode)+' ที่ตรงกับวันภาพและ QA</p>';
}
function chart(rows,metric){
 const data=rows.map(x=>({date:x.date,value:Number(x[metric])})).filter(x=>Number.isFinite(x.value)).slice(-50);
 if(!data.length)return '<p class="rpt-empty">ยังไม่มีค่า '+esc(metric)+' ผ่าน QA ในช่วงที่เลือก</p>';
 const x=i=>40+480*i/Math.max(1,data.length-1),y=v=>156-(v+1)*62;
 return '<svg viewBox="0 0 560 186" class="rpt-chart" role="img" aria-label="กราฟ '+esc(metric)+'">'+
 '<line x1="40" x2="530" y1="94" y2="94" stroke="#dce7dd" />'+
 '<path d="'+data.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r.value).toFixed(1)).join(' ')+'" stroke="#167a52" stroke-width="2.5" fill="none"/>'+
 data.map((r,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(r.value).toFixed(1)+'" r="3" fill="#167a52"/>').join('')+
 '<text x="40" y="179" font-size="11">'+esc(data[0].date)+'</text><text x="530" y="179" text-anchor="end" font-size="11">'+esc(data.at(-1).date)+'</text></svg>';
}

function documentPlan(d){
 const latest=d.good.at(-1),first=d.good[0],isSingle=ui.scope==='plot';
 const candidates=d.images.filter(x=>x.assets&&Object.keys(x.assets).length);
 const out=[];
 const add=(key,title,body)=>out.push({key,title,body});
 const latestImg=mode=>candidates.find(x=>imageURL(x,mode));
 const safeRead=(key,row)=>row?num(row[key]):'—';
 const age=ui.period==='all'?'ทั้งหมดที่มีข้อมูล':ui.period+' วันย้อนหลัง';
 if(ui.modules.has('summary')){
  const facts='<div class="rpt-kpis">'+[
   ['จำนวนแปลง',String(d.pp.length)],['วันที่มีผลวิเคราะห์',String(d.all.length)],
   ['วันภาพผ่าน QA',String(d.good.length)],['วันที่ผ่าน QA ล่าสุด',latest?.date||'—']
  ].map(([k,v])=>'<div class="rpt-kpi"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('')+'</div>';
  const snippet=latest&&isSingle?
   '<p>ข้อมูลผ่าน QA ล่าสุดวันที่ <b>'+esc(latest.date)+'</b> มี NDVI '+num(latest.ndvi)+' และ MNDWI '+num(latest.mndwi)+' ส่วนพื้นที่น้ำที่จำแนกได้ '+num(latest.water_rai)+' ไร่</p>':
   '<p>ใช้ข้อมูลที่มีอยู่จริงในขอบเขตที่เลือก โดยไม่นำค่าดัชนีของคนละแปลงมาเฉลี่ยรวมแบบไม่มีการถ่วงน้ำหนัก</p>';
  add('01 / OVERVIEW','Executive Monitoring Summary',facts+
    '<h3>วัตถุประสงค์</h3><p>'+esc(ui.text||'ติดตามสภาพสิ่งแวดล้อมจากภาพ Sentinel-2')+'</p>'+
    '<h3>ข้อค้นพบเบื้องต้น</h3>'+snippet+
    '<p class="rpt-disclaimer">เป็นรายงานคัดกรองเบื้องต้น ไม่ใช่ข้อยืนยันด้านน้ำท่วมหรืออัตราการรอดตายของป่าชายเลน</p>');
 }
 if(ui.modules.has('location')){
  const rows=d.pp.slice(0,12).map(x=>({code:x.code,prov:x.province,rai:x.area==null?'—':num(x.area),geo:x.group||'—'}));
  add('02 / REGISTRY','Plot Registry & Boundary',table(rows,[['code','แปลง'],['prov','จังหวัด'],['rai','พื้นที่ (ไร่)'],['geo','Boundary']])+
  '<p class="rpt-caption">แสดง '+rows.length+' จาก '+d.pp.length+' แปลง · ขอบเขตยืนยัน PDD และ MOC เป็นข้อมูลคนละสถานะ ไม่ใช้แทนกันโดยอัตโนมัติ</p>');
 }
 if(ui.modules.has('satellite')){
  const rgb=latestImg('true_color');
  add('03 / SATELLITE','True Color · Satellite Evidence',rgb?picture(rgb,'true_color'):
    '<p class="rpt-empty">ไม่พบภาพสีจริงจาก Raster TIFF ที่ตรงกับวันภาพผ่าน QA และช่วงเวลาที่เลือก</p>');
 }
 if(ui.modules.has('indices')){
  const indices=[...ui.metrics];
  const grid=indices.slice(0,4).map(k=>{const img=latestImg(k);return img?picture(img,k):'<p class="rpt-empty">'+esc(k.toUpperCase())+' ยังไม่มี Raster Preview ที่ผ่าน QA</p>';}).join('');
  add('04 / INDICES','Environmental Spectral Indices',
    '<div class="rpt-pictures">'+(grid||'<p class="rpt-empty">ยังไม่เลือกดัชนี</p>')+'</div>'+
    '<p class="rpt-caption">ภาพเป็น Visual Evidence จาก Raster ต้นฉบับ ไม่ใช่การยืนยันน้ำท่วม การเสื่อมสภาพ หรือความเสียหายโดยลำพัง</p>');
 }
 if(ui.modules.has('trend')){
  const key=[...ui.metrics][0]||'ndvi';
  const rows=isSingle?d.good:[];
  const recent=rows.slice(-7).map(x=>({date:x.date,value:num(x[key]),qa:num(x.qa_valid_pct)+'%'}));
  add('05 / TIME SERIES','Trend · '+key.toUpperCase(),
    isSingle?chart(rows,key)+table(recent,[['date','วันภาพ'],['value',key.toUpperCase()],['qa','QA SCL']]):
      '<p class="rpt-empty">กราฟข้ามหลายแปลงยังไม่เปิดใช้ เพราะค่าเฉลี่ยของคนละพื้นที่ไม่ใช่อนุกรมเดียวกัน กรุณาเลือกแปลงเดียวเพื่อแสดงกราฟ</p>'+
    '<p class="rpt-caption">แสดงเฉพาะวันภาพ AUTO_VALID ไม่เติมค่าระหว่างวันที่ไม่มีภาพ · ค่าสถิติแสดงทศนิยม 2 ตำแหน่ง</p>');
 }
 if(ui.modules.has('change')){
  const rows=d.changes.slice(-8).map(x=>({plot:x.plot,dates:x.date_a+' → '+x.date_b,area:num(x.common_clear_rai),water:num(x.water_net_change_rai)}));
  add('06 / CHANGE','Change Detection Screening',table(rows,[['plot','แปลง'],['dates','ช่วงภาพ'],['area','พื้นที่ร่วม ไร่'],['water','น้ำ Δ ไร่']])+
   '<p class="rpt-disclaimer">คู่ภาพที่ผ่านเกณฑ์ข้อมูลเบื้องต้นเท่านั้น ยังต้องพิจารณาน้ำขึ้นลง ฤดูกาล ภาพเมฆ และหลักฐานภาคสนามก่อนสรุปสาเหตุ</p>');
 }
 if(ui.modules.has('rain')){
  const rr=isSingle?(ctx.environment?.plots?.[ui.plot]?.scenes||[]).filter(x=>d.all.some(y=>y.plot===ui.plot&&y.date===x.date)):[];
  const rows=rr.slice(-9).map(x=>({date:x.date,one:num(x.rain_prev_1_utc_day_mm),three:num(x.rain_prev_3_utc_days_mm),qa:x.data_quality||'—'}));
  add('07 / RAINFALL','Rainfall · NASA POWER',table(rows,[['date','วันภาพ'],['one','ฝนก่อน 1 วัน มม.'],['three','ฝนก่อน 3 วัน มม.'],['qa','สถานะ']])+
  '<p class="rpt-caption">NASA POWER PRECTOTCORR: วัน UTC ก่อนวันภาพ ไม่ใช่ฝนย้อนหลัง 24/72 ชั่วโมงจากเวลาผ่านของดาวเทียม หรือสถานีวัดฝนจริง</p>');
 }
 if(ui.modules.has('qa')){
  const rows=d.all.slice(-8).map(x=>({plot:x.plot,date:x.date,status:x.analysis_status||'—',qa:num(x.qa_valid_pct)+'%',source:x.original_tif10||'—'}));
  add('08 / QA','Quality Assurance & Traceability',table(rows,[['plot','แปลง'],['date','วันภาพ'],['status','สถานะ'],['qa','SCL'],['source','TIFF 10m']])+
  '<h3>ข้อจำกัดและการใช้หลักฐาน</h3><ul class="rpt-findings">'+d.cautions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
  '<p class="rpt-caption">วันที่วิเคราะห์ '+esc(age)+' · ใช้ชุดข้อมูลที่เว็บไซต์เผยแพร่ ไม่แก้ไขค่า Raster จริง ไม่ใช้ภาพถ่ายอื่นแทน Scene ที่ขาด</p>');
 }
 if(!out.length)add('REPORT','No Report Sections','<p class="rpt-empty">กรุณาเลือกองค์ประกอบอย่างน้อย 1 หัวข้อ</p>');
 return {out,latest:first?.date||null};
}
function paperStyle(){
 return '@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e7eee9;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;color:#1b3226}.rpt-paper{position:relative;margin:0 auto 14px;width:210mm;min-height:297mm;padding:16mm 15mm 24mm;background:white;box-shadow:0 4px 22px #12291b29;break-after:page;page-break-after:always;overflow:hidden}.rpt-paper:last-child{break-after:auto;page-break-after:auto}.rpt-pagehead{display:flex;justify-content:space-between;border-bottom:2px solid #256d4b;padding-bottom:9px;font-weight:700;font-size:9px;letter-spacing:1px;color:#256d4b}.rpt-eyebrow{font-size:11px;letter-spacing:1.6px;color:#287a53;margin-top:25px}.rpt-paper h2{font-size:24px;line-height:1.35;margin:9px 0 20px}.rpt-paper h3{font-size:14px;margin:16px 0 7px}.rpt-paper p,.rpt-paper li{font-size:11px;line-height:1.85}.rpt-pagefoot{position:absolute;bottom:14mm;left:15mm;right:15mm;display:flex;justify-content:space-between;color:#618171;border-top:1px solid #d1dfd5;padding-top:7px;font-size:9px}.rpt-kpis{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:13px 0 18px}.rpt-kpi{background:#eef6f0;border-left:3px solid #36855a;padding:12px}.rpt-kpi small{display:block;font-size:10px;color:#607768}.rpt-kpi strong{display:block;font-size:17px;margin-top:3px}.rpt-caption{font-size:10px!important;color:#62796a;margin-top:8px}.rpt-disclaimer{padding:12px 14px;border-left:3px solid #bb8944;background:#fff7e9}.rpt-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}.rpt-table th,.rpt-table td{padding:8px 5px;border-bottom:1px solid #dae5db;text-align:left;overflow-wrap:anywhere}.rpt-table th{background:#edf5ee;font-weight:700}.rpt-image{margin:5px 0 16px}.rpt-image img{display:block;width:100%;height:auto;max-height:175mm;object-fit:contain;background:#e9eee9}.rpt-image figcaption{font-size:10px;color:#52705d;margin-top:7px}.rpt-pictures{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rpt-pictures .rpt-image img{max-height:80mm}.rpt-empty{padding:18px;background:#eef4ef;border:1px dashed #b8caba;font-size:11px}.rpt-chart{width:100%;height:auto;max-height:72mm}.rpt-findings{padding-left:18px}@media print{body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}.rpt-paper{box-shadow:none;margin:0;width:210mm;height:297mm;min-height:297mm}}';
}
function renderPages(){
 const d=evidence(),items=documentPlan(d).out,total=items.length;
 const pages=items.map((item,i)=>'<article class="rpt-paper" data-report-page="'+esc(item.key)+'"><header class="rpt-pagehead"><span>MANGROVE MONITORING CENTER</span><span>ENVIRONMENTAL MONITORING · DRAFT</span></header>'+
 '<div class="rpt-eyebrow">'+esc(item.key)+'</div><h2>'+esc(item.title)+'</h2>'+item.body+
 '<footer class="rpt-pagefoot"><span>'+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'ALL PLOTS')+' · '+esc(dateNow())+'</span><span>'+String(i+1)+' / '+total+'</span></footer></article>').join('');
 return {pages,d,total};
}
function updatePreview(){
 const el=$('rpt-preview');if(!el)return;
 const report=renderPages();
 el.innerHTML='<style>'+paperStyle()+'</style><div class="rpt-papers">'+report.pages+'</div>';
 const summary=$('rpt-source-summary');
 if(summary)summary.innerHTML='<b>ข้อมูลจริง:</b> '+report.d.pp.length+' แปลง · '+report.d.all.length+' วันภาพ · ผ่าน QA '+report.d.good.length+' วัน · Raster Preview '+report.d.images.length+' ฉาก · '+report.total+' หน้า';
 const note=$('rpt-warning-list');if(note)note.innerHTML=report.d.cautions.map(x=>'<p>• '+esc(x)+'</p>').join('');
}
function printPDF(){
 const report=renderPages(),popup=window.open('','_blank');
 if(!popup){alert('เบราว์เซอร์บล็อกหน้าต่าง กรุณาอนุญาต Pop-ups แล้วลองอีกครั้ง');return;}
 popup.document.open();
 popup.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>MMC '+esc(ui.plot)+' Report</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"><style>'+paperStyle()+'</style></head><body>'+report.pages+
 '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},1000)})<\/script></body></html>');
 popup.document.close();
}
function exportBlueprint(){
 const ev=evidence(),data={schema:'MMC_REPORT_BLUEPRINT_V1',interpreter:'LOCAL_RULE_BASED_NOT_LLM',created_at:new Date().toISOString(),request:ui.text,
 settings:{type:ui.type,scope:ui.scope,plot:ui.scope==='plot'?ui.plot:null,province:ui.scope==='province'?ui.province:null,period:ui.period,density:ui.density,metrics:[...ui.metrics],modules:[...ui.modules]},
 evidence:{source_generated_at:ctx.generated_at||null,imagery_manifest_version:ctx.imagery?.version||null,plot_codes:ev.pp.map(x=>x.code),scene_count:ev.all.length,qa_valid_scene_count:ev.good.length},warnings:ev.cautions};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='MMC_Report_Blueprint_'+dateNow()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function reportChoices(){
 const container=$('report-copilot-root');if(!container)return;
 container.innerHTML='<section class="rpt-studio"><div class="rpt-head"><div><span class="rpt-beta">REPORT STUDIO · BETA</span><h2>AI Report Copilot</h2><p>บอกระบบเป็นภาษาไทยว่าจะทำรายงานอะไร แล้วปรับแบบก่อนส่งออกเป็น PDF แนวตั้ง</p></div><span class="rpt-interpreter-type">Local Thai Intent Parser · ยังไม่ใช่ LLM</span></div>'+
 '<label class="rpt-prompt-title" for="rpt-text">คำอธิบายรายงานที่ต้องการ</label><textarea id="rpt-text" rows="4" maxlength="1200" placeholder="เช่น ขอรายงานแปลง 13-STC ย้อนหลัง 6 เดือน เน้น MNDWI NDVI และฝน เปรียบเทียบก่อนหลัง แบบภาพใหญ่ ไม่เอาตารางเยอะ">'+esc(ui.text)+'</textarea>'+
 '<div class="rpt-samples"><button type="button" data-rpt-sample="water">น้ำท่วม</button><button type="button" data-rpt-sample="forest">สภาพป่า</button><button type="button" data-rpt-sample="executive">ผู้บริหาร</button><button type="button" data-rpt-sample="audit">Audit</button></div>'+
 '<div class="rpt-buttons"><button type="button" class="btn primary" id="rpt-analyze">✦ วิเคราะห์คำสั่ง</button><small>โหมดปัจจุบันวิเคราะห์ข้อความด้วยกฎบนเว็บ ไม่ส่งข้อความไป API ภายนอก</small></div>'+
 '<div id="rpt-blueprint" class="rpt-blueprint"></div>'+
 '<div class="rpt-input-grid">'+
 '<label>ประเภทรายงาน<select id="rpt-type">'+options(Object.entries(TYPE),ui.type)+'</select></label>'+
 '<label>ขอบเขต<select id="rpt-scope">'+options([['plot','รายแปลง'],['province','จังหวัด'],['all','ทุกแปลง']],ui.scope)+'</select></label>'+
 '<label>เลือกแปลง<select id="rpt-plot">'+options(plotList().map(p=>[p.code,p.code+' · '+p.province]),ui.plot)+'</select></label>'+
 '<label>จังหวัด<select id="rpt-province">'+options(provinceList().map(x=>[x,x]),ui.province)+'</select></label>'+
 '<label>ช่วงเวลา<select id="rpt-period">'+options([['30','30 วัน'],['90','90 วัน'],['180','6 เดือน'],['365','1 ปี'],['730','2 ปี'],['1825','5 ปี'],['3650','10 ปี'],['all','ทั้งหมดที่มี']],ui.period)+'</select></label>'+
 '<label>รูปแบบ<select id="rpt-density">'+options([['brief','Visual / กระชับ'],['standard','Balanced / มาตรฐาน'],['technical','Technical / เชิงลึก']],ui.density)+'</select></label></div>'+
 '<div class="rpt-checkbox-grid"><fieldset><legend>เลือกหน้ารายงาน</legend>'+Object.entries(MODULES).map(([k,v])=>'<label><input type="checkbox" data-rpt-module="'+k+'"'+(ui.modules.has(k)?' checked':'')+'> '+esc(v)+'</label>').join('')+'</fieldset>'+
 '<fieldset><legend>ดัชนีที่ต้องการ</legend>'+Object.entries(METRICS).map(([k,v])=>'<label><input type="checkbox" data-rpt-metric="'+k+'"'+(ui.metrics.has(k)?' checked':'')+'> '+esc(v)+'</label>').join('')+'</fieldset></div>'+
 '<div class="rpt-buttons"><button type="button" class="btn primary" id="rpt-preview-button">สร้างตัวอย่างรายงาน</button><button type="button" class="btn" id="rpt-print">พิมพ์ / บันทึก PDF (A4)</button><button type="button" class="btn" id="rpt-blueprint-export">ส่งออก Blueprint JSON</button></div>'+
 '<div id="rpt-source-summary" class="rpt-source-summary"></div><div id="rpt-warning-list" class="rpt-warning-list"></div>'+
 '<details class="rpt-preview-toggle" open><summary>ดูตัวอย่างรายงานจริง · A4 แนวตั้ง</summary><div id="rpt-preview"></div></details></section>';
 syncForm();updatePreview();
 container.oninput=e=>{if(e.target.id==='rpt-text')ui.text=e.target.value;};
 container.onchange=e=>{
  const id=e.target.id,fields={'rpt-type':'type','rpt-scope':'scope','rpt-plot':'plot','rpt-province':'province','rpt-period':'period','rpt-density':'density'};
  if(fields[id]){ui[fields[id]]=e.target.value;if(id==='rpt-type')ui.modules=new Set(DEFAULT[ui.type]);}
  if(e.target.dataset.rptModule){if(e.target.checked)ui.modules.add(e.target.dataset.rptModule);else ui.modules.delete(e.target.dataset.rptModule);}
  if(e.target.dataset.rptMetric){if(e.target.checked)ui.metrics.add(e.target.dataset.rptMetric);else ui.metrics.delete(e.target.dataset.rptMetric);}
  if(id==='rpt-type')syncForm();showBlueprint();
 };
 container.onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.rptSample){
   const example={water:'รายงานแปลง '+ui.plot+' ย้อนหลัง 6 เดือน เน้นพื้นที่น้ำเพิ่ม MNDWI NDWI และฝน ภาพใหญ่',forest:'ดูสภาพป่าชายเลนแปลง '+ui.plot+' ย้อนหลัง 1 ปี เน้น NDVI NDRE NDMI และกราฟ',executive:'ทำรายงานจังหวัดระยองสำหรับผู้บริหาร ย้อนหลัง 3 เดือน เน้นภาพ ไม่เอาตารางเยอะ',audit:'ทำรายงานตรวจสอบ QA/QC และหลักฐานแปลง '+ui.plot+' ย้อนหลัง 1 ปี รายละเอียดทางเทคนิค'};
   ui.text=example[b.dataset.rptSample];$('rpt-text').value=ui.text;return;
  }
  if(b.id==='rpt-analyze'){
   const val=interpret(ui.text);for(const field of ['type','scope','plot','province','period','density'])ui[field]=val[field];
   ui.modules=val.modules;ui.metrics=val.metrics;ui.notice=val.notice;syncForm();updatePreview();return;
  }
  if(b.id==='rpt-preview-button'){updatePreview();$('rpt-preview')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(b.id==='rpt-print'){printPDF();return;}
  if(b.id==='rpt-blueprint-export'){exportBlueprint();return;}
 };
}
function showBlueprint(){
 const elem=$('rpt-blueprint');if(!elem)return;
 elem.innerHTML='<b>Report Blueprint:</b> '+esc(TYPE[ui.type])+' · '+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'ทุกแปลง')+' · '+esc(ui.period==='all'?'ทุกวันภาพ':ui.period+' วัน')+
 ' · A4 แนวตั้ง · '+ui.modules.size+' ส่วนประกอบ <span>'+ui.notice.map(x=>esc(x)).join(' • ')+'</span>';
}
function syncForm(){
 for(const [id,value] of [['rpt-type',ui.type],['rpt-scope',ui.scope],['rpt-plot',ui.plot],['rpt-province',ui.province],['rpt-period',ui.period],['rpt-density',ui.density]]){
  const el=$(id);if(el)el.value=value;
 }
 document.querySelectorAll('[data-rpt-module]').forEach(x=>x.checked=ui.modules.has(x.dataset.rptModule));
 document.querySelectorAll('[data-rpt-metric]').forEach(x=>x.checked=ui.metrics.has(x.dataset.rptMetric));
 showBlueprint();
}
function mount(payload){
 ctx=payload;if(!$('report-copilot-root'))return;
 if(!started){ui.plot=payload.defaultPlot||ui.plot;ui.text='ทำรายงานติดตามแปลง '+ui.plot+' ย้อนหลัง 6 เดือน เน้นภาพสีจริง NDVI และ MNDWI พร้อมกราฟแนวโน้ม A4 แนวตั้ง';started=true;}
 else if(payload.defaultPlot&&ui.scope==='plot')ui.plot=payload.defaultPlot;
 reportChoices();
}
window.MMCReportCopilot={mount,interpret,evidence,renderPages};

})();