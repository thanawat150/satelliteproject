/* MMC Georeferenced Imagery Explorer
   Uses only original GeoTIFF-derived RGB / index rasters.
   No rendered placeholders pretending to be satellite pixels. */
(function(){
'use strict';
const MODE={
 true_color:['สีจริง · RGB 4–3–2','Sentinel-2 10 m · B4 Red / B3 Green / B2 Blue'],
 false_color:['สีเท็จ · NIR–R–G','Sentinel-2 10 m · B8 NIR / B4 Red / B3 Green'],
 ndvi:['NDVI · พืช','(B8−B4)/(B8+B4)'],
 ndre:['NDRE · Red Edge','(B8A−B5)/(B8A+B5)'],
 ndmi:['NDMI (B8A) · ความชื้นพืช','(B8A−B11)/(B8A+B11) • ใช้ B8A ตาม TIFF'],
 mndwi:['MNDWI · น้ำ','(B3−B11)/(B3+B11)'],
 bsi:['BSI · ดินเปิดโล่ง','((B11+B4)−(B8+B2))/((B11+B4)+(B8+B2))'],
 ndwi:['NDWI · น้ำผิวดิน','(B3−B8)/(B3+B8) • ติดลบในป่าเป็นปกติ']
};
let index=null,files=new Map(),epoch=0,map=null,boundaryMapLayer=null,boundaryResizeObserver=null;
let active={plot:'13-STC',date:'',before:'',beforeManual:false,mode:'true_color',layout:'single',historyMode:'all',alpha:.85,geometry:null,rows:[],holder:null,existing:[],boundaryVisible:true,boundaryType:'PDD'};
const $=(id)=>document.getElementById(id);
const metricFmt=x=>x==null||x===''||!Number.isFinite(Number(x))?'—':Number(x).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,()=>String.fromCharCode(38)+'quot;').replace(/'/g,'&#39;');
function dateRows(){return active.existing.filter(x=>x.plot===active.plot)}
function qa(date){let r=active.rows.find(x=>x.date===date);if(!r)return {label:'QA ยังไม่ประมวลผล',kind:'noanalysis',percent:null};return {label:r.analysis_status||'ไม่ระบุ',kind:r.analysis_status||'unknown',percent:r.qa_valid_pct};}
const modeOptions=(m)=>Object.entries(MODE).map(([k,v])=>'<option value="'+k+'" '+(k===m?'selected':'')+'>'+esc(v[0])+'</option>').join('');
const historyOptions=(m)=>'<option value="all" '+(m==='all'?'selected':'')+'>แสดงทั้งหมด (8 ชนิด)</option>'+modeOptions(m);
function available(item){return item?.modes||[]}
function srcOK(x){return typeof x==='string'&&(/^data:image\/(?:png|jpeg|webp);base64,/i.test(x)||/^\.\/imagery\/[a-z0-9_()\/.\-]+(?:\?v=[a-z0-9_.\-]+)?$/i.test(x));}
function previewSrc(row){return srcOK(row?.src)?row.src:null}
async function getIndex(){if(index)return index;let r=await fetch('imagery_manifest.json?v=20261010-archive466-v1',{cache:'no-store'});if(!r.ok)throw Error('Imagery manifest HTTP '+r.status);index=await r.json();return index;}
async function getProduct(item){if(!item||item.source==='missing')return null;if(item.source==='generated'){return {layers:Object.entries(item.assets||{}).map(([mode,u])=>({plot:item.plot,date:item.date,mode,src:u+((mode==='true_color'||mode==='false_color')&&item.rgb_renderer_version?'?v='+encodeURIComponent(item.rgb_renderer_version):item.index_renderer_version?'?v='+encodeURIComponent(item.index_renderer_version):item.rgb_renderer_version?'?v='+encodeURIComponent(item.rgb_renderer_version):''),bounds:item.mode_bounds?.[mode]||item.bounds,resolution_m:mode==='true_color'||mode==='false_color'?10:20}))};}
const key='part-'+item.part;
if(!files.has(key)){const url='../data/full_preview_part_'+item.part+'.json';
 files.set(key,fetch(url).then(response=>{if(!response.ok)throw Error('Image product HTTP '+response.status);return response.json();}).catch(err=>{files.delete(key);throw err;}));
}
return files.get(key);}
function imageryItems(){const orig=(index?.items||[]).filter(x=>x.plot===active.plot);const extra=(index?.generated_items||[]).filter(x=>x.plot===active.plot);const map=new Map();for(const x of [...orig,...extra]){let k=x.date;const old=map.get(k);if(!old)map.set(k,x);else if(x.source==='generated'){// generated preview can supply modes not available in older preview
 map.set(k,{...x,fallback:old});}}
for(const row of active.rows){if(row.date&&!map.has(row.date))map.set(row.date,{plot:active.plot,date:row.date,source:'missing',modes:[]});}
return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function latestAvailableImage(items){return [...items].reverse().find(x=>x.source!=='missing'&&qa(x.date).kind==='AUTO_VALID');}
function dateChoices(items,selected){return items.map(x=>'<option value="'+esc(x.date)+'" '+(selected===x.date?'selected':'')+'>'+esc(x.date)+(x.source==='missing'?' · ไม่มี Raster Preview':x.source==='generated'?' · Rendered Raster':' · Raster Preview')+' · '+qa(x.date).label+'</option>').join('');}
function rastersFor(item,product){if(!item)return {};const rasters={};for(const x of product?.layers||[]){if(x.plot!==item.plot||x.date!==item.date)continue;if(available(item).includes(x.mode)&&previewSrc(x))rasters[x.mode]=x;}
return rasters;}
function localBounds(image,item){let b=image?.bounds||item?.bounds;return Array.isArray(b)&&b.length===2&&b[0].length===2&&b[1].length===2?b:null;}
function showError(s){if(!active.holder)return;active.holder.innerHTML='<div class="notice">ไม่สามารถโหลดภาพจริง: '+esc(s)+'</div>';}
function indexStatBrief(item,mode){
 if(!['ndvi','ndre','ndmi','mndwi','ndwi','bsi'].includes(mode))return '';
 const st=item?.index_stats?.[mode],v=item?.index_parity?.[mode];
 if(!st)return '<div class="img-index-brief">'+(item?.preview_kind==='VISUAL_ONLY_NON_QA'?'ภาพดัชนีจาก TIFF ต้นฉบับ • <b>ไม่ผ่าน QA</b> ไม่ใช้คำนวณผลกระทบ':'รอผลตรวจดัชนีจาก TIFF รายพิกเซล')+'</div>';
 const fmt=metricFmt;
 return '<div class="img-index-brief" data-index-stat="'+esc(mode)+'"><b>เฉลี่ยในขอบเขต '+fmt(st.plot_mean)+'</b> · ต่ำสุด '+fmt(st.plot_min)+' · สูงสุด '+fmt(st.plot_max)+' · '+esc(st.sample_pixels)+' พิกเซล (20 ม.)'+
 (v?'<div>รายงานเดิม '+fmt(v.published_mean)+' · ส่วนต่าง '+fmt(v.difference)+' '+(v.within_0_03?'✓ ตรงกัน':'⚠ ตรวจเพิ่ม')+'</div>':'')+
 (st.source_band_rmse!=null?'<div>ตรวจ Index Band ใน TIFF · RMSE '+fmt(st.source_band_rmse)+'</div>':'')+'</div>';
}
function indexAuditTable(item){
 if(item?.source!=='generated'||!item.index_stats||!Object.keys(item.index_stats).length)return '<div class="notice img-missing">ไม่มีผลดัชนีสำหรับภาพนี้ • วันที่ไม่ผ่าน QA แสดงเฉพาะภาพสีจริงและสีเท็จจากต้นฉบับ ไม่ใช้คำนวณการเปลี่ยนแปลง</div>';
 const modes=['ndvi','ndre','ndmi','ndwi','mndwi','bsi'];
 const fmt=metricFmt;
 const rows=modes.map(m=>{
  const st=item.index_stats[m],v=item.index_parity?.[m];if(!st)return '';
  return '<tr><td><b>'+esc(m.toUpperCase())+'</b></td><td>'+esc(st.formula)+'</td><td class="num">'+fmt(st.plot_mean)+'</td><td class="num">'+fmt(v?.published_mean)+'</td><td class="num">'+fmt(v?.difference)+'</td><td>'+esc(st.sample_pixels)+' px</td><td>'+(v?.within_0_03===false||st.embedded_tif_match===false?'⚠ ตรวจเพิ่ม':'✓ สอดคล้อง')+'</td></tr>';
 }).join('');
 return '<section class="img-index-audit" id="index-value-audit"><h3>ตรวจค่าดัชนีจาก TIFF · '+esc(item.plot)+' · '+esc(item.date)+'</h3>'+
 '<p class="muted tiny">ค่าเฉลี่ยคำนวณเฉพาะพิกเซลผ่าน SCL ภายใน Polygon บนกริด 20 เมตร • รายงานเดิมอาจใช้ขอบแปลง/NoData ต่างกันเล็กน้อย</p>'+
 '<div class="table-wrap"><table class="tbl"><thead><tr><th>ดัชนี</th><th>สูตรต้นฉบับ</th><th>เฉลี่ยตรวจใหม่</th><th>รายงานเดิม</th><th>ผลต่าง</th><th>พิกเซล</th><th>ตรวจ</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="muted tiny">NDMI ใช้ B8A/B11 ตามไฟล์ TIFF ไม่ใช่ NDMI รุ่น B8/B11 • NDWI ติดลบในพื้นที่ป่าพบได้ทั่วไป • MNDWI/BSI ไม่ใช่ข้อสรุปน้ำท่วมหรือการเสื่อมสภาพ</p></section>';
}
function legend(item,mode){
 if(mode==='true_color'||mode==='false_color'||mode==='generic_preview')return '';
 if(item?.source!=='generated')return '<div class="img-legend-note">ภาพดัชนีเก่า: ยังไม่ตรวจยืนยันสูตรและช่วงสีในไฟล์เดิม</div>';
 const water=mode==='mndwi'||mode==='ndwi',soil=mode==='bsi';
 // Color stops match the exact -1..+1 piecewise lookup in colorize().
 const grad=water?'linear-gradient(90deg,#9d5c35 0%,#e4bc67 40%,#eae0bd 50%,#6fc2c4 57.5%,#2880bb 72.5%,#0e2e75 100%)':soil?
 'linear-gradient(90deg,#1e664b 0%,#519c53 32.5%,#e0cd80 50%,#b97e4d 65%,#763d25 100%)':
 'linear-gradient(90deg,#844934 0%,#c27a46 35%,#f5dc80 50%,#9bc460 65%,#2d8655 82.5%,#074935 100%)';
 return '<div class="img-legend" data-index-legend="'+esc(mode)+'"><div class="img-legend-head">'+esc(mode.toUpperCase())+' • สีและสเกลที่ใช้จริง −1.00 ถึง +1.00</div>'+
 '<div class="img-legend-ramp" style="background:'+grad+'"></div>'+
 '<div class="img-legend-ticks"><span>−1.00</span><span>−0.50</span><span>0.00</span><span>+0.50</span><span>+1.00</span></div>'+
 '<small>สูตร: '+esc(MODE[mode]?.[1]||'')+'</small>'+
 indexStatBrief(item,mode)+
 '<div class="img-legend-note">ค่าเฉลี่ยเฉพาะภายใน PDD ส่วนภาพแสดง Raster เต็มกรอบ; สีไม่ได้แปลว่าเป็นน้ำท่วมหรือป่าเสื่อม</div></div>';
}
/* Georeferenced boundary overlay for every raster thumbnail.
   Match Leaflet's EPSG:3857 image bounds and the bitmap's object-fit:contain rectangle.
   Respect Polygon/MultiPolygon rings including holes. Never infer missing geometries. */
function mercatorY(lat){
 const r=Math.max(-85.05112878,Math.min(85.05112878,Number(lat)))*Math.PI/180;
 return Math.log(Math.tan(Math.PI/4+r/2));
}
function boundaryPath(bounds){
 const geometry=active.geometry;
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type)||!Array.isArray(geometry.coordinates))return '';
 if(!bounds||!Array.isArray(bounds[0])||!Array.isArray(bounds[1]))return '';
 const south=Number(bounds[0][0]),west=Number(bounds[0][1]),north=Number(bounds[1][0]),east=Number(bounds[1][1]);
 const top=mercatorY(north),bottom=mercatorY(south);
 if(![south,west,north,east,top,bottom].every(Number.isFinite)||east<=west||north<=south||top<=bottom)return '';
 const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const paths=[];
 for(const polygon of polys){
  if(!Array.isArray(polygon))continue;
  for(const ring of polygon){
   if(!Array.isArray(ring)||ring.length<3)continue;
   const vertices=[];
   for(const coordinate of ring){
    if(!Array.isArray(coordinate)||coordinate.length<2)continue;
    const lon=Number(coordinate[0]),lat=Number(coordinate[1]);
    if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
    const x=(lon-west)/(east-west)*1000;
    const y=(top-mercatorY(lat))/(top-bottom)*1000;
    if(Number.isFinite(x)&&Number.isFinite(y))vertices.push(x.toFixed(2)+','+y.toFixed(2));
   }
   if(vertices.length>=3)paths.push('M'+vertices.join(' L')+' Z');
  }
 }
 return paths.join(' ');
}
function overlaySvg(layer,item){
 if(!layer||!previewSrc(layer))return '';
 const path=boundaryPath(localBounds(layer,item));
 if(!path)return '';
 return '<svg class="img-boundary-overlay" data-plot="'+esc(active.plot)+'" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+
 '<path class="img-boundary-halo" d="'+path+'"></path><path class="img-boundary-line" d="'+path+'"></path></svg>';
}
function clearBoundaryLayout(){if(boundaryResizeObserver){boundaryResizeObserver.disconnect();boundaryResizeObserver=null;}}
function fitBoundaryOverlays(holder){
 clearBoundaryLayout();
 const pairs=[...holder.querySelectorAll('.img-boundary-overlay')].map(svg=>({svg,img:svg.parentElement?.querySelector('img'),frame:svg.parentElement})).filter(x=>x.img&&x.frame);
 const update=({svg,img,frame})=>{
  const fw=frame.clientWidth,fh=frame.clientHeight,nw=img.naturalWidth,nh=img.naturalHeight;
  if(!(fw>0&&fh>0&&nw>0&&nh>0)){svg.style.visibility='hidden';return;}
  const scale=Math.min(fw/nw,fh/nh),w=nw*scale,h=nh*scale;
  svg.style.left=((fw-w)/2)+'px';svg.style.top=((fh-h)/2)+'px';
  svg.style.width=w+'px';svg.style.height=h+'px';svg.style.visibility='visible';
 };
 for(const pair of pairs){pair.img.addEventListener('load',()=>update(pair),{once:true});update(pair);}
 if(typeof ResizeObserver!=='undefined'){
  boundaryResizeObserver=new ResizeObserver(()=>{for(const pair of pairs)update(pair);});
  for(const pair of pairs)boundaryResizeObserver.observe(pair.frame);
 }
}

function statusPill(date){let x=qa(date);let row=active.rows.find(r=>r.date===date);let info=x.percent!=null?' · SCL '+metricFmt(x.percent)+'%':'';if(row?.total_pixels!=null)info+=' · '+row.total_pixels+'px';
return '<span class="img-status '+(x.kind==='AUTO_VALID'?'ok':'warn')+'">'+esc(x.label+info)+'</span>';}
function thumb(layer,mode,date,item){if(!layer)return '<div class="mmc-img-empty">ยังไม่มีภาพ '+esc(MODE[mode]?.[0]||mode)+' ของวันที่เลือก</div>';
const src=previewSrc(layer);if(!src)return '<div class="mmc-img-empty">ไฟล์ภาพไม่พร้อมใช้งาน</div>';
return '<img loading="lazy" src="'+src+'" alt="'+esc(MODE[mode]?.[0]||mode)+' วันที่ '+esc(date)+' จากภาพดาวเทียมต้นฉบับ" draggable="false">'+overlaySvg(layer,item);}

function allDateGallery(items,byDate,modes){
 const selected=active.historyMode==='all'?'all':(Object.prototype.hasOwnProperty.call(MODE,active.historyMode)?active.historyMode:'all');
 const visibleModes=selected==='all'?modes:[selected];
 const selectedName=selected==='all'?'ทุกชนิด':MODE[selected][0];
 const loaded=items.filter(x=>visibleModes.some(mode=>Boolean(byDate.get(x.date)?.[mode]))).length;
 let out='<section class="img-history" id="img-all-dates"><div class="img-history-heading"><div><h3>ภาพดาวเทียมทุกวันของ '+esc(active.plot)+'</h3><p class="muted tiny">แสดง '+esc(selectedName)+' ย้อนหลังทุกวันตามภาพที่มีจริง พร้อมขอบเขตแปลง • วันที่ไม่มีภาพที่เลือกจะแจ้งชัดเจน</p></div><span class="img-data-tag">'+loaded+' / '+items.length+' วันมีภาพที่เลือก</span></div>';
 for(const item of [...items].reverse()){
  const layers=byDate.get(item.date)||{};
  const count=visibleModes.filter(mode=>layers[mode]).length;
  out+='<article class="img-history-date-card" data-history-date="'+esc(item.date)+'"><div class="img-history-meta"><div class="img-history-date"><b>'+esc(item.date)+'</b> '+statusPill(item.date)+' <span class="img-history-count">'+count+' / '+visibleModes.length+' ภาพ'+(item.preview_kind==='VISUAL_ONLY_NON_QA'?' (ไม่ผ่าน QA)':'')+'</span></div>'+
   '<button type="button" class="img-history-select" data-image-jump="'+esc(item.date)+'">เปิดวันนี้บนแผนที่</button></div>';
  if(!count){
   out+='<div class="notice img-missing">วันที่นี้ยังไม่มีภาพ '+esc(selectedName)+' ('+esc(qa(item.date).label)+') ไม่ใช้ภาพชนิดอื่นหรือวันอื่นแทน</div>';
  }else{
   if(qa(item.date).kind!=='AUTO_VALID')out+='<p class="img-history-qa-caution">ภาพมีอยู่จริง แต่วันดังกล่าวไม่ผ่าน QA หรือยังไม่มีผล QA ยืนยัน จึงไม่ควรใช้สรุปผลกระทบ</p>';
   if((selected==='all'||selected==='true_color'||selected==='false_color')&&(item.rgb_display_warning||Number(item.rgb_invalid_pct)>30||Number(item.rgb_unclassified_scl_pct)>20))out+='<p class="img-history-qa-caution">RGB QUALITY REVIEW: เกือบขาว '+metricFmt(item.rgb_near_white_pct)+'% · NoData/ไม่ผ่าน SCL '+metricFmt(item.rgb_invalid_pct)+'% · SCL 7 '+metricFmt(item.rgb_unclassified_scl_pct)+'% — ควรตรวจภาพต้นทางก่อนใช้งาน</p>';
   if((selected==='all'||selected==='true_color'||selected==='false_color')&&item.source==='generated'&&!item.rgb_renderer_version)out+='<p class="img-history-qa-caution">Preview รุ่นเก่า: ยังใช้การปรับสีรายภาพ ซึ่งอาจทำให้ภาพขาวหรือมีแถบดำ</p>';
   out+='<div class="img-gallery img-history-gallery'+(visibleModes.length===1?' img-history-single':'')+'">';
   for(const mode of visibleModes){
    out+='<div class="img-tile" data-history-mode="'+esc(mode)+'"><div class="img-title">'+esc(MODE[mode][0])+'</div><div class="img-frame">'+thumb(layers[mode],mode,item.date,item)+'</div><small>'+esc(MODE[mode][1])+'</small>'+(layers[mode]?'<button type="button" class="img-tile-open" data-image-open-mode="'+esc(mode)+'" data-image-open-date="'+esc(item.date)+'">เปิดบนแผนที่ ↗</button>':'')+indexStatBrief(item,mode)+'</div>';
   }
   out+='</div>';
  }
  out+='</article>';
 }
 return out+'</section>';
}

function groupMarkup(items,byDate){const target=items.find(x=>x.date===active.date),before=items.find(x=>x.date===active.before);
const a=byDate.get(active.date)||{},b=byDate.get(active.before)||{};
const sourceRows=active.rows.filter(x=>x.date===active.date);
const srcMeta=sourceRows[0];
const nav=items.length?
 '<div class="img-layout-tabs" role="group" aria-label="รูปแบบการดูภาพ">'+
 [['single','ภาพเดียว'],['compare','ก่อน / หลัง'],['grid','ทุกดัชนีวันเดียว'],['history','ทุกวัน']].map(([id,label])=>
 '<button type="button" class="img-layout-tab '+(active.layout===id?'active':'')+'" data-image-layout="'+id+'" aria-pressed="'+(active.layout===id)+'">'+label+'</button>').join('')+
 '</div><div class="img-controls">'+
 (active.layout==='history'?'':'<label>วันที่ภาพ<select id="image-date">'+dateChoices(items,active.date)+'</select></label>')+
 (active.layout==='single'||active.layout==='compare'?'<label>ชนิดภาพ<select id="image-mode">'+modeOptions(active.mode)+'</select></label>':'')+
 (active.layout==='history'?'<label class="img-history-filter">แสดงภาพ<select id="image-history-mode" aria-label="เลือกภาพหรือดัชนีในทุกวัน">'+historyOptions(active.historyMode)+'</select></label>':'')+
 (active.layout==='compare'?'<label>เทียบกับวันก่อน<select id="image-before">'+(!active.before?'<option value="" selected disabled>ไม่มีภาพก่อนหน้าผ่าน QA</option>':'')+dateChoices(items.filter(x=>x.date<active.date),active.before)+'</select></label>':'')+
 '<details class="img-display-options"><summary>ตัวเลือกการแสดงผล</summary><div class="img-extra-controls">'+
 (active.layout==='single'?'<label>ความโปร่งใส<input id="image-opacity" type="range" min="0" max="100" value="'+Math.round(active.alpha*100)+'" aria-label="ความโปร่งใสภาพ"></label>':'')+
 '<label class="img-boundary-control"><input type="checkbox" id="image-boundary-toggle" '+(active.boundaryVisible?'checked':'')+'> แสดงขอบเขตแปลง</label></div></details>'+
 '</div>':'';
const visualOnly=target?.preview_kind==='VISUAL_ONLY_NON_QA'?'<div class="notice img-missing"><b>ภาพทั้งหมดจาก TIFF ต้นฉบับ (ไม่ผ่าน QA):</b> สีจริง สีเท็จ และดัชนีที่แสดงเป็นภาพคำนวณเพื่อดูประกอบเท่านั้น อาจมีเมฆ/หมอกปะปน • ไม่มีสถิติดัชนีหรือ Change Detection ที่ผ่านการรับรองสำหรับวันนี้</div>':'';
const validQaRows=active.rows.filter(x=>x.analysis_status==='AUTO_VALID');
const previewDates=new Set(items.filter(x=>x.source!=='missing').map(x=>x.date));
const missingQa=validQaRows.filter(x=>!previewDates.has(x.date));
const latestQa=validQaRows.at(-1);
const head='<div class="panel-header"><div><h2>Satellite & Index Map · '+esc(active.plot)+'</h2><p class="muted tiny">วันวิเคราะห์และวันมี Raster Preview แยกกัน • ไม่ใช้ภาพ NO_DATA แทนภาพล่าสุดที่ผ่าน QA</p></div><span class="img-data-tag">ACTUAL RASTER ONLY</span></div>'+
'<div class="img-data-integrity"><div><b>QA ล่าสุด</b><span>'+esc(latestQa?.date||'ยังไม่มี QA ผ่าน')+'</span></div><div><b>วันที่มี Raster Preview</b><span>'+items.filter(x=>x.source!=='missing').length+' / '+items.length+'</span></div><div><b>QA ผ่านแต่ภาพยังไม่พร้อม</b><span>'+missingQa.length+' วัน</span></div></div>';
if(!items.length)return head+'<div class="notice">ยังไม่มี Preview แบบแผนที่สำหรับแปลง '+esc(active.plot)+' • ข้อมูลดัชนีแบบตัวเลขอาจมีอยู่ แต่แผนที่ Raster ยังไม่ได้สร้างจากไฟล์ TIFF</div><p class="muted tiny">เปิดไฟล์ TIFF ตามวันที่จากตารางด้านล่าง หรือรอการประมวลผลชุดภาพเพิ่ม ระบบไม่แสดงภาพดาวเทียมสมมุติ</p>';
const latestAvailable=[...items].reverse().find(x=>x.source!=='missing'&&qa(x.date).kind==='AUTO_VALID');
const openAvailable=latestAvailable&&latestAvailable.date!==active.date?'<button type="button" class="btn img-fallback-btn" id="image-open-available">ดูภาพจริงที่ผ่าน QA วันที่ '+esc(latestAvailable.date)+'</button>':'';
const noPreview=target?.source==='missing'?'<div class="notice img-missing"><b>ภาพวันที่ '+esc(active.date)+' ยังไม่มี Raster Preview</b> แม้มีข้อมูลวันที่นี้ในผลวิเคราะห์ ('+esc(qa(active.date).label)+') กำลังรอสร้างภาพจาก GeoTIFF ต้นฉบับ ไม่ใช้ภาพ Esri หรือภาพคนละวันแทนผล Sentinel-2 '+openAvailable+'</div>':'';
const smallWarning=active.rows.find(x=>x.date===active.date)?.total_pixels<30?'<div class="notice img-missing">แปลงมีพิกเซลสำหรับ QA น้อยกว่า 30 พิกเซลบนกริดวิเคราะห์ จึงไม่ควรตีความว่า SCL 100.00% หมายถึงภาพชัดหรือแม่นยำ ควรใช้ภาพต้นฉบับและข้อมูลภาคสนามตรวจทาน</div>':'';
const rgbSource=target?.source==='generated'?target:null;
const whitePct=rgbSource?.rgb_near_white_pct;
const showRgbReview=!!(rgbSource&&(rgbSource.rgb_display_warning||Number(rgbSource.rgb_invalid_pct)>30||Number(rgbSource.rgb_unclassified_scl_pct)>20));
const rgbWarning=showRgbReview?'<div class="notice img-missing img-rgb-warning"><b>RGB QUALITY REVIEW • ยังไม่รับรองภาพใส:</b> เกือบขาว '+metricFmt(whitePct)+'% · NoData/ไม่ผ่าน SCL '+metricFmt(rgbSource.rgb_invalid_pct)+'% · SCL 7 (ไม่จำแนก) '+metricFmt(rgbSource.rgb_unclassified_scl_pct)+'% โปรดตรวจ TIFF ก่อนใช้งาน</div>':'';
const rgbMeta=rgbSource?.rgb_native_width?'<div class="img-rgb-resolution">RGB Preview '+esc(rgbSource.rgb_native_width)+' × '+esc(rgbSource.rgb_native_height)+' พิกเซล (กริดต้นทาง 10 ม.) · ดัชนีจากกริด 20 ม. · เกือบขาว '+metricFmt(whitePct)+'% · NoData/ไม่ผ่าน SCL '+metricFmt(rgbSource.rgb_invalid_pct)+'% · รุ่น '+esc(rgbSource.rgb_renderer_version||'เดิม')+'</div>':'';
const boundaryLegend=active.geometry?'<div class="img-boundary-legend"><i></i> เส้นแดง = ขอบเขต '+esc(active.boundaryType==='PDD_136'?'PDD':active.boundaryType==='MOC3'?'MOC 3 (ยังไม่ยืนยัน)':active.boundaryType||'จากฐาน GIS')+' ที่ระบบมีอยู่ (ไม่ใช่การรับรองสิทธิ์)</div>':'<div class="notice img-missing">แปลงนี้ไม่มี Geometry ที่จับคู่ได้ จึงยังไม่สามารถวาดขอบเขตบน Raster</div>';
const qaLegend='<div class="img-qa-explainer">การแสดงภาพ: SCL QA ระบุพิกเซลที่วิเคราะห์ได้ ไม่ใช่คะแนนความชัด • RGB ใช้การปรับสีแบบค่าการสะท้อนแสงคงที่ • ช่องลายตารางหมายถึง NoData/ไม่ผ่าน SCL ของภาพต้นฉบับ • สีขาวอาจเป็นความสว่างสูงหรือเมฆที่ต้องตรวจสอบ</div>';
const main=active.layout==='single'?
 '<div class="img-preview-grid img-view-single"><div class="img-map-panel"><div class="img-title">'+esc(MODE[active.mode]?.[0]||active.mode)+' · '+esc(active.date)+' '+statusPill(active.date)+'</div>'+
 '<div class="img-geo-map" id="mmc-geo-map"></div>'+
 '<div class="img-foot">'+(a[active.mode]?'Sentinel-2 '+esc(String(a[active.mode]?.resolution_m||'—'))+' ม. · ภาพวันที่เลือกพร้อมขอบเขตบนแผนที่':'ภาพพื้นหลัง Esri แสดงตำแหน่งเท่านั้น · ไม่มี Raster '+esc(active.date))+'</div>'+
 legend(target,active.mode)+'</div></div>':'';
const compare=active.layout==='compare'?
 '<div class="img-compare-wrap"><div class="img-compare-head"><h3>เปรียบเทียบวันก่อนและวันที่เลือก · '+esc(MODE[active.mode]?.[0]||active.mode)+'</h3></div>'+
 '<div class="img-compare-grid"><figure><div class="img-title">ก่อน · '+esc(active.before||'ไม่มีวันก่อนหน้าที่ผ่าน QA')+' '+(active.before?statusPill(active.before):'')+'</div><div class="img-frame">'+thumb(b[active.mode],active.mode,active.before,before)+'</div></figure><figure><div class="img-title">หลัง · '+esc(active.date)+' '+statusPill(active.date)+'</div><div class="img-frame">'+thumb(a[active.mode],active.mode,active.date,target)+'</div></figure></div>'+
 (active.before&&qa(active.before).kind!=='AUTO_VALID'?'<div class="notice img-missing">วันก่อนที่เลือกไม่ผ่าน QA โปรดระวังการเปรียบเทียบผลกระทบ</div>':'')+
 '<p class="muted tiny">ชนิดภาพเดียวกันทั้งสองวันโดยอัตโนมัติ • ยังไม่ยืนยันน้ำท่วม ต้องตรวจ QA พิกเซลร่วม และบริบทน้ำขึ้นลง</p></div>':'';
const modes=['true_color','false_color','ndvi','ndre','ndmi','mndwi','bsi','ndwi'];
const gallery=active.layout==='grid'?
 '<h3 class="img-gallery-title">ภาพทั้ง 8 ชนิด · '+esc(active.date)+'</h3><div class="img-selected-qa">'+statusPill(active.date)+'</div><p class="muted tiny">คลิกเปิดบนแผนที่ที่ภาพที่ต้องการ ไม่ต้องเลือกชนิดภาพซ้ำ</p>'+
 '<div class="img-gallery">'+modes.map(mode=>'<div class="img-tile"><div class="img-title">'+esc(MODE[mode][0])+'</div><div class="img-frame">'+thumb(a[mode],mode,active.date,target)+'</div><small>'+esc(MODE[mode][1])+'</small>'+(a[mode]?'<button type="button" class="img-tile-open" data-image-open-mode="'+esc(mode)+'" data-image-open-date="'+esc(active.date)+'">เปิดบนแผนที่ ↗</button>':'')+indexStatBrief(target,mode)+'</div>').join('')+'</div>':'';
const history=active.layout==='history'?allDateGallery(items,byDate,modes):'';
const indexAudit=target?.index_stats?
 '<details class="img-index-audit-details"><summary>ข้อมูลตรวจสอบค่าดัชนีจาก TIFF (QA เชิงลึก)</summary>'+indexAuditTable(target)+'</details>':'';
const source=srcMeta?'<div class="img-source"><b>Traceability</b> · Plot '+esc(active.plot)+' • วันที่ภาพ '+esc(active.date)+' • '+esc(srcMeta.algorithm||'Preview จาก TIFF')+' • QA '+esc(srcMeta.analysis_status||'ยังไม่ประมวลผล')+
 '<br><small>Original TIFF: '+esc(srcMeta.original_tif10||'รอต้นฉบับ')+' / '+esc(srcMeta.original_tif20||'รอต้นฉบับ')+'</small>'+
'<br>'+[['10 m TIFF',srcMeta.original_tif10_file_id],['20 m TIFF / SCL',srcMeta.original_tif20_file_id]].filter(x=>x[1]).map(x=>'<a href="https://drive.google.com/file/d/'+encodeURIComponent(x[1])+'/view" target="_blank" rel="noopener noreferrer">'+esc(x[0])+' ↗</a>').join(' · ')+'</div>':'<div class="img-source">ภาพนี้มี Raster Preview แต่ยังไม่มีผล QA ที่จับคู่กับชุดวิเคราะห์ PDD เดิม จึงไม่ใช้สรุปผลกระทบ</div>';
return head+nav+boundaryLegend+(active.layout==='single'?qaLegend:'')+(active.layout==='history'?'':visualOnly+noPreview+smallWarning+rgbWarning+rgbMeta)+main+compare+gallery+history+(active.layout==='history'?'':indexAudit+source);
}
function destroyMap(){if(map){try{map.remove()}catch(e){}map=null;}boundaryMapLayer=null;}
function plotBounds(geo){const c=[];function walk(a){if(!Array.isArray(a))return;if(a.length>=2&&typeof a[0]==='number'&&typeof a[1]==='number')c.push([a[1],a[0]]);else for(let p of a)walk(p);}walk(geo?.coordinates);if(!c.length)return null;return [[Math.min(...c.map(x=>x[0])),Math.min(...c.map(x=>x[1]))],[Math.max(...c.map(x=>x[0])),Math.max(...c.map(x=>x[1]))]];}
function drawMap(item,raster){destroyMap();const holder=$('mmc-geo-map');if(!holder)return;if(!window.L){holder.innerHTML='<div class="mmc-img-empty">Leaflet ยังโหลดไม่สำเร็จ</div>';return;}
 map=L.map(holder,{preferCanvas:true,attributionControl:true});L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Tiles © Esri'}).addTo(map);
let bounds=localBounds(raster,item)||plotBounds(active.geometry);if(bounds&&raster){L.imageOverlay(previewSrc(raster),bounds,{opacity:active.alpha,interactive:false}).addTo(map);}
if(active.geometry){boundaryMapLayer=L.geoJSON({type:'Feature',geometry:active.geometry,properties:{}},{style:{color:'#ff5454',weight:3,opacity:1,fillOpacity:0,interactive:false}});if(active.boundaryVisible)boundaryMapLayer.addTo(map);}
holder.dataset.boundaryVisible=String(Boolean(active.geometry&&active.boundaryVisible));
if(bounds)map.fitBounds(bounds,{padding:[20,20]});else map.setView([10.4,100.8],7);
setTimeout(()=>{try{map.invalidateSize()}catch(e){}},100);
}
async function renderAsync(){const id=++epoch;destroyMap();clearBoundaryLayout();const hold=active.holder;if(!hold)return;hold.innerHTML='<div class="img-load">กำลังอ่าน Raster Preview และ metadata…</div>';
try{await getIndex();const items=imageryItems();
if(!items.some(x=>x.date===active.date)){const latest=[...items].reverse().find(x=>x.source!=='missing');const v=[...items].reverse().find(x=>qa(x.date).kind==='AUTO_VALID');active.date=latest?.date||v?.date||items.at(-1)?.date||'';}
if(!active.beforeManual||!items.some(x=>x.date===active.before)||active.before>=active.date){
const before=[...items].reverse().find(x=>x.date<active.date&&x.source!=='missing'&&qa(x.date).kind==='AUTO_VALID');
active.before=before?.date||[...items].reverse().find(x=>x.date<active.date&&qa(x.date).kind==='AUTO_VALID')?.date||'';
active.beforeManual=false;
}
const cur=items.find(x=>x.date===active.date);
const needed=active.layout==='history'?items:items.filter(item=>item.date===active.date||(active.layout==='compare'&&item.date===active.before));
const results=await Promise.all(needed.map(async item=>{
 try{return {item,product:await getProduct(item)}}catch(err){
  console.warn('Raster preview could not load for '+item.plot+' '+item.date,err);
  return {item,product:null};
 }
}));
if(id!==epoch)return;
const byDate=new Map(results.map(({item,product})=>[item.date,rastersFor(item,product)]));
hold.innerHTML=groupMarkup(items,byDate);
 document.dispatchEvent(new CustomEvent('mmc:imagery-date-change',{detail:{plot:active.plot,date:active.date}}));
hold.classList.toggle('boundary-hidden',!active.boundaryVisible);
fitBoundaryOverlays(hold);
if(active.layout==='single')drawMap(cur,byDate.get(active.date)?.[active.mode]||null);
const change=ev=>{const t=ev.target;
if(t.id==='image-date'){active.date=t.value;active.beforeManual=false;renderAsync();}
if(t.id==='image-before'){active.before=t.value;active.beforeManual=true;renderAsync();}
if(t.id==='image-mode'){active.mode=t.value;renderAsync();}
 if(t.id==='image-history-mode'){active.historyMode=t.value==='all'||Object.prototype.hasOwnProperty.call(MODE,t.value)?t.value:'all';renderAsync();}

if(t.id==='image-opacity'){active.alpha=Number(t.value)/100;if(map){map.eachLayer(layer=>{if(layer instanceof L.ImageOverlay)layer.setOpacity(active.alpha)})}}
if(t.id==='image-boundary-toggle'){active.boundaryVisible=t.checked;hold.classList.toggle('boundary-hidden',!t.checked);if(map&&boundaryMapLayer){if(t.checked)boundaryMapLayer.addTo(map);else map.removeLayer(boundaryMapLayer);}const mapHolder=$('mmc-geo-map');if(mapHolder)mapHolder.dataset.boundaryVisible=String(Boolean(active.geometry&&t.checked));}
};
const availableBtn=$('image-open-available');if(availableBtn&&latestAvailableImage(items))availableBtn.addEventListener('click',()=>{active.date=latestAvailableImage(items).date;active.beforeManual=false;renderAsync();});
for(const button of hold.querySelectorAll('[data-image-jump]'))button.addEventListener('click',()=>{
 active.date=button.dataset.imageJump;active.layout='single';active.beforeManual=false;renderAsync();
 hold.scrollIntoView({block:'start',behavior:'smooth'});
});
for(const button of hold.querySelectorAll('[data-image-layout]'))button.addEventListener('click',()=>{active.layout=button.dataset.imageLayout;renderAsync();});
for(const button of hold.querySelectorAll('[data-image-open-mode]'))button.addEventListener('click',()=>{active.mode=button.dataset.imageOpenMode;active.date=button.dataset.imageOpenDate||active.date;active.layout='single';active.beforeManual=false;renderAsync();hold.scrollIntoView({block:'start',behavior:'smooth'});});
for(const sel of ['image-date','image-before','image-mode','image-history-mode','image-opacity','image-boundary-toggle']){const node=$(sel);if(node)node.addEventListener(sel==='image-opacity'?'input':'change',change);}
}catch(e){console.error('MMC imagery',e);if(id===epoch)showError(e.message||e)}}
function mount(o){if(!o?.plot||!o?.container)return;active.layout='single';if(active.plot!==o.plot){active.date='';active.before='';active.beforeManual=false;active.mode='true_color';active.historyMode='all';}active.plot=o.plot;active.rows=o.sceneRows||[];active.geometry=o.geometry||null;active.boundaryType=o.boundaryType||'GIS';active.holder=document.getElementById(o.container);if(!active.holder)return;renderAsync();}
function selectDate(date,mode){
 if(!date||!active.holder||!active.rows.some(x=>x.date===date))return false;
 if(!Object.prototype.hasOwnProperty.call(MODE,mode))mode='mndwi';
 active.date=date;active.mode=mode;active.layout='single';active.beforeManual=false;
 renderAsync();return true;
}
function clear(){epoch++;destroyMap();clearBoundaryLayout();active.holder=null;}
window.MMCImagery={mount,clear,selectDate,get coverage(){return index?{plots:index.plot_count,dates:index.image_dates}:null}};
})();
