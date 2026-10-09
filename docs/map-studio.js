/* Map Studio — actual raster layers only, never substitutes fake index colors. */
(function(){
"use strict";
const MODES={
 true:{name:"สีจริง (B4–B3–B2)",type:"rgb"},
 false:{name:"สีเท็จพืช (B8–B4–B3)",type:"rgb"},
 mndwi:{name:"MNDWI (ดัชนีน้ำเปิด)",type:"index",colors:["#916533","#d4b882","#faf2ca","#73b9d1","#095ba3"]},
 ndmi:{name:"NDMI (ความชื้นพืช/พื้นที่)",type:"index",colors:["#995037","#e3ae68","#efe2b8","#69afc7","#125b92"]},
 ndvi:{name:"NDVI (ความเขียวพืช)",type:"index",colors:["#965032","#d8bb70","#e5dea8","#77b96b","#116b38"]},
 ndre:{name:"NDRE (สภาพใบพืช)",type:"index",colors:["#8e4738","#d1b671","#e6e8bd","#85b895","#2c7155"]},
 bsi:{name:"BSI (ดินเปิดโล่ง)",type:"index",colors:["#2b7152","#86a86f","#e9dfac","#d9a36e","#975534"]}
};
const defaults={mode:"true",boundary:true,water:true,labels:false,brightness:100,contrast:100,saturation:100,gamma:100,r:100,g:100,b:100,preset:"custom"};
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
 const v=available(p,d,mode);
 if(v)return {plot:p.plot,date:d,mode,url:v.src||compactToImage(v),bounds:v.bounds||satelliteBoundsByKey.get(p.plot+"|"+d)?.bounds,source:"Sentinel-2 GeoTIFF",previewResolution:(v.width&&v.height)?v.width+"×"+v.height+" px":null,sourceSuffix:v.source_suffix,resolution_m:v.resolution_m};
 if(mode==="true"){
  const row=satelliteRowForMap(p.plot,d),bounds=row?.preview_bounds||satelliteBoundsByKey.get(p.plot+"|"+d)?.bounds;
  if(row?.web_preview_url&&bounds)return {plot:p.plot,date:d,mode,url:row.web_preview_url,bounds,source:"Sentinel-2",previewResolution:row.preview_native_size?row.preview_native_size.join("×")+" px":null};
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
 $("studio-mode")?.addEventListener("change",e=>{state.mode=e.target.value;render(selected)});
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
 ["boundary","water","labels"].forEach(k=>{$("studio-"+k).checked=!!state[k]});
 ["brightness","contrast","saturation","gamma","r","g","b"].forEach(k=>{$("studio-"+k).value=state[k];$("studio-value-"+k).textContent=state[k]+"%"});
}
function syncModes(p){
 if(!p)return;
 const d=date(),e=$("studio-mode");
 const plotHas=mode=>entries.some(v=>v.plot===p.plot&&v.mode===dataMode(mode))||(mode==="true"&&mapSatelliteCandidates(p.plot).length>0);
 [...e.options].forEach(o=>{o.disabled=!plotHas(o.value);o.title=o.disabled?"ไม่มีภาพโหมดนี้สำหรับแปลงที่เลือก":"";});
 if(!plotHas(state.mode))state.mode=["true","false","mndwi","ndvi","ndre","ndmi","bsi"].find(plotHas)||"true";
 e.value=state.mode;
 const isIndex=MODES[state.mode].type==="index", legend=$("studio-legend");
 legend.hidden=!isIndex;
 if(isIndex){$("studio-legend-label").textContent=MODES[state.mode].name+" • ค่าประมาณ −1 ถึง +1";$("studio-ramp").style.background="linear-gradient(to right,"+MODES[state.mode].colors.join(",")+")";}
}
function render(p){
 if(!p)return;syncModes(p);current=null;removeMapSatelliteLayers();
 if(!mapSatelliteVisible){status("ภาพดาวเทียมถูกซ่อน");applyVisibility();return}
 let d=date(),layer=pick(p,d,state.mode);
 if(!layer){
   const choices=[...new Set(entries.filter(v=>v.plot===p.plot&&v.mode===dataMode(state.mode)).map(v=>v.date)
     .concat(state.mode==="true"?mapSatelliteCandidates(p.plot).map(v=>v.date):[]))].sort().reverse();
   if(choices.length){
     d=choices[0];mapSatelliteDate=d;
     const sel=$("map-sat-date");if(sel&&[...sel.options].some(o=>o.value===d))sel.value=d;
     layer=pick(p,d,state.mode);
   }
 }
 if(!layer?.bounds||!layer.url){status(p.plot+" • "+nice(d)+" • ยังไม่มีภาพ "+MODES[state.mode].name+" ที่พร้อมแสดง");applyVisibility();return}
 const b=L.latLngBounds(layer.bounds[0],layer.bounds[1]);current=layer;
 [[overviewMap,"overview"],[fullMap,"full"]].forEach(([map,k])=>{
  if(!map)return;
  satelliteImageLayers[k]=L.imageOverlay(layer.url,b,{pane:"satellitePane",opacity:mapSatelliteOpacity,interactive:false}).addTo(map);
  satelliteImageLayers[k].on("load",applyColor);
  satelliteImageLayers[k].on("error",()=>status("เปิดภาพไม่สำเร็จ ตรวจสอบสิทธิ์ของ Google Drive JPG"));
 });
 applyColor();applyVisibility();status(p.plot+" • "+nice(d)+" • "+MODES[state.mode].name+(layer.previewResolution?" • "+layer.previewResolution:"")+(layer.resolution_m?" • "+layer.resolution_m+" m":"")+" • สร้างจาก GeoTIFF จริง");
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
   if(l.setStyle)l.setStyle({opacity:state.boundary?1:0,weight:state.boundary?(selected?.plot===name?3:1.5):0,fillOpacity:state.boundary?(selected?.plot===name?0.15:0.025):0});
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
window.MapStudio={state,init,render,refresh:()=>selected&&render(selected),applyVisibility,reportMarkup,saveReport,entries:()=>entries};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();