(function standalone(){
'use strict';
const STORAGE='affiliate-lab-shopee-publisher-v1',DB='affiliate-lab-shopee-videos-v1';
const routes=['dashboard','library','compose','calendar','performance'];
const labels={dashboard:'DASHBOARD',library:'VIDEO LIBRARY',compose:'POST COMPOSER',calendar:'POSTING CALENDAR',performance:'PERFORMANCE'};
const icons={plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-6-6 6 6-6 6',calendar:'M3 10h18M8 3v4m8-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',video:'M3 5h14v14H3z m14 4 5-3v12l-5-3',check:'M4 12l5 5L20 6',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l4 2',bag:'M4 8h16l-1 13H5L4 8zm5 0V6a3 3 0 0 1 6 0v2',download:'M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3',edit:'M3 17l1 4 4-1L20 8a2 2 0 0 0-4-4L3 17z',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12 5 5',trash:'M4 7h16M10 7V4h4v3M6 7l1 14h10l1-14',alert:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v6m0 4h.01',play:'m8 5 12 7-12 7V5z'};
const ico=(key)=>'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(icons[key]||icons.check)+'"/></svg>';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const validURL=s=>{try{let u=new URL(String(s||'').trim());return ['http:','https:'].includes(u.protocol)?u.toString():''}catch{return''}};
const shopeeURL=s=>{try{let host=new URL(s).hostname.toLowerCase();return host==='shopee.co.th'||host.endsWith('.shopee.co.th')||host==='shopee.app.link'||host.endsWith('.shopee.app.link')||host==='shope.ee'||host.endsWith('.shope.ee')}catch{return false}};
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const formatTime=s=>s?new Date(s).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'ยังไม่กำหนดเวลา';
const formatMoney=n=>'฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const num=n=>Number(n||0).toLocaleString('th-TH');
const fresh=()=>({id:'',title:'',filename:'',size:0,duration:null,width:null,height:null,caption:'',products:[{name:'',url:''}],schedule:'',notes:'',ai:false,mission:false,postedUrl:'',postedAt:'',confirmed:false,status:'draft',views:0,orders:0,commission:0,hasVideo:false,created:''});
function load(){try{let s=JSON.parse(localStorage.getItem(STORAGE));if(s?.version===1&&Array.isArray(s.posts))return {version:1,posts:s.posts.filter(x=>x?.id).slice(0,400).map(x=>({...fresh(),...x,products:Array.isArray(x.products)&&x.products.length?x.products:[{name:'',url:''}]}))}}catch{}return {version:1,posts:[]}}
let data=load(),view=new URLSearchParams(location.search).get('view')||'dashboard',filter='all',query='',draft=fresh(),editId='',uploadFile=null,videoObjectURL='',month=new Date(),chosenDate=dateKey(new Date()),modalId='',db=null;
if(!routes.includes(view))view='dashboard';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function note(t){let a=$('#toast');a.textContent=t;a.classList.add('show');setTimeout(()=>a.classList.remove('show'),3400)}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(data));return true}catch{note('พื้นที่จัดเก็บเต็ม โปรดสำรองข้อมูล');return false}}
function status(p){return p.status==='published'?'published':p.status==='queued'&&p.schedule&&new Date(p.schedule)<=new Date()?'due':p.status==='queued'?'queued':'draft'}
const statLabel={published:'เผยแพร่ยืนยันแล้ว',due:'ถึงเวลาโพสต์',queued:'รอเวลาโพสต์',draft:'ฉบับร่าง'};
const badge=p=>`<span class="pill ${status(p)}">${statLabel[status(p)]}</span>`;
const find=id=>data.posts.find(x=>x.id===id);
const vids=p=>(p.products||[]).filter(x=>shopeeURL(x.url)).length;
const mb=n=>Number(n||0)>1024*1024?(Number(n)/(1024*1024)).toFixed(1)+' MB':Math.round(Number(n||0)/1024)+' KB';
function dbOpen(){return new Promise((res,rej)=>{if(db)return res(db);if(!window.indexedDB)return rej(Error('เบราว์เซอร์ไม่รองรับการเก็บคลิป'));let r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('videos'))r.result.createObjectStore('videos')};r.onsuccess=()=>res(db=r.result);r.onerror=()=>rej(r.error)})}
async function getBlob(id){const conn=await dbOpen();return new Promise((res,rej)=>{let r=conn.transaction('videos','readonly').objectStore('videos').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function putBlob(id,file){let conn=await dbOpen();return new Promise((res,rej)=>{let t=conn.transaction('videos','readwrite');t.objectStore('videos').put(file,id);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
async function deleteBlob(id){try{let conn=await dbOpen();conn.transaction('videos','readwrite').objectStore('videos').delete(id)}catch{}}
function download(blob,name){let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),20000)}
async function downloadVideo(p){try{let f=await getBlob(p.id);if(!f)return note('ไม่พบวิดีโอในอุปกรณ์นี้');download(f,p.filename||'Shopee_Video.mp4')}catch(e){note('โหลดวิดีโอไม่ได้: '+e.message)}}
async function copy(s){try{await navigator.clipboard.writeText(s);note('คัดลอกแล้ว')}catch{note('ไม่สามารถคัดลอกอัตโนมัติได้')}}
function ics(posts){const dt=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const clean=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Affiliate Lab//Publisher//TH',...posts.filter(x=>x.status==='queued'&&x.schedule).flatMap(p=>['BEGIN:VEVENT','UID:'+p.id+'@affiliate-lab','DTSTAMP:'+dt(new Date()),'DTSTART:'+dt(p.schedule),'DTEND:'+dt(new Date(new Date(p.schedule).getTime()+900000)),'SUMMARY:'+clean('โพสต์ Shopee Video: '+p.title),'DESCRIPTION:'+clean('โพสต์และติดตะกร้าด้วยตนเองใน Shopee Video'),'BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY','DESCRIPTION:เตือนโพสต์ Shopee Video','END:VALARM','END:VEVENT']),'END:VCALENDAR'].join('\r\n')}
function exportIcs(posts){if(!posts.some(x=>x.status==='queued'&&x.schedule))return note('ยังไม่มีคิวสำหรับส่งออกปฏิทิน');download(new Blob([ics(posts)],{type:'text/calendar;charset=utf-8'}),'Shopee_Posting_Queue.ics')}
function exportCsv(){let headers=['title','schedule','status','postedUrl','views','orders','commission'],safe=x=>{let v=String(x??'');if(/^\s*[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};let rows=[headers.join(','),...data.posts.map(p=>headers.map(k=>safe(p[k])).join(','))];download(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),'Shopee_Video_Report.csv')}
function backup(){download(new Blob([JSON.stringify({version:1,posts:data.posts.map(p=>({...p,hasVideo:false})),note:'ไม่รวมไฟล์ MP4'},null,2)],{type:'application/json'}),'Shopee_Publisher_Backup.json');note('ดาวน์โหลดสำรองข้อมูลแล้ว · ไม่มีไฟล์วิดีโอ')}
function header(label,title,desc,action=''){return `<div class="section-title"><div><span class="eyebrow">${label}</span><h1>${title}</h1><p>${desc}</p></div><div class="actions">${action}</div></div>`}
function metric(label,v,icon='',col='',foot=''){return `<div class="metric-card"><div class="metric-card-head"><span>${label}</span><span class="metric-icon ${col}">${ico(icon||'video')}</span></div><strong class="metric-value">${v}</strong><div class="metric-foot">${foot}</div></div>`}
function empty(text,detail,action=''){return `<div class="empty-state">${ico('video')}<strong>${text}</strong><p>${detail}</p>${action}</div>`}
function listing(posts){return `<div class="table-wrap"><table class="posts-table"><thead><tr><th>คลิป</th><th>กำหนดเวลา</th><th>สถานะ</th><th>สินค้า</th><th></th></tr></thead><tbody>${posts.map(p=>`<tr><td><span class="post-name">${h(p.title)}</span><span class="subtext">${h(p.filename||'ยังไม่มีไฟล์')}</span></td><td>${formatTime(p.schedule)}</td><td>${badge(p)}</td><td>${vids(p)} สินค้า</td><td><div class="list-actions"><button class="btn btn-outline btn-sm" data-do="edit" data-id="${h(p.id)}">เปิด</button>${p.status==='queued'?`<button class="btn btn-soft btn-sm" data-do="published" data-id="${h(p.id)}">ยืนยัน</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`}
function dashboard(){
 let total=data.posts.length,queued=data.posts.filter(x=>x.status==='queued'),due=queued.filter(p=>status(p)==='due'),published=data.posts.filter(x=>x.status==='published');
 return header('OVERVIEW','ภาพรวมการโพสต์','ศูนย์จัดการคลิป Shopee Video Affiliate','<button class="btn btn-outline" data-do="ics">'+ico('calendar')+' ปฏิทิน .ics</button>')+
 `<div class="feature-hero"><div><span class="eyebrow" style="color:#85ecd9">SHOPEE VIDEO WORKSPACE</span><h2>จัดคลิปและตะกร้าให้พร้อม<br>ก่อนถึงเวลาโพสต์</h2><p>อัปโหลดคลิป เตรียมลิงก์สินค้า เขียน Caption วางแผนการลงคลิป และยืนยันผลหลังเผยแพร่จริงใน Shopee</p><button class="btn" data-do="new">${ico('plus')} เตรียมโพสต์ใหม่</button></div><div class="feature-hero-illustration">${ico('calendar')}</div></div><div class="cards metric-grid">${metric('คลิปทั้งหมด',num(total),'video','','รวมรายการทั้งหมด')}${metric('ในคิวโพสต์',num(queued.length),'clock','orange','รอเวลาและการดำเนินการ')}${metric('ถึงเวลาโพสต์',num(due.length),'alert','purple','ยังไม่เผยแพร่อัตโนมัติ')}${metric('ยืนยันโพสต์แล้ว',num(published.length),'check','green','ยืนยันจากคุณ')}</div><div class="content-two"><section class="panel"><div class="panel-head"><div><h2>คลิปในคิวโพสต์</h2><p>รายการที่จะต้องดำเนินการใน Shopee</p></div><button class="btn btn-quiet btn-sm" data-nav="calendar">ปฏิทิน ${ico('arrow')}</button></div>${queued.length?listing(queued.slice().sort((a,b)=>(a.schedule||'').localeCompare(b.schedule||'')).slice(0,5)):empty('ยังไม่มีคลิปในคิว','สร้างโพสต์ใหม่และตั้งวันเวลาโพสต์','<button class="btn btn-primary" data-do="new">เพิ่มคลิป</button>')}</section><section class="panel"><div class="panel-head"><h2>4 ขั้นตอนพร้อมโพสต์</h2></div><div class="guide-steps">${[['1','เลือกวิดีโอ','แนบ MP4 จากอุปกรณ์'],['2','เตรียมตะกร้า','เก็บลิงก์สินค้าที่จะติด'],['3','ตั้งกำหนดการ','บันทึกเข้าคิวและส่งออกปฏิทิน'],['4','ยืนยันผลจริง','โพสต์เองแล้วบันทึกลิงก์และตะกร้า']].map(([i,t,s])=>`<div class="guide-step"><span class="guide-step-num">${i}</span><div><strong>${t}</strong><span>${s}</span></div></div>`).join('')}</div><div class="divider"></div><div class="notice">${ico('alert')}<span>ระบบนี้ยังไม่เผยแพร่หรือแนบตะกร้าผ่าน Shopee API โดยอัตโนมัติ</span></div></section></div>`}
function library(){
 let arr=data.posts.slice().reverse().filter(p=>(filter==='all'||status(p)===filter)&&(p.title+' '+p.filename).toLowerCase().includes(query.toLowerCase()));
 return header('VIDEO LIBRARY','คลังวิดีโอ','คลิปทั้งหมดในพื้นที่ทำงานส่วนตัว','<button class="btn btn-primary" data-do="new">'+ico('plus')+' เพิ่มคลิปใหม่</button>')+
 `<div class="search-row"><label class="input-search">${ico('search')}<input id="find-video" type="search" value="${h(query)}" placeholder="ค้นหาชื่อคลิป" aria-label="ค้นหา"></label><div class="field"><select id="filter-video" aria-label="กรองสถานะ"><option value="all">ทุกสถานะ</option>${Object.entries(statLabel).map(([v,t])=>`<option value="${v}" ${filter===v?'selected':''}>${t}</option>`).join('')}</select></div></div>`+
 (arr.length?`<div class="card-grid">${arr.map(p=>`<article class="video-card"><div class="video-thumb">${ico('video')}${badge(p)}</div><div class="video-meta"><strong>${h(p.title||p.filename)}</strong><p>${h(p.filename||'ยังไม่มีไฟล์')} · ${mb(p.size)}</p><div class="video-meta-footer"><button class="btn btn-outline btn-sm" data-do="edit" data-id="${h(p.id)}">${ico('edit')} แก้ไข</button><button class="btn btn-outline btn-sm" data-do="get-video" data-id="${h(p.id)}">${ico('download')}</button>${p.status==='queued'?`<button class="btn btn-soft btn-sm" data-do="published" data-id="${h(p.id)}">ยืนยัน</button>`:''}<button class="btn btn-danger btn-sm" data-do="delete" data-id="${h(p.id)}" aria-label="ลบ">${ico('trash')}</button></div></div></article>`).join('')}</div>`:empty('ไม่พบวิดีโอ','ลองเปลี่ยนคำค้นหรือเริ่มเพิ่มคลิป','<button class="btn btn-primary" data-do="new">เพิ่มคลิป</button>'))+
 `<p class="data-foot">คลิปถูกเก็บใน IndexedDB ของเบราว์เซอร์เครื่องนี้ ไม่ซิงก์หรืออัปโหลดขึ้นเซิร์ฟเวอร์ · ไฟล์สำรอง JSON ไม่รวม MP4</p>`;
}
function productInputs(){return draft.products.map((p,i)=>`<div class="product-row"><span class="product-index">${i+1}</span><div class="product-fields"><label class="field"><span>ชื่อสินค้า</span><input data-product-name="${i}" value="${h(p.name)}" placeholder="ลู่วิ่ง D5-Pro"></label><label class="field"><span>ลิงก์ Shopee</span><input data-product-url="${i}" value="${h(p.url)}" type="url" placeholder="https://s.shopee.co.th/..."></label></div><button type="button" class="product-remove" data-do="remove-product" data-index="${i}">×</button></div>`).join('')}
function ready(){return[['ชื่อคลิป',!!draft.title.trim()],['ไฟล์ MP4/MOV',!!uploadFile||!!draft.hasVideo],['ลิงก์ Shopee อย่างน้อย 1',draft.products.some(x=>shopeeURL(x.url))],['Caption',!!draft.caption.trim()],['วันและเวลา',!!draft.schedule]]}
function readyUI(){const checks=ready(),count=checks.filter(x=>x[1]).length;return `<div class="text-row"><strong>ความพร้อมของโพสต์</strong><span class="tag-selector">${count}/5</span></div><div class="progress-bar"><div class="progress-fill" style="width:${count*20}%"></div></div><div class="check-list">${checks.map(([title,pass])=>`<div class="check ${pass?'ok':''}">${ico(pass?'check':'alert')}<span>${title}</span></div>`).join('')}</div>`}
function compose(){
 let hasVideo=uploadFile||draft.hasVideo;
 return header('POST COMPOSER',editId?'แก้ไขโพสต์':'เตรียมโพสต์ใหม่','รวมวิดีโอ สินค้า และแคปชันในหน้าเดียว','<button class="btn btn-outline" data-nav="library">← กลับคลังคลิป</button>')+
 `<form id="post-form" class="compose-layout"><div class="compose-main"><section class="panel"><div class="numbered-heading"><span>01</span><h2>วิดีโอที่ต้องการโพสต์</h2></div>${hasVideo?`<video id="preview-video" class="video-preview" controls playsinline preload="metadata"></video><p class="data-foot">${h(draft.filename)} · ${mb(draft.size)} ${draft.duration?Math.round(draft.duration)+' วินาที':''}</p><label class="btn btn-outline btn-sm" for="video-upload">เปลี่ยนไฟล์</label>`:`<label class="upload-zone" for="video-upload">${ico('video')}<strong>คลิกเพื่อเพิ่ม MP4 / MOV</strong><small>ขนาดไม่เกิน 500 MB เก็บบนอุปกรณ์นี้</small><span class="btn btn-outline btn-sm">เลือกวิดีโอ</span></label>`}<input id="video-upload" type="file" accept=".mp4,.mov,video/mp4,video/quicktime" style="position:absolute;left:-9999px;width:1px"><label class="field" style="margin-top:15px"><span>ชื่อคลิป *</span><input name="title" maxlength="180" required value="${h(draft.title)}" placeholder="เช่น สาธิตรีโมทลู่วิ่ง D5-Pro"></label><p class="right-hint">แนะนำวิดีโอแนวตั้ง 9:16; เงื่อนไข Shopee Mission บางรายการอาจไม่รับคลิปสั้นหรือ AI</p></section><section class="panel"><div class="numbered-heading"><span>02</span><h2>สินค้าที่จะติดตะกร้า</h2></div><div class="notice blue">${ico('bag')}<span>ลิงก์ในระบบเป็นรายการเตรียมติดตะกร้า ต้องเลือกสินค้าจริงใน Shopee หลังอัปโหลด</span></div><div id="product-inputs" style="margin-top:12px">${productInputs()}</div><div class="caption-tools"><button type="button" data-do="add-product">＋ เพิ่มสินค้า</button><button type="button" data-do="import-product">↥ ดึงข้อมูลจาก Affiliate Lab</button></div></section><section class="panel"><div class="numbered-heading"><span>03</span><h2>Caption และรายละเอียด</h2></div><label class="field"><span>ข้อความโพสต์ *</span><textarea name="caption" rows="6" maxlength="2000" placeholder="เขียนแคปชันตามข้อมูลสินค้าจริง">${h(draft.caption)}</textarea></label><div class="caption-tools"><button type="button" data-do="caption" data-tone="info">✦ แนวให้ข้อมูล</button><button type="button" data-do="caption" data-tone="demo">สาธิต</button><button type="button" data-do="caption" data-tone="question">คำถาม</button><button type="button" data-do="copy-caption">คัดลอก</button></div><label class="checkbox-row"><input type="checkbox" name="ai" ${draft.ai?'checked':''}> คลิปใช้ AI สร้างหรือปรับเนื้อหา</label><label class="checkbox-row"><input type="checkbox" name="mission" ${draft.mission?'checked':''}> ตั้งใจเข้าร่วม Shopee Mission (ตรวจเกณฑ์เฉพาะกิจกรรมก่อน)</label><label class="field"><span>บันทึกเพิ่มเติม</span><textarea name="notes" rows="2">${h(draft.notes)}</textarea></label></section></div><aside class="compose-side"><section class="panel"><div class="numbered-heading"><span>04</span><h2>กำหนดวันและเวลา</h2></div><label class="field"><span>โพสต์เมื่อ</span><input name="schedule" type="datetime-local" value="${h(draft.schedule)}"></label><p class="right-hint">เมื่อถึงเวลา ระบบจะแสดงสถานะ “ถึงเวลาโพสต์” เท่านั้น ไม่โพสต์หรือแจ้งเตือนเมื่อปิดหน้าเว็บ; ใช้ Export .ics สำหรับปฏิทิน</p><div class="divider"></div><div id="ready-mount">${readyUI()}</div><div class="divider"></div><button class="btn btn-primary full-width" type="submit" value="queued">บันทึกเข้าคิว</button><button class="btn btn-outline full-width" style="margin-top:9px" type="submit" value="draft">บันทึกร่าง</button></section><section class="panel"><div class="panel-head"><h3>ตรวจสอบก่อนโพสต์</h3></div><div class="check-list">${['สินค้าในคลิปตรงกับลิงก์','ไม่มีการอ้างสรรพคุณเกินข้อมูล','ตรวจเงื่อนไข AI และ Mission','ติดตะกร้าใน Shopee แล้วกลับมายืนยัน'].map(x=>`<div class="check">${ico('check')}<span>${x}</span></div>`).join('')}</div></section></aside></form>`;
}
function calendar(){
 const y=month.getFullYear(),m=month.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7;
 const cells=Array.from({length:42},(_,i)=>{let d=new Date(y,m,i+1-offset),key=dateKey(d),ps=data.posts.filter(x=>x.schedule?.slice(0,10)===key);return `<button type="button" class="day-cell ${d.getMonth()===m?'':'outside'} ${key===chosenDate?'selected':''} ${key===dateKey(new Date())?'today':''}" data-day="${key}"><span class="day-number">${d.getDate()}</span><span class="day-pills">${ps.slice(0,5).map(x=>`<i class="${x.status==='published'?'live':''}"></i>`).join('')}</span></button>`}).join('');
 const posts=data.posts.filter(x=>x.schedule?.slice(0,10)===chosenDate);
 return header('POSTING CALENDAR','ปฏิทินโพสต์','ดูแผนงานตามวันและส่งคิวไปแอปปฏิทิน','<button class="btn btn-outline" data-do="ics">'+ico('download')+' Export .ics</button>')+`<div class="notice blue" style="margin-bottom:17px">${ico('alert')}<span>เป็นกำหนดการช่วยเตือน ไม่ได้ส่งโพสต์เข้า Shopee โดยอัตโนมัติ</span></div><div class="calendar-layout"><section class="panel"><div class="month-toolbar"><h2>${new Date(y,m,1).toLocaleString('th-TH',{month:'long',year:'numeric'})}</h2><div class="month-actions"><button class="btn btn-outline btn-sm" data-do="prev-month">‹</button><button class="btn btn-outline btn-sm" data-do="today">วันนี้</button><button class="btn btn-outline btn-sm" data-do="next-month">›</button></div></div><div class="weekday-row">${['จ','อ','พ','พฤ','ศ','ส','อา'].map(x=>'<span>'+x+'</span>').join('')}</div><div class="month-grid">${cells}</div></section><aside class="panel"><div class="panel-head"><h2>${new Date(chosenDate+'T12:00:00').toLocaleDateString('th-TH',{dateStyle:'long'})}</h2></div>${posts.length?`<div class="stacked-list">${posts.map(x=>`<div class="stacked-item"><div><strong>${h(x.title)}</strong><small>${formatTime(x.schedule)}</small></div><button class="btn btn-outline btn-sm" data-do="edit" data-id="${h(x.id)}">เปิด</button></div>`).join('')}</div>`:empty('วันนี้ยังไม่มีรายการ','เลือกวันอื่นหรือสร้างรายการใหม่')}</aside></div>`;
}
function performance(){
 let p=data.posts.filter(x=>x.status==='published'),sum=k=>p.reduce((a,b)=>a+Number(b[k]||0),0);
 return header('PERFORMANCE','ผลลัพธ์การโพสต์','บันทึกสถิติด้วยตนเองจาก Shopee','<button class="btn btn-outline" data-do="csv">'+ico('download')+' Export CSV</button>')+`<div class="notice blue">${ico('alert')}<span>ยอดวิว ยอดขาย และคอมมิชชันเป็นตัวเลขที่ผู้ใช้กรอกเอง ไม่ได้เชื่อม Shopee API</span></div><div class="cards metric-grid">${metric('โพสต์แล้ว',num(p.length),'check','green')}${metric('ยอดวิว',num(sum('views')),'play')}${metric('ออเดอร์',num(sum('orders')),'bag','orange')}${metric('ค่าคอมมิชชัน',formatMoney(sum('commission')),'edit','purple')}</div><section class="panel"><div class="panel-head"><h2>โพสต์ที่ยืนยันแล้ว</h2></div>${p.length?`<div class="table-wrap"><table class="posts-table"><thead><tr><th>คลิป</th><th>ยอดวิว</th><th>ออเดอร์</th><th>คอมมิชชัน</th><th>จัดการ</th></tr></thead><tbody>${p.map(x=>`<tr><td><span class="post-name">${h(x.title)}</span><span class="subtext">${formatTime(x.postedAt)}</span></td><td>${num(x.views)}</td><td>${num(x.orders)}</td><td>${formatMoney(x.commission)}</td><td><button class="btn btn-outline btn-sm" data-do="metrics" data-id="${h(x.id)}">แก้ยอด</button> <a class="btn btn-quiet btn-sm" href="${h(validURL(x.postedUrl))}" target="_blank" rel="noopener noreferrer">↗</a></td></tr>`).join('')}</tbody></table></div>`:empty('ยังไม่มีผลลัพธ์','โพสต์ใน Shopee พร้อมติดตะกร้าจริงแล้วจึงกลับมายืนยันผล')}</section>`;
}
function clearPreview(){if(videoObjectURL){URL.revokeObjectURL(videoObjectURL);videoObjectURL=''}}
async function preview(){
 let el=$('#preview-video');if(!el)return;
 try{let blob=uploadFile||await getBlob(editId||draft.id);if(!blob){note('ไม่พบไฟล์ MP4 ในเครื่องนี้ โปรดแนบใหม่');return}clearPreview();videoObjectURL=URL.createObjectURL(blob);el.src=videoObjectURL}catch{note('แสดงตัวอย่างไม่ได้')}
}
function paint(){
 $('#view').innerHTML=({dashboard,library,compose,calendar,performance})[view]();
 $('#page-crumb').textContent=labels[view];
 $$('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
 if(view==='compose')preview();
}
function navigate(tab){if(!routes.includes(tab))return;view=tab;let u=new URL(location.href);u.searchParams.set('view',tab);history.pushState(null,'',u);$('#sidebar').classList.remove('show');$('#sidebar-backdrop').hidden=true;paint();scrollTo({top:0,behavior:'instant'})}
function createPost(){editId='';draft=fresh();uploadFile=null;clearPreview();navigate('compose')}
function editPost(p){editId=p.id;draft={...fresh(),...p,products:p.products.map(x=>({...x}))};uploadFile=null;clearPreview();navigate('compose')}
function formSync(t){
 if(t.dataset.productName!==undefined&&draft.products[Number(t.dataset.productName)])draft.products[Number(t.dataset.productName)].name=t.value;
 if(t.dataset.productUrl!==undefined&&draft.products[Number(t.dataset.productUrl)])draft.products[Number(t.dataset.productUrl)].url=t.value;
 if(['title','caption','notes','schedule'].includes(t.name))draft[t.name]=t.value;
 if(['ai','mission'].includes(t.name))draft[t.name]=t.checked;
 let mount=$('#ready-mount');if(mount)mount.innerHTML=readyUI();
}
async function newFile(f){
 if(!f)return;if(!/\.(mp4|mov)$/i.test(f.name))return note('รองรับเฉพาะ MP4/MOV');
 if(f.size>500*1024*1024)return note('ไฟล์เกิน 500 MB');
 uploadFile=f;draft.filename=f.name;draft.size=f.size;draft.hasVideo=true;
 let tmp=URL.createObjectURL(f),v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>{draft.duration=v.duration;draft.width=v.videoWidth;draft.height=v.videoHeight;URL.revokeObjectURL(tmp);paint()};v.onerror=()=>{URL.revokeObjectURL(tmp);paint()};v.src=tmp;setTimeout(()=>{if(!v.duration){URL.revokeObjectURL(tmp);paint()}},5000);
}
async function submit(e){
 e.preventDefault();let intent=e.submitter?.value==='queued'?'queued':'draft';
 if(!draft.title.trim())return note('กรุณาใส่ชื่อคลิป');
 if(intent==='queued'){
  if(!draft.caption.trim()||!draft.schedule||!draft.products.some(x=>shopeeURL(x.url)))return note('ต้องมี Caption เวลา และลิงก์ Shopee ก่อนเข้าคิว');
  if(!uploadFile){try{if(!editId||!await getBlob(editId))return note('กรุณาแนบไฟล์ MP4 ก่อนเข้าคิว')}catch{return note('หา MP4 ไม่พบ')}}
  if(data.posts.some(x=>x.id!==editId&&x.status==='queued'&&x.schedule===draft.schedule)&&!confirm('มีโพสต์เวลาเดียวกัน ต้องการดำเนินการต่อหรือไม่?'))return;
 }
 let id=editId||uid();
 if(uploadFile){try{await putBlob(id,uploadFile)}catch(err){return note('บันทึกวิดีโอไม่ได้: '+err.message)}}
 let old=find(id),item={...draft,id,status:intent,created:old?.created||new Date().toISOString(),hasVideo:!!uploadFile||!!old?.hasVideo,products:draft.products.filter(x=>x.name||x.url)};
 data.posts=data.posts.filter(x=>x.id!==id);data.posts.push(item);save();editId='';uploadFile=null;clearPreview();navigate('library');note(intent==='queued'?'เข้าคิวแล้ว · ยังต้องโพสต์เองใน Shopee':'บันทึกฉบับร่างแล้ว');
}
function dialog(html){$('#modal-root').innerHTML='<div class="dialog-scrim"><div class="dialog" role="dialog" aria-modal="true">'+html+'</div></div>'}
function publishDialog(p){dialog(`<div class="dialog-title"><h2>ยืนยันโพสต์บน Shopee</h2><button class="icon-button" data-do="close">×</button></div><p class="dialog-desc">ใส่ลิงก์โพสต์จริงและตรวจสอบว่าติดตะกร้าครบแล้ว</p><form id="publish-form" data-id="${h(p.id)}"><label class="field"><span>ลิงก์ Shopee Video</span><input name="postedUrl" type="url" value="${h(p.postedUrl||'')}" required placeholder="https://shopee.co.th/..."></label><label class="checkbox-row"><input type="checkbox" name="verified" required> ฉันตรวจด้วยตนเองแล้วว่าโพสต์สำเร็จและติดตะกร้าเรียบร้อย</label><div class="notice">${ico('alert')}<span>เว็บไซต์ไม่ได้ตรวจสอบโพสต์หรือตะกร้าผ่าน API</span></div><div class="dialog-actions"><button type="button" class="btn btn-outline" data-do="close">ยกเลิก</button><button class="btn btn-primary" type="submit">ยืนยันผล</button></div></form>`)}
function metricDialog(p){dialog(`<div class="dialog-title"><h2>บันทึกสถิติ</h2><button class="icon-button" data-do="close">×</button></div><p class="dialog-desc">${h(p.title)}</p><form id="metric-form" data-id="${h(p.id)}"><label class="field"><span>ยอดวิว</span><input type="number" name="views" min="0" step="1" required value="${p.views||0}"></label><label class="field"><span>ออเดอร์</span><input type="number" name="orders" min="0" step="1" required value="${p.orders||0}"></label><label class="field"><span>ค่าคอมมิชชัน (บาท)</span><input type="number" name="commission" min="0" step=".01" required value="${p.commission||0}"></label><div class="dialog-actions"><button type="button" class="btn btn-outline" data-do="close">ยกเลิก</button><button class="btn btn-primary" type="submit">บันทึก</button></div></form>`)}
function clickHandler(e){
 let el=e.target.closest('[data-nav],[data-view],[data-do],[data-day]');
 if(!el)return;
 if(el.dataset.nav||el.dataset.view){e.preventDefault();return navigate(el.dataset.nav||el.dataset.view)}
 if(el.dataset.day){chosenDate=el.dataset.day;return paint()}
 let a=el.dataset.do,p=find(el.dataset.id);e.preventDefault();
 if(a==='new')return createPost();
 if(a==='edit'&&p)return editPost(p);
 if(a==='get-video'&&p)return downloadVideo(p);
 if(a==='published'&&p)return publishDialog(p);
 if(a==='metrics'&&p)return metricDialog(p);
 if(a==='close')return $('#modal-root').innerHTML='';
 if(a==='ics')return exportIcs(data.posts);
 if(a==='csv')return exportCsv();
 if(a==='backup')return backup();
 if(a==='restore')return $('#restore-file').click();
 if(a==='add-product'){if(draft.products.length<10)draft.products.push({name:'',url:''});return paint()}
 if(a==='remove-product'){draft.products.splice(Number(el.dataset.index),1);if(!draft.products.length)draft.products.push({name:'',url:''});return paint()}
 if(a==='import-product'){let x;try{x=JSON.parse(localStorage.getItem('ken-lab-products-v3'))?.form}catch{}if(!x?.name)return note('ไม่มีข้อมูลใน Product Script Factory');draft.products=[{name:x.name,url:x.url||''}];draft.title||=x.name;paint();return note('นำเข้าสินค้าแล้ว')}
 if(a==='caption'){let n=draft.products.find(x=>x.name)?.name||draft.title||'สินค้านี้',tone=el.dataset.tone||'info';if(draft.caption&&!confirm('แทนที่ Caption เดิมหรือไม่?'))return;draft.caption=({info:`สนใจ ${n} อยู่หรือเปล่า? 🛒\nลองดูรายละเอียดสินค้าในคลิปแล้วตรวจรุ่นและราคาในตะกร้าก่อนสั่งซื้อ\n#ShopeeVideo #รีวิวสินค้า`,demo:`มาดู ${n} กันครับ! 📦\nคลิปนี้พาชมรายละเอียดที่ควรตรวจสอบก่อนเลือกซื้อ\nกดดูสินค้าในตะกร้าได้เลย\n#ShopeeVideo #แนะนำสินค้า`,question:`กำลังเปรียบเทียบ ${n} ใช่ไหม?\nดูจุดที่ควรสังเกตจากคลิป แล้วตรวจรายละเอียดร้านค้าในตะกร้าก่อนตัดสินใจ\n#ShopeeVideo`})[tone];let t=$('textarea[name="caption"]');if(t)t.value=draft.caption;let ready=$('#ready-mount');if(ready)ready.innerHTML=readyUI();return}
 if(a==='copy-caption')return copy(draft.caption);
 if(a==='prev-month'||a==='next-month'){month=new Date(month.getFullYear(),month.getMonth()+(a==='next-month'?1:-1),1);chosenDate=dateKey(month);return paint()}
 if(a==='today'){month=new Date();chosenDate=dateKey(month);return paint()}
 if(a==='delete'&&p&&confirm('ลบรายการและวิดีโอในเครื่องนี้หรือไม่?')){data.posts=data.posts.filter(x=>x.id!==p.id);save();deleteBlob(p.id);paint();return note('ลบแล้ว')}
}
async function restore(file){if(!file)return;try{if(file.size>5e6)throw Error('ไฟล์ใหญ่เกิน 5MB');let d=JSON.parse(await file.text());if(d.version!==1||!Array.isArray(d.posts))throw Error('รูปแบบไฟล์ไม่ถูกต้อง');if(!confirm('การนำเข้าจะแทนข้อมูลเดิมและไม่รวม MP4 ดำเนินการต่อหรือไม่?'))return;data={version:1,posts:d.posts.filter(p=>p?.id).slice(0,400).map(p=>({...fresh(),...p,hasVideo:false}))};save();navigate('dashboard');note('นำเข้ารายการแล้ว · กรุณาแนบ MP4 ใหม่หากจำเป็น')}catch(e){note(e.message)}}
function submitHandler(e){
 if(e.target.id==='post-form')return void submit(e);
 if(e.target.id==='publish-form'){e.preventDefault();let p=find(e.target.dataset.id),f=new FormData(e.target),url=f.get('postedUrl');if(!p||!shopeeURL(url)||!f.has('verified'))return note('กรุณาใส่ลิงก์ Shopee และยืนยันตะกร้าจริง');p.status='published';p.postedUrl=url;p.confirmed=true;p.postedAt=new Date().toISOString();save();$('#modal-root').innerHTML='';paint();return note('บันทึกว่าโพสต์และติดตะกร้าแล้วตามคำยืนยันของคุณ')}
 if(e.target.id==='metric-form'){e.preventDefault();let p=find(e.target.dataset.id),f=new FormData(e.target),keys=['views','orders','commission'],values=keys.map(k=>Number(f.get(k)));if(!p||values.some((v,i)=>!Number.isFinite(v)||v<0||(i<2&&!Number.isInteger(v))))return note('ตัวเลขไม่ถูกต้อง');keys.forEach((k,i)=>p[k]=values[i]);save();$('#modal-root').innerHTML='';paint();note('บันทึกสถิติแล้ว')}
}
function init(){
 $$('.nav-link [data-icon],.topbar [data-icon]').forEach(x=>x.innerHTML=ico(x.dataset.icon));
 document.addEventListener('click',clickHandler);
 document.addEventListener('submit',submitHandler);
 document.addEventListener('input',e=>{let t=e.target;if(t.id==='find-video'){query=t.value;let pos=t.selectionStart;paint();$('#find-video')?.focus();if(typeof pos==='number')$('#find-video').setSelectionRange(pos,pos);return}if(t.closest('#post-form'))formSync(t)});
 document.addEventListener('change',e=>{let t=e.target;if(t.id==='video-upload')return void newFile(t.files?.[0]);if(t.id==='filter-video'){filter=t.value;return paint()}if(t.id==='restore-file'){restore(t.files?.[0]);t.value='';return}if(t.closest('#post-form'))formSync(t)});
 $('#menu-toggle').addEventListener('click',()=>{let el=$('#sidebar');el.classList.toggle('show');$('#sidebar-backdrop').hidden=!el.classList.contains('show')});
 $('#sidebar-backdrop').addEventListener('click',()=>{$('#sidebar').classList.remove('show');$('#sidebar-backdrop').hidden=true});
 window.addEventListener('popstate',()=>{let v=new URLSearchParams(location.search).get('view');view=routes.includes(v)?v:'dashboard';paint()});
 window.addEventListener('beforeunload',clearPreview);
 const clock=()=>$('#clock').textContent=new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})+' น.';
 clock();setInterval(()=>{clock();if(['dashboard','library','calendar'].includes(view))paint()},60000);
 paint();
}
window.ShopeeVideoPublisher={getPosts:()=>data.posts.map(x=>({...x})),navigate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();