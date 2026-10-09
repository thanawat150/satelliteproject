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
let index=null,files=new Map(),epoch=0,map=null;
let active={plot:'13-STC',date:'',before:'',mode:'true_color',compareMode:'true_color',alpha:.85,geometry:null,rows:[],holder:null,existing:[]};
const $=(id)=>document.getElementById(id);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,()=>String.fromCharCode(38)+'quot;').replace(/'/g,'&#39;');
function dateRows(){return active.existing.filter(x=>x.plot===active.plot)}
function qa(date){let r=active.rows.find(x=>x.date===date);if(!r)return {label:'QA ยังไม่ประมวลผล',kind:'noanalysis',percent:null};return {label:r.analysis_status||'ไม่ระบุ',kind:r.analysis_status||'unknown',percent:r.qa_valid_pct};}
const modeOptions=(m)=>Object.entries(MODE).map(([k,v])=>'<option value="'+k+'" '+(k===m?'selected':'')+'>'+esc(v[0])+'</option>').join('');
function available(item){return item?.modes||[]}
function srcOK(x){return typeof x==='string'&&(/^data:image\/(?:png|jpeg|webp);base64,/i.test(x)||/^\.\/imagery\/[a-z0-9_()\/.\-]+$/i.test(x));}
function previewSrc(row){return srcOK(row?.src)?row.src:null}
async function getIndex(){if(index)return index;let r=await fetch('imagery_manifest.json?v=20261009-v2',{cache:'no-store'});if(!r.ok)throw Error('Imagery manifest HTTP '+r.status);index=await r.json();return index;}
async function getProduct(item){if(!item)return null;if(item.source==='generated'){return {layers:Object.entries(item.assets||{}).map(([mode,u])=>({plot:item.plot,date:item.date,mode,src:u,bounds:item.bounds,resolution_m:mode==='true_color'||mode==='false_color'?10:20}))};}
const key='part-'+item.part;if(!files.has(key)){const url='../data/full_preview_part_'+item.part+'.json';const response=await fetch(url);if(!response.ok)throw Error('Image product HTTP '+response.status);files.set(key,await response.json());}return files.get(key);}
function imageryItems(){const orig=(index?.items||[]).filter(x=>x.plot===active.plot);const extra=(index?.generated_items||[]).filter(x=>x.plot===active.plot);const map=new Map();for(const x of [...orig,...extra]){let k=x.date;const old=map.get(k);if(!old)map.set(k,x);else if(x.source==='generated'){// generated preview can supply modes not available in older preview
 map.set(k,{...x,fallback:old});}}
return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function dateChoices(items,selected){return items.map(x=>'<option value="'+esc(x.date)+'" '+(selected===x.date?'selected':'')+'>'+esc(x.date)+(x.source==='generated'?' · Processed':' · Preview')+'</option>').join('');}
function rastersFor(item,product){if(!item)return {};const rasters={};for(const x of product?.layers||[]){if(x.plot!==item.plot||x.date!==item.date)continue;if(available(item).includes(x.mode)&&previewSrc(x))rasters[x.mode]=x;}
return rasters;}
function localBounds(image,item){let b=image?.bounds||item?.bounds;return Array.isArray(b)&&b.length===2&&b[0].length===2&&b[1].length===2?b:null;}
function showError(s){if(!active.holder)return;active.holder.innerHTML='<div class="notice">ไม่สามารถโหลดภาพจริง: '+esc(s)+'</div>';}
function statusPill(date){let x=qa(date);let info=x.percent!=null?' · '+x.percent+'%':'';
return '<span class="img-status '+(x.kind==='AUTO_VALID'?'ok':'warn')+'">'+esc(x.label+info)+'</span>';}
function thumb(layer,mode,date){if(!layer)return '<div class="mmc-img-empty">ยังไม่มีภาพ '+esc(MODE[mode]?.[0]||mode)+' ของวันที่เลือก</div>';
const src=previewSrc(layer);return '<img loading="lazy" src="'+src+'" alt="'+esc(MODE[mode]?.[0]||mode)+' วันที่ '+esc(date)+' จากภาพดาวเทียมต้นฉบับ" draggable="false">';}
function groupMarkup(items,byDate){const target=items.find(x=>x.date===active.date),before=items.find(x=>x.date===active.before);
const a=byDate.get(active.date)||{},b=byDate.get(active.before)||{};
const sourceRows=active.rows.filter(x=>x.date===active.date);
const srcMeta=sourceRows[0];
const nav=items.length?'<label>วันภาพ<select id="image-date">'+dateChoices(items,active.date)+'</select></label><label>ภาพดัชนี / สี<select id="image-mode">'+modeOptions(active.mode)+'</select></label><label>Opacity ภาพ<input id="image-opacity" type="range" min="0" max="100" value="'+Math.round(active.alpha*100)+'" aria-label="ความโปร่งใสภาพ"></label>':'';
const head='<div class="panel-header"><div><h2>Satellite & Index Map · '+esc(active.plot)+'</h2><p class="muted tiny">ภาพจริงจาก GeoTIFF / บางแปลงยังไม่มี Preview • เลือกวันและชนิดดัชนีได้</p></div><span class="img-data-tag">ACTUAL RASTER ONLY</span></div>';
if(!items.length)return head+'<div class="notice">ยังไม่มี Preview แบบแผนที่สำหรับแปลง '+esc(active.plot)+' • ข้อมูลดัชนีแบบตัวเลขอาจมีอยู่ แต่แผนที่ Raster ยังไม่ได้สร้างจากไฟล์ TIFF</div><p class="muted tiny">เปิดไฟล์ TIFF ตามวันที่จากตารางด้านล่าง หรือรอการประมวลผลชุดภาพเพิ่ม ระบบไม่แสดงภาพดาวเทียมสมมุติ</p>';
const main='<div class="img-controls">'+nav+'</div>'+
 '<div class="img-preview-grid"><div class="img-large"><div class="img-title">'+esc(MODE[active.mode]?.[0]||active.mode)+' · '+esc(active.date)+' '+statusPill(active.date)+'</div><div class="img-frame">'+thumb(a[active.mode],active.mode,active.date)+'</div><div class="img-foot">ความละเอียด: '+esc(String(a[active.mode]?.resolution_m||'—'))+' m · ภาพเต็มสี่เหลี่ยม (ไม่ clip เฉพาะ Polygon)</div></div>'+
 '<div class="img-map-panel"><div class="img-title">แสดง Raster ซ้อนแผนที่พร้อมขอบเขต PDD</div><div class="img-geo-map" id="mmc-geo-map"></div><div class="img-foot">ขอบเขต PDD เส้นแดง · ภาพอ้างอิงพิกัดตาม bounds ของ Raster จริง</div></div></div>';
const compare='<div class="img-compare-wrap"><div class="img-compare-head"><h3>เปรียบเทียบ Before / After</h3><label>Before<select id="image-before">'+dateChoices(items,active.before)+'</select></label><label>ชนิด<select id="image-compare-mode">'+modeOptions(active.compareMode)+'</select></label></div>'+
 '<div class="img-compare-grid"><figure><div class="img-title">BEFORE · '+esc(active.before)+' '+statusPill(active.before)+'</div><div class="img-frame">'+thumb(b[active.compareMode],active.compareMode,active.before)+'</div></figure><figure><div class="img-title">AFTER · '+esc(active.date)+' '+statusPill(active.date)+'</div><div class="img-frame">'+thumb(a[active.compareMode],active.compareMode,active.date)+'</div></figure></div>'+
 '<p class="muted tiny">แสดงภาพจากสองวันที่เลือกจริง แต่ยังไม่ใช่ผล Change Detection ที่ยืนยันแล้ว เพราะต้องตรวจ QA, พิกเซลใช้ได้ร่วมกัน และน้ำขึ้นน้ำลงก่อนตีความ</p></div>';
const modes=['true_color','false_color','ndvi','ndre','ndmi','mndwi','bsi','ndwi'];
const gallery='<h3 class="img-gallery-title">ภาพสีจริง / สีเท็จ / ดัชนีในวันที่เลือก</h3><div class="img-gallery">'+modes.map(mode=>'<div class="img-tile"><div class="img-title">'+esc(MODE[mode][0])+'</div><div class="img-frame">'+thumb(a[mode],mode,active.date)+'</div><small>'+esc(MODE[mode][1])+'</small></div>').join('')+'</div>';
const source=srcMeta?'<div class="img-source"><b>Traceability</b> · Plot '+esc(active.plot)+' • วันที่ภาพ '+esc(active.date)+' • '+esc(srcMeta.algorithm||'Preview จาก TIFF')+' • QA '+esc(srcMeta.analysis_status||'ยังไม่ประมวลผล')+
 '<br><small>Original TIFF: '+esc(srcMeta.original_tif10||'รอต้นฉบับ')+' / '+esc(srcMeta.original_tif20||'รอต้นฉบับ')+'</small></div>':'<div class="img-source">ภาพนี้มี Raster Preview แต่ยังไม่มีผล QA ที่จับคู่กับชุดวิเคราะห์ PDD เดิม จึงไม่ใช้สรุปผลกระทบ</div>';
return head+main+compare+gallery+source;
}
function destroyMap(){if(map){try{map.remove()}catch(e){}map=null;}}
function plotBounds(geo){const c=[];function walk(a){if(!Array.isArray(a))return;if(a.length>=2&&typeof a[0]==='number'&&typeof a[1]==='number')c.push([a[1],a[0]]);else for(let p of a)walk(p);}walk(geo?.coordinates);if(!c.length)return null;return [[Math.min(...c.map(x=>x[0])),Math.min(...c.map(x=>x[1]))],[Math.max(...c.map(x=>x[0])),Math.max(...c.map(x=>x[1]))]];}
function drawMap(item,raster){destroyMap();const holder=$('mmc-geo-map');if(!holder)return;if(!window.L){holder.innerHTML='<div class="mmc-img-empty">Leaflet ยังโหลดไม่สำเร็จ</div>';return;}
 map=L.map(holder,{preferCanvas:true,attributionControl:true});L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Tiles © Esri'}).addTo(map);
let bounds=localBounds(raster,item)||plotBounds(active.geometry);if(bounds&&raster){L.imageOverlay(previewSrc(raster),bounds,{opacity:active.alpha,interactive:false}).addTo(map);}
if(active.geometry){L.geoJSON({type:'Feature',geometry:active.geometry,properties:{}},{style:{color:'#ff5454',weight:2.5,fillOpacity:0,interactive:false}}).addTo(map);}
if(bounds)map.fitBounds(bounds,{padding:[20,20]});else map.setView([10.4,100.8],7);
setTimeout(()=>{try{map.invalidateSize()}catch(e){}},100);
}
async function renderAsync(){const id=++epoch;destroyMap();const hold=active.holder;if(!hold)return;hold.innerHTML='<div class="img-load">กำลังอ่าน Raster Preview และ metadata…</div>';
try{await getIndex();const items=imageryItems();if(!items.some(x=>x.date===active.date))active.date=items.at(-1)?.date||'';if(!items.some(x=>x.date===active.before))active.before=items[0]?.date||active.date;
const cur=items.find(x=>x.date===active.date),bef=items.find(x=>x.date===active.before);
const [cp,bp]=await Promise.all([getProduct(cur),cur?.part===bef?.part&&cur?.source===bef?.source?getProduct(cur):getProduct(bef)]);
if(id!==epoch)return;const byDate=new Map();if(cur)byDate.set(cur.date,rastersFor(cur,cp));if(bef)byDate.set(bef.date,rastersFor(bef,bp));
hold.innerHTML=groupMarkup(items,byDate);
drawMap(cur,byDate.get(active.date)?.[active.mode]||null);
const change=ev=>{const t=ev.target;
if(t.id==='image-date'){active.date=t.value;renderAsync();}
if(t.id==='image-before'){active.before=t.value;renderAsync();}
if(t.id==='image-mode'){active.mode=t.value;renderAsync();}
if(t.id==='image-compare-mode'){active.compareMode=t.value;renderAsync();}
if(t.id==='image-opacity'){active.alpha=Number(t.value)/100;if(map){map.eachLayer(layer=>{if(layer instanceof L.ImageOverlay)layer.setOpacity(active.alpha)})}}
};
for(const sel of ['image-date','image-before','image-mode','image-compare-mode','image-opacity']){const node=$(sel);if(node)node.addEventListener(sel==='image-opacity'?'input':'change',change);}
}catch(e){console.error('MMC imagery',e);if(id===epoch)showError(e.message||e)}}
function mount(o){if(!o?.plot||!o?.container)return;active.plot=o.plot;active.rows=o.sceneRows||[];active.geometry=o.geometry||null;active.holder=document.getElementById(o.container);if(!active.holder)return;renderAsync();}
function clear(){epoch++;destroyMap();active.holder=null;}
window.MMCImagery={mount,clear,get coverage(){return index?{plots:index.plot_count,dates:index.image_dates}:null}};
})();
