/* MMC Report Copilot: local Thai request interpreter and source-verified A4 reporting.
   This static GitHub Pages edition uses rule-based language parsing, not hosted LLM. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const num=x=>x==null||x===''||!Number.isFinite(Number(x))?'—':Number(x).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateNow=()=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return parts.year+'-'+parts.month+'-'+parts.day;};
const daysAgo=n=>{const date=new Date(dateNow()+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-n);return date.toISOString().slice(0,10);};
const TYPE={plot:'Plot Monitoring',executive:'Executive Brief',atlas:'Satellite Atlas',change:'Change Detection',water:'Water Monitoring',forest:'Forest Condition',audit:'Technical & Audit',annual:'Annual Monitoring'};
const METRICS={ndvi:'NDVI · พืชพรรณ',ndre:'NDRE · Red Edge',ndmi:'NDMI · ความชื้นพืช',ndwi:'NDWI · น้ำ',mndwi:'MNDWI · ผิวน้ำ',bsi:'BSI · ดินเปิดโล่ง'};
const MODULES={summary:'Executive Summary',location:'ทะเบียนแปลง',satellite:'ภาพสีจริง',indices:'ภาพดัชนี',trend:'กราฟย้อนหลัง',change:'Change Detection',rain:'ข้อมูลฝน',qa:'QA/QC & Evidence'};
const DEFAULT={
 plot:['summary','location','satellite','indices','trend','qa'],
 executive:['summary','location','satellite','indices','trend','qa'],
 atlas:['location','satellite','indices','qa'],
 change:['summary','satellite','indices','change','qa'],
 water:['summary','satellite','indices','trend','rain','change','qa'],
 forest:['summary','satellite','indices','trend','qa'],
 audit:['summary','location','qa','indices'],
 annual:['summary','satellite','indices','trend','change','qa']
};
const ui={text:'',type:'plot',scope:'plot',plot:'13-STC',province:'ALL',period:'180',density:'standard',imageDates:'2',metrics:new Set(['ndvi','mndwi','ndmi']),modules:new Set(DEFAULT.plot),notice:[]};
let ctx=null,started=false;
const plotList=()=>ctx?.plots||[];
const allScenes=()=>ctx?.scenes||[];
const allImages=()=>ctx?.imagery?.generated_items||[];
function provinceList(){return [...new Set(plotList().map(p=>p.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));}
function interpret(q){
 const text=String(q||'').trim(),d={type:'plot',scope:'plot',plot:ui.plot,province:'ALL',period:'180',density:'standard',imageDates:ui.imageDates||'2',metrics:new Set(),notice:[]};
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
 const imageDays=text.match(/(?:ภาพ|วันภาพ|วันที่ภาพ)\s*(\d{1,2})\s*(?:วัน|วันที่)/);if(imageDays)d.imageDates=String(Math.min(4,Math.max(1,Number(imageDays[1]))));
 if(d.scope==='all'&&!imageDays)d.imageDates='1';
 if(/น้ำท่วม|ต้นไม้ตาย|บุกรุก|เสียหาย/.test(text))d.notice.push('ข้อความเกี่ยวกับผลกระทบเป็นสมมติฐานคัดกรอง ยังไม่ใช่ข้อเท็จจริงที่ยืนยัน');
 if(!text)d.notice.push('ยังไม่ได้พิมพ์คำสั่ง');
 d.modules=new Set(DEFAULT[d.type]);if(d.scope!=='plot')d.modules.add('location');
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

function mercatorY(lat){const y=Math.max(-85.05112878,Math.min(85.05112878,Number(lat)))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+y/2));}
function reportBoundary(im,mode){
 const polygon=plotList().find(p=>p.code===im.plot)?.geometry;
 const bounds=im.mode_bounds?.[mode]||im.bounds;
 if(!polygon||!['Polygon','MultiPolygon'].includes(polygon.type)||!Array.isArray(bounds)||bounds.length!==2)return '';
 const south=Number(bounds[0]?.[0]),west=Number(bounds[0]?.[1]),north=Number(bounds[1]?.[0]),east=Number(bounds[1]?.[1]);
 const top=mercatorY(north),bottom=mercatorY(south);
 if(![south,west,north,east,top,bottom].every(Number.isFinite)||north<=south||east<=west||top<=bottom)return '';
 const parts=polygon.type==='Polygon'?[polygon.coordinates]:polygon.coordinates,paths=[];
 for(const group of parts){for(const ring of group||[]){const vertices=[];
   for(const point of ring||[]){if(!Array.isArray(point)||point.length<2)continue;
     const lon=Number(point[0]),lat=Number(point[1]);if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
     const x=(lon-west)/(east-west)*1000,y=(top-mercatorY(lat))/(top-bottom)*1000;
     if(Number.isFinite(x)&&Number.isFinite(y))vertices.push(x.toFixed(2)+','+y.toFixed(2));
   }
   if(vertices.length>=3)paths.push('M'+vertices.join(' L')+' Z');
 }}
 if(!paths.length)return '';
 return '<svg class="rpt-image-boundary" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><path d="'+paths.join(' ')+'" fill="none" stroke="#18241b" stroke-width="5" vector-effect="non-scaling-stroke"/><path d="'+paths.join(' ')+'" fill="none" stroke="#ef2e3e" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>';
}

function picture(im,mode){
 const src=imageURL(im,mode);
 return src?'<figure class="rpt-image"><div class="rpt-image-canvas"><img src="'+esc(src)+'" alt="'+esc(im.plot+' '+mode+' '+im.date)+'">'+reportBoundary(im,mode)+'</div><figcaption>'+esc(im.plot)+' · '+esc(mode.toUpperCase())+' · '+esc(im.date)+' · Raster Preview จาก TIFF'+(reportBoundary(im,mode)?' · เส้นแดง = ขอบเขต GIS':' · ไม่มีขอบเขต GIS ที่จับคู่ได้')+'</figcaption></figure>':
 '<p class="rpt-empty">ไม่มีภาพ '+esc(mode)+' ที่ตรงกับวันภาพและ QA</p>';
}
function chart(rows,metric){
 const data=rows.filter(x=>x[metric]!==null&&x[metric]!==undefined&&x[metric]!==''&&Number.isFinite(Number(x[metric]))).map(x=>({date:x.date,value:Number(x[metric])})).slice(-50);
 if(!data.length)return '<p class="rpt-empty">ยังไม่มีค่า '+esc(metric)+' ผ่าน QA ในช่วงที่เลือก</p>';
 const x=i=>40+480*i/Math.max(1,data.length-1),y=v=>156-(v+1)*62;
 return '<svg viewBox="0 0 560 186" class="rpt-chart" role="img" aria-label="กราฟ '+esc(metric)+'">'+
 '<line x1="40" x2="530" y1="94" y2="94" stroke="#dce7dd" />'+
 '<path d="'+data.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r.value).toFixed(1)).join(' ')+'" stroke="#167a52" stroke-width="2.5" fill="none"/>'+
 data.map((r,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(r.value).toFixed(1)+'" r="3" fill="#167a52"/>').join('')+
 '<text x="40" y="179" font-size="11">'+esc(data[0].date)+'</text><text x="530" y="179" text-anchor="end" font-size="11">'+esc(data.at(-1).date)+'</text></svg>';
}

function documentPlan(d){
 const latest=d.good.at(-1),isSingle=ui.scope==='plot',out=[];
 const rowsLimit=ui.density==='brief'?9:ui.density==='technical'?18:14;
 const sampleDays=Math.max(1,Math.min(4,Number(ui.imageDates)||2));
 const plotOrder=d.pp.map(x=>x.code);
 const scopeLabel=isSingle?ui.plot:ui.scope==='province'?ui.province:'ทุกจังหวัด';
 const add=(name,title,body)=>out.push({key:name,title,body});
 const chunk=(rows,size)=>{const batches=[];for(let i=0;i<rows.length;i+=size)batches.push(rows.slice(i,i+size));return batches;};
 const imgByPlot=new Map();
 for(const im of d.images){
  if(!imgByPlot.has(im.plot))imgByPlot.set(im.plot,[]);
  imgByPlot.get(im.plot).push(im);
 }
 const perPlot=new Map();
 for(const pp of d.pp){
  const observations=d.good.filter(x=>x.plot===pp.code);
  const frames=imgByPlot.get(pp.code)||[];
  perPlot.set(pp.code,{plot:pp,rows:observations,latest:observations.at(-1),frames});
 }
 const thumbnail=(im,mode)=>picture(im,mode);
 function galleryPages(title,kind,cards,maxTiles=6){
  const pageCount=Math.ceil(cards.length/maxTiles),balanced=pageCount?Math.ceil(cards.length/pageCount):maxTiles;
  const batches=chunk(cards,balanced);
  if(!batches.length){add(kind,title,'<p class="rpt-empty">ไม่พบภาพ Raster ที่ตรงกับช่วงวันที่และผ่าน QA สำหรับส่วนนี้</p>');return;}
  batches.forEach((batch,i)=>{
   const first=batch[0],last=batch.at(-1);
   const subtitle=isSingle?'แปลง '+ui.plot:'ภาพลำดับ '+(i*balanced+1)+'–'+(i*balanced+batch.length)+' จาก '+cards.length+' ภาพ';
   add(kind+' '+(i+1),title+(batches.length>1?' · '+(i+1)+'/'+batches.length:''),
    '<p class="rpt-gallery-sub">'+esc(subtitle)+' · ภาพจริงจาก TIFF เฉพาะวันผ่าน QA</p>'+
    '<div class="rpt-pictures rpt-photo-grid '+(isSingle?'rpt-gallery-plot':'rpt-gallery-portfolio')+'">'+batch.map(x=>thumbnail(x.im,x.mode)).join('')+'</div>'+
    '<div class="rpt-gallery-evidence"><b>หลักฐานประกอบภาพในหน้านี้</b>'+table(batch.map(x=>{const row=d.good.find(r=>r.plot===x.im.plot&&r.date===x.im.date);return {plot:x.im.plot,date:x.im.date,mode:x.mode.toUpperCase(),qa:row?num(row.qa_valid_pct)+'%':'—'};}),[['plot','แปลง'],['date','วันภาพ'],['mode','ชนิดภาพ'],['qa','QA SCL']])+'</div>'+ 
    '<p class="rpt-caption">วันภาพ '+esc(first.im.date)+' ถึง '+esc(last.im.date)+' · ขอบเขตแดงแสดงได้เมื่อมี Geometry ตรงกับภาพ Raster</p>');
  });
 }
 const headImages=[];
 const chosen=new Set();
 for(const pp of d.pp){
  const frames=imgByPlot.get(pp.code)||[];
  let found=frames.find(im=>imageURL(im,'true_color')||imageURL(im,'mndwi')||imageURL(im,'ndvi'));
  if(found){
   const mode=imageURL(found,'true_color')?'true_color':imageURL(found,'mndwi')?'mndwi':'ndvi';
   headImages.push({im:found,mode});chosen.add(pp.code);
  }
  if(headImages.length>=4)break;
 }
 if(isSingle&&headImages.length<4){
  for(const im of imgByPlot.get(ui.plot)||[]){
   for(const mode of ['false_color','ndvi','mndwi','true_color']){
    if(!imageURL(im,mode))continue;
    const key=im.plot+'|'+im.date+'|'+mode;
    if(headImages.some(x=>x.im.plot+'|'+x.im.date+'|'+x.mode===key))continue;
    headImages.push({im,mode});if(headImages.length>=4)break;
   }
   if(headImages.length>=4)break;
  }
 }
 if(ui.modules.has('summary')){
  const latestDates=[...new Set(d.good.map(x=>x.date))].sort();
  const areaPlots=d.pp.filter(x=>x.geometry&&x.area!=null&&Number.isFinite(Number(x.area)));
  const areaSum=areaPlots.reduce((sum,p)=>sum+Number(p.area),0);
  const facts='<div class="rpt-kpis">'+[
   ['ขอบเขต',scopeLabel],['แปลงในรายงาน',String(d.pp.length)],
   ['ผ่าน QA / วันภาพ',d.good.length+' / '+d.all.length],
   ['วันภาพผ่าน QA ล่าสุด',latest?.date||'—'],
   ['ผลรวมพื้นที่ Geometry',areaPlots.length?num(areaSum)+' ไร่':'—'],
   ['ช่วงเวลา',ui.period==='all'?'ทั้งหมด':ui.period+' วัน']
  ].map(([k,v])=>'<div class="rpt-kpi"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('')+'</div>';
  const visuals=headImages.length?'<h3>ภาพหลักฐานดาวเทียม</h3><div class="rpt-pictures rpt-cover-grid">'+headImages.slice(0,4).map(x=>thumbnail(x.im,x.mode)).join('')+'</div>':'<p class="rpt-empty">ยังไม่พบภาพ Raster ผ่าน QA ในช่วงเวลา</p>';
  const snapshotRows=isSingle?(perPlot.get(ui.plot)?.rows||[]).slice(-5).map(x=>({code:x.date,ndvi:num(x.ndvi),water:num(x.mndwi),qa:num(x.qa_valid_pct)+'%'})):
   d.pp.map(p=>({plot:p.code,last:perPlot.get(p.code)?.latest})).filter(x=>x.last).sort((a,b)=>b.last.date.localeCompare(a.last.date)).slice(0,6).map(x=>({code:x.plot,ndvi:num(x.last.ndvi),water:num(x.last.mndwi),qa:x.last.date}));
  const quickEvidence='<h3>'+(isSingle?'ค่าล่าสุดที่ผ่าน QA':'ตัวอย่างแปลงที่มีภาพ QA ล่าสุด')+'</h3>'+table(snapshotRows,[['code',isSingle?'วันที่ภาพ':'แปลง'],['ndvi','NDVI'],['water','MNDWI'],['qa',isSingle?'QA SCL':'วันภาพล่าสุด']]);
  add('01 / SUMMARY','Environmental Monitoring · '+scopeLabel,
   '<p class="rpt-lead">'+esc(ui.text||'รายงานติดตามสภาพป่าชายเลนจาก Sentinel-2')+'</p>'+facts+visuals+quickEvidence+
   '<p class="rpt-caption">พื้นที่ข้างต้นเป็นผลรวมพื้นที่จาก Geometry รายแปลง '+areaPlots.length+' แปลง ไม่ใช่พื้นที่ Union ที่ตัดส่วนซ้อนทับหรือผลรับรองจากหน่วยงาน</p>');
 }
 if(ui.modules.has('location')){
  const provinceCounts=new Map();
  for(const p of d.pp){if(!provinceCounts.has(p.province))provinceCounts.set(p.province,{name:p.province,count:0,valid:0,images:0,area:0,withArea:0});
   const q=provinceCounts.get(p.province);q.count++;q.valid+=perPlot.get(p.code).rows.length;q.images+=perPlot.get(p.code).frames.length;
   if(p.geometry&&p.area!=null&&Number.isFinite(Number(p.area))){q.area+=Number(p.area);q.withArea++;}
  }
  if(!isSingle){
   const byProvince=[...provinceCounts.values()].sort((a,b)=>b.count-a.count).map(p=>({province:p.name,plots:String(p.count),qa:String(p.valid),images:String(p.images),area:p.withArea?num(p.area):'—'}));
   chunk(byProvince,rowsLimit).forEach((batch,i)=>add('02 / PROVINCE '+(i+1),'ภาพรวมแยกจังหวัด'+(i?' · ต่อ':''),
    table(batch,[['province','จังหวัด'],['plots','แปลง'],['qa','วันภาพ QA'],['images','Raster QA'],['area','พื้นที่มี GIS (ไร่)']])+
    '<p class="rpt-caption">ข้อมูลแยกตามจังหวัด ไม่เฉลี่ยค่าดัชนีของคนละแปลงรวมกัน</p>'));
  }
  const rows=d.pp.map(p=>({code:p.code,prov:p.province,rai:p.geometry&&p.area!=null?num(p.area):'—',qa:String(perPlot.get(p.code).rows.length),last:perPlot.get(p.code).latest?.date||'—'}));
  chunk(rows,rowsLimit).forEach((batch,i)=>add('02 / REGISTRY '+(i+1),'ทะเบียนแปลง'+(rows.length>rowsLimit?' · '+(i+1)+'/'+Math.ceil(rows.length/rowsLimit):''),
   table(batch,[['code','แปลง'],['prov','จังหวัด'],['rai','พื้นที่ GIS (ไร่)'],['qa','QA ผ่าน'],['last','วันล่าสุด']])+
   '<p class="rpt-caption">แสดงแปลงที่ '+(i*rowsLimit+1)+'–'+Math.min(rows.length,(i+1)*rowsLimit)+' จาก '+rows.length+' แปลง พร้อมสถานะวันที่มีข้อมูลจริง</p>'));
 }
 if(ui.modules.has('satellite')){
  const gallery=[];
  for(const code of plotOrder){
   const frames=(imgByPlot.get(code)||[]).filter(im=>imageURL(im,'true_color')||imageURL(im,'false_color')).slice(0,sampleDays);
   for(const im of frames){
    if(imageURL(im,'true_color'))gallery.push({im,mode:'true_color'});
    if(imageURL(im,'false_color'))gallery.push({im,mode:'false_color'});
   }
  }
  galleryPages('Satellite Atlas · สีจริง / สีเท็จ','03 / SATELLITE',gallery,isSingle?4:6);
 }
 if(ui.modules.has('indices')){
  const gallery=[];
  const selected=[...ui.metrics];
  for(const code of plotOrder){
   const frames=(imgByPlot.get(code)||[]).slice(0,sampleDays);
   for(const im of frames)for(const mode of selected){
    if(imageURL(im,mode))gallery.push({im,mode});
   }
  }
  galleryPages('Index Atlas · '+(selected.map(x=>x.toUpperCase()).join(' / ')||'ไม่เลือกดัชนี'),'04 / INDICES',gallery,isSingle?4:6);
 }
 if(ui.modules.has('trend')){
  const key=[...ui.metrics][0]||'ndvi';
  if(isSingle){
   const rr=perPlot.get(ui.plot)?.rows||[];
   const validMetric=rr.filter(x=>x[key]!=null&&x[key]!==''&&Number.isFinite(Number(x[key])));
   const kpis='<div class="rpt-kpis">'+[
    ['วันภาพที่มีค่า',String(validMetric.length)],['ค่าแรก',validMetric.length?num(validMetric[0][key]):'—'],
    ['ค่าล่าสุด',validMetric.length?num(validMetric.at(-1)[key]):'—'],
    ['ผลต่าง',validMetric.length>1?num(validMetric.at(-1)[key]-validMetric[0][key]):'—']
   ].map(([k,v])=>'<div class="rpt-kpi"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('')+'</div>';
   add('05 / TREND','Time Series · '+key.toUpperCase(),kpis+chart(rr,key)+
    table(rr.slice(-rowsLimit).map(r=>({date:r.date,value:num(r[key]),qa:num(r.qa_valid_pct)+'%'})),[['date','วันภาพ'],['value',key.toUpperCase()],['qa','QA SCL']])+
    '<p class="rpt-caption">จุดกราฟคือวันที่มี Sentinel-2 ผ่าน QA จริง ไม่ใช่ข้อมูลต่อเนื่องรายวัน</p>');
  }else{
   const records=d.pp.map(p=>{const series=perPlot.get(p.code).rows.filter(x=>x[key]!=null&&x[key]!==''&&Number.isFinite(Number(x[key]))),last=series.at(-1),first=series[0];
    return {code:p.code,province:p.province,scenes:String(series.length),last:last?.date||'—',value:last?num(last[key]):'—',delta:series.length>1?num(last[key]-first[key]):'—'};});
   chunk(records,rowsLimit).forEach((batch,i)=>add('05 / TREND '+(i+1),'เปรียบเทียบรายแปลง · '+key.toUpperCase(),
    table(batch,[['code','แปลง'],['province','จังหวัด'],['scenes','วัน QA'],['last','ล่าสุด'],['value','ค่า'],['delta','Δ ช่วง']])+
    '<p class="rpt-caption">ไม่รวมค่าดัชนีข้ามแปลงเป็นเส้นเดียว ค่า Δ เทียบวันภาพแรกและสุดท้ายของแต่ละแปลง</p>'));
  }
 }
 if(ui.modules.has('change')){
  const cByPlot=new Map();
  for(const r of d.changes){const prev=cByPlot.get(r.plot);if(!prev||r.date_b>prev.date_b)cByPlot.set(r.plot,r);}
  const records=d.pp.map(p=>{const r=cByPlot.get(p.code);return {code:p.code,dates:r?r.date_a+' → '+r.date_b:'—',area:r?num(r.common_clear_rai):'—',water:r?num(r.water_net_change_rai):'—',veg:r?num(r.vegetation_net_change_rai):'—'};});
  chunk(records,rowsLimit).forEach((batch,i)=>add('06 / CHANGE '+(i+1),'Screening Change · รายแปลง',
   table(batch,[['code','แปลง'],['dates','คู่วันที่ผ่าน QA'],['area','ร่วม (ไร่)'],['water','น้ำ Δ'],['veg','พืช Δ']])+
   '<p class="rpt-disclaimer">การเปลี่ยนแปลงเป็นการคัดกรองบนพิกเซลที่เทียบกันได้ ไม่ยืนยันน้ำท่วมหรือสาเหตุของสภาพป่า</p>'));
 }
 if(ui.modules.has('rain')){
  const latestRain=[];
  for(const p of d.pp){
   const rain=(ctx.environment?.plots?.[p.code]?.scenes||[]).filter(x=>d.all.some(y=>y.plot===p.code&&y.date===x.date)&&x.data_quality==='COMPLETE');
   for(const row of rain.slice(isSingle?-rowsLimit:-1))latestRain.push({plot:p.code,date:row.date,one:num(row.rain_prev_1_utc_day_mm),three:num(row.rain_prev_3_utc_days_mm)});
  }
  chunk(latestRain,rowsLimit).forEach((batch,i)=>add('07 / RAIN '+(i+1),'Rainfall Context · NASA POWER',
   table(batch,[['plot','แปลง'],['date','วันภาพ'],['one','ฝนก่อน 1 วัน (มม.)'],['three','ฝนก่อน 3 วัน (มม.)']])+
   '<p class="rpt-caption">NASA POWER เป็นข้อมูลฝนตามวัน UTC ที่สัมพันธ์กับวันภาพ ไม่ใช่สถานีวัดฝนหรือน้ำขึ้นลงที่ตรวจสอบแล้ว</p>'));
  if(!latestRain.length)add('07 / RAIN','Rainfall Context','<p class="rpt-empty">ยังไม่มีข้อมูลฝนที่ตรงช่วงเวลาหรือผ่านเงื่อนไข COMPLETE</p>');
 }
 if(ui.modules.has('qa')){
  const records=d.pp.map(p=>{
   const related=d.all.filter(r=>r.plot===p.code),good=perPlot.get(p.code).rows,im=perPlot.get(p.code).frames;
   return {code:p.code,prov:p.province,all:String(related.length),valid:String(good.length),images:String(im.length),source:good.at(-1)?.original_tif10||'—'};
  });
  chunk(records,rowsLimit).forEach((batch,i)=>add('08 / QA '+(i+1),'QA/QC · Data Lineage',
   table(batch,[['code','แปลง'],['prov','จังหวัด'],['all','วันภาพ'],['valid','QA ผ่าน'],['images','Raster'],['source','TIFF ต้นฉบับล่าสุด']])+
   '<p class="rpt-caption">รายงานคงค่า NULL สำหรับข้อมูลขาด ไม่ตีความว่ามีค่า 0.00</p>'));
  add('09 / CAVEATS','การตีความและข้อจำกัด',
   '<ul class="rpt-findings">'+d.cautions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
   '<p class="rpt-disclaimer">ยังไม่มีการตรวจสอบความถูกต้องโดยอิสระ หรือการปรับแก้น้ำขึ้นลง จึงไม่ใช้รายงานนี้เป็นใบรับรอง MRV หรือหลักฐานความเสียหายที่ยืนยันแล้ว</p>'+
   '<p class="rpt-caption">ขอบเขต: '+esc(scopeLabel)+' · รอบภาพ: '+esc(ui.period==='all'?'ทุกวันที่มีข้อมูล':ui.period+' วัน')+' · สร้างเมื่อ '+esc(dateNow())+'</p>');
 }
 if(!out.length)add('00 / EMPTY','ไม่มีองค์ประกอบรายงาน','<p class="rpt-empty">กรุณาเลือกองค์ประกอบอย่างน้อย 1 หัวข้อ</p>');
 return {out,imageCount:out.reduce((n,p)=>n+(p.body.match(/<figure class="rpt-image"/g)||[]).length,0)};
}
function paperStyle(){
 return '@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e7eee9;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;color:#1b3226}.rpt-paper{position:relative;margin:0 auto 14px;width:210mm;min-height:297mm;padding:16mm 15mm 24mm;background:white;box-shadow:0 4px 22px #12291b29;break-after:page;page-break-after:always;overflow:hidden}.rpt-paper:last-child{break-after:auto;page-break-after:auto}.rpt-pagehead{display:flex;justify-content:space-between;border-bottom:2px solid #256d4b;padding-bottom:9px;font-weight:700;font-size:9px;letter-spacing:1px;color:#256d4b}.rpt-eyebrow{font-size:11px;letter-spacing:1.6px;color:#287a53;margin-top:25px}.rpt-paper h2{font-size:24px;line-height:1.35;margin:9px 0 20px}.rpt-paper h3{font-size:14px;margin:16px 0 7px}.rpt-paper p,.rpt-paper li{font-size:11px;line-height:1.85}.rpt-pagefoot{position:absolute;bottom:14mm;left:15mm;right:15mm;display:flex;justify-content:space-between;color:#618171;border-top:1px solid #d1dfd5;padding-top:7px;font-size:9px}.rpt-kpis{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:13px 0 18px}.rpt-kpi{background:#eef6f0;border-left:3px solid #36855a;padding:12px}.rpt-kpi small{display:block;font-size:10px;color:#607768}.rpt-kpi strong{display:block;font-size:17px;margin-top:3px}.rpt-caption{font-size:10px!important;color:#62796a;margin-top:8px}.rpt-disclaimer{padding:12px 14px;border-left:3px solid #bb8944;background:#fff7e9}.rpt-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}.rpt-table th,.rpt-table td{padding:8px 5px;border-bottom:1px solid #dae5db;text-align:left;overflow-wrap:anywhere}.rpt-table th{background:#edf5ee;font-weight:700}.rpt-image{margin:5px 0 16px}.rpt-image-canvas{display:block;position:relative;isolation:isolate}.rpt-image img{display:block;width:100%;height:auto;max-height:175mm;object-fit:contain;background:#e9eee9}.rpt-image-boundary{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.rpt-density-brief .rpt-image img{max-height:185mm}.rpt-density-technical .rpt-table td{font-size:8px}.rpt-image figcaption{font-size:10px;color:#52705d;margin-top:7px}.rpt-pictures{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rpt-pictures .rpt-image img{max-height:80mm}.rpt-empty{padding:18px;background:#eef4ef;border:1px dashed #b8caba;font-size:11px}.rpt-chart{width:100%;height:auto;max-height:72mm}.rpt-findings{padding-left:18px}.rpt-kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.rpt-kpi{padding:8px}.rpt-kpi strong{font-size:13px;overflow-wrap:anywhere}.rpt-kpi small{font-size:9px}.rpt-lead{font-size:10.5px!important;line-height:1.55!important;margin:0 0 10px}.rpt-pictures.rpt-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm 4mm;align-items:start}.rpt-photo-grid .rpt-image{margin:0;min-width:0}.rpt-photo-grid .rpt-image-canvas{width:100%;height:46mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.rpt-photo-grid .rpt-image img{height:46mm;width:100%;max-height:46mm;object-fit:contain}.rpt-gallery-plot .rpt-image-canvas{height:68mm}.rpt-gallery-plot .rpt-image img{height:68mm;max-height:68mm}.rpt-photo-grid .rpt-image figcaption{font-size:8px;line-height:1.4;margin-top:3px}.rpt-pictures.rpt-cover-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3mm 4mm}.rpt-cover-grid .rpt-image{margin:0}.rpt-cover-grid .rpt-image-canvas{width:100%;height:42mm;display:flex;justify-content:center;align-items:center;overflow:hidden}.rpt-cover-grid .rpt-image img{width:100%;height:42mm;max-height:42mm;object-fit:contain}.rpt-cover-grid .rpt-image figcaption{font-size:8px;line-height:1.25;margin-top:2px}.rpt-gallery-sub{font-size:10px!important;color:#64796d;margin:0 0 7px}.rpt-gallery-evidence{margin-top:7px}.rpt-gallery-evidence>b{display:block;font-size:9px;color:#205e3e;margin-bottom:5px}.rpt-gallery-evidence .rpt-table th,.rpt-gallery-evidence .rpt-table td{padding:4px;font-size:8px}.rpt-paper h2{font-size:21px;margin:8px 0 13px}.rpt-eyebrow{margin-top:16px}.rpt-paper h3{margin:12px 0 5px}@media print{body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}.rpt-paper{box-shadow:none;margin:0;width:210mm;height:297mm;min-height:297mm}}';
}
function renderPages(){
 const d=evidence(),plan=documentPlan(d),items=plan.out,total=items.length;
 const pages=items.map((item,i)=>'<article class="rpt-paper" data-report-page="'+esc(item.key)+'"><header class="rpt-pagehead"><span>MANGROVE MONITORING CENTER</span><span>ENVIRONMENTAL MONITORING · DRAFT</span></header>'+
 '<div class="rpt-eyebrow">'+esc(item.key)+'</div><h2>'+esc(item.title)+'</h2>'+item.body+
 '<footer class="rpt-pagefoot"><span>'+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'ALL PLOTS')+' · '+esc(dateNow())+'</span><span>'+String(i+1)+' / '+total+'</span></footer></article>').join('');
 return {pages,d,total,imageCount:plan.imageCount};
}
function fitImageBoundaries(doc){
 const frames=[...doc.querySelectorAll('.rpt-image-canvas')];
 for(const frame of frames){
  const img=frame.querySelector('img'),svg=frame.querySelector('.rpt-image-boundary');
  if(!img||!svg)continue;
  const adjust=()=>{
   const iw=img.clientWidth,ih=img.clientHeight,nw=img.naturalWidth,nh=img.naturalHeight;
   if(!iw||!ih||!nw||!nh){svg.style.visibility='hidden';return;}
   const scale=Math.min(iw/nw,ih/nh),w=nw*scale,h=nh*scale;
   svg.style.left=((iw-w)/2)+'px';svg.style.top=((ih-h)/2)+'px';
   svg.style.width=w+'px';svg.style.height=h+'px';svg.style.visibility='visible';
  };
  img.addEventListener('load',adjust,{once:true});
  adjust();
 }
}
function updatePreview(){
 const el=$('rpt-preview');if(!el)return;
 const report=renderPages();
 const previewCount=Math.min(8,report.total),previewPages=report.pages.split('</article>').slice(0,previewCount).map(x=>x+'</article>').join('');
 el.innerHTML='<style>'+paperStyle().replace('body{margin:0;background:#e7eee9;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;color:#1b3226}','')+'</style><div class="rpt-papers">'+previewPages+'</div>'+(report.total>previewCount?'<p class="rpt-preview-more">แสดงตัวอย่าง '+previewCount+' จาก '+report.total+' หน้า · PDF ฉบับเต็มจะรวมครบทุกหน้า (ภาพ '+report.imageCount+' ภาพ)</p>':'');
 fitImageBoundaries(el);
 const summary=$('rpt-source-summary');
 if(summary)summary.innerHTML='<b>ข้อมูลจริง:</b> '+report.d.pp.length+' แปลง · '+report.d.all.length+' วันภาพ · ผ่าน QA '+report.d.good.length+' วัน · Raster Preview '+report.d.images.length+' ฉาก · ในรายงาน '+report.imageCount+' ภาพ / '+report.total+' หน้า';
 const note=$('rpt-warning-list');if(note)note.innerHTML=report.d.cautions.map(x=>'<p>• '+esc(x)+'</p>').join('');
}
function printPDF(){
 const report=renderPages(),popup=window.open('','_blank');
 if(!popup){alert('เบราว์เซอร์บล็อกหน้าต่าง กรุณาอนุญาต Pop-ups แล้วลองอีกครั้ง');return;}
 popup.document.open();
 popup.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>MMC '+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'Nationwide')+' Report</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"><style>'+paperStyle()+'</style></head><body>'+report.pages+
 '<script>window.addEventListener("load",function(){var images=Array.from(document.images);Promise.all(images.map(function(im){return im.complete?Promise.resolve():new Promise(function(resolve){im.onload=resolve;im.onerror=resolve})})).then(function(){document.querySelectorAll(".rpt-image-canvas").forEach(function(frame){var im=frame.querySelector("img"),svg=frame.querySelector("svg");if(!svg||!im.naturalWidth)return;var iw=im.clientWidth,ih=im.clientHeight,scale=Math.min(iw/im.naturalWidth,ih/im.naturalHeight),w=im.naturalWidth*scale,h=im.naturalHeight*scale;svg.style.left=(iw-w)/2+"px";svg.style.top=(ih-h)/2+"px";svg.style.width=w+"px";svg.style.height=h+"px"});setTimeout(function(){window.print()},350)})})<\/script></body></html>');
 popup.document.close();
}
function exportBlueprint(){
 const ev=evidence(),data={schema:'MMC_REPORT_BLUEPRINT_V1',interpreter:'LOCAL_RULE_BASED_NOT_LLM',created_at:new Date().toISOString(),request:ui.text,
 settings:{type:ui.type,scope:ui.scope,plot:ui.scope==='plot'?ui.plot:null,province:ui.scope==='province'?ui.province:null,period:ui.period,density:ui.density,image_dates_per_plot:ui.imageDates,metrics:[...ui.metrics],modules:[...ui.modules]},
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
 '<div class="rpt-scope-switch" role="group" aria-label="เลือกขอบเขตสำหรับรายงาน"><button type="button" data-rpt-scope-switch="plot">รายแปลง</button><button type="button" data-rpt-scope-switch="province">รายจังหวัด</button><button type="button" data-rpt-scope-switch="all">ทุกแปลง / ทั้งประเทศ</button></div>'+ 
 '<div id="rpt-blueprint" class="rpt-blueprint"></div>'+
 '<div class="rpt-input-grid">'+
 '<label>ประเภทรายงาน<select id="rpt-type">'+options(Object.entries(TYPE),ui.type)+'</select></label>'+
 '<label>ขอบเขต<select id="rpt-scope">'+options([['plot','รายแปลง'],['province','จังหวัด'],['all','ทุกแปลง']],ui.scope)+'</select></label>'+
 '<label>เลือกแปลง<select id="rpt-plot">'+options(plotList().map(p=>[p.code,p.code+' · '+p.province]),ui.plot)+'</select></label>'+
 '<label>จังหวัด<select id="rpt-province">'+options(provinceList().map(x=>[x,x]),ui.province)+'</select></label>'+
 '<label>ช่วงเวลา<select id="rpt-period">'+options([['30','30 วัน'],['90','90 วัน'],['180','6 เดือน'],['365','1 ปี'],['730','2 ปี'],['1825','5 ปี'],['3650','10 ปี'],['all','ทั้งหมดที่มี']],ui.period)+'</select></label>'+
 '<label>รูปแบบ<select id="rpt-density">'+options([['brief','Visual / กระชับ'],['standard','Balanced / มาตรฐาน'],['technical','Technical / เชิงลึก']],ui.density)+'</select></label>'+ 
 '<label>จำนวนวันภาพต่อแปลง<select id="rpt-image-dates">'+options([['1','วันภาพล่าสุด 1 วัน'],['2','2 วันภาพล่าสุด'],['3','3 วันภาพล่าสุด'],['4','4 วันภาพล่าสุด']],ui.imageDates)+'</select></label></div>'+
 '<div class="rpt-checkbox-grid"><fieldset><legend>เลือกหน้ารายงาน</legend>'+Object.entries(MODULES).map(([k,v])=>'<label><input type="checkbox" data-rpt-module="'+k+'"'+(ui.modules.has(k)?' checked':'')+'> '+esc(v)+'</label>').join('')+'</fieldset>'+
 '<fieldset><legend>ดัชนีที่ต้องการ</legend>'+Object.entries(METRICS).map(([k,v])=>'<label><input type="checkbox" data-rpt-metric="'+k+'"'+(ui.metrics.has(k)?' checked':'')+'> '+esc(v)+'</label>').join('')+'</fieldset></div>'+
 '<div class="rpt-buttons"><button type="button" class="btn primary" id="rpt-preview-button">สร้างตัวอย่างรายงาน</button><button type="button" class="btn" id="rpt-print">พิมพ์ / บันทึก PDF (A4)</button><button type="button" class="btn" id="rpt-blueprint-export">ส่งออก Blueprint JSON</button></div>'+
 '<div id="rpt-source-summary" class="rpt-source-summary"></div><div id="rpt-warning-list" class="rpt-warning-list"></div>'+
 '<details class="rpt-preview-toggle" open><summary>ดูตัวอย่างรายงานจริง · A4 แนวตั้ง</summary><div id="rpt-preview"></div></details></section>';
 syncForm();updatePreview();
 container.oninput=e=>{if(e.target.id==='rpt-text')ui.text=e.target.value;};
 container.onchange=e=>{
  const id=e.target.id,fields={'rpt-type':'type','rpt-scope':'scope','rpt-plot':'plot','rpt-province':'province','rpt-period':'period','rpt-density':'density','rpt-image-dates':'imageDates'};
  if(fields[id]){ui[fields[id]]=e.target.value;if(id==='rpt-type')ui.modules=new Set(DEFAULT[ui.type]);if(id==='rpt-scope'){ui.imageDates=ui.scope==='all'?'1':ui.scope==='province'?'2':'3';if(ui.scope!=='plot')ui.modules.add('location');if(ui.scope==='province'&&!provinceList().includes(ui.province))ui.province=plotList().find(p=>p.code===ui.plot)?.province||provinceList()[0]||'ALL';}}
  if(e.target.dataset.rptModule){if(e.target.checked)ui.modules.add(e.target.dataset.rptModule);else ui.modules.delete(e.target.dataset.rptModule);}
  if(e.target.dataset.rptMetric){if(e.target.checked)ui.metrics.add(e.target.dataset.rptMetric);else ui.metrics.delete(e.target.dataset.rptMetric);}
  if(id==='rpt-type'||id==='rpt-scope')syncForm();showBlueprint();updatePreview();
 };
 container.onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.rptScopeSwitch){ui.scope=b.dataset.rptScopeSwitch;ui.imageDates=ui.scope==='all'?'1':ui.scope==='province'?'2':'3';if(ui.scope!=='plot')ui.modules.add('location');if(ui.scope==='province'&&!provinceList().includes(ui.province))ui.province=plotList().find(p=>p.code===ui.plot)?.province||provinceList()[0]||'ALL';syncForm();updatePreview();return;}
  if(b.dataset.rptSample){
   const example={water:'รายงานแปลง '+ui.plot+' ย้อนหลัง 6 เดือน เน้นพื้นที่น้ำเพิ่ม MNDWI NDWI และฝน ภาพใหญ่',forest:'ดูสภาพป่าชายเลนแปลง '+ui.plot+' ย้อนหลัง 1 ปี เน้น NDVI NDRE NDMI และกราฟ',executive:'ทำรายงานจังหวัดระยองสำหรับผู้บริหาร ย้อนหลัง 3 เดือน เน้นภาพ ไม่เอาตารางเยอะ',audit:'ทำรายงานตรวจสอบ QA/QC และหลักฐานแปลง '+ui.plot+' ย้อนหลัง 1 ปี รายละเอียดทางเทคนิค'};
   ui.text=example[b.dataset.rptSample];$('rpt-text').value=ui.text;return;
  }
  if(b.id==='rpt-analyze'){
   const val=interpret(ui.text);for(const field of ['type','scope','plot','province','period','density','imageDates'])ui[field]=val[field];
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
 ' · วันภาพ/แปลง '+esc(ui.imageDates)+' วัน · A4 แนวตั้ง · '+ui.modules.size+' ส่วนประกอบ <span>'+ui.notice.map(x=>esc(x)).join(' • ')+'</span>';
}
function syncForm(){
 for(const [id,value] of [['rpt-type',ui.type],['rpt-scope',ui.scope],['rpt-plot',ui.plot],['rpt-province',ui.province],['rpt-period',ui.period],['rpt-density',ui.density],['rpt-image-dates',ui.imageDates]]){
  const el=$(id);if(el)el.value=value;
 }
 document.querySelectorAll('[data-rpt-scope-switch]').forEach(x=>{const on=x.dataset.rptScopeSwitch===ui.scope;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});
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