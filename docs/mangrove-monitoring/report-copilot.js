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
const ui={text:'',type:'plot',scope:'plot',plot:'13-STC',province:'ALL',period:'180',density:'standard',imageDates:'2',appendix:false,metrics:new Set(['ndvi','mndwi','ndmi']),modules:new Set(DEFAULT.plot),notice:[]};
let ctx=null,started=false;
const plotList=()=>ctx?.plots||[];
const allScenes=()=>ctx?.scenes||[];
const allImages=()=>ctx?.imagery?.generated_items||[];
function provinceList(){return [...new Set(plotList().map(p=>p.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));}
function interpret(q){
 const text=String(q||'').trim(),d={type:'plot',scope:'plot',plot:ui.plot,province:'ALL',period:'180',density:'standard',imageDates:ui.imageDates||'2',appendix:false,metrics:new Set(),notice:[]};
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
 d.appendix=/ภาคผนวก|แนบทุกภาพ|ภาพทุกวัน|ไฟล์ภาพทั้งหมด|แนบภาพทั้งหมด/.test(text);
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
 const visualImages=allImages().filter(x=>codes.has(x.plot)&&x.date>=threshold&&x.date<=dateNow()&&x.source==='generated'&&x.assets).sort((a,b)=>b.date.localeCompare(a.date));
 const changes=(ctx?.changes||[]).filter(c=>codes.has(c.plot)&&c.date_b>=threshold&&c.status==='AUTO_VALID'&&Number(c.common_clear_rai)>0);
 const cautions=[];
 if(!pp.length)cautions.push('ไม่มีแปลงในขอบเขตที่เลือก');
 if(!all.length)cautions.push('ไม่มีภาพในช่วงวันที่เลือก ไม่สร้างข้อมูลสมมติ');
 if(!good.length)cautions.push('ไม่มีภาพผ่าน QA จึงไม่แสดงค่าดัชนีที่ไม่รับรอง');
 if(pp.some(x=>!x.geometry))cautions.push('บางแปลงยังไม่มีขอบเขต GIS');
 if(ui.scope!=='plot')cautions.push('ไม่เฉลี่ยค่าดัชนีของหลายแปลงข้ามพื้นที่โดยไม่มีวิธีถ่วงน้ำหนักที่ตรวจสอบได้');
 cautions.push('ข้อมูลภาพดาวเทียมใช้คัดกรอง ไม่ใช่หลักฐานยืนยันน้ำท่วม ต้นไม้ตาย หรือการบุกรุก');
 return {pp,all,good,images,visualImages,changes,cautions,threshold};
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



function waterChangeBreakdown(pair){
 if(!pair)return '<p class="rpt-empty">ไม่มีคู่ภาพที่ใช้คำนวณการเปลี่ยนแปลง</p>';
 const gain=pair.water_new_rai==null?null:Number(pair.water_new_rai);
 const loss=pair.water_lost_rai==null?null:Number(pair.water_lost_rai);
 const net=pair.water_net_change_rai==null?null:Number(pair.water_net_change_rai);
 if(!Number.isFinite(gain)||!Number.isFinite(loss)||!Number.isFinite(net))return '<p class="rpt-empty">ไม่มีตัวเลขน้ำเพิ่ม/น้ำลดจากผลการวิเคราะห์เดิมครบทุกตัว จึงไม่สร้างค่าทดแทน</p>';
 const mx=Math.max(gain,loss,.25),bar=(label,val,klass)=>
  '<div class="rpt-water-row"><span>'+esc(label)+'</span><div class="rpt-water-bar"><div class="'+klass+'" style="width:'+Math.min(100,Math.max(0,val/mx*100)).toFixed(2)+'%"></div></div><b>'+num(val)+' ไร่</b></div>';
 return '<div class="rpt-water-breakdown"><h3>จำแนกการเปลี่ยนแปลงพื้นที่น้ำจากคู่ภาพ</h3>'+
 bar('เปลี่ยนเป็นน้ำ',gain,'rpt-water-gain')+bar('เปลี่ยนออกจากน้ำ',loss,'rpt-water-loss')+
 '<p class="rpt-water-net">น้ำเพิ่มสุทธิ = '+num(gain)+' − '+num(loss)+' = <b>'+num(net)+' ไร่</b></p>'+
 '<p class="rpt-caption">คำนวณจากพิกเซลคู่ภาพที่ผ่านเกณฑ์เดียวกัน ไม่ใช่แผนที่ตำแหน่งน้ำเพิ่ม/น้ำลดรายพิกเซล</p></div>';
}

function imageryAlignment(a,b,mode){
 const bounds=x=>x?.mode_bounds?.[mode]||x?.bounds,aa=bounds(a),bb=bounds(b);
 if(!Array.isArray(aa)||!Array.isArray(bb)||aa.length!==2||bb.length!==2)return false;
 const v=x=>[Number(x[0][0]),Number(x[0][1]),Number(x[1][0]),Number(x[1][1])];
 const x=v(aa),y=v(bb);
 return x.every((n,i)=>Number.isFinite(n)&&Number.isFinite(y[i])&&Math.abs(n-y[i])<=.000002);
}
function likelyCloudObscured(im){
 const white=im?.rgb_near_white_pct,invalid=im?.rgb_invalid_pct;
 const cloud=im?.rgb_cloud_pct??im?.cloud_pct;
 return cloud!=null&&Number(cloud)>55||
   white!=null&&Number(white)>80||
   invalid!=null&&Number(invalid)>65;
}
function visualPairCard(before,after,mode='mndwi'){
 const aligned=imageryAlignment(before,after,mode),cloud=likelyCloudObscured(before)||likelyCloudObscured(after);
 const qaFor=im=>ctx?.scenes?.find(x=>x.plot===im.plot&&x.date===im.date);
 const badge=im=>{const q=qaFor(im);return 'วันภาพ '+esc(im.date)+' · QA '+esc(q?.analysis_status||'ไม่มีผลตรวจ')+
  ' · พิกเซลผ่าน QA '+(q?.qa_valid_pct==null?'—':num(q.qa_valid_pct)+'%');};
 const compareOK=aligned&&!cloud&&before?.index_renderer_version===after?.index_renderer_version;
 const beforePic=picture(before,mode),afterPic=picture(after,mode);
 const afterMarked=afterPic.replace('class="rpt-image-canvas"','class="rpt-image-canvas rpt-visual-current-canvas"')
   .replace('</div><figcaption>','<svg class="rpt-visual-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="วงตำแหน่งเปลี่ยนแปลงเบื้องต้น"></svg></div><figcaption>');
 return '<div class="rpt-visual-pair" data-visual-scan="'+(compareOK?'eligible':'disabled')+'" data-visual-mode="'+esc(mode)+'">'+
  '<div class="rpt-visual-duo">'+
  '<div class="rpt-visual-date"><b>ภาพก่อนหน้า · '+esc(before.date)+'</b>'+beforePic+'<small>'+badge(before)+'</small></div>'+
  '<div class="rpt-visual-date"><b>ภาพปัจจุบันที่ใช้เทียบ · '+esc(after.date)+'</b>'+afterMarked+'<small>'+badge(after)+'</small></div>'+
  '</div><p class="rpt-visual-result">'+
  (cloud?'มีสัญญาณภาพขาว/NoData มาก ไม่วงอัตโนมัติเพราะอาจถูกเมฆหรือข้อมูลขาดบัง':
   !aligned?'ขอบภาพสองวันไม่ตรงกัน จึงแสดงคู่ภาพให้ตรวจด้วยตา แต่ไม่วงอัตโนมัติ':
   !compareOK?'รุ่นการแสดงดัชนีไม่ตรงกัน จึงไม่คำนวณสีต่างเพื่อวงตำแหน่ง':'กำลังตรวจความต่างของสีที่แสดงบนภาพดัชนี…')+
  '</p><p class="rpt-caption">วงสีส้ม = จุดสงสัยจากความต่างสีภาพดัชนีที่แสดง ไม่ใช่ขอบเขตน้ำท่วมหรือพื้นที่เปลี่ยนแปลงที่คำนวณจาก GeoTIFF · เมฆและการปรับสีอาจทำให้คลาดเคลื่อน</p></div>';
}
function visualScreeningPages(d,withQaPairs){
 const pages=[],used=new Set(withQaPairs),byPlot=new Map(),mode='mndwi';
 for(const im of d.visualImages||[]){
  if(!imageURL(im,mode))continue;
  if(!byPlot.has(im.plot))byPlot.set(im.plot,[]);
  byPlot.get(im.plot).push(im);
 }
 const groups=[];
 for(const p of d.pp){
  const items=byPlot.get(p.code)||[],clear=items.filter(x=>!likelyCloudObscured(x));
  if(clear.length<2)continue;
  let before=null,after=null;
  for(let i=0;i<clear.length;i++){for(let j=i+1;j<clear.length;j++){
    if(imageryAlignment(clear[j],clear[i],mode)&&clear[j].index_renderer_version===clear[i].index_renderer_version){
      before=clear[j];after=clear[i];break;
    }
  }if(before)break;}
  if(!before){before=clear[1];after=clear[0];}
  const qaBefore=d.good.some(x=>x.plot===p.code&&x.date===before.date),qaAfter=d.good.some(x=>x.plot===p.code&&x.date===after.date);
  groups.push({p,before,after,qaBefore,qaAfter,missingQa:!qaBefore||!qaAfter,priority:!used.has(p.code)});
 }
 groups.sort((a,b)=>(Number(b.priority)-Number(a.priority))||(Number(b.missingQa)-Number(a.missingQa))||a.p.code.localeCompare(b.p.code));
 for(const x of groups.slice(0,2)){
  pages.push({key:'V / VISUAL '+x.p.code,title:'จุดสังเกตจากภาพดัชนี · '+x.p.code,
   body:'<p class="rpt-lead">ภาพนี้ใช้เพื่อคัดกรองด้วยสายตา โดยไม่บังคับว่าต้องผ่าน QA หากภาพยังเห็นผิวพื้นที่ได้ชัดเจน <b>ไม่ใช้ค่าจากภาพนี้คำนวณไร่หรือยืนยันน้ำท่วม</b></p>'+
     '<div class="rpt-visual-qa">ภาพก่อนหน้า: '+esc(x.qaBefore?'ผ่าน QA':'ไม่ผ่าน/ยังไม่มี QA')+
     ' · ภาพปัจจุบัน: '+esc(x.qaAfter?'ผ่าน QA':'ไม่ผ่าน/ยังไม่มี QA')+'</div>'+
     visualPairCard(x.before,x.after,'mndwi')+
     '<p class="rpt-disclaimer">เป็นข้อสังเกตเชิงภาพเท่านั้น สำหรับจุดที่เห็นน้ำเพิ่ม/ลดหรือพืชพรรณเปลี่ยน ให้ตรวจภาพสีจริงประกอบ แล้วใช้ GeoTIFF และ Mask ที่เชื่อถือได้ก่อนวัดพื้นที่</p>'});
 }
 return pages;
}
function floodFinding(r){
 if(!r.pair)return '<p>ยังไม่มีคู่ภาพที่เปรียบเทียบได้ จึงยังไม่จัดระดับสัญญาณพื้นที่น้ำสำหรับแปลงนี้</p>';
 const c=r.pair,raw=[];
 const pos=(v)=>Number.isFinite(Number(v))?Number(v):null;
 const gain=pos(c.water_new_rai),loss=pos(c.water_lost_rai),net=pos(c.water_net_change_rai);
 if(net!==null&&r.area>0){
  raw.push(net>0?('น้ำที่จำแนกได้เพิ่มสุทธิ '+num(net)+' ไร่ คิดเป็น '+num(net/r.area*100)+'% ของพื้นที่พิกเซลร่วม'):net<0?
   ('น้ำที่จำแนกได้ลดสุทธิ '+num(Math.abs(net))+' ไร่'):('พื้นที่น้ำสุทธิไม่เปลี่ยนแปลงในคู่ภาพนี้'));
 }
 if(gain!==null&&loss!==null&&gain>0&&loss>0)raw.push('พบทั้งพิกเซลที่เปลี่ยนเป็นน้ำและพิกเซลที่เปลี่ยนออกจากน้ำในแปลงเดียวกัน');
 if(r.pct!=null&&r.pct>=50)raw.push('สัดส่วนการจำแนกน้ำเปลี่ยนสูงมาก ต้องตรวจ Raster/เกณฑ์ MNDWI และความต่างของภาพก่อนตีความ');
 const veg=pos(c.vegetation_net_change_rai);
 if(veg!==null&&veg<0)raw.push('การจำแนกพื้นที่พืชลดสุทธิ '+num(Math.abs(veg))+' ไร่ร่วมด้วย แต่ยังไม่ใช่หลักฐานว่าต้นไม้ตาย');
 if(r.plot.geometry&&r.plot.area!=null&&r.area>Number(r.plot.area)+.1)raw.push('พื้นที่พิกเซลร่วมมากกว่าพื้นที่ Geometry '+num(r.area-Number(r.plot.area))+' ไร่ ต้องตรวจวิธี Rasterization ก่อนรับรองค่า');
 if(!raw.length)raw.push('มีข้อมูลคู่ภาพสำหรับคัดกรอง แต่ยังไม่พอระบุสาเหตุของการเปลี่ยนแปลง');
 return '<div class="rpt-finding"><h3>ข้อค้นพบเฉพาะแปลง '+esc(r.code)+'</h3><ul>'+raw.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';
}


/* Print-safe locator uses actual supplied plot polygons, with a numbered legend to
   avoid the overlapping textual plot IDs of the earlier centroid-only schematic. */
function floodPlotLocator(rows){
 const observed=[],every=[];
 for(const r of rows){
  const g=r.plot.geometry,poly=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
  const rings=[];
  for(const part of poly)for(const ring of part||[]){
   const pts=(ring||[]).filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))).map(p=>[Number(p[0]),Number(p[1])]);
   if(pts.length>=3){rings.push(pts);for(const point of pts)every.push(point);}
  }
  if(rings.length){const pts=rings[0],cx=pts.reduce((n,p)=>n+p[0],0)/pts.length,cy=pts.reduce((n,p)=>n+p[1],0)/pts.length;observed.push({r,rings,cx,cy,index:rows.indexOf(r)+1});}
 }
 if(!every.length)return '<p class="rpt-empty">ไม่มี Geometry ที่ยืนยันพิกัดได้ จึงไม่แสดงแผนที่คาดเดา</p>';
 const latMean=every.reduce((n,p)=>n+p[1],0)/every.length,longitudeFactor=Math.cos(latMean*Math.PI/180);
 const west=Math.min(...every.map(p=>p[0])),east=Math.max(...every.map(p=>p[0]));
 const south=Math.min(...every.map(p=>p[1])),north=Math.max(...every.map(p=>p[1]));
 const xsize=Math.max(.000001,(east-west)*longitudeFactor),ysize=Math.max(.000001,north-south);
 const scale=Math.min(510/xsize,255/ysize),ox=32+(510-xsize*scale)/2,oy=39+(255-ysize*scale)/2;
 const xy=(lng,lat)=>[ox+(lng-west)*longitudeFactor*scale,oy+(north-lat)*scale];
 const marks=[],pinCenters=[];
 for(const item of observed){
  const [cx,cy]=xy(item.cx,item.cy),candidates=[[0,0]];
  for(const rad of [16,30,45,60])for(let t=0;t<12;t++){const theta=Math.PI*2*t/12;candidates.push([rad*Math.cos(theta),rad*Math.sin(theta)]);}
  let target=[cx,cy];
  for(const [dx,dy] of candidates){
   const nx=cx+dx,ny=cy+dy;
   if(nx<21||nx>552||ny<16||ny>319)continue;
   if(pinCenters.every(p=>Math.hypot(p[0]-nx,p[1]-ny)>21)){target=[nx,ny];break;}
  }
  pinCenters.push(target);marks.push({item,cx,cy,tx:target[0],ty:target[1]});
 }
 const color=r=>!r.pair?'#809c8b':r.water>0?'#bc6e42':'#287b5b';
 const polygonPaths=observed.map(({r,rings})=>{
  const d=rings.map(ring=>ring.map((p,i)=>{const [x,y]=xy(p[0],p[1]);return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2);}).join(' ')+' Z').join(' ');
  return '<path d="'+d+'" fill="'+color(r)+'" fill-opacity="0.20" stroke="'+color(r)+'" stroke-width="1.1" fill-rule="evenodd"/>';
 }).join('');
 const markerSvg=marks.map(m=>{
  const col=color(m.item.r),nr=m.item.index;return '<line x1="'+m.cx.toFixed(1)+'" y1="'+m.cy.toFixed(1)+'" x2="'+m.tx.toFixed(1)+'" y2="'+m.ty.toFixed(1)+'" stroke="'+col+'" stroke-opacity=".6" stroke-width="1"/>'+
   '<circle cx="'+m.tx.toFixed(1)+'" cy="'+m.ty.toFixed(1)+'" r="10" fill="'+col+'" stroke="#fff" stroke-width="1.8"/>'+
   '<text x="'+m.tx.toFixed(1)+'" y="'+(m.ty+3.5).toFixed(1)+'" text-anchor="middle" font-size="9.3" fill="#fff" font-weight="700">'+nr+'</text>';
 }).join('');
 const key=rows.map((r,i)=>'<div><b style="color:'+color(r)+'">'+(i+1)+'.</b> '+esc(r.code)+' <small>'+esc(!r.pair?'ไม่มีคู่ภาพ':r.water>0?'น้ำเพิ่มสุทธิ':'ไม่มีน้ำเพิ่มสุทธิ')+'</small></div>').join('');
 return '<div class="rpt-gis-map">'+
  '<svg class="rpt-gis-overview" viewBox="0 0 570 339" role="img" aria-label="ขอบเขตจริงของแปลง GIS '+rows.length+' แปลง พร้อมหมายเลขแยกอ่านได้">'+
  '<rect x="10" y="7" width="550" height="321" fill="#f3f7f3" rx="6" stroke="#b7c9ba"/>'+
  [0,1,2,3,4].map(i=>'<line x1="'+(27+i*128)+'" x2="'+(27+i*128)+'" y1="22" y2="316" stroke="#d3e0d6" stroke-width=".6"/>').join('')+
  [0,1,2,3].map(i=>'<line x1="21" x2="555" y1="'+(35+i*91)+'" y2="'+(35+i*91)+'" stroke="#d3e0d6" stroke-width=".6"/>').join('')+
  polygonPaths+markerSvg+
  '<text x="20" y="26" font-size="12" fill="#1d5e3d" font-weight="700">N ↑</text>'+
  '<text x="540" y="318" font-size="9" text-anchor="end" fill="#597364">WGS84 · GIS polygons</text></svg>'+
  '<div class="rpt-locator-key">'+key+'</div></div>'+
  '<p class="rpt-caption">ขอบเขตแปลงจาก Geometry จริง พร้อมหมายเลขอ้างอิงด้านล่าง • ไม่ได้แสดงขอบเขตจังหวัด ถนน หรือฐานภาพดาวเทียม • สีส้ม=น้ำเพิ่มสุทธิ, เขียว=มีคู่ภาพแต่ไม่เพิ่ม, เทา=ไม่มีคู่ภาพ</p>';
}

/* Flood brief is question-first: decision pages before optional visual evidence appendix.
   Pair changes are screening evidence only; different dates/tides must not become a flood claim. */
function floodPlan(d){
 const out=[],section=(key,title,body)=>out.push({key,title,body});
 const latest=d.good.at(-1),pairs=new Map(),matched=new Set(d.pp.map(p=>p.code));
 const validDates=new Set(d.good.map(x=>x.plot+'|'+x.date));
 const raw=d.changes.filter(c=>matched.has(c.plot)&&c.date_a&&c.date_b&&c.date_a<c.date_b&&c.date_a>=d.threshold
  &&validDates.has(c.plot+'|'+c.date_a)&&validDates.has(c.plot+'|'+c.date_b)
  &&c.water_net_change_rai!==null&&c.water_net_change_rai!==undefined
  &&Number.isFinite(Number(c.water_net_change_rai))&&Number(c.common_clear_rai)>0);
 for(const c of raw){
  const old=pairs.get(c.plot);
  if(!old||c.date_b>old.date_b||(c.date_b===old.date_b&&c.date_a>old.date_a))pairs.set(c.plot,c);
 }
 const rows=d.pp.map(p=>{
  const c=pairs.get(p.code)||null,water=c?Number(c.water_net_change_rai):null,area=c?Number(c.common_clear_rai):null;
  const pct=c&&area>0?water/area*100:null;
  const raster=d.images.filter(x=>x.plot===p.code);
  return {plot:p,code:p.code,sceneCount:d.good.filter(x=>x.plot===p.code).length,
    pair:c,water,area,pct,raster,latest:d.good.filter(x=>x.plot===p.code).at(-1)};
 });
 const comparable=rows.filter(r=>r.pair),increase=comparable.filter(r=>r.water>0);
 const ordered=increase.slice().sort((a,b)=>b.water-a.water||a.code.localeCompare(b.code));
 const noPair=rows.length-comparable.length,variableWindows=new Set(comparable.map(r=>r.pair.date_a+'|'+r.pair.date_b)).size>1;
 const issues=[];
 if(!d.pp.length)issues.push('ไม่พบแปลงในขอบเขตที่เลือก');
 if(!comparable.length)issues.push('ไม่มีคู่ภาพ Change Detection ที่ผ่านเกณฑ์ในช่วงเวลา จึงไม่จัดอันดับสัญญาณพื้นที่น้ำ');
 if(noPair)issues.push(noPair+' แปลงไม่มีคู่ภาพที่เทียบการเปลี่ยนแปลงน้ำได้');
 issues.push('ใช้คู่ภาพที่ทั้งวันก่อนและวันหลังอยู่ในช่วงเวลาที่เลือกและมี Scene ผ่าน QA ในทะเบียนเท่านั้น');
 if(variableWindows)issues.push('คู่วันที่ภาพของแต่ละแปลงไม่ตรงกัน จึงไม่ใช้ลำดับพื้นที่น้ำเพิ่มเพื่อยืนยันความรุนแรงที่เปรียบเทียบกันได้');
 const geodiff=comparable.filter(r=>r.plot.geometry&&r.plot.area!=null&&r.area>Number(r.plot.area)+0.1);
 const balanceReview=comparable.filter(r=>r.pair.water_new_rai!=null&&r.pair.water_lost_rai!=null&&Math.abs(Number(r.pair.water_new_rai)-Number(r.pair.water_lost_rai)-Number(r.pair.water_net_change_rai))>0.01);
 if(geodiff.length)issues.push('พื้นที่พิกเซลร่วมมากกว่าพื้นที่ Geometry ใน '+geodiff.length+' แปลง: อาจต่างจาก Rasterization ต้องตรวจการคำนวณก่อน Audit');
 if(balanceReview.length)issues.push('พบค่า Δ น้ำไม่ตรงกับผลต่างน้ำเพิ่มและน้ำลดใน '+balanceReview.length+' แปลง ควรระงับการใช้ผลจนกว่าจะตรวจสูตร/ข้อมูลต้นทาง');
 if(comparable.length>3&&increase.length===comparable.length)issues.push('ทุกแปลงที่มีคู่ภาพพบพื้นที่น้ำเพิ่มสุทธิพร้อมกัน อาจมีปัจจัยร่วมของชุดภาพ/ฤดูกาล/น้ำขึ้นลง ต้องตรวจทั้งระบบก่อนระบุเหตุการณ์น้ำท่วม');
 issues.push('ยังไม่พบข้อมูลระดับน้ำขึ้นลง ณ เวลาถ่ายภาพที่ผูกกับคู่ภาพในการส่งออกรายงานนี้');
 issues.push('ยังไม่มีหลักฐานภาคสนามหรือการตรวจสอบความถูกต้องอิสระเพื่อยืนยันน้ำท่วมหรือความเสียหาย');
 const candidates=Math.min(3,ordered.length),priority=ordered.slice(0,candidates);
 const sourceScene=(code,date)=>d.good.find(x=>x.plot===code&&x.date===date);
 const image=(code,date,mode)=>{
  const im=d.images.find(x=>x.plot===code&&x.date===date&&imageURL(x,mode));
  return im?picture(im,mode):'<p class="rpt-empty">ไม่พบภาพ '+esc(mode.toUpperCase())+' ของ '+esc(code)+' วันที่ '+esc(date)+' ในคลังที่ผ่าน QA</p>';
 };
 const metric=(k,v)=>'<div class="rpt-kpi"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>';
 const waterVal=r=>r.water===null?'ไม่มีคู่เปรียบเทียบ':(r.water>0?'+':'')+num(r.water)+' ไร่';
 const percentVal=r=>r.pct==null?'—':num(r.pct)+'%';
 const pairText=r=>r.pair?r.pair.date_a+' → '+r.pair.date_b:'ไม่มีคู่ภาพ';
 const shortRow=r=>({code:r.code,water:waterVal(r),pct:percentVal(r),before:r.pair?.date_a||'—',current:r.pair?.date_b||'—'});
 const scope=ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'ทุกแปลงในระบบ';
 const scopeText=ui.scope==='plot'?'แปลง':ui.scope==='province'?'จังหวัด':'เครือข่าย';
 const status=comparable.length?'พบสัญญาณพื้นที่น้ำเปลี่ยนแปลง ต้องตรวจบริบทเพิ่มเติม':'ข้อมูลคู่ภาพไม่เพียงพอสำหรับสรุปการเปลี่ยนแปลงน้ำ';
 const coverVisual=priority.slice(0,2).map(r=>{
  const im=d.images.find(x=>x.plot===r.code&&x.date===r.pair.date_b&&imageURL(x,'true_color'));
  return im?picture(im,'true_color'):'<p class="rpt-empty">ภาพสีจริงหลังเหตุการณ์ '+esc(r.code)+' ยังไม่มี</p>';
 }).join('');
 const coverage='<div class="rpt-kpis rpt-flood-kpis">'+metric('แปลงในขอบเขต',rows.length)+metric('คู่ภาพเทียบได้',comparable.length+'/'+rows.length)+
  metric('แปลงน้ำเพิ่ม (คัดกรอง)',increase.length)+metric('วันที่ภาพ QA ล่าสุด',latest?.date||'—')+'</div>';
 const top3=table(ordered.slice(0,3).map(shortRow),[['code','แปลง'],['water','น้ำเปลี่ยน'],['pct','% พื้นที่ร่วม'],['before','ภาพก่อนหน้า'],['current','ภาพปัจจุบัน']]);
 section('01 / DECISION','สรุปสถานการณ์พื้นที่น้ำ · '+scope,
  '<div class="rpt-flood-status"><strong>ผลคัดกรอง:</strong> '+esc(status)+'</div>'+
  (comparable.length>3&&increase.length===comparable.length?'<p class="rpt-cross-scene"><strong>จุดสังเกตระดับจังหวัด:</strong> แปลงที่มีคู่ภาพทั้งหมด '+increase.length+' แปลงแสดงพื้นที่น้ำเพิ่มสุทธิพร้อมกัน จึงควรตรวจวันภาพ การประมวลผล ฤดูกาล และอิทธิพลน้ำขึ้นลงร่วมกันก่อนจัดเป็นเหตุการณ์น้ำท่วม</p>':'')+
  '<p class="rpt-lead">วิเคราะห์ '+esc(scopeText)+' '+esc(scope)+' จาก Sentinel-2 และคู่ภาพ Change Detection ที่ผ่านเกณฑ์ข้อมูลในช่วง '+esc(ui.period==='all'?'ทุกวันที่มีข้อมูล':ui.period+' วันย้อนหลัง')+'. ค่าที่เห็นเป็นการเปลี่ยนแปลงการจำแนกน้ำ ไม่ใช่พื้นที่น้ำท่วมยืนยัน</p>'+
  coverage+'<h3>แปลงที่มีพื้นที่น้ำเพิ่มสุทธิสูงสุดในชุดที่ตรวจได้</h3>'+top3+
  '<div class="rpt-pictures rpt-cover-grid">'+coverVisual+'</div>'+
  '<div class="rpt-nextstep"><b>ข้อเสนอเพื่อการตัดสินใจ</b><p>ให้ตรวจสอบคู่ภาพและวิธีคำนวณของ '+esc(priority.map(r=>r.code).join(', ')||'แปลงที่มีข้อมูลครบ')+' ก่อน พร้อมตรวจน้ำขึ้นลง ณ เวลาถ่ายภาพและสภาพพื้นที่จริง ยังไม่อนุมัติการสรุปความเสียหายจากข้อมูลชุดนี้เพียงอย่างเดียว</p></div>'+ 
  '<p class="rpt-disclaimer"><b>ข้อสรุปสำหรับผู้บริหาร:</b> ยังไม่ยืนยันว่าเกิดน้ำท่วมหรือพืชตาย ต้องตรวจวันภาพ น้ำขึ้นลง ฝน และหลักฐานภาคสนามก่อนระบุผลกระทบ</p>');
 const gis=floodPlotLocator(rows);
 section('02 / COVERAGE','ขอบเขตศึกษาและความครอบคลุม',
  '<h3>การกระจายตัวของแปลง</h3>'+gis+coverage+
  '<p class="rpt-caption">จำนวนภาพ Sentinel-2 '+d.all.length+' รายการ · ภาพผ่าน QA '+d.good.length+' รายการ · เปรียบเทียบน้ำได้ '+comparable.length+' แปลง</p>'+
  '<p class="rpt-disclaimer">แผนผังแสดงพิกัดแปลง ไม่ยืนยันพื้นที่ท่วม ระดับน้ำ หรือระดับความเสียหาย</p>');
 const ranked=comparable.slice().sort((a,b)=>(b.water??-Infinity)-(a.water??-Infinity));
 const rankingCols=[['code','แปลง'],['water','Δ น้ำ ไร่'],['pct','% พื้นที่ร่วม'],['before','ภาพก่อนหน้า'],['current','ภาพปัจจุบัน']];
 const rankChunk=ranked.slice(0,14);
 section('03 / EVIDENCE','แปลงที่ควรตรวจสอบก่อน',
  '<p>จัดลำดับตาม <b>พื้นที่น้ำเพิ่มสุทธิที่จำแนกได้</b> ในคู่ภาพล่าสุดที่ผ่านเงื่อนไขของแต่ละแปลง ไม่ใช่อันดับน้ำท่วมจริง และไม่ได้ปรับระยะเวลาหรือน้ำขึ้นลงให้เทียบเท่ากัน</p>'+
  table(rankChunk.map(shortRow),rankingCols)+
  waterChangeBreakdown(ordered[0]?.pair)+'<p class="rpt-caption">ภาพสรุปด้านบนเป็นรายละเอียดของ '+esc(ordered[0]?.code||'แปลงที่มีคู่ภาพ')+' เท่านั้น ไม่ใช่ผลรวมรายจังหวัด</p>'+ 
   '<p class="rpt-caption">แสดง '+rankChunk.length+' / '+comparable.length+' แปลงที่มีคู่ภาพ · สัญญาณน้ำเพิ่ม '+increase.length+' แปลง · ไม่มีคู่ภาพ '+noPair+' แปลง</p>'+
  '<p class="rpt-disclaimer">'+esc(variableWindows?'แต่ละแปลงใช้คู่วันที่ภาพต่างกัน ไม่ควรตีความอันดับนี้ว่าเป็นความรุนแรงที่เปรียบเทียบกันได้':'ต้องตรวจปัจจัยต่าง ๆ ของคู่ภาพก่อนตีความผล')+' · คำว่า “ภาพปัจจุบัน” หมายถึงวันภาพหลังที่ใช้เทียบ ไม่จำเป็นต้องเป็นภาพดาวเทียมใหม่ล่าสุดในคลัง</p>'+ 
  '<p class="rpt-caption"><b>คำอธิบาย:</b> Δ น้ำ = ผลต่างพื้นที่ที่จำแนกเป็นน้ำระหว่างภาพสองวัน; พื้นที่ร่วม = พิกเซลที่นำมาเปรียบเทียบได้ทั้งสองวัน; QA = การตรวจคุณภาพภาพสำหรับการวิเคราะห์ ไม่ใช่ความถูกต้องของการยืนยันน้ำท่วม</p>');
 if(comparable.length>14){
  for(let i=14;i<comparable.length;i+=16)section('03 / EVIDENCE '+(i/16+1),'ตารางหลักฐานเพิ่มเติม',
   table(ranked.slice(i,i+16).map(shortRow),rankingCols)+'<p class="rpt-caption">รายการที่มีคู่ภาพทั้งหมด ไม่ซ่อนแปลงท้ายรายงาน</p>');
 }
 for(let n=0;n<candidates;n++){
  const r=priority[n],c=r.pair,indexMode=['mndwi','ndwi','ndvi'].find(m=>ui.metrics.has(m))||'mndwi';
  const imAfter=d.images.find(x=>x.plot===r.code&&x.date===c.date_b&&imageURL(x,indexMode));
  const rain=(ctx?.environment?.plots?.[r.code]?.scenes||[]).find(x=>x.date===c.date_b);
  const scA=sourceScene(r.code,c.date_a),scB=sourceScene(r.code,c.date_b);
  const before=image(r.code,c.date_a,'true_color'),after=image(r.code,c.date_b,'true_color');
  section('04 / CASE '+(n+1),'กรณีตรวจสอบ '+r.code+' · คู่ภาพจริง',
   '<div class="rpt-kpis rpt-case-kpis">'+metric('น้ำเพิ่มสุทธิ',waterVal(r))+metric('พื้นที่ร่วม',num(r.area)+' ไร่')+
   metric('สัดส่วนต่อพื้นที่ร่วม',percentVal(r))+metric('ภาพก่อนหน้า',c.date_a)+metric('ภาพปัจจุบัน',c.date_b)+'</div>'+
   '<p><b>วันที่ภาพก่อนหน้า:</b> '+esc(c.date_a)+' · <b>วันที่ภาพปัจจุบันที่ใช้เทียบ:</b> '+esc(c.date_b)+' · <b>QA ก่อน/หลัง:</b> '+num(scA?.qa_valid_pct)+'% / '+num(scB?.qa_valid_pct)+'%</p>'+
   '<div class="rpt-pictures rpt-case-compare">'+before+after+'</div>'+
   '<p class="rpt-caption">ก่อน (ซ้าย) เทียบหลัง (ขวา) ตามวันในผล Change Detection • ภาพจาก TIFF ที่ผ่าน QA เท่านั้น</p>'+
   (imAfter?'<div class="rpt-case-index">'+picture(imAfter,indexMode)+'</div>':'<p class="rpt-empty">'+esc(indexMode.toUpperCase())+' วันหลังเหตุการณ์ไม่พร้อมสำหรับแสดงประกอบ</p>')+
   '<p class="rpt-caption">ฝน NASA POWER ก่อนวันหลังภาพ 3 วัน (UTC): '+(rain&&rain.rain_prev_3_utc_days_mm!=null?num(rain.rain_prev_3_utc_days_mm)+' มม.':'ไม่มีข้อมูลที่ตรงวัน')+'</p>'+
   waterChangeBreakdown(c)+floodFinding(r)+
   '<p class="rpt-disclaimer">ยังไม่สรุปว่าเป็นน้ำท่วม และไม่สามารถบอกผลกระทบต่อการรอดของต้นไม้จากภาพสองวันได้ ต้องตรวจน้ำขึ้นลงและพื้นที่จริง</p>');
 }
 for(const visualPage of visualScreeningPages(d,new Set(priority.map(r=>r.code))))section(visualPage.key,visualPage.title,visualPage.body);
  const rainRows=priority.concat(ordered.slice(3,6)).map(r=>{
  const rain=(ctx?.environment?.plots?.[r.code]?.scenes||[]).find(x=>x.date===r.pair.date_b);
  return {plot:r.code,date:r.pair.date_b,rain:rain?.rain_prev_3_utc_days_mm==null?'—':num(rain.rain_prev_3_utc_days_mm),one:rain?.rain_prev_1_utc_day_mm==null?'—':num(rain.rain_prev_1_utc_day_mm),qa:rain?.data_quality||'ไม่ทราบ'};
 });
 section('05 / CONTEXT','ฝน น้ำขึ้นลง และข้อจำกัดเหตุการณ์',
  '<h3>ฝนย้อนหลังอ้างอิงวันที่ภาพหลัง (ถ้ามี)</h3>'+
  table(rainRows,[['plot','แปลง'],['date','วันที่ภาพหลัง'],['one','ฝน 1 วัน มม.'],['rain','ฝน 3 วัน มม.'],['qa','คุณภาพ']])+
  '<h3>การตีความอย่างปลอดภัย</h3><ul class="rpt-findings">'+
  '<li>NASA POWER เป็นข้อมูลฝนประมาณการตามวัน UTC ไม่ใช่สถานีวัดฝนภาคสนาม และไม่ใช้ยืนยันการท่วมเพียงอย่างเดียว</li>'+
  '<li>ยังไม่มีข้อมูลระดับน้ำขึ้นลงที่ผูกเวลาภาพไว้ จึงแยกน้ำทะเลขึ้นกับน้ำท่วมไม่ได้</li>'+
  '<li>คู่ภาพต่างฤดูกาลหรือห่างหลายเดือนอาจทำให้เกิดความต่างที่ไม่ใช่เหตุการณ์น้ำท่วมช่วงสั้น</li>'+
  '<li>ภาพวันที่ผ่าน QA ล่าสุด ('+esc(latest?.date||'—')+') ไม่เท่ากับวันที่หลังในคู่ Change Detection เสมอไป</li></ul>');
 section('06 / ACTION','ข้อเสนอแนะและการตัดสินใจ',
  '<p class="rpt-lead">คำแนะนำนี้เป็นขั้นตอนการตรวจสอบ ไม่ใช่คำรับรองพื้นที่น้ำท่วมหรือประเมินมูลค่าความเสียหาย</p>'+
  '<div class="rpt-actions-list">'+
  '<div><b>1. ตรวจเชิงพื้นที่</b><p>ตรวจคู่ภาพจริงและขอบเขต Geometry สำหรับ '+esc(priority.map(r=>r.code).join(', ')||'แปลงที่ข้อมูลพร้อม')+' ตรวจวันภาพ สัดส่วนพื้นที่ร่วม และค่าที่ผิดปกติ</p></div>'+
  '<div><b>2. ตรวจปัจจัยน้ำ</b><p>ขอเวลาผ่านของ Sentinel-2 เทียบกับระดับน้ำขึ้นลงที่น่าเชื่อถือ และข้อมูลฝน/เหตุการณ์ภาคสนามที่ตรงช่วงเดียวกัน</p></div>'+
  '<div><b>3. ตรวจแปลงภาคสนาม</b><p>หากมีหลักฐานเพิ่ม ให้เลือกจุดสำรวจ ตรวจการท่วมขัง การรอดของต้นไม้ และสภาพพื้นที่ บันทึกภาพพร้อมพิกัดและวันเวลา</p></div>'+
  '<div><b>4. อนุมัติรายงานผลกระทบ</b><p>ยกระดับเป็นผลยืนยันได้เฉพาะเมื่อมีหลักฐานอย่างเป็นอิสระ และผู้ตรวจทานรับรองสมมติฐาน/วิธีคำนวณ</p></div></div>'+
  '<h3>ข้อสรุปที่ยังตอบไม่ได้</h3><p class="rpt-disclaimer">ยังสรุปไม่ได้ว่ามีน้ำท่วมจริงกี่ไร่ เกิดวันใด ทำให้ต้นไม้เสียหายกี่ต้น หรือเกิดมูลค่าความเสียหายเท่าไร</p>');
 const dataGaps=d.pp.filter(p=>!pairs.has(p.code)).map(p=>p.code);
 section('07 / AUDIT','หลักฐาน QA/QC และความพร้อมการตรวจสอบ',
  '<div class="rpt-kpis rpt-flood-kpis">'+metric('แปลงทั้งหมด',rows.length)+metric('แปลงมี Change Pair',comparable.length)+
  metric('วันภาพ QA ผ่าน',d.good.length+'/'+d.all.length)+metric('แปลงยังไม่มีคู่เทียบ',dataGaps.length)+'</div>'+
  '<h3>ประเด็นจำกัดคุณภาพข้อมูล</h3><ul class="rpt-findings">'+issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
  '<h3>ตัวอย่างไฟล์หลักฐานต้นทางของแปลงที่ตรวจสอบก่อน</h3>'+table(priority.map(r=>({plot:r.code,beforeDate:r.pair.date_a,currentDate:r.pair.date_b,before:sourceScene(r.code,r.pair.date_a)?.original_tif10||'—',after:sourceScene(r.code,r.pair.date_b)?.original_tif10||'—'})),[['plot','แปลง'],['beforeDate','ภาพก่อนหน้า'],['currentDate','ภาพปัจจุบัน'],['before','TIFF ก่อน'],['after','TIFF หลัง']])+ 
  '<h3>การตรวจสอบความพร้อมก่อนใช้งาน</h3>'+
  table([{item:'ผลน้ำเปลี่ยนบน Common-clear Area',state:comparable.length?'มีข้อมูลคัดกรอง':'ไม่มีข้อมูล',owner:'ตรวจวิธีคำนวณ'},{
   item:'ภาพ TIFF และวันภาพ QA',state:d.good.length?'พบชุดข้อมูล':'ไม่มี',owner:'ตรวจ scene ID / SCL'},{
   item:'ระดับน้ำขึ้นลงตรงเวลาภาพ',state:'ยังไม่เชื่อมหลักฐาน',owner:'รอข้อมูลก่อนยืนยัน'},{
   item:'ภาคสนามและการตรวจอิสระ',state:'ยังไม่มีหลักฐานในรายงาน',owner:'รอผลสำรวจ'}],
   [['item','หัวข้อ'],['state','สถานะ'],['owner','สิ่งที่ต้องทำ']])+
  '<p class="rpt-disclaimer">สถานะรายงาน: DRAFT / SCREENING ONLY · ไม่ผ่านเกณฑ์ยืนยันผลกระทบด้านน้ำท่วมและต้นไม้ โดยไม่มีหลักฐานเพิ่ม</p>'+
  '<p class="rpt-caption">ที่มา: ขอบเขตโครงการ, Sentinel-2 GeoTIFF, ผล Change Detection ที่ผ่าน AUTO_VALID และข้อมูล NASA POWER เมื่อมี · สร้าง '+esc(dateNow())+'</p>');
  if(geodiff.length||balanceReview.length||dataGaps.length){
   const areaRows=geodiff.map(r=>({plot:r.code,geometry:num(r.plot.area),clear:num(r.area),diff:'+'+num(r.area-Number(r.plot.area))}));
   section('08 / QA REVIEW','รายการตรวจสอบที่ยังไม่ผ่าน QA',
    '<p class="rpt-lead">ต้องตรวจแก้ข้อแตกต่างของพื้นที่ หรืออธิบายวิธีคำนวณก่อนนำผลไปใช้อ้างอิงในเอกสารรับรอง</p>'+
    '<h3>พื้นที่พิกเซลร่วมเกินพื้นที่ Geometry</h3>'+
    table(areaRows,[['plot','แปลง'],['geometry','Geometry (ไร่)'],['clear','พิกเซลร่วม (ไร่)'],['diff','ผลต่าง (ไร่)']])+
    '<p class="rpt-caption">ขนาดพื้นที่อาจต่างจากการ Rasterization / ขอบเขตพิกเซล ไม่ถือว่าค่าใดผิดจนกว่าจะตรวจวิธีคำนวณและ CRS</p>'+
    (balanceReview.length?'<h3>ผลน้ำสุทธิที่ไม่ตรงกับน้ำเพิ่มลบน้ำลด</h3>'+table(balanceReview.map(r=>({plot:r.code,new:num(r.pair.water_new_rai),lost:num(r.pair.water_lost_rai),net:num(r.water)})),[['plot','แปลง'],['new','น้ำเพิ่ม'],['lost','น้ำลด'],['net','สุทธิ']]):'')+
    '<h3>แปลงที่ยังไม่มีคู่ภาพพร้อมเปรียบเทียบ</h3><p>'+esc(dataGaps.length?dataGaps.join(', '):'ทุกแปลงมีคู่ภาพ')+'</p>'+
    '<div class="rpt-disclaimer">Data Quality Gate: ยังไม่พร้อมรับรองผลกระทบ • เปิดรายงานคัดกรองเพื่อชี้เป้าตรวจสอบเพิ่มเติมได้เท่านั้น</div>');
  }
 if(ui.appendix){
  const modes=ui.modules.has('indices')?[...ui.metrics].filter(m=>METRICS[m]).slice(0,3):[];
  const cards=[];
  for(const p of d.pp){
   const imgs=d.images.filter(im=>im.plot===p.code).slice(0,Math.min(4,Math.max(1,Number(ui.imageDates)||2)));
   for(const im of imgs){
    if(imageURL(im,'true_color'))cards.push({im,mode:'true_color'});
    for(const m of modes)if(imageURL(im,m))cards.push({im,mode:m});
   }
  }
  for(let n=0;n<cards.length;n+=4){
   const subset=cards.slice(n,n+4);
   section('A / APPENDIX '+(Math.floor(n/4)+1),'ภาคผนวก Raster Evidence · '+(Math.floor(n/4)+1),
    '<div class="rpt-pictures rpt-flood-appendix">'+subset.map(x=>picture(x.im,x.mode)).join('')+'</div>'+
    table(subset.map(x=>({plot:x.im.plot,date:x.im.date,mode:x.mode.toUpperCase()})),
      [['plot','แปลง'],['date','วันภาพ'],['mode','ดัชนี / ภาพ']])+
    '<p class="rpt-caption">ชุดภาพที่ผู้ใช้ขอแนบเพิ่มเติม • เฉพาะ Raster จริงผ่าน QA พร้อมขอบเขตถ้ามี ไม่ใช้ตีความความรุนแรงแยกจากข้อสรุปหลัก</p>');
  }
 }
 return {out,imageCount:out.reduce((n,p)=>n+(p.body.match(/<figure class="rpt-image"/g)||[]).length,0),
   audit:{scope,plots:rows.length,comparable:comparable.length,increases:increase.length,latestQA:latest?.date||null,
    reviewNeeded:true,changePairCaveats:issues,priority:priority.map(r=>({plot:r.code,net_water_rai:r.water,common_clear_rai:r.area,date_a:r.pair.date_a,date_b:r.pair.date_b}))}};
}

function documentPlan(d){
 if(ui.type==='water')return floodPlan(d);
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
 return '@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e7eee9;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;color:#1b3226}.rpt-paper{position:relative;margin:0 auto 14px;width:210mm;min-height:297mm;padding:16mm 15mm 24mm;background:white;box-shadow:0 4px 22px #12291b29;break-after:page;page-break-after:always;overflow:hidden}.rpt-paper:last-child{break-after:auto;page-break-after:auto}.rpt-pagehead{display:flex;justify-content:space-between;border-bottom:2px solid #256d4b;padding-bottom:9px;font-weight:700;font-size:9px;letter-spacing:1px;color:#256d4b}.rpt-eyebrow{font-size:11px;letter-spacing:1.6px;color:#287a53;margin-top:25px}.rpt-paper h2{font-size:24px;line-height:1.35;margin:9px 0 20px}.rpt-paper h3{font-size:14px;margin:16px 0 7px}.rpt-paper p,.rpt-paper li{font-size:11px;line-height:1.85}.rpt-pagefoot{position:absolute;bottom:14mm;left:15mm;right:15mm;display:flex;justify-content:space-between;color:#618171;border-top:1px solid #d1dfd5;padding-top:7px;font-size:9px}.rpt-kpis{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:13px 0 18px}.rpt-kpi{background:#eef6f0;border-left:3px solid #36855a;padding:12px}.rpt-kpi small{display:block;font-size:10px;color:#607768}.rpt-kpi strong{display:block;font-size:17px;margin-top:3px}.rpt-caption{font-size:10px!important;color:#62796a;margin-top:8px}.rpt-disclaimer{padding:12px 14px;border-left:3px solid #bb8944;background:#fff7e9}.rpt-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}.rpt-table th,.rpt-table td{padding:8px 5px;border-bottom:1px solid #dae5db;text-align:left;overflow-wrap:anywhere}.rpt-table th{background:#edf5ee;font-weight:700}.rpt-image{margin:5px 0 16px}.rpt-image-canvas{display:block;position:relative;isolation:isolate}.rpt-image img{display:block;width:100%;height:auto;max-height:175mm;object-fit:contain;background:#e9eee9}.rpt-image-boundary{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.rpt-density-brief .rpt-image img{max-height:185mm}.rpt-density-technical .rpt-table td{font-size:8px}.rpt-image figcaption{font-size:10px;color:#52705d;margin-top:7px}.rpt-pictures{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rpt-pictures .rpt-image img{max-height:80mm}.rpt-empty{padding:18px;background:#eef4ef;border:1px dashed #b8caba;font-size:11px}.rpt-chart{width:100%;height:auto;max-height:72mm}.rpt-findings{padding-left:18px}.rpt-kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.rpt-kpi{padding:8px}.rpt-kpi strong{font-size:13px;overflow-wrap:anywhere}.rpt-kpi small{font-size:9px}.rpt-lead{font-size:10.5px!important;line-height:1.55!important;margin:0 0 10px}.rpt-pictures.rpt-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm 4mm;align-items:start}.rpt-photo-grid .rpt-image{margin:0;min-width:0}.rpt-photo-grid .rpt-image-canvas{width:100%;height:46mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.rpt-photo-grid .rpt-image img{height:46mm;width:100%;max-height:46mm;object-fit:contain}.rpt-gallery-plot .rpt-image-canvas{height:68mm}.rpt-gallery-plot .rpt-image img{height:68mm;max-height:68mm}.rpt-photo-grid .rpt-image figcaption{font-size:8px;line-height:1.4;margin-top:3px}.rpt-pictures.rpt-cover-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3mm 4mm}.rpt-cover-grid .rpt-image{margin:0}.rpt-cover-grid .rpt-image-canvas{width:100%;height:42mm;display:flex;justify-content:center;align-items:center;overflow:hidden}.rpt-cover-grid .rpt-image img{width:100%;height:42mm;max-height:42mm;object-fit:contain}.rpt-cover-grid .rpt-image figcaption{font-size:8px;line-height:1.25;margin-top:2px}.rpt-gallery-sub{font-size:10px!important;color:#64796d;margin:0 0 7px}.rpt-gallery-evidence{margin-top:7px}.rpt-gallery-evidence>b{display:block;font-size:9px;color:#205e3e;margin-bottom:5px}.rpt-gallery-evidence .rpt-table th,.rpt-gallery-evidence .rpt-table td{padding:4px;font-size:8px}.rpt-paper h2{font-size:21px;margin:8px 0 13px}.rpt-eyebrow{margin-top:16px}.rpt-paper h3{margin:12px 0 5px}.rpt-flood-status{border-left:4px solid #bc653a;background:#fff1e8;padding:10px 12px;margin:8px 0 12px;font-size:12px;line-height:1.5}.rpt-flood-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.rpt-flood-kpis .rpt-kpi{min-width:0;padding:9px 7px}.rpt-flood-kpis .rpt-kpi strong{font-size:12px;overflow-wrap:anywhere}.rpt-flood-kpis .rpt-kpi small{font-size:8px}.rpt-case-kpis{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.rpt-case-kpis .rpt-kpi{padding:8px 6px}.rpt-case-kpis .rpt-kpi strong{font-size:12px}.rpt-case-compare{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rpt-case-compare .rpt-image{margin:2px 0 4px}.rpt-case-compare .rpt-image-canvas{height:68mm;width:100%;display:flex;align-items:center;justify-content:center}.rpt-case-compare .rpt-image img{height:68mm;max-height:68mm;width:100%;object-fit:contain}.rpt-case-compare .rpt-image figcaption{font-size:9px;line-height:1.5}.rpt-case-index{max-width:70%;margin:5px auto 0}.rpt-case-index .rpt-image-canvas{height:45mm;display:flex;align-items:center;justify-content:center}.rpt-case-index .rpt-image img{height:45mm;max-height:45mm;width:100%;object-fit:contain}.rpt-case-index .rpt-image{margin:3px 0}.rpt-case-index figcaption{font-size:9px}.rpt-gis-overview{display:block;width:100%;max-height:94mm;margin:8px auto 5px}.rpt-actions-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rpt-actions-list>div{background:#edf5ef;border-left:3px solid #2a7550;padding:9px 11px}.rpt-actions-list b{color:#1b6040;font-size:11px}.rpt-actions-list p{font-size:10px;line-height:1.7;margin:4px 0}.rpt-flood-appendix{display:grid;grid-template-columns:1fr 1fr;gap:7mm}.rpt-flood-appendix .rpt-image{margin:0}.rpt-flood-appendix .rpt-image-canvas{height:74mm;display:flex;justify-content:center;align-items:center}.rpt-flood-appendix .rpt-image img{width:100%;height:74mm;max-height:74mm;object-fit:contain}.rpt-flood-appendix .rpt-image figcaption{font-size:8px;line-height:1.45}.rpt-paper .rpt-findings li{line-height:1.6;margin-bottom:3px}.rpt-paper .rpt-table td{vertical-align:top}.rpt-water-breakdown{background:#f0f7f4;border:1px solid #d3e5da;border-radius:7px;padding:8px 10px;margin:9px 0}.rpt-water-breakdown h3{margin:0 0 5px;font-size:11px}.rpt-water-row{display:grid;grid-template-columns:110px 1fr 82px;align-items:center;gap:7px;font-size:10px;margin:5px 0}.rpt-water-row b{font-size:10px;text-align:right}.rpt-water-bar{height:9px;background:#dbe5e0;border-radius:3px;overflow:hidden}.rpt-water-bar>div{height:100%}.rpt-water-gain{background:#328ac0}.rpt-water-loss{background:#bd8460}.rpt-water-net{font-size:10px!important;line-height:1.4!important;text-align:right;margin:4px 0}.rpt-water-breakdown .rpt-caption{line-height:1.45!important;margin:2px 0}.rpt-finding{background:#f7faf7;border-left:3px solid #2b7b58;padding:7px 10px;margin:8px 0}.rpt-finding h3{font-size:10px;margin:0 0 3px}.rpt-finding ul{margin:2px 0;padding-left:16px}.rpt-finding li{font-size:9px;line-height:1.5;margin:2px 0}.rpt-cross-scene{padding:8px 10px;border:1px solid #c58d64;background:#fff6eb;border-radius:5px;font-size:10px!important;line-height:1.6!important}.rpt-nextstep{border:1px solid #b8d4bd;background:#e9f5ea;padding:10px 13px;margin-top:8px}.rpt-nextstep b{font-size:11px;color:#1c5e3d}.rpt-nextstep p{margin:3px 0;font-size:10px;line-height:1.55}.rpt-gis-map{width:100%}.rpt-gis-overview{display:block;margin:0 auto;width:100%;max-height:112mm}.rpt-locator-key{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 7px;margin:4px 0}.rpt-locator-key>div{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rpt-locator-key small{font-size:8px;color:#71847b}.rpt-locator-key b{font-size:10px}.rpt-photo-grid .rpt-caption{font-size:9px!important}.rpt-paper h2{letter-spacing:-.25px}.rpt-paper .rpt-pagehead{font-size:10px}.rpt-paper .rpt-pagefoot{font-size:9.5px}.rpt-visual-pair{border:1px solid #b8d4c2;border-radius:7px;background:#f8fbf9;padding:11px;margin:10px 0}.rpt-visual-duo{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}.rpt-visual-date{min-width:0}.rpt-visual-date>b{display:block;font-size:10px;color:#1d6745;margin:0 0 5px}.rpt-visual-date>small{display:block;font-size:9px;line-height:1.55;color:#4e6758;margin:4px 0}.rpt-visual-date .rpt-image{margin:0}.rpt-visual-date .rpt-image-canvas{width:100%;height:82mm;display:flex;align-items:center;justify-content:center}.rpt-visual-date .rpt-image img{height:82mm;width:100%;max-height:82mm;object-fit:contain}.rpt-visual-date .rpt-image figcaption{font-size:8px;line-height:1.45}.rpt-visual-current-canvas{position:relative}.rpt-visual-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.rpt-visual-result{background:#e8f4e9;border-left:3px solid #48935e;color:#215f3d;padding:6px 8px;font-size:10px!important;line-height:1.6!important;margin:10px 0 4px}.rpt-visual-pair .rpt-caption{font-size:9px!important;line-height:1.5!important}.rpt-visual-qa{font-size:11px;border-left:3px solid #b88b4b;background:#fff7e8;padding:8px;margin:8px 0}.rpt-visual-current-canvas>.rpt-image-boundary{pointer-events:none}@media print{body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}.rpt-paper{box-shadow:none;margin:0;width:210mm;height:296mm;min-height:296mm;break-inside:avoid;page-break-inside:avoid}}';
}
function renderPages(output='full'){
 const d=evidence(),plan=documentPlan(d),items=plan.out.filter(item=>output==='main'?!item.key.startsWith('A / APPENDIX'):output==='appendix'?item.key.startsWith('A / APPENDIX'):true),total=items.length;
 const pages=items.map((item,i)=>'<article class="rpt-paper" data-report-page="'+esc(item.key)+'"><header class="rpt-pagehead"><span>MANGROVE MONITORING CENTER</span><span>ENVIRONMENTAL MONITORING · DRAFT</span></header>'+
 '<div class="rpt-eyebrow">'+esc(item.key)+'</div><h2>'+esc(item.title)+'</h2>'+item.body+
 '<footer class="rpt-pagefoot"><span>'+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'ALL PLOTS')+' · '+esc(dateNow())+'</span><span>'+String(i+1)+' / '+total+'</span></footer></article>').join('');
 return {pages,d,total,imageCount:items.reduce((n,p)=>n+(p.body.match(/<figure class="rpt-image"/g)||[]).length,0),audit:plan.audit||null};
}

async function markVisualChanges(root){
 const sources=[...root.querySelectorAll('.rpt-visual-pair[data-visual-scan="eligible"]')];
 for(const region of sources){
  const photos=[...region.querySelectorAll('.rpt-visual-duo .rpt-image img')];
  const overlay=region.querySelector('.rpt-visual-overlay'),caption=region.querySelector('.rpt-visual-result');
  if(photos.length!==2||!overlay||!caption)continue;
  try{
   await Promise.all(photos.map(img=>img.complete&&img.naturalWidth?Promise.resolve():
    new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,3000);})));
   if(photos.some(img=>!img.naturalWidth||!img.naturalHeight)){caption.textContent='ภาพต้นทางโหลดไม่ครบ จึงไม่วงพื้นที่อัตโนมัติ';continue;}
   const count=96,size=12,read=img=>{
    const c=root.createElement?root.createElement('canvas'):document.createElement('canvas');
    c.width=c.height=count;
    const g=c.getContext('2d',{willReadFrequently:true});if(!g)return null;
    g.clearRect(0,0,count,count);g.drawImage(img,0,0,count,count);
    return g.getImageData(0,0,count,count).data;
   };
   const a=read(photos[0]),b=read(photos[1]);
   if(!a||!b){caption.textContent='เครื่องไม่รองรับการอ่านสีภาพสำหรับวงจุดสังเกต';continue;}
   const cells=[],w=count/size,h=count/size;
   let changedAll=0,validAll=0;
   for(let gy=0;gy<size;gy++)for(let gx=0;gx<size;gx++){
    let valid=0,changed=0,magnitude=0;
    for(let y=gy*h;y<(gy+1)*h;y++)for(let x=gx*w;x<(gx+1)*w;x++){
     const p=(y*count+x)*4,ar=a[p],ag=a[p+1],ab=a[p+2],br=b[p],bg=b[p+1],bb=b[p+2];
     if(a[p+3]<180||b[p+3]<180)continue;
     if((ar>246&&ag>246&&ab>246)||(br>246&&bg>246&&bb>246))continue;
     const diff=(Math.abs(ar-br)+Math.abs(ag-bg)+Math.abs(ab-bb))/3;valid++;validAll++;
     if(diff>45){changed++;changedAll++;magnitude+=diff;}
    }
    const ratio=valid?changed/valid:0;
    if(valid>=28&&ratio>=.26)cells.push({gx,gy,ratio,score:ratio*(magnitude/Math.max(1,changed))});
   }
   const area=validAll?changedAll/validAll:0;
   if(validAll<count*count*.24){caption.textContent='พิกเซลที่อ่านเทียบได้มีน้อย อาจมีเมฆ/NoData — ไม่วงอัตโนมัติ';continue;}
   if(area>.68){caption.textContent='ภาพสีเปลี่ยนกว้างมากทั้งภาพ อาจเกิดจากเมฆหรือการเรนเดอร์ — ไม่ระบุจุดเปลี่ยนแปลงโดยอัตโนมัติ';continue;}
   if(area<.015||!cells.length){caption.textContent='ยังไม่พบความต่างของสีดัชนีที่เด่นพอจะวงอัตโนมัติ สามารถดูคู่ภาพเปรียบเทียบด้วยตาได้';continue;}
   cells.sort((a,b)=>b.score-a.score);
   const hits=[];
   for(const cand of cells){
    const cx=(cand.gx+.5)*1000/size,cy=(cand.gy+.5)*1000/size;
    if(hits.some(p=>Math.hypot(p.cx-cx,p.cy-cy)<205))continue;
    hits.push({cx,cy});
    if(hits.length===3)break;
   }
   overlay.innerHTML=hits.map((p,i)=>'<circle cx="'+p.cx.toFixed(1)+'" cy="'+p.cy.toFixed(1)+'" r="93" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="13 9"/>'+
    '<circle cx="'+p.cx.toFixed(1)+'" cy="'+p.cy.toFixed(1)+'" r="93" fill="none" stroke="#ef8a1b" stroke-width="7" stroke-dasharray="13 9"/>'+
    '<circle cx="'+(p.cx+72).toFixed(1)+'" cy="'+(p.cy-72).toFixed(1)+'" r="24" fill="#ef8a1b" stroke="white" stroke-width="3"/>'+
    '<text x="'+(p.cx+72).toFixed(1)+'" y="'+(p.cy-63).toFixed(1)+'" text-anchor="middle" fill="#fff" font-size="25" font-weight="700">'+(i+1)+'</text>').join('');
   caption.textContent='วงจุดสังเกตเบื้องต้น '+hits.length+' จุด จากความต่างของสีภาพดัชนีสองวัน (ไม่ใช่ขอบเขตน้ำท่วมหรือผลวัดพื้นที่)';
  }catch(e){caption.textContent='ไม่สามารถประมวลผลการเปรียบเทียบสีภาพได้ จึงไม่วงจุดโดยคาดเดา';}
 }
}

function fitImageBoundaries(doc){
 const frames=[...doc.querySelectorAll('.rpt-image-canvas')];
 for(const frame of frames){
  const img=frame.querySelector('img'),shapes=[...frame.querySelectorAll('.rpt-image-boundary,.rpt-visual-overlay')];
  if(!img||!shapes.length)continue;
  const adjust=()=>{
   const iw=img.clientWidth,ih=img.clientHeight,nw=img.naturalWidth,nh=img.naturalHeight;
   if(!iw||!ih||!nw||!nh){shapes.forEach(svg=>svg.style.visibility='hidden');return;}
   const scale=Math.min(iw/nw,ih/nh),w=nw*scale,h=nh*scale;
   for(const svg of shapes){svg.style.left=((iw-w)/2)+'px';svg.style.top=((ih-h)/2)+'px';
   svg.style.width=w+'px';svg.style.height=h+'px';svg.style.visibility='visible';}
  };
  img.addEventListener('load',adjust,{once:true});
  adjust();
 }
}
function updatePreview(){
 const el=$('rpt-preview');if(!el)return;
 const report=renderPages();
 const auditPanel=$('rpt-readiness');if(auditPanel){const a=report.audit;auditPanel.innerHTML=a?'<strong>ผลประเมินเอกสาร: รายงานคัดกรองเท่านั้น</strong><p>มีคู่ภาพสำหรับวิเคราะห์ '+a.comparable+' / '+a.plots+' แปลง · พบสัญญาณน้ำเพิ่ม '+a.increases+' แปลง · ยังต้องตรวจน้ำขึ้นลงและภาคสนามก่อนสรุปน้ำท่วม</p>':'<strong>Report QA:</strong> ตรวจวันภาพและแหล่งข้อมูลก่อนใช้';}
 const previewCount=Math.min(8,report.total),previewPages=report.pages.split('</article>').slice(0,previewCount).map(x=>x+'</article>').join('');
 el.innerHTML='<style>'+paperStyle().replace('body{margin:0;background:#e7eee9;font-family:"IBM Plex Sans Thai",Tahoma,sans-serif;color:#1b3226}','')+'</style><div class="rpt-papers">'+previewPages+'</div>'+(report.total>previewCount?'<p class="rpt-preview-more">แสดงตัวอย่าง '+previewCount+' จาก '+report.total+' หน้า · PDF ฉบับเต็มจะรวมครบทุกหน้า (ภาพ '+report.imageCount+' ภาพ)</p>':'');
 fitImageBoundaries(el);
 void markVisualChanges(el);
 const summary=$('rpt-source-summary');
 if(summary)summary.innerHTML='<b>ข้อมูลจริง:</b> '+report.d.pp.length+' แปลง · '+report.d.all.length+' วันภาพ · ผ่าน QA '+report.d.good.length+' วัน · Raster Preview '+report.d.images.length+' ฉาก · ในรายงาน '+report.imageCount+' ภาพ / '+report.total+' หน้า';
 const note=$('rpt-warning-list');if(note)note.innerHTML=report.d.cautions.map(x=>'<p>• '+esc(x)+'</p>').join('');
}
function printPDF(output='main'){
 const report=renderPages(output);
 if(!report.total){alert('ยังไม่มีภาพภาคผนวกที่ผ่าน QA สำหรับพิมพ์แยก');return;}
 const popup=window.open('','_blank');
 if(!popup){alert('เบราว์เซอร์บล็อกหน้าต่าง กรุณาอนุญาต Pop-ups แล้วลองอีกครั้ง');return;}
 const printScript=String.raw`window.addEventListener('load',async function(){
  const images=Array.from(document.images);
  await Promise.all(images.map(im=>im.complete?Promise.resolve():new Promise(resolve=>{im.onload=resolve;im.onerror=resolve})));
  document.querySelectorAll('.rpt-image-canvas').forEach(frame=>{
   const im=frame.querySelector('img'),shapes=frame.querySelectorAll('.rpt-image-boundary,.rpt-visual-overlay');
   if(!im||!im.naturalWidth)return;
   const iw=im.clientWidth,ih=im.clientHeight,scale=Math.min(iw/im.naturalWidth,ih/im.naturalHeight),w=im.naturalWidth*scale,h=im.naturalHeight*scale;
   shapes.forEach(svg=>{svg.style.left=(iw-w)/2+'px';svg.style.top=(ih-h)/2+'px';svg.style.width=w+'px';svg.style.height=h+'px'});
  });
  await (VISUAL_FUNCTION)(document);
  setTimeout(()=>window.print(),350);
 });`.replace('(VISUAL_FUNCTION)','('+markVisualChanges.toString()+')');
 popup.document.open();
 popup.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>MMC '+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'Nationwide')+' '+(output==='appendix'?'Evidence Appendix':'Decision Report')+'</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"><style>'+paperStyle()+'</style></head><body>'+report.pages+
 '<script>'+printScript+'<\/script></body></html>');
 popup.document.close();
}
function exportBlueprint(){
 const ev=evidence(),data={schema:'MMC_REPORT_BLUEPRINT_V1',interpreter:'LOCAL_RULE_BASED_NOT_LLM',created_at:new Date().toISOString(),request:ui.text,
 settings:{type:ui.type,scope:ui.scope,plot:ui.scope==='plot'?ui.plot:null,province:ui.scope==='province'?ui.province:null,period:ui.period,density:ui.density,image_dates_per_plot:ui.imageDates,include_full_appendix:ui.appendix,metrics:[...ui.metrics],modules:[...ui.modules]},
 evidence:{source_generated_at:ctx.generated_at||null,imagery_manifest_version:ctx.imagery?.version||null,plot_codes:ev.pp.map(x=>x.code),scene_count:ev.all.length,qa_valid_scene_count:ev.good.length},decision_review:ui.type==='water'?floodPlan(ev).audit:null,warnings:ev.cautions};
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
 '<label class="rpt-appendix-toggle"><input type="checkbox" id="rpt-appendix"'+(ui.appendix?' checked':'')+'> แนบภาพทุกแปลงเป็นภาคผนวก (รายงานจะยาวขึ้น)</label>'+ 
 '<div id="rpt-readiness" class="rpt-readiness" aria-live="polite"></div>'+
 '<div id="rpt-flood-guidance" class="rpt-flood-guidance" hidden>รายงานตรวจน้ำท่วมต้องมีหน้าสรุป หลักฐาน ข้อจำกัด และ Audit ครบ จึงไม่เปิดให้ตัดหน้าบังคับออก ภาคผนวกภาพเป็นตัวเลือกแยกต่างหาก</div>'+ 
 '<div class="rpt-checkbox-grid"><fieldset id="rpt-module-picker"><legend>เลือกหน้ารายงาน</legend>'+Object.entries(MODULES).map(([k,v])=>'<label><input type="checkbox" data-rpt-module="'+k+'"'+(ui.modules.has(k)?' checked':'')+'> '+esc(v)+'</label>').join('')+'</fieldset>'+
 '<fieldset><legend id="rpt-index-legend">ดัชนีที่ต้องการ</legend>'+Object.entries(METRICS).map(([k,v])=>'<label><input type="checkbox" data-rpt-metric="'+k+'"'+(ui.metrics.has(k)?' checked':'')+'> '+esc(v)+'</label>').join('')+'</fieldset></div>'+
 '<div class="rpt-buttons"><button type="button" class="btn primary" id="rpt-preview-button">สร้างตัวอย่างรายงาน</button><button type="button" class="btn" id="rpt-print">รายงานหลัก PDF · A4</button><button type="button" class="btn" id="rpt-print-appendix"'+(!ui.appendix||ui.type!=='water'?' hidden':'')+'>ภาคผนวก PDF แยกไฟล์</button><button type="button" class="btn" id="rpt-blueprint-export">ส่งออก Blueprint JSON</button></div>'+
 '<div id="rpt-source-summary" class="rpt-source-summary"></div><div id="rpt-warning-list" class="rpt-warning-list"></div>'+
 '<details class="rpt-preview-toggle" open><summary>ดูตัวอย่างรายงานจริง · A4 แนวตั้ง</summary><div id="rpt-preview"></div></details></section>';
 syncForm();updatePreview();
 container.oninput=e=>{if(e.target.id==='rpt-text')ui.text=e.target.value;};
 container.onchange=e=>{
  const id=e.target.id,fields={'rpt-type':'type','rpt-scope':'scope','rpt-plot':'plot','rpt-province':'province','rpt-period':'period','rpt-density':'density','rpt-image-dates':'imageDates'};
  if(fields[id]){ui[fields[id]]=e.target.value;if(id==='rpt-type')ui.modules=new Set(DEFAULT[ui.type]);if(id==='rpt-scope'){ui.imageDates=ui.scope==='all'?'1':ui.scope==='province'?'2':'3';if(ui.scope!=='plot')ui.modules.add('location');if(ui.scope==='province'&&!provinceList().includes(ui.province))ui.province=plotList().find(p=>p.code===ui.plot)?.province||provinceList()[0]||'ALL';}}
  if(id==='rpt-appendix')ui.appendix=Boolean(e.target.checked);
   if(e.target.dataset.rptModule){if(e.target.checked)ui.modules.add(e.target.dataset.rptModule);else ui.modules.delete(e.target.dataset.rptModule);}
  if(e.target.dataset.rptMetric){if(e.target.checked)ui.metrics.add(e.target.dataset.rptMetric);else ui.metrics.delete(e.target.dataset.rptMetric);}
  if(id==='rpt-type'||id==='rpt-scope'||id==='rpt-appendix')syncForm();showBlueprint();if(id==='rpt-type'||id==='rpt-scope'||id==='rpt-appendix')updatePreview();
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
   ui.modules=val.modules;ui.metrics=val.metrics;ui.appendix=val.appendix;ui.notice=val.notice;syncForm();updatePreview();return;
  }
  if(b.id==='rpt-preview-button'){updatePreview();$('rpt-preview')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(b.id==='rpt-print'){printPDF('main');return;}
   if(b.id==='rpt-print-appendix'){printPDF('appendix');return;}
  if(b.id==='rpt-blueprint-export'){exportBlueprint();return;}
 };
}
function showBlueprint(){
 const elem=$('rpt-blueprint');if(!elem)return;
 elem.innerHTML='<b>Report Blueprint:</b> '+esc(TYPE[ui.type])+' · '+esc(ui.scope==='plot'?ui.plot:ui.scope==='province'?ui.province:'ทุกแปลง')+' · '+esc(ui.period==='all'?'ทุกวันภาพ':ui.period+' วัน')+
 ' · A4 แนวตั้ง · '+(ui.type==='water'?'Decision Brief':'Atlas / Report')+' · '+(ui.appendix?'พร้อมภาคผนวกภาพ':'เฉพาะเนื้อหาหลัก')+' · '+ui.modules.size+' ส่วนประกอบ <span>'+ui.notice.map(x=>esc(x)).join(' • ')+'</span>';
}
function syncForm(){
 for(const [id,value] of [['rpt-type',ui.type],['rpt-scope',ui.scope],['rpt-plot',ui.plot],['rpt-province',ui.province],['rpt-period',ui.period],['rpt-density',ui.density],['rpt-image-dates',ui.imageDates]]){
  const el=$(id);if(el)el.value=value;
 }
 if($('rpt-appendix'))$('rpt-appendix').checked=Boolean(ui.appendix);
 document.querySelectorAll('[data-rpt-scope-switch]').forEach(x=>{const on=x.dataset.rptScopeSwitch===ui.scope;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on));});
 if($('rpt-module-picker'))$('rpt-module-picker').hidden=ui.type==='water';
 if($('rpt-flood-guidance'))$('rpt-flood-guidance').hidden=ui.type!=='water';
 if($('rpt-index-legend'))$('rpt-index-legend').textContent=ui.type==='water'?'ดัชนีภาพประกอบและภาคผนวก':'ดัชนีที่ต้องการ';
 if($('rpt-appendix'))$('rpt-appendix').closest('label').hidden=ui.type!=='water';
 if($('rpt-print-appendix'))$('rpt-print-appendix').hidden=!(ui.type==='water'&&ui.appendix);
 if($('rpt-image-dates'))$('rpt-image-dates').closest('label').hidden=ui.type==='water'&&!ui.appendix;
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