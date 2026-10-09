(()=>{'use strict';
const $=id=>document.getElementById(id),base='data/nationwide/';
const selectedDays=new Map();const selectedMetrics=new Set(['water_rai','ndvi','ndre','ndmi','mndwi','bsi','vegetation_rai','bare_soil_rai','qa_valid_pct']);
const specs={water_rai:['พื้นที่น้ำ (ไร่)','น้ำที่จำแนกจาก MNDWI > 0 หลังผ่าน QA'],ndvi:['NDVI','ความเขียวพืช: ค่าลดลงอาจเป็นพืชเครียด/มีพื้นที่ใบลดลง'],ndre:['NDRE','ดัชนีขอบแดงที่สัมพันธ์กับคลอโรฟิลล์'],ndmi:['NDMI','ดัชนีความชื้นของพืชและพื้นผิว'],mndwi:['MNDWI','ดัชนีน้ำเปิด (Green/SWIR)'],ndwi:['NDWI','น้ำตาม Green/NIR'],bsi:['BSI','ดัชนีดินเปิดโล่ง: เพิ่มขึ้นอาจสัมพันธ์กับดินเปิดมากขึ้น'],savi:['SAVI','ดัชนีพืชที่ลดอิทธิพลของดิน'],evi:['EVI','ดัชนีพืชที่ใช้แบนด์ NIR/Red/Blue'],gli:['GLI','Green Leaf Index'],vegetation_rai:['พื้นที่พืช (ไร่)','จำแนกแบบเบื้องต้นด้วย NDVI ≥ 0.35'],bare_soil_rai:['พื้นที่ดินเปิดโล่ง (ไร่)','ใช้ BSI และ NDVI พร้อมไม่นับน้ำ'],wetness_rai:['พื้นที่ชื้น (ไร่)','สถานะความชื้นที่อาจทับซ้อนชั้นพืช/น้ำ'],qa_valid_pct:['คุณภาพภาพ QA (%)','สัดส่วนพิกเซลใน PDD ที่ใช้วิเคราะห์ได้']};
let boundary={features:[]},batch={plots:{},scenes:[],changes:[],totals:{}},water={features:[]},previews={images:[]},map=null,layerGroup=null,plots=[],plot='',charts=[];
const getPlotMeta=p=>batch.plots[p]||boundary.features.find(f=>f.properties.plot===p)?.properties||{};
const format=v=>v==null||!isFinite(Number(v))?'—':Number(v).toLocaleString('th-TH',{minimumFractionDigits:Number(v)%1?2:0,maximumFractionDigits:5});
const bdate=d=>{if(!d)return '—';const [y,m,dd]=d.split('-');return `${dd}/${m}/${+y+543}`};
const trusted=r=>r.analysis_status==='AUTO_VALID'||r.analysis_status==='VERIFIED';
const color=['#35addc','#e9b24a','#b267d8','#4bb688','#ec7992','#bedb59','#63bacc'];
async function load(){try{
 const [b,r,f,p]=await Promise.all(['boundaries_pdd_136.geojson','batch_01_results.json','batch_01_features.geojson','batch_01_previews.json'].map(file=>fetch(base+file).then(x=>{if(!x.ok)throw Error(file+': '+x.status);return x.json()})));
 boundary=b;batch=r;water=f;previews=p;plots=b.features.map(f=>f.properties.plot).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
 init();
 }catch(e){$('scope').textContent='ไม่สามารถโหลดผลการประมวลผล: '+e.message;console.error(e)}}
function dataRows(){const all=batch.scenes.filter(r=>r.plot===plot).sort((a,b)=>a.date.localeCompare(b.date));if(!selectedDays.has(plot))selectedDays.set(plot,new Set(all.map(x=>x.date)));return all}
function current(){return dataRows().filter(r=>selectedDays.get(plot).has(r.date))}
function renderControls(){
 const provinces=[...new Set(plots.map(p=>getPlotMeta(p).province))].sort();$('province').innerHTML=provinces.map(pr=>`<option value="${pr}">${pr}</option>`).join('');
 const chosen=Object.keys(batch.plots||{})[0]||plots[0];$('province').value=getPlotMeta(chosen).province||provinces[0];populatePlots(chosen);
 $('province').onchange=()=>populatePlots();$('plot').onchange=()=>{plot=$('plot').value;render()};
 $('alldates').onclick=()=>{selectedDays.set(plot,new Set(dataRows().map(x=>x.date)));render()};
 $('allmetrics').onclick=()=>{Object.keys(specs).forEach(k=>selectedMetrics.add(k));render()};
 $('print').onclick=()=>window.print();$('csv').onclick=downloadCSV;
 $('dates').onchange=e=>{const v=e.target.dataset.day;if(!v)return;const set=selectedDays.get(plot);if(e.target.checked)set.add(v);else set.delete(v);render()};
 $('metrics').onchange=e=>{const v=e.target.dataset.metric;if(!v)return;e.target.checked?selectedMetrics.add(v):selectedMetrics.delete(v);render()};
}
function populatePlots(preferred){const province=$('province').value;const codes=plots.filter(p=>getPlotMeta(p).province===province);$('plot').innerHTML=codes.map(c=>`<option value="${c}">${c}</option>`).join('');plot=preferred&&codes.includes(preferred)?preferred:codes[0];$('plot').value=plot;render()}
function init(){renderControls();const n=batch.totals||{};$('progress').textContent=`ชุดแรก ${n.plots_with_source_scenes||0}/10 แปลง • ${n.processed_dates||0} วันภาพ • ผ่าน QA ${n.qa_valid_dates||0} / ไม่ผ่าน ${n.no_data_dates||0} วันภาพ • การเปรียบเทียบที่มีภาพใช้ได้ ${n.date_changes||0} คู่ • ไม่เปลี่ยนค่ารายงาน Verified เดิม`;
 $('progressbar').style.width=`${(n.plots_with_source_scenes||0)/136*100}%`;
 $('scope').textContent='ขอบเขตงานที่ยืนยัน 136 แปลง • ชุด PDD ตาม MOC 1 + MOC 2 + Standard ยืนยันครบ 136 แปลงแล้ว (MOC 3 อีก 23 แปลงแยกออก) • สถานะชุดแรกประมวลผล 10/136 แปลง ที่เหลือแสดง PDD และรอรัน TIFF';}
function render(){if(!plot)return;const all=dataRows(),days=selectedDays.get(plot),rows=current();const info=getPlotMeta(plot);
 $('plotmeta').textContent=`PDD MultiPolygon ${(info.pdd_geometry_parts||info.geometry_parts||1)} ส่วน • พื้นที่คำนวณ ${format((info.pdd_area_rai||info.geometry_area_rai))} ไร่`;
 $('dates').innerHTML=all.map(r=>`<label><input type="checkbox" data-day="${r.date}" ${days.has(r.date)?'checked':''}> ${bdate(r.date)} ${r.status==='AUTO_VALID'?'✓':'⚠'}</label>`).join('');
 $('metrics').innerHTML=Object.entries(specs).map(([k,v])=>`<label><input type="checkbox" data-metric="${k}" ${selectedMetrics.has(k)?'checked':''}> ${v[0]}</label>`).join('');
 const valid=rows.filter(trusted),last=valid.at(-1),first=valid[0];
 const cards=[['แปลง',plot],['วันภาพที่เลือก',rows.length],['วันภาพผ่าน QA',valid.length],['น้ำล่าสุด (ไร่)',format(last?.water_rai)]];
 $('kpis').innerHTML=cards.map(([n,v])=>`<div class="kpi"><span>${n}</span><strong>${v}</strong></div>`).join('');
 renderMap(rows);renderImages(rows);renderCharts(rows);renderSummary(rows,first,last);renderTable(rows);
}
function renderMap(rows){
 if(!map){map=L.map('map',{zoomControl:true});L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri imagery'}).addTo(map);}
 if(layerGroup)map.removeLayer(layerGroup);layerGroup=L.featureGroup().addTo(map);
 const g=boundary.features.find(x=>x.properties.plot===plot);
 if(g)L.geoJSON(g,{style:{color:'#ff5c55',weight:2,fillOpacity:.03}}).addTo(layerGroup);
 const features=water.features.filter(x=>x.properties.plot===plot&&x.properties.class==='water'&&rows.some(r=>r.date===x.properties.date));
 const legend=$('maplegend');legend.innerHTML='';features.forEach((f,i)=>{
  const c=color[i%color.length];L.geoJSON(f,{style:{color:c,weight:1.5,fillColor:c,fillOpacity:.28}}).addTo(layerGroup);
  const l=document.createElement('span');l.className='legend';l.textContent='■ '+bdate(f.properties.date)+' '+format(f.properties.area_rai)+' ไร่';l.style.color=c;legend.appendChild(l);
 });
 if(layerGroup.getBounds().isValid())map.fitBounds(layerGroup.getBounds(),{padding:[20,20],maxZoom:17});setTimeout(()=>map.invalidateSize(),80);
}
function renderImages(rows){const panel=$('images'),list=previews.images.filter(x=>x.plot===plot&&rows.some(r=>r.date===x.date));
 panel.innerHTML='';for(const p of list){const f=document.createElement('figure');f.className='scene';const image=document.createElement('img');image.src=p.src;image.alt=plot+' '+p.date;const cap=document.createElement('figcaption');const obs=rows.find(x=>x.date===p.date);cap.textContent=bdate(p.date)+' • '+(obs?.analysis_status==='AUTO_VALID'?'ผ่าน QA':'ไม่ผ่าน QA')+' • ภาพจริงคลิปตาม PDD';f.append(image,cap);panel.appendChild(f)}
 if(!list.length)panel.textContent='ไม่มีภาพในวันที่เลือก';}
function renderCharts(rows){charts.forEach(c=>c.destroy());charts=[];const box=$('charts');box.innerHTML='';
 if(typeof Chart==='undefined'){box.textContent='กราฟยังไม่พร้อม: ไม่สามารถโหลด Chart.js';return}
 for(const k of selectedMetrics){if(!specs[k])continue;const pane=document.createElement('article');pane.className='chart';const h=document.createElement('h3');h.textContent=specs[k][0];const canvas=document.createElement('canvas');const p=document.createElement('p');p.className='muted';p.textContent=specs[k][1];pane.append(h,canvas,p);box.append(pane);
 const values=rows.map(x=>x.analysis_status==='AUTO_VALID'||k==='qa_valid_pct'?x[k]:null);
 const chart=new Chart(canvas,{type:'line',data:{labels:rows.map(x=>bdate(x.date)),datasets:[{label:specs[k][0],data:values,spanGaps:false,borderColor:'#43c9eb',pointBackgroundColor:'#43c9eb',pointRadius:4,tension:.16}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#9cbbcb'}},y:{ticks:{color:'#9cbbcb'}}}}});charts.push(chart);
 }}
function renderSummary(rows,first,last){const box=$('summary');box.innerHTML='<h3>สรุปการเปลี่ยนแปลง / Pattern interpretation</h3>';
 if(rows.length===0){box.innerHTML+='<p>'+(batch.plots[plot]?'ยังไม่ได้เลือกวันที่':'แปลงนี้มีขอบเขต PDD แล้ว แต่ยังไม่ถึงคิวประมวลผล TIFF จึงยังไม่มีค่ากราฟและรายงานรายวัน')+'</p>';return}
 const msg=[];if(first&&last&&first!==last){for(const key of ['water_rai','ndvi','ndre','ndmi','mndwi','bsi','vegetation_rai','bare_soil_rai']){if(first[key]==null||last[key]==null)continue;const change=last[key]-first[key];msg.push(`${specs[key][0]}: ${format(first[key])} → ${format(last[key])} (${change>=0?'+':''}${format(change)}). ${change<0?'มีแนวโน้มลดลง':'มีแนวโน้มเพิ่มขึ้น'}; ต้องตรวจภาพต้นฉบับและบริบทพื้นที่ร่วมกัน`)}}
 for(const row of rows.filter(x=>x.analysis_status!=='AUTO_VALID'))msg.push(`${bdate(row.date)}: ไม่ผ่าน QA (${format(row.qa_valid_pct)}%) ไม่ใช้สรุปการเปลี่ยนแปลงเชิงพื้นที่`);
 if(!msg.length)msg.push('ยังมีข้อมูลผ่าน QA ไม่เพียงพอสำหรับเปรียบเทียบ');
 box.innerHTML+=msg.map(s=>`<p>${s}</p>`).join('')+'<p class="muted">MNDWI / NDVI / BSI ไม่ใช่หลักฐานยืนยันอุทกภัยหรือความเสียหายของต้นไม้ด้วยตัวเอง โดยเฉพาะพื้นที่ป่าชายเลนที่มีน้ำขึ้นลงตามธรรมชาติ</p>';
}
function renderTable(rows){const keys=['date','analysis_status','qa_valid_pct','water_rai','vegetation_rai','bare_soil_rai','ndvi','ndre','ndmi','mndwi','ndwi','bsi','evi','savi','gli'];$('tablehead').innerHTML='<tr>'+keys.map(k=>`<th>${specs[k]?.[0]||k}</th>`).join('')+'</tr>';$('tablebody').innerHTML=rows.map(row=>'<tr>'+keys.map(k=>`<td${k==='analysis_status'&&row[k]!=='AUTO_VALID'?' class="qa"':''}>${k==='date'?bdate(row[k]):typeof row[k]==='number'?format(row[k]):row[k]??'—'}</td>`).join('')+'</tr>').join('')}
function downloadCSV(){const rows=current();if(!rows.length)return;const keys=['plot','province','date','analysis_status','qa_valid_pct','water_rai','water_pct','vegetation_rai','bare_soil_rai','wetness_rai','ndvi','ndre','ndmi','mndwi','ndwi','bsi','evi','savi','gli'];const csv='\ufeff'+[keys.join(','),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`${plot}_PDD_Sentinel2_Analysis.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
load();
})();
