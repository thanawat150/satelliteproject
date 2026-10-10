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
// REPORT_CODE
})();