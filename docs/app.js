const STATUS = {
  HIGH:{label:'สัญญาณน้ำสูง',color:'#fb5a5a'},
  WATCH:{label:'เฝ้าระวัง',color:'#f59e0b'},
  NORMAL:{label:'ปกติ/ลดลง',color:'#22c55e'},
  NO_DATA:{label:'ข้อมูลไม่เพียงพอ',color:'#64748b'}
};
const VEG = {
  STRESS_SIGNAL:'มีสัญญาณพืชเครียดจากสภาพเปียก/น้ำขัง', WATCH:'ควรติดตามพืช', STABLE:'ยังไม่พบสัญญาณเสื่อมชัด', NO_DATA:'ไม่มีข้อมูลพืช'
};
let dataset=null, plots=[], selected=null, overviewMap=null, fullMap=null, chart=null, activeStatus='ALL';
let satelliteFiles=[], satellitePartsMeta=null, jpgPreviewMap={};
let satelliteBounds=[], satelliteBoundsByKey=new Map();
const satelliteImageLayers={overview:null,full:null};
let mapSatelliteDate=null, mapSatelliteOpacity=.82, mapSatelliteVisible=true;
let boundaryFC=null, boundaryByPlot=new Map();
let newWaterFC=null, newWaterByPlot=new Map();
const mapLayers={overview:new Map(),full:new Map()};
const newWaterLayers={overview:null,full:null};
const fmt=n=>n===null||n===undefined||Number.isNaN(n)?'N/A':Number(n).toLocaleString('th-TH',{maximumFractionDigits:2});
const idx=n=>n===null||n===undefined||Number.isNaN(n)?'N/A':Number(n).toFixed(3);
const dateTH=s=>{if(!s||s.length!==8)return '—';return `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`};
const delta=(a,b,digits=3)=>a==null||b==null?'N/A':`${b-a>=0?'+':''}${(b-a).toFixed(digits)}`;

async function init(){
  const [r,b,w,sb]=await Promise.all([
    fetch('data/plots.json',{cache:'no-store'}),
    fetch('data/boundaries.geojson',{cache:'no-store'}),
    fetch('data/new_water.geojson',{cache:'no-store'}),
    fetch('data/satellite_bounds.json',{cache:'no-store'})
  ]);
  if(!r.ok) throw new Error(`plots.json HTTP ${r.status}`);
  if(!b.ok) throw new Error(`boundaries.geojson HTTP ${b.status}`);
  if(!w.ok) throw new Error(`new_water.geojson HTTP ${w.status}`);
  if(!sb.ok) throw new Error(`satellite_bounds.json HTTP ${sb.status}`);
  dataset=await r.json(); plots=dataset.plots;
  boundaryFC=await b.json();
  newWaterFC=await w.json();
  const sbData=await sb.json(); satelliteBounds=sbData.overlays||[];
  satelliteBoundsByKey=new Map(satelliteBounds.map(x=>[`${x.plot}|${x.date}`,x]));
  boundaryByPlot=new Map(boundaryFC.features.map(f=>[f.properties.plot,f]));
  newWaterByPlot=new Map(newWaterFC.features.map(f=>[f.properties.plot,f]));
  document.getElementById('updated-pill').textContent=`อัปเดต ${dataset.updated}`;
  ['verified-folder','verified-folder-2'].forEach(id=>{const el=document.getElementById(id);el.href=dataset.report_folder});
  bindUI(); renderKPIs(); renderSidebar(); renderPriority(); renderMatrix(); initMaps(); populateReportSelect();

  const params=new URLSearchParams(location.search);
  const requestedPlot=params.get('plot');
  const initial=plots.find(p=>p.plot===requestedPlot)||plots.find(p=>p.plot==='13-STC')||plots[0];
  selectPlot(initial,false);
  await loadSatelliteLibrary();
  const requestedTab=params.get('tab');
  if(['overview','map','impact','satellite','report'].includes(requestedTab)) switchTab(requestedTab,false);
  if(params.get('report')==='verified'){
    document.getElementById('report-type').value='verified';
    switchTab('report',false);
  }
  renderReportPreview();
}
function bindUI(){
  document.getElementById('search-input').addEventListener('input',renderSidebar);
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeStatus=b.dataset.status;renderSidebar()}));
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  document.getElementById('report-plot').addEventListener('change',renderReportPreview);
  document.getElementById('report-type').addEventListener('change',renderReportPreview);
  ['sat-filter-plot','sat-filter-date','sat-filter-sensor','sat-filter-resolution'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderSatelliteGallery));
  document.getElementById('map-sat-date')?.addEventListener('change',e=>{mapSatelliteDate=e.target.value;updateMapSatelliteOverlay(selected)});
  document.getElementById('map-sat-visible')?.addEventListener('change',e=>{mapSatelliteVisible=e.target.checked;updateMapSatelliteOverlay(selected)});
  document.getElementById('map-sat-opacity')?.addEventListener('input',e=>{mapSatelliteOpacity=Number(e.target.value)/100;Object.values(satelliteImageLayers).forEach(l=>l?.setOpacity(mapSatelliteOpacity))});
}
function switchTab(tab,updateUrl=true){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('active',x.id===`tab-${tab}`));if(updateUrl)updateQuery({tab});setTimeout(()=>{if(tab==='map'&&fullMap){fullMap.invalidateSize();if(selected){populateMapSatelliteDates(selected);updateMapSatelliteOverlay(selected);focusMaps(selected)}}if(tab==='overview'&&overviewMap)overviewMap.invalidateSize()},160)}
function openReportCenter(){switchTab('report');renderReportPreview()}
function renderKPIs(){const c={HIGH:0,WATCH:0,NORMAL:0,NO_DATA:0};plots.forEach(p=>c[p.status]++);document.getElementById('kpi-total').textContent=plots.length;document.getElementById('kpi-high').textContent=c.HIGH;document.getElementById('kpi-watch').textContent=c.WATCH;document.getElementById('kpi-nodata').textContent=c.NO_DATA}
function renderSidebar(){const q=document.getElementById('search-input').value.trim().toLowerCase();const list=document.getElementById('plot-list');list.innerHTML='';plots.filter(p=>(activeStatus==='ALL'||p.status===activeStatus)&&p.plot.toLowerCase().includes(q)).forEach(p=>{const d=document.createElement('div');d.className=`plot-item ${selected?.plot===p.plot?'active':''}`;d.innerHTML=`<div class="plot-top"><strong>${p.plot}</strong><span><i class="status-dot" style="background:${STATUS[p.status].color}"></i><small>${STATUS[p.status].label}</small></span></div><div class="plot-bottom"><span>${fmt(p.area_rai)} ไร่</span><span>${p.water_change_pp==null?'N/A':`${p.water_change_pp>0?'+':''}${fmt(p.water_change_pp)} pp`}</span></div>`;d.onclick=()=>selectPlot(p);list.appendChild(d)})}
function renderPriority(){const el=document.getElementById('priority-list');el.innerHTML='';const sorted=plots.filter(p=>p.status!=='NO_DATA').sort((a,b)=>(b.water_change_pp??-999)-(a.water_change_pp??-999)).slice(0,7);sorted.forEach((p,i)=>{const d=document.createElement('div');d.className='priority-item';d.innerHTML=`<div class="priority-rank">${i+1}</div><div><strong>${p.plot}</strong><small>${STATUS[p.status].label} • น้ำล่าสุด ${fmt(p.water_current_pct)}%</small></div><div class="priority-value">${p.water_change_pp>=0?'+':''}${fmt(p.water_change_pp)} pp</div>`;d.onclick=()=>selectPlot(p);el.appendChild(d)})}
function summaryText(p){if(p.status==='NO_DATA')return 'ภาพปัจจุบันไม่มี valid pixels เพียงพอ จึงยังไม่ควรสรุปผลกระทบของแปลงนี้';const veg=VEG[p.vegetation_status];if(p.status==='HIGH')return `พบสัญญาณน้ำเพิ่มขึ้นอย่างชัดเจนภายในแปลง โดยมีพื้นที่น้ำใหม่ประมาณ ${fmt(p.new_water_rai)} ไร่ • ${veg}`;if(p.status==='WATCH')return `พบการเปลี่ยนแปลงของน้ำที่ควรติดตามต่อ พื้นที่น้ำใหม่ประมาณ ${fmt(p.new_water_rai)} ไร่ • ${veg}`;return `ไม่พบสัญญาณน้ำเพิ่มสูงในรอบเปรียบเทียบนี้ • ${veg}`}
function selectPlot(p,updateUrl=true){selected=p;renderSidebar();document.getElementById('detail-title').textContent=p.plot;const st=document.getElementById('detail-status');st.textContent=STATUS[p.status].label;st.className=`status-pill status-${p.status}`;document.getElementById('detail-area').textContent=`พื้นที่ ${fmt(p.area_rai)} ไร่`;document.getElementById('detail-dates').textContent=`${dateTH(p.baseline)} → ${dateTH(p.current)}`;document.getElementById('plain-summary').textContent=summaryText(p);document.getElementById('water-values').textContent=`${fmt(p.water_before_rai)} → ${fmt(p.water_current_rai)} ไร่`;document.getElementById('water-delta').textContent=p.water_change_pp==null?'N/A':`${p.water_change_pp>=0?'+':''}${fmt(p.water_change_pp)} จุดเปอร์เซ็นต์`;document.getElementById('ndvi-values').textContent=`${idx(p.ndvi_before)} → ${idx(p.ndvi_current)}`;document.getElementById('ndvi-delta').textContent=delta(p.ndvi_before,p.ndvi_current);document.getElementById('ndre-values').textContent=`${idx(p.ndre_before)} → ${idx(p.ndre_current)}`;document.getElementById('ndre-delta').textContent=delta(p.ndre_before,p.ndre_current);document.getElementById('ndmi-values').textContent=`${idx(p.ndmi_before)} → ${idx(p.ndmi_current)}`;document.getElementById('ndmi-delta').textContent=delta(p.ndmi_before,p.ndmi_current);updateChart(p);focusMaps(p);document.getElementById('report-plot').value=p.plot;updateMapHighlight();syncSatellitePlotFilter(p.plot);populateMapSatelliteDates(p);updateMapSatelliteOverlay(p);if(updateUrl)updateQuery({plot:p.plot})}
function datePretty(s){
  if(!s)return '—';
  const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}/${m[2]}/${m[1]}`:s;
}
function fileSizePretty(n){
  n=Number(n||0); if(n<1024)return `${n} B`; if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`; return `${(n/1024/1024).toFixed(1)} MB`;
}
async function loadSatelliteLibrary(){
  const status=document.getElementById('satellite-sync-status');
  try{
    const r=await fetch('data/satellite_parts.json',{cache:'no-store'});
    if(!r.ok)throw new Error(`satellite_parts.json HTTP ${r.status}`);
    satellitePartsMeta=await r.json();
    let pr=null;try{pr=await fetch('data/jpg_previews.json',{cache:'no-store'});if(pr.ok)jpgPreviewMap=await pr.json()}catch(_){jpgPreviewMap={}}
    const chunks=await Promise.all(satellitePartsMeta.parts.map(async part=>{
      const rr=await fetch('data/'+part.file,{cache:'no-store'});
      if(!rr.ok)throw new Error(`${part.file} HTTP ${rr.status}`);
      return rr.json();
    }));
    // Each source GeoTIFF has a separate browser-renderable image built from its real raster bands.
    // Keep the original Drive link as a download source and never ask browsers to preview a TIFF.
    const displayChunks=await Promise.all(satellitePartsMeta.parts.map(async (_,i)=>{
      const resp=await fetch('data/existing_display_part_'+(i+1)+'.json',{cache:'no-store'});
      if(!resp.ok)throw new Error('display previews part '+(i+1)+' HTTP '+resp.status);
      return resp.json();
    }));
    const previews=new Map(displayChunks.flatMap(c=>Object.entries(c.files||{})));
    const byId=new Map();chunks.flat().forEach(x=>byId.set(x.id,x));
    satelliteFiles=[...byId.values()].map(x=>{
      const d=previews.get(x.title);
      const result=Object.assign({},x,jpgPreviewMap[x.id]||{});
      if(d&&d.src){
        result.web_preview_url=d.src;
        result.preview_kind=d.kind;
        result.preview_bounds=d.bounds;
        result.preview_native_size=[d.width,d.height];
        result.preview_display_size=[d.display_width,d.display_height];
        result.preview_ready=true;
      }else result.preview_ready=false;
      return result;
    }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.plot||'').localeCompare(String(b.plot||''))||String(a.resolution||'').localeCompare(String(b.resolution||'')));
    const ready=satelliteFiles.filter(x=>x.preview_ready).length;
    const src=document.getElementById('satellite-source-folder'); if(src)src.href=satellitePartsMeta.source_root?.url||'#';
    if(status)status.textContent=`ภาพพร้อมแสดง ${ready}/${satelliteFiles.length} ไฟล์ • TIFF ต้นฉบับอยู่ใน Google Drive • อัปเดตรายการ ${new Date(satellitePartsMeta.updated_at).toLocaleString('th-TH')}`;
    populateSatelliteFilters();
    renderSatelliteGallery();
    populateMapSatelliteDates(selected);
    updateMapSatelliteOverlay(selected);
    window.MapStudio?.refresh?.();
  }catch(e){
    console.error(e);
    if(status)status.textContent='โหลดรายการภาพจาก Google Drive ไม่สำเร็จ';
  }
}
function populateSatelliteFilters(){
  const plotSel=document.getElementById('sat-filter-plot');
  const dateSel=document.getElementById('sat-filter-date');
  const sensorSel=document.getElementById('sat-filter-sensor');
  const resSel=document.getElementById('sat-filter-resolution');
  const plotsAvail=[...new Set(satelliteFiles.map(x=>x.plot).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  plotSel.innerHTML='<option value="ALL">ทุกแปลง</option>'+plotsAvail.map(x=>`<option value="${x}">${x}</option>`).join('');
  const dates=[...new Set(satelliteFiles.map(x=>x.date).filter(Boolean))].sort().reverse();
  dateSel.innerHTML='<option value="ALL">ทุกวันที่</option>'+dates.map(x=>`<option value="${x}">${datePretty(x)}</option>`).join('');
  const sensors=[...new Set(satelliteFiles.map(x=>x.sensor).filter(Boolean))].sort();
  sensorSel.innerHTML='<option value="ALL">ทุกดาวเทียม</option>'+sensors.map(x=>`<option value="${x}">${x}</option>`).join('');
  const resolutions=[...new Set(satelliteFiles.map(x=>x.resolution).filter(Boolean))].sort((a,b)=>parseInt(a)-parseInt(b));
  resSel.innerHTML='<option value="ALL">ทุกความละเอียด</option>'+resolutions.map(x=>`<option value="${x}">${x}</option>`).join('');
  syncSatellitePlotFilter(selected?.plot||'ALL');
}
function syncSatellitePlotFilter(plot){
  const sel=document.getElementById('sat-filter-plot');
  if(!sel||!satelliteFiles.length)return;
  if([...sel.options].some(o=>o.value===plot))sel.value=plot;
  if(document.getElementById('tab-satellite')?.classList.contains('active'))renderSatelliteGallery();
}
function resetSatelliteFilters(){
  document.getElementById('sat-filter-plot').value='ALL';
  document.getElementById('sat-filter-date').value='ALL';
  document.getElementById('sat-filter-sensor').value='ALL';
  document.getElementById('sat-filter-resolution').value='ALL';
  renderSatelliteGallery();
}
function satelliteFiltered(){
  const p=document.getElementById('sat-filter-plot')?.value||'ALL';
  const d=document.getElementById('sat-filter-date')?.value||'ALL';
  const s=document.getElementById('sat-filter-sensor')?.value||'ALL';
  const r=document.getElementById('sat-filter-resolution')?.value||'ALL';
  return satelliteFiles.filter(x=>(p==='ALL'||x.plot===p)&&(d==='ALL'||x.date===d)&&(s==='ALL'||x.sensor===s)&&(r==='ALL'||x.resolution===r));
}
function renderSatelliteGallery(){
  const gallery=document.getElementById('satellite-gallery'); if(!gallery)return;
  const rows=satelliteFiltered();
  document.getElementById('sat-count-files').textContent=rows.length;
  document.getElementById('sat-count-dates').textContent=new Set(rows.map(x=>x.date).filter(Boolean)).size;
  document.getElementById('sat-count-plots').textContent=new Set(rows.map(x=>x.plot).filter(Boolean)).size;
  document.getElementById('sat-latest-date').textContent=rows.length?datePretty([...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0].date):'—';
  if(!rows.length){gallery.innerHTML='<div class="sat-empty">ไม่พบภาพตามตัวกรองนี้</div>';return}
  gallery.innerHTML=rows.map(x=>`<article class="sat-card" onclick="openSatelliteViewer('${x.id}')">
    <div class="sat-thumb">
      <img class="sat-gallery-img" data-file-id="${x.id}" loading="lazy" alt="${x.plot} ${x.date}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
      <div class="sat-thumb-fallback"><span>ยังไม่มีภาพ</span><small>กดเปิดไฟล์ต้นฉบับใน Drive</small></div>
      <div class="sat-resolution">${x.resolution||'—'}</div>
    </div>
    <div class="sat-card-body">
      <div class="sat-card-top"><strong>${x.plot}</strong><span>${x.sensor}</span></div>
      <h4>${datePretty(x.date)}</h4>
      <p>${x.title}</p>
      <div class="sat-card-meta"><span>${x.preview_kind==='true_color'?'สีจริง':x.preview_kind==='ndmi'?'ดัชนีความชื้น':x.preview_kind?.includes('grayscale')?'ภาพระดับเทา':x.preview_kind==='no_valid_pixels'?'ไม่มีพิกเซลที่ใช้ได้':'ภาพแสดงผล'}</span><span>${fileSizePretty(x.size)}</span></div>
    </div>
  </article>`).join('');
  // Assign image sources as DOM properties, not strings in innerHTML (large data URLs).
  const dict=new Map(rows.map(x=>[x.id,x]));
  gallery.querySelectorAll('img[data-file-id]').forEach(im=>{
    const x=dict.get(im.dataset.fileId);
    if(x?.web_preview_url)im.src=x.web_preview_url;
    else{im.style.display='none';im.nextElementSibling.style.display='grid'}
  });
}
function openSatelliteViewer(id){
  const x=satelliteFiles.find(f=>f.id===id); if(!x)return;
  const modal=document.getElementById('satellite-modal');
  const img=document.getElementById('sat-modal-image');
  const waiting=document.getElementById('sat-modal-waiting');
  document.getElementById('sat-modal-title').textContent=`${x.plot} • ${datePretty(x.date)}`;
  document.getElementById('sat-modal-meta').textContent=`${x.sensor} • ${x.resolution||'ไม่ระบุ resolution'} • ${x.preview_kind||'GeoTIFF'} • ${x.title}`;
  document.getElementById('sat-modal-drive').href=x.url;
  document.getElementById('sat-modal-original').href=x.url;
  if(x.web_preview_url){
    img.src=x.web_preview_url; img.style.display='block'; waiting.style.display='none';
    img.onerror=()=>{img.style.display='none';waiting.style.display='grid'};
  }else{
    img.removeAttribute('src'); img.style.display='none'; waiting.style.display='grid';
  }
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
}
function closeSatelliteViewer(){
  const modal=document.getElementById('satellite-modal'); if(!modal)return;
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
  const img=document.getElementById('sat-modal-image'); if(img){img.removeAttribute('src');img.style.display='none'}
}
function mapSatelliteCandidates(plot){
  return satelliteFiles
    .filter(x=>x.plot===plot && x.sensor==='Sentinel-2' && x.resolution==='10m')
    .filter(x=>x.web_preview_url && (x.preview_bounds || satelliteBoundsByKey.has(`${x.plot}|${x.date}`)))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function populateMapSatelliteDates(p){
  const sel=document.getElementById('map-sat-date'); if(!sel||!p)return;
  const from10m=mapSatelliteCandidates(p.plot).map(x=>x.date);
  const fromVisual=window.MapStudio?.entries?.()?.filter(x=>x.plot===p.plot).map(x=>x.date)||[];
  const dates=[...new Set([...from10m,...fromVisual].filter(Boolean))].sort().reverse();
  const current=mapSatelliteDate && dates.includes(mapSatelliteDate) ? mapSatelliteDate : (dates[0]||'');
  sel.innerHTML=dates.length?dates.map(d=>`<option value="${d}">${datePretty(d)}</option>`).join(''):'<option value="">ไม่มีภาพ</option>';
  sel.value=current; mapSatelliteDate=current||null;
}
function satelliteRowForMap(plot,date){
  const rows=mapSatelliteCandidates(plot).filter(x=>x.date===date);
  return rows.find(x=>x.web_preview_url)||rows[0]||null;
}
function removeMapSatelliteLayers(){
  [[overviewMap,'overview'],[fullMap,'full']].forEach(([map,key])=>{
    if(map && satelliteImageLayers[key]) map.removeLayer(satelliteImageLayers[key]);
    satelliteImageLayers[key]=null;
  });
}
function updateMapSatelliteOverlay(p){
  if(window.MapStudio?.render)return window.MapStudio.render(p);
  const status=document.getElementById('map-sat-status');
  if(!p){removeMapSatelliteLayers();return}
  if(!mapSatelliteVisible){
    removeMapSatelliteLayers();
    if(status)status.textContent='ซ่อนภาพดาวเทียมอยู่';
    return;
  }
  const date=mapSatelliteDate || mapSatelliteCandidates(p.plot)[0]?.date;
  const row=satelliteRowForMap(p.plot,date);
  const oldGeo=satelliteBoundsByKey.get(`${p.plot}|${date}`);
  const imageBounds=row?.preview_bounds || oldGeo?.bounds || null;
  removeMapSatelliteLayers();
  if(!row||!imageBounds){
    if(status)status.textContent=`${p.plot} • ยังไม่มีภาพ 10 m ที่ผูกพิกัดสำหรับวันที่เลือก`;
    return;
  }
  if(!row.web_preview_url){
    if(status)status.textContent=`${p.plot} • ${datePretty(date)} • กำลังรอ JPG Preview จาก GeoTIFF`;
    return;
  }
  const bounds=L.latLngBounds(imageBounds[0],imageBounds[1]);
  [[overviewMap,'overview'],[fullMap,'full']].forEach(([map,key])=>{
    if(!map)return;
    const layer=L.imageOverlay(row.web_preview_url,bounds,{opacity:mapSatelliteOpacity,pane:'satellitePane',interactive:false,crossOrigin:false}).addTo(map);
    satelliteImageLayers[key]=layer;
  });
  if(status)status.textContent=`${p.plot} • ${datePretty(date)} • True Color 10 m • JPG Preview`;
  updateMapHighlight();
  updateNewWaterOverlay(p);
  window.MapStudio?.applyVisibility?.();
}
function updateChart(p){const labels=['น้ำ (%)','NDVI ×100','NDRE ×100','NDMI ×100'];const before=[p.water_before_pct,p.ndvi_before==null?null:p.ndvi_before*100,p.ndre_before==null?null:p.ndre_before*100,p.ndmi_before==null?null:p.ndmi_before*100];const current=[p.water_current_pct,p.ndvi_current==null?null:p.ndvi_current*100,p.ndre_current==null?null:p.ndre_current*100,p.ndmi_current==null?null:p.ndmi_current*100];if(chart)chart.destroy();chart=new Chart(document.getElementById('change-chart'),{type:'bar',data:{labels,datasets:[{label:'เดิม',data:before,backgroundColor:'rgba(56,189,248,.45)',borderColor:'#38bdf8',borderWidth:1},{label:'ปัจจุบัน',data:current,backgroundColor:'rgba(245,158,11,.55)',borderColor:'#f59e0b',borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#9cb4c7',boxWidth:10}}},scales:{x:{ticks:{color:'#9cb4c7'},grid:{display:false}},y:{ticks:{color:'#7792a7'},grid:{color:'rgba(255,255,255,.06)'}}}}})}
function popupHtml(p){
  const q=boundaryByPlot.get(p.plot)?.properties?.boundary_quality;
  const boundaryNote=q==='verified'?'ขอบเขตจากพิกัด UTM':'ตำแหน่งแปลง (รอตรวจ polygon)';
  return `<b>${p.plot}</b><br>${STATUS[p.status].label}<br>พื้นที่ ${fmt(p.area_rai)} ไร่<br>น้ำล่าสุด ${fmt(p.water_current_pct)}%<br><small>${boundaryNote}</small><br><a href="${p.report_url||dataset.report_folder}" target="_blank" rel="noopener" style="color:#60d5ff">เปิด Verified PDF</a>`;
}
function addPlotLayer(m,p,store){
  const feat=boundaryByPlot.get(p.plot); let layer;
  if(feat && feat.geometry && feat.geometry.type!=='Point'){
    layer=L.geoJSON(feat,{style:{
      color:STATUS[p.status].color,weight:2,opacity:.95,
      fillColor:STATUS[p.status].color,fillOpacity:.10
    }}).addTo(m);
  }else{
    layer=L.circleMarker([p.lat,p.lon],{radius:9,color:'#07111c',weight:2,fillColor:STATUS[p.status].color,fillOpacity:.92}).addTo(m);
  }
  layer.bindPopup(popupHtml(p));
  layer.on('click',()=>selectPlot(p));
  store.set(p.plot,layer);
}
function initBaseMap(id,store){
  const m=L.map(id,{zoomControl:true}).setView([12.72,101.72],11);
  m.createPane('satellitePane'); m.getPane('satellitePane').style.zIndex=250;
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri World Imagery'}).addTo(m);
  plots.forEach(p=>addPlotLayer(m,p,store));
  return m;
}
function initMaps(){
  overviewMap=initBaseMap('overview-map',mapLayers.overview);
  fullMap=initBaseMap('full-map',mapLayers.full);
  const polygonFeatures=boundaryFC?.features?.filter(f=>f.geometry?.type!=='Point')||[];
  if(polygonFeatures.length){
    const bounds=L.geoJSON({type:'FeatureCollection',features:polygonFeatures}).getBounds();
    overviewMap.fitBounds(bounds,{padding:[20,20]}); fullMap.fitBounds(bounds,{padding:[25,25]});
  }else{
    const pts=plots.filter(p=>p.lat&&p.lon).map(p=>[p.lat,p.lon]);
    if(pts.length){overviewMap.fitBounds(pts,{padding:[25,25]});fullMap.fitBounds(pts,{padding:[35,35]})}
  }
}
function updateMapHighlight(){
  for(const store of [mapLayers.overview,mapLayers.full]){
    store.forEach((layer,name)=>{
      const p=plots.find(x=>x.plot===name); if(!p)return;
      if(layer.setStyle){
        layer.setStyle({color:STATUS[p.status].color,weight:name===selected?.plot?4:2,fillOpacity:name===selected?.plot ? .28 : .18});
      }
    });
  }
}
function updateNewWaterOverlay(p){
  const feature=newWaterByPlot.get(p.plot);
  const pairs=[[overviewMap,'overview'],[fullMap,'full']];
  pairs.forEach(([map,key])=>{
    if(!map)return;
    if(newWaterLayers[key]){
      map.removeLayer(newWaterLayers[key]);
      newWaterLayers[key]=null;
    }
    if(!feature||window.MapStudio?.state?.water===false)return;
    const layer=L.geoJSON(feature,{
      style:{
        color:'#38bdf8',
        weight:1.5,
        opacity:1,
        fillColor:'#38bdf8',
        fillOpacity:.24,
        dashArray:'5 3'
      }
    }).addTo(map);
    layer.bindPopup(`<b>${p.plot}</b><br><span style="color:#38bdf8">พื้นที่น้ำใหม่</span><br>ประมาณ ${fmt(feature.properties.new_water_rai)} ไร่<br><small>เทียบ ${dateTH(p.baseline)} → ${dateTH(p.current)}</small>`);
    newWaterLayers[key]=layer;
    if(layer.bringToFront)layer.bringToFront();
  });
}
function focusMaps(p){
  [overviewMap,fullMap].forEach((m,i)=>{
    if(!m)return; const store=i===0?mapLayers.overview:mapLayers.full; const layer=store.get(p.plot);
    if(layer?.getBounds && layer.getBounds().isValid()) m.fitBounds(layer.getBounds(),{padding:[55,55],maxZoom:16});
    else if(p.lat&&p.lon) m.flyTo([p.lat,p.lon],14,{duration:.5});
  });
  updateMapHighlight();
  updateNewWaterOverlay(p);
}
function openVerifiedReport(){if(selected?.report_url)window.open(selected.report_url,'_blank','noopener')}
function updateQuery(values){
  const u=new URL(location.href);
  Object.entries(values).forEach(([k,v])=>v==null?u.searchParams.delete(k):u.searchParams.set(k,v));
  history.replaceState({},'',u);
}
function showToast(message){
  let t=document.getElementById('portal-toast');
  if(!t){t=document.createElement('div');t.id='portal-toast';t.className='toast';document.body.appendChild(t)}
  t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1800);
}
async function copyShareLink(){
  const u=new URL(location.href);u.searchParams.set('plot',selected?.plot||plots[0]?.plot||'13-STC');
  try{await navigator.clipboard.writeText(u.toString());showToast('คัดลอกลิงก์แล้ว')}catch(e){prompt('คัดลอกลิงก์นี้',u.toString())}
}
function downloadCSV(){
  const headers=['plot','status','area_rai','baseline','current','water_before_rai','water_before_pct','water_current_rai','water_current_pct','water_change_pp','new_water_rai','stable_land_rai','ndvi_before','ndvi_current','ndre_before','ndre_current','ndmi_before','ndmi_current','latest_valid_pct'];
  const esc=v=>v==null?'':`"${String(v).replaceAll('"','""')}"`;
  const rows=[headers.join(','),...plots.map(p=>headers.map(h=>esc(p[h])).join(','))];
  const blob=new Blob(['\ufeff'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Rayong_Flood_Monitoring_${dataset.updated}.csv`;a.click();URL.revokeObjectURL(a.href);showToast('ดาวน์โหลด CSV แล้ว');
}
function drivePreviewUrl(url){
  const m=String(url||'').match(/\/file\/d\/([^/]+)/);
  return m?`https://drive.google.com/file/d/${m[1]}/preview`:url;
}
function badge(status){return `<span class="matrix-badge status-${status}">${STATUS[status].label}</span>`}
function renderMatrix(){const body=document.getElementById('impact-body');body.innerHTML='';plots.forEach(p=>{const tr=document.createElement('tr');tr.innerHTML=`<td><b>${p.plot}</b></td><td>${badge(p.status)}</td><td>${fmt(p.water_before_pct)}%</td><td>${fmt(p.water_current_pct)}%</td><td>${fmt(p.new_water_rai)} ไร่</td><td>${idx(p.ndvi_before)} → ${idx(p.ndvi_current)}</td><td>${idx(p.ndre_before)} → ${idx(p.ndre_current)}</td><td>${idx(p.ndmi_before)} → ${idx(p.ndmi_current)}</td><td>${VEG[p.vegetation_status]}</td>`;tr.onclick=()=>{selectPlot(p);switchTab('overview')};body.appendChild(tr)})}
function populateReportSelect(){const s=document.getElementById('report-plot');s.innerHTML=plots.map(p=>`<option>${p.plot}</option>`).join('')}
function showSelectedReport(){document.getElementById('report-plot').value=selected.plot;switchTab('report');renderReportPreview()}
function renderReportPreview(){
  const name=document.getElementById('report-plot').value||selected?.plot;
  const p=plots.find(x=>x.plot===name)||plots[0];
  const type=document.getElementById('report-type').value;
  const verifiedLink=document.getElementById('verified-folder-2');
  const paper=document.getElementById('report-paper');
  const frame=document.getElementById('verified-pdf-frame');
  const printBtn=document.getElementById('print-report-btn');
  if(verifiedLink) verifiedLink.href=p.report_url||dataset.report_folder;
  updateQuery({plot:p.plot,tab:'report',report:type==='verified'?'verified':null});

  if(type==='verified'){
    paper.style.display='none';
    frame.style.display='block';
    frame.src=drivePreviewUrl(p.report_url||dataset.report_folder);
    if(printBtn) printBtn.style.display='none';
    return;
  }

  frame.style.display='none'; frame.src='about:blank';
  paper.style.display='block';
  if(printBtn) printBtn.style.display='block';
  paper.innerHTML=`<div class="report-title">รายงานติดตามน้ำท่วมและผลกระทบสิ่งแวดล้อม</div>
  <div class="report-sub">${p.plot} • จังหวัดระยอง • Sentinel-2 L2A • ${dateTH(p.baseline)} → ${dateTH(p.current)}</div>
  <div class="report-rule"></div>
  <div class="report-kpis">
    <div class="report-kpi"><span>พื้นที่โครงการ</span><strong>${fmt(p.area_rai)} ไร่</strong></div>
    <div class="report-kpi"><span>น้ำล่าสุด</span><strong>${fmt(p.water_current_pct)}%</strong></div>
    <div class="report-kpi"><span>พื้นที่น้ำใหม่</span><strong>${fmt(p.new_water_rai)} ไร่</strong></div>
  </div>
  <div class="report-section"><h4>ข้อสรุปการเปลี่ยนแปลง</h4><div class="report-summary">${summaryText(p)}</div></div>
  <div class="report-section"><h4>ค่าดัชนีที่ใช้ติดตาม</h4><div class="report-grid">
    <div class="report-block"><b>MNDWI (ดัชนีน้ำเปิด)</b><p>พื้นที่น้ำ: ${fmt(p.water_before_rai)} → ${fmt(p.water_current_rai)} ไร่<br>สัดส่วน: ${fmt(p.water_before_pct)}% → ${fmt(p.water_current_pct)}%</p></div>
    <div class="report-block"><b>NDVI (ความเขียวพืช)</b><p>Stable land: ${idx(p.ndvi_before)} → ${idx(p.ndvi_current)}<br>เปลี่ยนแปลง ${delta(p.ndvi_before,p.ndvi_current)}</p></div>
    <div class="report-block"><b>NDRE (สุขภาพใบพืช)</b><p>Stable land: ${idx(p.ndre_before)} → ${idx(p.ndre_current)}<br>เปลี่ยนแปลง ${delta(p.ndre_before,p.ndre_current)}</p></div>
    <div class="report-block"><b>NDMI (ความชื้นพืช/พื้นที่)</b><p>Stable land: ${idx(p.ndmi_before)} → ${idx(p.ndmi_current)}<br>เปลี่ยนแปลง ${delta(p.ndmi_before,p.ndmi_current)}</p></div>
  </div></div>
  <div class="report-section"><h4>QA / การตีความ</h4><div class="report-grid">
    <div class="report-block"><b>Stable land check</b><p>พื้นที่ที่ยังเป็น land ทั้งสองวัน ${fmt(p.stable_land_rai)} ไร่ ใช้แยกผลของน้ำออกจากการเปลี่ยนแปลงของพืช</p></div>
    <div class="report-block"><b>ภาพล่าสุดที่ตรวจ QA</b><p>2 ต.ค. 2026 usable pixels ${fmt(p.latest_valid_pct)}% • วันที่ที่ใช้สรุปผลคือ ${dateTH(p.current)}</p></div>
  </div></div>
  <div class="report-footer">Live Report อ่านค่าจากประวัติการวิเคราะห์ • วันที่คุณภาพต่ำจะไม่แทน Current อัตโนมัติ • รายงาน Verified PDF ยังคงเป็นฉบับอ้างอิง</div>`;
  const studioImage=window.MapStudio?.reportMarkup?.(p)||'';
  if(studioImage)paper.insertAdjacentHTML('beforeend',studioImage);
  window.TrendReport?.render?.(p.plot,paper).catch?.(err=>console.warn('Live report trend unavailable',err));
}
function printReport(){if(document.getElementById('report-type').value==='verified'){const p=plots.find(x=>x.plot===document.getElementById('report-plot').value);if(p?.report_url)window.open(p.report_url,'_blank','noopener');return}renderReportPreview();window.print()}
init().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend',`<div style="position:fixed;bottom:12px;right:12px;background:#7f1d1d;color:white;padding:10px;border-radius:8px;z-index:9999">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`)})