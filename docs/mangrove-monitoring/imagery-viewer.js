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
 ndmi:['NDMI · ความชื้นพืช','(B8A−B11)/(B8A+B11)'],
 mndwi:['MNDWI · น้ำ','(B3−B11)/(B3+B11)'],
 bsi:['BSI · ดินเปิดโล่ง','สูตร BSI จาก SWIR, RED, NIR และ BLUE'],
 ndwi:['NDWI · น้ำ','(B3−B8)/(B3+B8)']
};
let index=null,files=new Map(),epoch=0,map=null,boundaryMapLayer=null,boundaryResizeObserver=null;
let active={plot:'13-STC',date:'',before:'',beforeManual:false,mode:'true_color',compareMode:'true_color',alpha:.85,geometry:null,rows:[],holder:null,existing:[],boundaryVisible:true,boundaryType:'PDD'};
const $=(id)=>document.getElementById(id);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,()=>String.fromCharCode(38)+'quot;').replace(/'/g,'&#39;');
function dateRows(){return active.existing.filter(x=>x.plot===active.plot)}
function qa(date){let r=active.rows.find(x=>x.date===date);if(!r)return {label:'QA ยังไม่ประมวลผล',kind:'noanalysis',percent:null};return {label:r.analysis_status||'ไม่ระบุ',kind:r.analysis_status||'unknown',percent:r.qa_valid_pct};}
const modeOptions=(m)=>Object.entries(MODE).map(([k,v])=>'<option value="'+k+'" '+(k===m?'selected':'')+'>'+esc(v[0])+'</option>').join('');
function available(item){return item?.modes||[]}
function srcOK(x){return typeof x==='string'&&(/^data:image\/(?:png|jpeg|webp);base64,/i.test(x)||/^\.\/imagery\/[a-z0-9_()\/.\-]+(?:\?v=[a-z0-9_.\-]+)?$/i.test(x));}
function previewSrc(row){return srcOK(row?.src)?row.src:null}
async function getIndex(){if(index)return index;let r=await fetch('imagery_manifest.json?v=20261009-v3',{cache:'no-store'});if(!r.ok)throw Error('Imagery manifest HTTP '+r.status);index=await r.json();return index;}
async function getProduct(item){if(!item||item.source==='missing')return null;if(item.source==='generated'){return {layers:Object.entries(item.assets||{}).map(([mode,u])=>({plot:item.plot,date:item.date,mode,src:u+(item.rgb_renderer_version?'?v='+encodeURIComponent(item.rgb_renderer_version):''),bounds:item.mode_bounds?.[mode]||item.bounds,resolution_m:mode==='true_color'||mode==='false_color'?10:20}))};}
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
function legend(item,mode){
if(mode==='true_color'||mode==='false_color'||mode==='generic_preview')return '';
if(item?.source!=='generated')return '<div class="img-legend-note">ดัชนีจากชุดภาพต้นฉบับ · ตรวจช่วงสีที่ใช้แสดงผลกับไฟล์ที่สร้างภาพ เพราะแต่ละชุดอาจใช้ช่วงสีต่างกัน</div>';
const water=(mode==='mndwi'||mode==='ndwi'),soil=mode==='bsi';
const grad=water?'linear-gradient(90deg,#9d5c35,#e4bc67,#eadfbd,#6fc2c4,#2880bb,#0e2e75)':soil?'linear-gradient(90deg,#1e664b,#51a053,#e0cd80,#b97e4d,#763d25)':'linear-gradient(90deg,#844934,#c27a46,#f5dc80,#9bc460,#2d8655,#074935)';
return '<div class="img-legend"><div class="img-legend-head">ช่วงสีแสดงดัชนี · '+esc(mode.toUpperCase())+' (ค่าทั่วไป −1 ถึง +1)</div><div class="img-legend-ramp" style="background:'+grad+'"></div><div class="img-legend-ticks"><span>−1</span><span>0</span><span>+1</span></div><div class="img-legend-note">ค่านี้เป็นสเกลแสดงผล ไม่ใช่เกณฑ์วินิจฉัยป่าหรือรับรองน้ำท่วม</div></div>';
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

function statusPill(date){let x=qa(date);let row=active.rows.find(r=>r.date===date);let info=x.percent!=null?' · SCL '+x.percent+'%':'';if(row?.total_pixels!=null)info+=' · '+row.total_pixels+'px';
return '<span class="img-status '+(x.kind==='AUTO_VALID'?'ok':'warn')+'">'+esc(x.label+info)+'</span>';}
function thumb(layer,mode,date,item){if(!layer)return '<div class="mmc-img-empty">ยังไม่มีภาพ '+esc(MODE[mode]?.[0]||mode)+' ของวันที่เลือก</div>';
const src=previewSrc(layer);if(!src)return '<div class="mmc-img-empty">ไฟล์ภาพไม่พร้อมใช้งาน</div>';
return '<img loading="lazy" src="'+src+'" alt="'+esc(MODE[mode]?.[0]||mode)+' วันที่ '+esc(date)+' จากภาพดาวเทียมต้นฉบับ" draggable="false">'+overlaySvg(layer,item);}

function allDateGallery(items,byDate,modes){
 const loaded=items.filter(x=>Object.keys(byDate.get(x.date)||{}).length>0).length;
 let out='<section class="img-history" id="img-all-dates"><div class="img-history-heading"><div><h3>ภาพดาวเทียมทุกวันของ '+esc(active.plot)+'</h3><p class="muted tiny">แสดงทุกวันที่มีในคลัง แยกตามวันที่และชนิดภาพ โดยมีขอบเขตสีแดงครอบภาพจริงทุกชนิด</p></div><span class="img-data-tag">'+loaded+' / '+items.length+' DATES WITH RASTER</span></div>';
 for(const item of [...items].reverse()){
  const layers=byDate.get(item.date)||{};
  const count=modes.filter(mode=>layers[mode]).length;
  out+='<article class="img-history-date-card" data-history-date="'+esc(item.date)+'"><div class="img-history-meta"><div class="img-history-date"><b>'+esc(item.date)+'</b> '+statusPill(item.date)+' <span class="img-history-count">'+count+' / 8 ภาพ</span></div>'+
   '<button type="button" class="img-history-select" data-image-jump="'+esc(item.date)+'">เลือกดูวันที่นี้บนแผนที่</button></div>';
  if(!count){
   out+='<div class="notice img-missing">วันที่นี้ยังไม่มี Raster Preview ('+esc(qa(item.date).label)+') ไม่สร้างภาพแทนจากแหล่งอื่น</div>';
  }else{
   if(qa(item.date).kind!=='AUTO_VALID')out+='<p class="img-history-qa-caution">ภาพมีอยู่จริง แต่วันดังกล่าวไม่ผ่าน QA หรือยังไม่มีผล QA ยืนยัน จึงไม่ควรใช้สรุปผลกระทบ</p>';
   if(item.rgb_display_warning||Number(item.rgb_invalid_pct)>30||Number(item.rgb_unclassified_scl_pct)>20)out+='<p class="img-history-qa-caution">RGB QUALITY REVIEW: เกือบขาว '+esc(String(item.rgb_near_white_pct??'ไม่ทราบ'))+'% · NoData/ไม่ผ่าน SCL '+esc(String(item.rgb_invalid_pct??'ไม่ทราบ'))+'% · SCL 7 '+esc(String(item.rgb_unclassified_scl_pct??'ไม่ทราบ'))+'% — ควรตรวจภาพต้นทางก่อนใช้งาน</p>';
   if(item.source==='generated'&&!item.rgb_renderer_version)out+='<p class="img-history-qa-caution">Preview รุ่นเก่า: ยังใช้การปรับสีรายภาพ ซึ่งอาจทำให้ภาพขาวหรือมีแถบดำ</p>';
   out+='<div class="img-gallery img-history-gallery">';
   for(const mode of modes){
    out+='<div class="img-tile" data-history-mode="'+esc(mode)+'"><div class="img-title">'+esc(MODE[mode][0])+'</div><div class="img-frame">'+thumb(layers[mode],mode,item.date,item)+'</div><small>'+esc(MODE[mode][1])+'</small></div>';
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
const nav=items.length?'<label>วันภาพ<select id="image-date">'+dateChoices(items,active.date)+'</select></label><label>ภาพดัชนี / สี<select id="image-mode">'+modeOptions(active.mode)+'</select></label><label>Opacity ภาพ<input id="image-opacity" type="range" min="0" max="100" value="'+Math.round(active.alpha*100)+'" aria-label="ความโปร่งใสภาพ"></label><label class="img-boundary-control"><input type="checkbox" id="image-boundary-toggle" '+(active.boundaryVisible?'checked':'')+'> ขอบเขตแปลง</label><a class="img-history-link" href="#img-all-dates">ดูภาพทุกวัน + ทุกดัชนี ↓</a>':'';
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
const smallWarning=active.rows.find(x=>x.date===active.date)?.total_pixels<30?'<div class="notice img-missing">แปลงมีพิกเซลสำหรับ QA น้อยกว่า 30 พิกเซลบนกริดวิเคราะห์ จึงไม่ควรตีความว่า SCL 100% หมายถึงภาพชัดหรือแม่นยำ ควรใช้ภาพต้นฉบับและข้อมูลภาคสนามตรวจทาน</div>':'';
const rgbSource=target?.source==='generated'?target:null;
const whitePct=rgbSource?.rgb_near_white_pct;
const showRgbReview=!!(rgbSource&&(rgbSource.rgb_display_warning||Number(rgbSource.rgb_invalid_pct)>30||Number(rgbSource.rgb_unclassified_scl_pct)>20));
const rgbWarning=showRgbReview?'<div class="notice img-missing img-rgb-warning"><b>RGB QUALITY REVIEW • ยังไม่รับรองภาพใส:</b> เกือบขาว '+esc(String(whitePct??'ไม่ทราบ'))+'% · NoData/ไม่ผ่าน SCL '+esc(String(rgbSource.rgb_invalid_pct??'ไม่ทราบ'))+'% · SCL 7 (ไม่จำแนก) '+esc(String(rgbSource.rgb_unclassified_scl_pct??'ไม่ทราบ'))+'% โปรดตรวจ TIFF ก่อนใช้งาน</div>':'';
const rgbMeta=rgbSource?.rgb_native_width?'<div class="img-rgb-resolution">RGB Preview '+esc(rgbSource.rgb_native_width)+' × '+esc(rgbSource.rgb_native_height)+' พิกเซล (กริดต้นทาง 10 ม.) · ดัชนีจากกริด 20 ม. · เกือบขาว '+esc(String(whitePct??'ไม่ทราบ'))+'% · NoData/ไม่ผ่าน SCL '+esc(String(rgbSource.rgb_invalid_pct??'ไม่ทราบ'))+'% · รุ่น '+esc(rgbSource.rgb_renderer_version||'เดิม')+'</div>':'';
const boundaryLegend=active.geometry?'<div class="img-boundary-legend"><i></i> เส้นแดง = ขอบเขต '+esc(active.boundaryType==='PDD_136'?'PDD':active.boundaryType==='MOC3'?'MOC 3 (ยังไม่ยืนยัน)':active.boundaryType||'จากฐาน GIS')+' ที่ระบบมีอยู่ (ไม่ใช่การรับรองสิทธิ์)</div>':'<div class="notice img-missing">แปลงนี้ไม่มี Geometry ที่จับคู่ได้ จึงยังไม่สามารถวาดขอบเขตบน Raster</div>';
const qaLegend='<div class="img-qa-explainer">การแสดงภาพ: SCL QA ระบุพิกเซลที่วิเคราะห์ได้ ไม่ใช่คะแนนความชัด • RGB ใช้การปรับสีแบบค่าการสะท้อนแสงคงที่ • ช่องลายตารางหมายถึง NoData/ไม่ผ่าน SCL ของภาพต้นฉบับ • สีขาวอาจเป็นความสว่างสูงหรือเมฆที่ต้องตรวจสอบ</div>';
const main='<div class="img-controls">'+nav+'</div>'+boundaryLegend+qaLegend+noPreview+smallWarning+rgbWarning+rgbMeta+
 '<div class="img-preview-grid"><div class="img-large"><div class="img-title">'+esc(MODE[active.mode]?.[0]||active.mode)+' · '+esc(active.date)+' '+statusPill(active.date)+'</div><div class="img-frame">'+thumb(a[active.mode],active.mode,active.date,target)+'</div><div class="img-foot">ความละเอียด: '+esc(String(a[active.mode]?.resolution_m||'—'))+' m · ภาพเต็มสี่เหลี่ยม (ไม่ clip เฉพาะ Polygon)</div></div>'+
 '<div class="img-map-panel"><div class="img-title">'+(a[active.mode]?'Raster Sentinel-2 พร้อมขอบเขต PDD':'ภาพพื้นหลัง Esri พร้อมขอบเขต PDD (ยังไม่มี Raster '+esc(active.date)+')')+'</div><div class="img-geo-map" id="mmc-geo-map"></div><div class="img-foot">'+(a[active.mode]?'ขอบเขต PDD เส้นแดง · ภาพ Sentinel-2 วันที่เลือกอ้างอิง bounds ของ Raster จริง':'ภาพนี้เป็น Basemap Esri สำหรับดูตำแหน่งเท่านั้น ไม่ใช่ภาพ Sentinel-2 วันที่ '+esc(active.date))+'</div>'
+legend(target,active.mode)
+'</div></div>';
const compare='<div class="img-compare-wrap"><div class="img-compare-head"><h3>เปรียบเทียบ Before / After</h3><label>Before<select id="image-before">'+(!active.before?'<option value="" selected disabled>ไม่มีภาพ QA ผ่านก่อนวันที่เลือก</option>':'')+dateChoices(items,active.before)+'</select></label><label>ชนิด<select id="image-compare-mode">'+modeOptions(active.compareMode)+'</select></label></div>'+
 '<div class="img-compare-grid"><figure><div class="img-title">BEFORE · '+esc(active.before||'ไม่มีวันก่อนหน้าที่ผ่าน QA')+' '+(active.before?statusPill(active.before):'')+'</div><div class="img-frame">'+thumb(b[active.compareMode],active.compareMode,active.before,before)+'</div></figure><figure><div class="img-title">AFTER · '+esc(active.date)+' '+statusPill(active.date)+'</div><div class="img-frame">'+thumb(a[active.compareMode],active.compareMode,active.date,target)+'</div></figure></div>'+
 (qa(active.before).kind!=='AUTO_VALID'?'<div class="notice img-missing">วัน Before ที่เลือกไม่ผ่าน QA จึงไม่ควรใช้เปรียบเทียบผลกระทบ โปรดเลือกวันที่ผ่าน QA</div>':'')+
 '<p class="muted tiny">แสดงภาพจากสองวันที่เลือกจริง แต่ยังไม่ใช่ผล Change Detection ที่ยืนยันแล้ว เพราะต้องตรวจ QA, พิกเซลใช้ได้ร่วมกัน และน้ำขึ้นน้ำลงก่อนตีความ</p></div>';
const modes=['true_color','false_color','ndvi','ndre','ndmi','mndwi','bsi','ndwi'];
const gallery='<h3 class="img-gallery-title">ภาพสีจริง / สีเท็จ / ดัชนีในวันที่เลือก</h3><div class="img-gallery">'+modes.map(mode=>'<div class="img-tile"><div class="img-title">'+esc(MODE[mode][0])+'</div><div class="img-frame">'+thumb(a[mode],mode,active.date,target)+'</div><small>'+esc(MODE[mode][1])+'</small></div>').join('')+'</div>';
const history=allDateGallery(items,byDate,modes);
const source=srcMeta?'<div class="img-source"><b>Traceability</b> · Plot '+esc(active.plot)+' • วันที่ภาพ '+esc(active.date)+' • '+esc(srcMeta.algorithm||'Preview จาก TIFF')+' • QA '+esc(srcMeta.analysis_status||'ยังไม่ประมวลผล')+
 '<br><small>Original TIFF: '+esc(srcMeta.original_tif10||'รอต้นฉบับ')+' / '+esc(srcMeta.original_tif20||'รอต้นฉบับ')+'</small>'+
'<br>'+[['10 m TIFF',srcMeta.original_tif10_file_id],['20 m TIFF / SCL',srcMeta.original_tif20_file_id]].filter(x=>x[1]).map(x=>'<a href="https://drive.google.com/file/d/'+encodeURIComponent(x[1])+'/view" target="_blank" rel="noopener noreferrer">'+esc(x[0])+' ↗</a>').join(' · ')+'</div>':'<div class="img-source">ภาพนี้มี Raster Preview แต่ยังไม่มีผล QA ที่จับคู่กับชุดวิเคราะห์ PDD เดิม จึงไม่ใช้สรุปผลกระทบ</div>';
return head+main+compare+gallery+history+source;
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
if(!items.some(x=>x.date===active.date)){const v=[...items].reverse().find(x=>qa(x.date).kind==='AUTO_VALID');active.date=v?.date||items.at(-1)?.date||'';}
if(!active.beforeManual||!items.some(x=>x.date===active.before)||active.before>=active.date){
const before=[...items].reverse().find(x=>x.date<active.date&&x.source!=='missing'&&qa(x.date).kind==='AUTO_VALID');
active.before=before?.date||[...items].reverse().find(x=>x.date<active.date&&qa(x.date).kind==='AUTO_VALID')?.date||'';
active.beforeManual=false;
}
const cur=items.find(x=>x.date===active.date);
const results=await Promise.all(items.map(async item=>{
 try{return {item,product:await getProduct(item)}}catch(err){
  console.warn('Raster preview could not load for '+item.plot+' '+item.date,err);
  return {item,product:null};
 }
}));
if(id!==epoch)return;
const byDate=new Map(results.map(({item,product})=>[item.date,rastersFor(item,product)]));
hold.innerHTML=groupMarkup(items,byDate);
hold.classList.toggle('boundary-hidden',!active.boundaryVisible);
fitBoundaryOverlays(hold);
drawMap(cur,byDate.get(active.date)?.[active.mode]||null);
const change=ev=>{const t=ev.target;
if(t.id==='image-date'){active.date=t.value;active.beforeManual=false;renderAsync();}
if(t.id==='image-before'){active.before=t.value;active.beforeManual=true;renderAsync();}
if(t.id==='image-mode'){active.mode=t.value;renderAsync();}
if(t.id==='image-compare-mode'){active.compareMode=t.value;renderAsync();}
if(t.id==='image-opacity'){active.alpha=Number(t.value)/100;if(map){map.eachLayer(layer=>{if(layer instanceof L.ImageOverlay)layer.setOpacity(active.alpha)})}}
if(t.id==='image-boundary-toggle'){active.boundaryVisible=t.checked;hold.classList.toggle('boundary-hidden',!t.checked);if(map&&boundaryMapLayer){if(t.checked)boundaryMapLayer.addTo(map);else map.removeLayer(boundaryMapLayer);}const mapHolder=$('mmc-geo-map');if(mapHolder)mapHolder.dataset.boundaryVisible=String(Boolean(active.geometry&&t.checked));}
};
const availableBtn=$('image-open-available');if(availableBtn&&latestAvailableImage(items))availableBtn.addEventListener('click',()=>{active.date=latestAvailableImage(items).date;active.beforeManual=false;renderAsync();});
for(const button of hold.querySelectorAll('[data-image-jump]'))button.addEventListener('click',()=>{
 active.date=button.dataset.imageJump;active.beforeManual=false;renderAsync();
 hold.scrollIntoView({block:'start',behavior:'smooth'});
});
for(const sel of ['image-date','image-before','image-mode','image-compare-mode','image-opacity','image-boundary-toggle']){const node=$(sel);if(node)node.addEventListener(sel==='image-opacity'?'input':'change',change);}
}catch(e){console.error('MMC imagery',e);if(id===epoch)showError(e.message||e)}}
function mount(o){if(!o?.plot||!o?.container)return;if(active.plot!==o.plot){active.date='';active.before='';active.beforeManual=false;active.mode='true_color';active.compareMode='true_color';}active.plot=o.plot;active.rows=o.sceneRows||[];active.geometry=o.geometry||null;active.boundaryType=o.boundaryType||'GIS';active.holder=document.getElementById(o.container);if(!active.holder)return;renderAsync();}
function clear(){epoch++;destroyMap();clearBoundaryLayout();active.holder=null;}
window.MMCImagery={mount,clear,get coverage(){return index?{plots:index.plot_count,dates:index.image_dates}:null}};
})();
