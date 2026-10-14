/* Map Studio — actual raster layers only, never substitutes fake index colors. */
(function(){
"use strict";
const MODES={
 true:{name:"สีจริง (B4–B3–B2)",type:"rgb"},
 false:{name:"สีเท็จพืช (B8–B4–B3)",type:"rgb"},
 mndwi:{name:"MNDWI (ดัชนีน้ำเปิด)",type:"index",colors:["#916533","#d4b882","#faf2ca","#73b9d1","#095ba3"]},
 ndwi:{name:"NDWI (ดัชนีน้ำ)",type:"index",colors:["#a16f42","#dfc794","#f6f6dc","#77bddb","#0969aa"]},
 ndmi:{name:"NDMI (ความชื้นพืช/พื้นที่)",type:"index",colors:["#995037","#e3ae68","#efe2b8","#69afc7","#125b92"]},
 ndvi:{name:"NDVI (ความเขียวพืช)",type:"index",colors:["#965032","#d8bb70","#e5dea8","#77b96b","#116b38"]},
 ndre:{name:"NDRE (สภาพใบพืช)",type:"index",colors:["#8e4738","#d1b671","#e6e8bd","#85b895","#2c7155"]},
 bsi:{name:"BSI (ดินเปิดโล่ง)",type:"index",colors:["#2b7152","#86a86f","#e9dfac","#d9a36e","#975534"]}
};
const defaults={mode:"true",boundary:true,water:false,labels:false,resampling:"sharp",brightness:100,contrast:100,saturation:100,gamma:100,r:100,g:100,b:100,preset:"custom"};
const state={...defaults};let entries=[],current=null,saved=null,initialized=false;
const $=id=>document.getElementById(id);
const notify=s=>{if(typeof showToast==="function")showToast(s);else console.info(s)};
const safe=s=>String(s).replace(/[^A-Za-z0-9._-]/g,"_");
const nice=d=>d?d.split("-").reverse().join("/"):"—";

function compactToImage(v){
 if(v.url)return v.url;
 if(!v.pixels||!Array.isArray(v.size))return null;
 const w=v.size[0],h=v.size[1],c=document.createElement("canvas");c.width=w;c.height=h;
 const ctx=c.getContext("2d"),buf=ctx.createImageData(w,h),raw=buf.data,p=v.pixels;
 const toRGB=str=>[parseInt(str.slice(1,3),16),parseInt(str.slice(3,5),16),parseInt(str.slice(5,7),16)];
 const interpolate=(colors,t)=>{
  const z=Math.max(0,Math.min(colors.length-1,t*(colors.length-1))),a=Math.floor(z),b=Math.min(colors.length-1,a+1),f=z-a;
  const x=toRGB(colors[a]),y=toRGB(colors[b]);return x.map((v,i)=>Math.round(v*(1-f)+y[i]*f));
 };
 const isRGB=v.mode==="false";
 for(let i=0;i<w*h;i++){
  const off=i*(isRGB?3:1),src=p.slice(off,off+(isRGB?3:1));
  if(src.includes("x"))continue;
  let rgb;
  if(isRGB)rgb=[parseInt(src[0],16)*17,parseInt(src[1],16)*17,parseInt(src[2],16)*17];
  else rgb=interpolate(MODES[v.mode].colors,parseInt(src[0],16)/15);
  const k=i*4;raw[k]=rgb[0];raw[k+1]=rgb[1];raw[k+2]=rgb[2];raw[k+3]=255;
 }
 ctx.putImageData(buf,0,0);v.url=c.toDataURL("image/png");return v.url;
}
function dataMode(mode){return mode==="true"?"true_color":mode==="false"?"false_color":mode}
function available(p,d,mode){
 const priority={DIRECT:0,LATEST_RECT:1,NO_CLOUD_FILTER:2,HIST_CLEAR_RECT_SCL0:3};
 const target=dataMode(mode);
 return entries
   .filter(v=>v.plot===p?.plot&&v.date===d&&v.mode===target)
   .sort((a,b)=>(priority[a.source_suffix]??9)-(priority[b.source_suffix]??9))[0]||null;
}
function date(){return mapSatelliteDate||(selected&&mapSatelliteCandidates(selected.plot)[0]?.date)||null;}
function pick(p,d,mode){
  const file=typeof selectedSatelliteFile==="function"?selectedSatelliteFile(p.plot,d):null;
  if(file){
    // A selected file is always displayed, even if clouds, shadows or NO_DATA prevent analysis.
    // A 20m/60m TIFF is a native-band preview, NOT a fabricated RGB false-color composite.
    let specific=null;
    {
      const nativeResolution=(mode==="mndwi"||mode==="ndmi"||mode==="ndre")?"20m":"10m";
      if(file.resolution===nativeResolution || (file.resolution==="10m" && mode==="bsi")){
        const variants=entries.filter(v=>v.plot===p.plot&&v.date===d&&v.mode===dataMode(mode));
        const directFile=/^(?!RYF__)/.test(file.title);
        specific=variants.find(v=>directFile&&v.source_suffix==="DIRECT")||
          variants.find(v=>v.source_suffix&&v.source_suffix!=="DIRECT"&&file.title.includes(v.source_suffix))||null;
      }
    }
    const bounds=specific?.bounds||file.preview_bounds||satelliteBoundsByKey.get(p.plot+"|"+d)?.bounds;
    if(specific?.src && bounds) return {plot:p.plot,date:d,mode,url:specific.src,bounds,
      source:"Sentinel-2 "+file.resolution+" / "+file.title,previewResolution:(specific.width&&specific.height)?specific.width+"×"+specific.height+" px":null,
      resolution_m:specific.resolution_m,selectedFile:file.title};
    if(file.web_preview_url && bounds)return {plot:p.plot,date:d,mode,url:file.web_preview_url,bounds,
      source:"Sentinel-2 GeoTIFF "+file.resolution+" • "+file.title,
      previewResolution:file.preview_native_size?file.preview_native_size.join("×")+" px":null,
      resolution_m:file.resolution,selectedFile:file.title,nativePreview:true,
      webPreviewUpscaled:Array.isArray(file.preview_native_size)&&Array.isArray(file.preview_display_size)&&file.preview_display_size[0]>file.preview_native_size[0]*1.5,
      nativePixelSize:file.preview_native_size,
      displayNote:mode!=="true"?"ไฟล์นี้ไม่มีชุดแบนด์สำหรับแสดงตามโหมดที่เลือก จึงแสดง Preview จากไฟล์โดยตรง":""};
    return null;
  }
  const v=available(p,d,mode);
  if(v)return {plot:p.plot,date:d,mode,url:v.src||compactToImage(v),bounds:v.bounds||satelliteBoundsByKey.get(p.plot+"|"+d)?.bounds,source:"Sentinel-2 GeoTIFF",
    previewResolution:(v.width&&v.height)?v.width+"×"+v.height+" px":null,sourceSuffix:v.source_suffix,resolution_m:v.resolution_m};
  if(mode==="true"){
    const row=satelliteRowForMap(p.plot,d),bounds=row?.preview_bounds||satelliteBoundsByKey.get(p.plot+"|"+d)?.bounds;
    if(row?.web_preview_url&&bounds)return {plot:p.plot,date:d,mode,url:row.web_preview_url,bounds,source:"Sentinel-2",
      previewResolution:row.preview_native_size?row.preview_native_size.join("×")+" px":null,
      nativePreview:true,webPreviewUpscaled:Array.isArray(row.preview_native_size)&&Array.isArray(row.preview_display_size)&&row.preview_display_size[0]>row.preview_native_size[0]*1.5,nativePixelSize:row.preview_native_size};
    // A date containing only 20m or 60m products should still be visible.
    const any=satelliteFilesForMap(p.plot,d).find(x=>x.preview_bounds&&x.web_preview_url);
    if(any)return {plot:p.plot,date:d,mode,url:any.web_preview_url,bounds:any.preview_bounds,source:any.title,
      previewResolution:any.preview_native_size?any.preview_native_size.join("×")+" px":null,
      nativePreview:true,resolution_m:any.resolution,webPreviewUpscaled:Array.isArray(any.preview_native_size)&&Array.isArray(any.preview_display_size)&&any.preview_display_size[0]>any.preview_native_size[0]*1.5,nativePixelSize:any.preview_native_size,displayNote:"ไม่มีภาพ 10m ในวันนี้ — แสดงไฟล์ "+any.resolution+" ที่มี"};
  }
  return null;
}
async function init(){
 if(initialized)return;initialized=true;
 try{
   const parts=await Promise.allSettled(Array.from({length:10},(_,i)=>fetch("data/full_preview_part_"+(i+1)+".json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("full preview part "+(i+1)+" HTTP "+r.status);return r.json()})));
   entries=parts.filter(x=>x.status==="fulfilled").flatMap(x=>Array.isArray(x.value.layers)?x.value.layers:[]);if(!entries.length)throw Error("Missing full preview layers");
 }catch(e){
   console.warn("Full preview layers unavailable, falling back to compact quicklooks",e);
   try{const r=await fetch("data/visual_layers.json",{cache:"no-store"});if(r.ok){const j=await r.json();entries=Array.isArray(j.layers)?j.layers:[];}}catch(_){}
 }
 ["boundary","water","labels"].forEach(k=>{const e=$("studio-"+k);if(e)e.addEventListener("change",()=>{state[k]=e.checked;applyVisibility();})});
 $("studio-mode")?.addEventListener("change",e=>{state.mode=e.target.value;state.preset="custom";updateInputs();render(selected)});
 $("studio-resampling")?.addEventListener("change",e=>{state.resampling=e.target.value;applyResampling()});
 $("studio-preset")?.addEventListener("change",e=>preset(e.target.value));
 $("studio-reset")?.addEventListener("click",()=>{const p={mode:state.mode,boundary:state.boundary,water:state.water,labels:state.labels};Object.assign(state,defaults,p);updateInputs();applyColor();});
 ["brightness","contrast","saturation","gamma","r","g","b"].forEach(k=>{
  $("studio-"+k)?.addEventListener("input",e=>{state[k]=Number(e.target.value);$("studio-value-"+k).textContent=state[k]+"%";applyColor()});
 });
 $("studio-save-report")?.addEventListener("click",saveReport);
 $("studio-export-svg")?.addEventListener("click",exportSVG);
 $("studio-export-png")?.addEventListener("click",exportPNG);
 updateInputs();
 if(typeof selected!=='undefined' && selected){
   populateMapSatelliteDates(selected);
   render(selected);
 }
}
function updateInputs(){
 $("studio-mode").value=state.mode;$("studio-preset").value=state.preset;
 if($("studio-resampling"))$("studio-resampling").value=state.resampling;
 ["boundary","water","labels"].forEach(k=>{$("studio-"+k).checked=!!state[k]});
 ["brightness","contrast","saturation","gamma","r","g","b"].forEach(k=>{$("studio-"+k).value=state[k];$("studio-value-"+k).textContent=state[k]+"%"});
 if(typeof syncSatelliteControls==="function")syncSatelliteControls();
}
function syncModes(p){
 if(!p)return;
 const d=date(),e=$("studio-mode");
 const plotHas=mode=>entries.some(v=>v.plot===p.plot&&v.mode===dataMode(mode))||(mode==="true"&&mapSatelliteCandidates(p.plot).length>0);
 [...e.options].forEach(o=>{o.disabled=!plotHas(o.value);o.title=o.disabled?"ไม่มีภาพโหมดนี้สำหรับแปลงที่เลือก":"";});
 if(!plotHas(state.mode))state.mode=["true","false","mndwi","ndwi","ndmi","ndvi","ndre","bsi"].find(plotHas)||"true";
 e.value=state.mode;
 const isIndex=MODES[state.mode].type==="index", legend=$("studio-legend");
 legend.hidden=!isIndex;
 if(isIndex){$("studio-legend-label").textContent=MODES[state.mode].name+" • ค่าประมาณ −1 ถึง +1";$("studio-ramp").style.background="linear-gradient(to right,"+MODES[state.mode].colors.join(",")+")";}
}
/* Satellite imagery is displayed at its full rectangular raster extent; PDD is a separate vector overlay. */
let renderSerial=0;
const nativePreviewCache=new Map();
async function clipPlotImage(p,layer){
 // Older web previews have been stretched by 6x-12x with bilinear interpolation.
 // Sample the centre of each original Sentinel pixel once and let the browser
 // display the native 10m/20m image without synthesising extra ground detail.
 if(!layer.webPreviewUpscaled||!Array.isArray(layer.nativePixelSize)||!layer.url.startsWith("data:image/"))return layer.url;
 const [nw,nh]=layer.nativePixelSize;
 if(nw<1||nh<1||nw*nh>2000000)return layer.url;
 if(nativePreviewCache.has(layer.url))return nativePreviewCache.get(layer.url);
 try{
   const image=new Image();image.src=layer.url;await image.decode();
   if(image.naturalWidth<=nw*1.5)return layer.url;
   const canvas=document.createElement("canvas");canvas.width=nw;canvas.height=nh;
   const ctx=canvas.getContext("2d",{willReadFrequently:false});
   if(!ctx)return layer.url;
   ctx.imageSmoothingEnabled=false;
   // A nearest-neighbour reduction retrieves the source pixel closest to its
   // centre; no upscaling or hallucinated information is performed.
   ctx.drawImage(image,0,0,nw,nh);
   const native=canvas.toDataURL("image/png");
   nativePreviewCache.set(layer.url,native);
   return native;
 }catch(e){console.warn("Native preview reduction unavailable",e);return layer.url}
}
function applyResampling(){
 const sharp=state.resampling!=="smooth";
 Object.values(satelliteImageLayers).forEach(l=>{const el=l?.getElement();if(el){
   el.style.imageRendering=sharp?"pixelated":"auto";
 }});
}
function render(p){
 if(!p)return;const callId=++renderSerial;syncModes(p);current=null;removeMapSatelliteLayers();
 if(!mapSatelliteVisible){status("ภาพดาวเทียมถูกซ่อน");applyVisibility();return}
 let d=date(),layer=pick(p,d,state.mode);
 // Do not jump to a different date just because an index layer is absent.
 // Imagery dates are selected independently of scientific QA.
 if(!layer&&state.mode!=="true"){
   const raw=pick(p,d,"true");
   if(raw){state.mode="true";state.preset="custom";updateInputs();layer={...raw,mode:"true",
     displayNote:"โหมดที่เลือกไม่มีภาพสำหรับวันนี้ — แสดงสีจริงของวันเดิมแทน"};}
 }
 if(!layer?.bounds||!layer.url){status(p.plot+" • "+nice(d)+" • ยังไม่มีภาพ "+MODES[state.mode].name+" ที่พร้อมแสดง");applyVisibility();return}
 const b=L.latLngBounds(layer.bounds[0],layer.bounds[1]);current=layer;
 status("กำลังแสดงภาพเต็มขอบเขต Raster "+p.plot+" • "+nice(d)+"...");
 clipPlotImage(p,layer).then(url=>{
  if(callId!==renderSerial)return;
  current={...layer,url};
  [[overviewMap,"overview"],[fullMap,"full"]].forEach(([map,k])=>{
   if(!map)return;
   satelliteImageLayers[k]=L.imageOverlay(url,b,{pane:"satellitePane",opacity:mapSatelliteOpacity,interactive:false}).addTo(map);
   satelliteImageLayers[k].on("load",()=>{applyColor();applyResampling()});
   satelliteImageLayers[k].on("error",()=>status("เปิดชั้นภาพนี้ไม่สำเร็จ ลองเลือกวันอื่น"));
  });
  applyColor();applyResampling();applyVisibility();
  const qa=window.TrendReport?.rows?.(p.plot)?.find(x=>x.date===d);
  const qualityWarning=qa?.analysis_status==="NO_DATA"?" • ⚠ ภาพวันดังกล่าวผ่าน QA ไม่เพียงพอ":
    qa?.analysis_status==="PARTIAL"?" • ⚠ มีเมฆ/เงาบางส่วน ไม่ครอบคลุมทั้งแปลง":"";
  const boundaryGeometry=boundaryByPlot?.get(p.plot)?.geometry;
  const parts=boundaryGeometry?.type==="MultiPolygon"?boundaryGeometry.coordinates.length:1;
  const partLabel=parts>1?" • PDD MultiPolygon "+parts+" ส่วน":" • PDD Polygon";
    const size=(layer.previewResolution||"").split("×").map(Number);
  const small=size.length===2&&Math.min(...size)<80;
  status(p.plot+" • "+nice(d)+" • "+(layer.nativePreview?"ภาพจาก TIFF ต้นฉบับ":MODES[state.mode].name)+(layer.previewResolution?" • "+layer.previewResolution:"")+
    (layer.resolution_m?" • "+layer.resolution_m+" m":"")+
    (small?" • ⚠ พื้นที่เล็ก จำนวนพิกเซลจาก Sentinel-2 มีจำกัด แม้จะปรับคมก็เพิ่มรายละเอียดจริงไม่ได้":"")+qualityWarning+(layer.displayNote?" • "+layer.displayNote:"")+partLabel+" • ภาพเต็มสี่เหลี่ยม Raster • PDD เป็นชั้นเส้นขอบแยก");
 }).catch(e=>status("แสดงภาพไม่สำเร็จ: "+e.message));
}
function status(s){if($("map-sat-status"))$("map-sat-status").textContent=s;if($("studio-data-status"))$("studio-data-status").textContent=s}
function applyColor(){
 const cm=$("studio-color-matrix"),gamma=$("studio-gamma-transfer");
 if(cm)cm.setAttribute("values",[state.r/100,0,0,0,0,0,state.g/100,0,0,0,0,0,state.b/100,0,0,0,0,0,1,0].join(" "));
 if(gamma)[...gamma.children].forEach(x=>x.setAttribute("exponent",(100/state.gamma).toFixed(3)));
 const svgNeeded=(state.r!==100||state.g!==100||state.b!==100||state.gamma!==100);const css=(svgNeeded?"url(#studio-color-filter) ":"")+"brightness("+state.brightness+"%) contrast("+state.contrast+"%) saturate("+state.saturation+"%)";
 Object.values(satelliteImageLayers).forEach(l=>{const e=l?.getElement();if(e)e.style.filter=css});
}
function applyVisibility(){
 for(const [map,store] of [[overviewMap,mapLayers.overview],[fullMap,mapLayers.full]]){
  if(!map)continue;
  store.forEach((l,name)=>{
   if(l.setStyle)l.setStyle({opacity:state.boundary?(selected?.plot===name?1:0.16):0,weight:state.boundary?(selected?.plot===name?2.8:0.7):0,fillOpacity:state.boundary?(selected?.plot===name?0.045:0):0,color:selected?.plot===name?"#ff5e58":"#c3cdd2"});
   if(l.getTooltip?.())l.unbindTooltip();
   if(state.labels&&name===selected?.plot)l.bindTooltip(name,{permanent:true,direction:"center",className:"studio-map-label"}).openTooltip();
  });
 }
 if(!state.water){
  [[overviewMap,"overview"],[fullMap,"full"]].forEach(([m,k])=>{if(m&&newWaterLayers[k]){m.removeLayer(newWaterLayers[k]);newWaterLayers[k]=null}});
 }else if(selected&&!newWaterLayers.full)updateNewWaterOverlay(selected);
}
function preset(name){
 Object.assign(state,defaults,{preset:name});
 if(name==="clean")Object.assign(state,{mode:"true",boundary:false,water:false});
 if(name==="natural")Object.assign(state,{mode:"true",boundary:true,water:false});
 if(name==="water")Object.assign(state,{mode:"mndwi",boundary:true,water:true});
 if(name==="vegetation")Object.assign(state,{mode:"ndvi",boundary:true,water:false});
 if(name==="soil")Object.assign(state,{mode:"bsi",boundary:true,water:false});
 if(state.mode!=="true"&&!available(selected,date(),state.mode)){notify("ชั้นข้อมูลของวันนี้ยังไม่พร้อม แสดงสีจริงแทน");state.mode="true";}
 updateInputs();render(selected);
}
function saveReport(){
 if(!current)return notify("กรุณาเลือกภาพดาวเทียมที่แสดงได้ก่อน");
 saved={...current,style:{...state},opacity:mapSatelliteOpacity};
 $("studio-saved-note").textContent="บันทึก "+current.plot+" • "+nice(current.date)+" • "+MODES[current.mode].name+" ไว้ใน Quick Report แล้ว";
 notify("บันทึกภาพประกอบรายงานแล้ว");
}
function xy(p,b,w,h){return[(p[0]-b[0][1])/(b[1][1]-b[0][1])*w,(b[1][0]-p[1])/(b[1][0]-b[0][0])*h]}
function paths(f,b,w,h){
 if(!f)return"";const g=f.geometry,polys=g.type==="Polygon"?[g.coordinates]:(g.type==="MultiPolygon"?g.coordinates:[]);
 return polys.map(poly=>poly.map(ring=>ring.map((p,i)=>{const z=xy(p,b,w,h);return(i?"L":"M")+z[0].toFixed(1)+","+z[1].toFixed(1)}).join(" ")+"Z").join(" ")).join(" ");
}
function svg(v){
 const b=v.bounds;if(!b)return"";
 const w=960,lat=(b[0][0]+b[1][0])/2*Math.PI/180,h=Math.max(300,Math.min(960,960*(b[1][0]-b[0][0])/((b[1][1]-b[0][1])*Math.cos(lat))));
 const href=String(v.url).replace(/&/g,"&amp;").replace(/"/g,"&quot;");
 const boundary=v.style.boundary?'<path d="'+paths(boundaryByPlot.get(v.plot),b,w,h)+'" fill="none" stroke="#fc6868" stroke-width="3" fill-rule="evenodd"/>':"";
 const water=v.style.water?'<path d="'+paths(newWaterByPlot.get(v.plot),b,w,h)+'" fill="#38bdf8" fill-opacity=".25" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="5 3" fill-rule="evenodd"/>':"";
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h.toFixed(1)+'" role="img"><image href="'+href+'" width="'+w+'" height="'+h.toFixed(1)+'" preserveAspectRatio="none" opacity="'+v.opacity+'" style="filter:brightness('+v.style.brightness+'%) contrast('+v.style.contrast+'%) saturate('+v.style.saturation+'%)"/>'+water+boundary+'<text x="'+(w-35)+'" y="34" text-anchor="middle" fill="white" font-size="25" font-family="sans-serif" stroke="#23323f" paint-order="stroke">N↑</text></svg>';
}
function reportMarkup(p){
 if(!saved||saved.plot!==p.plot)return"";
 const isExternal=/^https?:/.test(saved.url);
 const b=saved.bounds,lat=(b[0][0]+b[1][0])/2*Math.PI/180,ratio=(b[1][1]-b[0][1])*Math.cos(lat)/(b[1][0]-b[0][0]);
 const imageHTML=isExternal?'<div class="studio-report-stage" style="aspect-ratio:'+ratio.toFixed(5)+'"><img class="studio-report-base" src="'+String(saved.url).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" style="opacity:'+saved.opacity+';filter:brightness('+saved.style.brightness+'%) contrast('+saved.style.contrast+'%) saturate('+saved.style.saturation+'%)" alt="ภาพสีจริงดาวเทียม"/><div class="studio-report-vector">'+svg(saved).replace(/<image\b[^>]*\/>/,'')+'</div></div>':svg(saved);
 return '<div class="report-section studio-report-figure"><h4>ภาพประกอบจาก Map Viewer</h4><div class="studio-report-svg">'+imageHTML+'</div><p>'+saved.plot+' • '+nice(saved.date)+' • '+MODES[saved.mode].name+'</p><small>ภาพสำหรับแสดงผลและสื่อสารผลวิเคราะห์ ค่าสถิติในรายงานยังอ้างอิงผล raster ที่ตรวจสอบแล้ว</small></div>';
}
function saveFile(name,s,mime){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([s],{type:mime}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function exportSVG(){if(!current)return notify("ยังไม่มีภาพที่จะส่งออก");saveFile(safe(current.plot)+"_"+current.date+"_"+state.mode+".svg",svg({...current,style:{...state},opacity:mapSatelliteOpacity}),"image/svg+xml");notify("ส่งออก SVG แล้ว (ภาพฐานเชื่อมจาก URL ต้นทาง)")}
async function exportPNG(){
 if(!current)return notify("ยังไม่มีภาพที่จะส่งออก");
 const u=new URL(current.url,location.href);
 if(!current.url.startsWith("data:")&&u.origin!==location.origin)return notify("ไฟล์ JPG ใน Drive ไม่อนุญาตสร้าง PNG ผ่านเว็บ กรุณาใช้ Export SVG หรือ Quick Report PDF");
 const raw=svg({...current,style:{...state},opacity:mapSatelliteOpacity}),blob=new Blob([raw],{type:"image/svg+xml"}),src=URL.createObjectURL(blob);
 try{const im=new Image();im.src=src;await im.decode();const c=document.createElement("canvas");c.width=1200;c.height=Math.round(c.width*im.height/im.width);c.getContext("2d").drawImage(im,0,0,c.width,c.height);c.toBlob(b=>{if(!b)return notify("Export PNG ไม่สำเร็จ");const u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=safe(current.plot)+"_"+current.date+"_"+state.mode+".png";a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}, "image/png");}
 catch(e){console.warn(e);notify("Export PNG ไม่สำเร็จ ใช้ SVG หรือ PDF แทน");}finally{URL.revokeObjectURL(src)}
}
function setMode(mode){
 if(!["true","false","mndwi","ndwi","ndmi","ndvi","ndre","bsi"].includes(mode))return;
 if(typeof selected!=="undefined"&&selected){
   const availableForPlot=entries.some(v=>v.plot===selected.plot&&v.mode===dataMode(mode))||
     (mode==="true"&&mapSatelliteCandidates(selected.plot).length>0);
   if(!availableForPlot)return notify("ยังไม่มีภาพ "+(MODES[mode]?.name||mode)+" จาก Raster ต้นฉบับของแปลงนี้");
 }
 state.mode=mode;state.preset="custom";updateInputs();if(typeof selected!=="undefined"&&selected)render(selected);
}
window.MapStudio={state,init,render,refresh:()=>selected&&render(selected),applyVisibility,reportMarkup,saveReport,entries:()=>entries,setMode};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();