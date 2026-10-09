/* KEN LAB Production Wizard v1 — prompt authoring, no external AI required. */
(function(){
'use strict';
const KEY='ken-lab-production-wizard-v1';
const PRESETS=[
 {id:'ken',name:'ป๋าเคน',group:'เทคโนโลยี / อธิบาย',desc:'ชายไทยวัย 25 ใส่แว่น ผิวแทน รูปร่างสมส่วนค่อนไปทางท้วมเล็กน้อย บุคลิกผู้เชี่ยวชาญเป็นกันเอง',outfit:'เสื้อเชิ้ต Navy กางเกง Beige รองเท้าขาว แว่นสายตาทรงเดิม',place:'ห้องทำงานไทยจริง โต๊ะคอม',voice:'ชายไทยเสียงทุ้มอบอุ่น พูดฉลาด มีอารมณ์ขันเล็กน้อย',url:'https://drive.google.com/file/d/1T0zV0CYK7Mgfu2GBzukf78uQCcsSUSXm/view',idTag:'KEN-MASTER'},
 {id:'samlee',name:'น้องสำลี',group:'ไลฟ์สไตล์ / ถามตอบ',desc:'หญิงไทยวัย 23 บุคลิกสดใส สุภาพ เป็นสาวออฟฟิศ ช่างสงสัย ถามคำถามแทนผู้ชม',outfit:'สูทชมพูอ่อนหรือเบจอมชมพู เสื้อขาว กางเกงสีอ่อน',place:'ออฟฟิศไทยบรรยากาศเป็นธรรมชาติ',voice:'หญิงไทยเสียงสดใส เป็นธรรมชาติ ชัดถ้อยชัดคำ',url:'https://drive.google.com/file/d/17_Qc7laYg5yH4p8SgzQl8FYZO5jIwfkQ/view',idTag:'SAMLEE-MASTER'},
 {id:'may-lifestyle',name:'เมย์ · Lifestyle',group:'บิวตี้ / ไลฟ์สไตล์',desc:'หญิงไทยวัยทำงาน สไตล์รีวิวชีวิตประจำวัน พูดเป็นกันเอง ไม่ดูจัดฉาก',outfit:'ชุดลำลองสุภาพตามภาพอ้างอิงต้นฉบับ',place:'ห้องพักหรือบ้านไทย แสงหน้าต่างจริง',voice:'หญิงไทยเสียงเป็นมิตร เหมือนแนะนำของให้เพื่อนฟัง',url:'https://drive.google.com/file/d/1bGu-_4NCXZGL14T72aoodoqehgYfirMI/view',idTag:'MAY-LIFESTYLE'},
 {id:'may-fruit',name:'เมย์ · แม่ค้าผลไม้',group:'อาหาร / เครื่องครัว / ร้านค้า',desc:'หญิงไทยวัยประมาณ 20 ปี บุคลิกร่าเริง พูดเก่งแบบแม่ค้าผลไม้ มีความเป็นธรรมชาติ',outfit:'เสื้อและผ้ากันเปื้อนตาม Character Master ต้นฉบับ',place:'แผงขายผลไม้ตลาดไทย',voice:'หญิงไทยน้ำเสียงกระฉับกระเฉง เป็นกันเองเหมือนคุยกับลูกค้า',url:'https://drive.google.com/file/d/1Dsrxbw5kUgkM1h-urNA_I7gN1Dp7imob/view',idTag:'MAY-FRUIT'}
];
const MODES={natural:'รีวิวแบบเพื่อนเล่าให้ฟัง',demo:'สาธิตสินค้าและฟังก์ชัน',problem:'ปัญหา → ข้อมูลช่วยตัดสินใจ',question:'เปิดด้วยคำถาม',dialogue:'สองคนถาม–ตอบ',voiceover:'เน้นสินค้า / Voice Over'};
const CATEGORY=['อัตโนมัติ','เครื่องสำอาง / สกินแคร์','เทคโนโลยี / แก็ดเจ็ต','ออกกำลังกาย','อาหาร / เครื่องครัว','ของใช้ในบ้าน','แฟชั่น','ท่องเที่ยว / Outdoor','ทั่วไป'];
const EMPTY=()=>({version:1,step:1,project:{title:'',facts:'',audience:'',category:'อัตโนมัติ',platform:'Shopee / TikTok',format:'9:16',length:40,count:5,mode:'natural',cta:'ดูรายละเอียดสินค้าได้ที่ลิงก์ในโพสต์',notes:'',boardLayout:'board'},primary:'',secondary:'',custom:[],draft:{name:'',age:'25',gender:'',occupation:'',face:'',skin:'',hair:'',body:'',signature:'',look:'',personality:'',delivery:'',outfit:'',location:'',lighting:'',camera:'',voice:'',reference:''},ideaCycles:{},shots:[],importedScript:'',importedLabel:'',suggestionCycle:0,created:Date.now()});
function clamp(s,n=200){return String(s==null?'':s).slice(0,n)}
function esc(s){return clamp(s,30000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.version===1&&s.project&&Array.isArray(s.custom)&&Array.isArray(s.shots))return {...EMPTY(),...s};}catch{}return EMPTY()}
let state=load();
const library=()=>[...PRESETS,...state.custom];
const selected=()=>library().find(c=>c.id===state.primary)||null;
const guest=()=>library().find(c=>c.id===state.secondary)||null;
const pid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
const safeUrl=s=>/^https?:\/\//i.test(String(s||'').trim())?clamp(s,500):'';
function save(){try{localStorage.setItem(KEY,JSON.stringify({...state,custom:state.custom.slice(0,25)}))}catch(e){toast('พื้นที่จัดเก็บเบราว์เซอร์เต็ม โปรดดาวน์โหลดไฟล์สำรอง');}}
function toast(msg){const e=document.querySelector('#toast');if(e){e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000);}else{let z=document.querySelector('#pw-message');if(z)z.textContent=msg;}}
function currentHTML(){const host=document.querySelector('#app');if(host){host.innerHTML=render();window.scrollTo({top:0,behavior:'smooth'})}}
function updateStage(n){state.step=Math.max(1,Math.min(3,n));save();currentHTML()}
function summarizeFacts(s){return String(s||'').replace(/\r/g,'').split(/\n+|[•;；]/u).map(x=>x.replace(/^\s*[-\d.)]+\s*/, '').trim()).filter(Boolean).slice(0,12);}
function recommend(){const s=(state.project.title+' '+state.project.facts+' '+state.project.category).toLowerCase();let picks=[];
 if(/กันแดด|ผิว|ครีม|สกิน|หน้า|แฟชั่น|เสื้อ|บิวตี้|เครื่องสำอาง/.test(s))picks=['may-lifestyle','samlee','ken'];
 else if(/อาหาร|ผลไม้|เครื่องครัว|ปั่น|หม้อ|ร้านค้า|ตลาด/.test(s))picks=['may-fruit','may-lifestyle','samlee'];
 else if(/โดรน|กล้อง|มือถือ|รีโมท|แอป|คอม|เกม|เทค|smart|tablet|ipad|เครื่องใช้ไฟฟ้า/.test(s))picks=['ken','samlee','may-lifestyle'];
 else if(/วิ่ง|ฟิตเนส|ออกกำลังกาย|ลู่|สุขภาพ|โยคะ/.test(s))picks=['may-lifestyle','ken','samlee'];
 else picks=['samlee','may-lifestyle','ken'];
 return picks;
}
function frameSpec(){const p=state.project;return `${p.format==='9:16'?'Vertical 9:16 portrait, target 1080x1920':'Horizontal 16:9, target 1920x1080'}, realistic natural Thai setting, phone-filmed authentic visual style, no stock-footage aesthetic.`}
function identity(c){if(!c)return 'NO on-screen human presenter. Product shots and neutral voice-over only.';
return `CHARACTER ID LOCK: ${c.idTag||c.id}, ${c.name}. Physical identity: ${c.desc||c.look||''}. Wardrobe continuity: ${c.outfit||''}. Default location: ${c.place||c.location||''}. Voice identity: ${c.voice||''}. Reference: ${c.url||c.reference||'No image attached yet, generate master portrait first'}. Keep the exact same face, hair, body shape, complexion and outfit in every shot. IMPORTANT: attach the approved reference image directly in the image/video generation tool; a Google Drive URL by itself may not be read by the generator.`}
function characterPrompt(c=selected()){if(!c)return 'โปรดเลือกตัวละครหรือกรอกรายละเอียดตัวละครใหม่ก่อน';return [
 'CHARACTER MASTER GENERATION PROMPT — IMAGE ONLY',
 `Identity name / slug: ${c.name} (${c.idTag||c.id}).`,
 `Subject: a believable adult Thai person, age ${c.age||'around 25–35'}, ${c.desc||c.look||'natural realistic appearance'}.`,
 `Personality conveyed through expression and body language: ${c.personality||c.desc||'approachable'}.`,
 `Speaking identity for later voice-over: ${c.voice||'natural Thai speech'}; background role: ${c.occupation||'everyday presenter'}.`,
 `Defining identity markers: ${c.signature||'subtle individual traits, natural facial asymmetry'}.`,
 `Lighting and cinematography guidance: ${c.lighting||'soft natural daylight'}, ${c.camera||'natural eye-level portrait'}.`,
 `Consistent wardrobe: ${c.outfit||'simple everyday clothing with no prominent logo'}.`,
 `Natural suitable work/lifestyle setting: ${c.place||c.location||'real Thai home or office'}.`,
 'Create ONE high-quality photorealistic full-body master image, subject fully visible from head to shoes, front 3/4 angle, neutral standing pose, natural realistic skin texture and small asymmetries, correct five fingers, realistic hair and facial proportions, lens 50mm equivalent, soft natural daylight. Subject is a NEW fictional AI influencer. Plain uncomplicated background with enough space around the subject. No text in image.',
 'For character-sheet version: preserve the identical person and outfit across exactly four panels: front full body, left 3/4 portrait, right 3/4 portrait, and warm natural expression closeup. Do not change face between panels.',
 c.url||c.reference?`If using existing approved identity, do NOT redesign. Upload and match this character reference exactly: ${c.url||c.reference}.`:'Once approved, treat this generated image as the character master for all subsequent storyboard frames and video shots.',
 'NEGATIVE: different identity, face drift, generic AI face, cartoon, glamour retouching, plastic skin, extra limbs, distorted fingers, low-quality text, brand logos, duplicate person, watermark.'
 ].join('\n\n')}
function layoutShot(title,hook,beat,index,n,details){const p=state.project;const seconds=Number(p.length)/Number(n);const start=seconds*index,end=seconds*(index+1);const lines=summarizeFacts(p.facts);const char=selected(),secondary=guest();
 const scenario=char?.place||char?.location||'สถานที่ใช้งานสินค้าที่สมจริง';
 const goals=["เปิดความสนใจใน 1–3 วินาที",'ทำให้เข้าใจบริบท', 'สื่อสารข้อมูลสินค้าตามที่มีจริง','สาธิตหรือแสดงรายละเอียดสินค้า','ช่วยให้ผู้ชมตัดสินใจ','ปิดด้วยการชวนดูรายละเอียด'];
 const action=p.mode==='voiceover'?'ภาพสินค้าในสถานที่ใช้งานจริง เน้นรายละเอียดที่เกี่ยวกับบทพูด ไม่สร้างฟังก์ชันที่ไม่ได้ระบุ':p.mode==='dialogue'&&secondary?'คนแรกตั้งคำถาม คนที่สองอธิบายพร้อมมองสินค้าหรือชี้ของจริงอย่างเป็นธรรมชาติ':'ผู้เล่าอยู่กับสินค้าหรือภาพประกอบจริง ใช้สีหน้าและท่าทางเล็กน้อย';
 const q=p.mode==='dialogue'&&secondary?`${char?.name||'ผู้ถาม'}: ${hook}\n${secondary.name}: ${beat}`:p.mode==='voiceover'?`Voice Over: ${beat}`:`${char?.name||'ผู้เล่า'}: ${beat}`;
 return {id:pid(),index:index+1,start,end,title,objective:goals[Math.min(index,goals.length-1)],scene:scenario,action,angle:index===0?'Medium close-up → object reveal':index===n-1?'Medium shot + readable product detail':index%2?'Over-shoulder / insert close-up':'Medium shot with product visible',dialogue:q,overlay:index===0?hook.slice(0,44):(title.slice(0,45)),mood:index===0?'Curious / Hook':index===n-1?'Friendly / CTA':'Natural / Informative',sound:'Natural room ambience; dialogue clean and dry, no copyrighted music; no invented sound.',sourceFacts:details};}
function beatsFor(n){const p=state.project;const facts=summarizeFacts(p.facts);const product=p.title||'ผลิตภัณฑ์';const a=facts[0]||p.facts.slice(0,120),b=facts[1]||a,c=facts[2]||b;
 const hook=p.mode==='question'?`กำลังหาข้อมูลเกี่ยวกับ${product}อยู่หรือเปล่า?`:`${product} มีอะไรที่ควรรู้ก่อนเลือก?`;
 const src=p.importedScript||state.importedScript||'';
 const segments=src.split(/\n\s*\n|\n(?=\S)/).map(x=>x.trim()).filter(x=>x.length>8);
 const primary=[
 ['HOOK',hook,`มาดูข้อมูลของ ${product} กันครับ`],
 ['CONTEXT',`เรื่องนี้ต้องดูอะไร?`,`ถ้ากำลังสนใจ ${product} ลองเริ่มจากรายละเอียดที่ระบุไว้ก่อน`],
 ['FACT 01',`รายละเอียดแรก`,`ตามข้อมูลสินค้า ${a}`],
 ['FACT 02',`รายละเอียดเพิ่มเติม`,`อีกจุดที่ระบุไว้คือ ${b}`],
 ['CTA',`อ่านก่อนตัดสินใจ`,p.cta||'ตรวจรายละเอียดและเงื่อนไขในหน้าสินค้าก่อนตัดสินใจ']
 ];
 const extra=[['FACT 03',`ข้อมูลอีกข้อ`,`ข้อมูลสินค้าเพิ่มเติมคือ ${c}`],['DETAIL',`ดูส่วนประกอบหรือฟังก์ชัน`,`ตรวจภาพและรายละเอียดสินค้าประกอบกับข้อมูลที่ให้มา`],['WRAP UP',`เลือกให้เหมาะกับตัวเอง`,`เปรียบเทียบกับสิ่งที่ต้องการก่อนตัดสินใจ`]];
 let beats=n===4?[primary[0],primary[2],primary[3],primary[4]]:n===5?primary:n===6?[primary[0],primary[1],primary[2],primary[3],extra[0],primary[4]]:n===8?[primary[0],primary[1],primary[2],primary[3],extra[0],extra[1],extra[2],primary[4]]:primary;
 if(segments.length){beats=beats.map((item,i)=>[item[0],item[1],segments[i]||item[2]])}
 return beats.map((a,i)=>layoutShot(a[0],a[1],a[2],i,beats.length,facts.slice(0,8).join(' | ')));
}
function shotStoryboard(s){const p=state.project;const char=selected(),other=guest();const layout=p.boardLayout==='frame'?'Produce a single vertical image ONLY with no information panel; metadata should remain outside the picture.':'Produce ONE 16:9 STORYBOARD SHEET: left side shows a framed vertical 9:16 realistic still for this shot; right side is a clean production information panel with shot number, timing, scene, camera, motion, spoken dialogue and mood. Prefer short English labels on the panel and avoid generating complex Thai writing. Do not add invented text.';
return [
`STORYBOARD IMAGE PROMPT — ${String(s.index).padStart(2,'0')} / ${state.shots.length} — ${p.title||'Untitled'}`,
`Time ${time(s.start)}–${time(s.end)} (${(s.end-s.start).toFixed(1)} seconds). ${layout}`,
`FORMAT OF THE FUTURE VIDEO: ${frameSpec()}`,
`REFERENCE / IDENTITY:\n${identity(char)}${other?'\nSUPPORTING PRESENTER:\n'+identity(other):''}`,
`LOCATION: ${s.scene}. CONTINUITY: Same approved characters, wardrobe, props, lighting, product and room across consecutive shots. Use natural Thai home/office/store environment; avoid futuristic UI.`,
`VISUAL CONTENT: ${s.objective}. ACTION: ${s.action}. CAMERA: ${s.angle}. MOOD: ${s.mood}.`,
`FACT BASIS (user supplied, not verified): ${s.sourceFacts||p.facts}. Do not visualize unverified product functionality, efficacy, certificates, discounts, performance or reviews.`,
`TEXT OVERLAY (add during editing, not generative image): ${s.overlay}`,
`EXACT DIALOGUE / VO: ${s.dialogue}`,
`NEGATIVE: different face or hair, character age change, costume change, duplicate hands/fingers, product shape/logo change, imaginary controls, excessive beauty retouch, cartoon, sci-fi room, random text, AI artefacts, watermark.`
].join('\n\n')}
function shotVideo(s){const p=state.project;const char=selected(),other=guest();return [
`GOOGLE FLOW / AI VIDEO PROMPT — SHOT ${String(s.index).padStart(2,'0')} / ${state.shots.length}`,
`TARGET VIDEO: ${frameSpec()} 30 fps desired. ONE CONTINUOUS SHOT. Duration target ${(s.end-s.start).toFixed(1)} seconds (adjust to generator supported duration if needed). No cuts, no montage, no abrupt transitions. This is a shot-level prompt, not a whole-video montage.`,
`REQUIRED INPUT ASSETS: Upload the approved CHARACTER MASTER image(s) directly to the generator as reference, plus original PRODUCT PHOTO for accurate packaging if available. Do not assume the reference URLs are ingested automatically.`,
`PERMANENT IDENTITY LOCK: ${identity(char)}${other?' SUPPORTING PERSON: '+identity(other):''}`,
`SCENE AND SETTING: ${s.scene}. Existing shot continuity preserved: clothing, furniture, time of day, lighting, product props, body proportions and face identity stay unchanged.`,
`TIMELINE / PERFORMANCE: ${s.objective}. ${s.action}. Character gestures must be simple and physically plausible. Match actions to the provided product facts, not imagined demonstrations.`,
`CAMERA: ${s.angle}. Natural smartphone handheld micro-movement, realistic depth of field, no excessive cinematic movement.`,
`EXACT THAI DIALOGUE — spoken once only, correct speaker and lip-sync if supported:\n${s.dialogue}`,
`AUDIO: ${s.sound}. Mood: ${s.mood}. Keep voice intelligible. If this tool cannot generate reliable Thai speech, render silent visuals and add separately generated voice during post-production; do not invent English dialogue.`,
`OVERLAY TO ADD IN EDITOR (DO NOT GENERATE RANDOM LETTERS IN VIDEO): ${s.overlay}`,
`SOURCE PRODUCT FACTS: ${p.facts}. No claims beyond these statements; no fake testimonials, no invented before/after effects.`,
`NEGATIVE: face drift, mismatched speaker, extra actors, uncanny eyes, deformed hands, frame jumps, unmotivated camera cuts, wardrobe changes, hallucinated product features, inaccurate UI, text glitches, cartoon appearance, watermark.`
].join('\n\n')}
function whole(){return [
`KEN LAB — PRODUCTION PROMPT PACKAGE\nProject: ${state.project.title||'Untitled'}\nGenerated: ${new Date().toLocaleString('th-TH')}\nSelected: ${selected()?.name||'ไม่มีตัวละคร'}${guest()?' + '+guest().name:''}\nFormat: ${state.project.format}, ${state.project.length} sec, ${state.shots.length} shots.\n\nNOTE: this is a prompt authoring toolkit, not an AI image/video generator. Product claims come only from user inputs.`,
'==================== 01 — CHARACTER MASTER / REFERENCE ====================',characterPrompt(),
'==================== 02 — STORYBOARD IMAGE PROMPTS ====================',...state.shots.map(shotStoryboard),
'==================== 03 — VIDEO PROMPTS ====================',...state.shots.map(shotVideo)
].join('\n\n---\n\n')}
function time(s){let m=Math.floor(s/60),sec=(s%60);return `${String(m).padStart(2,'0')}:${sec.toFixed(1).padStart(4,'0')}`}
const charButton=(c,choice)=>`<button type="button" class="pw-character ${choice?'is-picked':''}" data-pw-select="${esc(c.id)}"><div class="pw-avatar">${esc(c.name.slice(0,1))}</div><div class="pw-character-content"><strong>${esc(c.name)}</strong><small>${esc(c.group||'ตัวละครใหม่')}</small><span>${esc(c.desc||c.look||'ตัวละครที่กำหนดเอง')}</span></div><span class="pw-checked">${choice?'✓':'เลือก'}</span></button>`;
const input=(name,label,val,placeholder='',type='text')=>`<label class="pw-field"><span>${esc(label)}</span><input data-pw-field="${esc(name)}" value="${esc(val)}" type="${type}" placeholder="${esc(placeholder)}" ${type==='url'?'maxlength="500"':'maxlength="200"'}></label>`;
const textarea=(name,label,val,placeholder='',rows=3)=>`<label class="pw-field"><span>${esc(label)}</span><textarea rows="${rows}" data-pw-field="${esc(name)}" placeholder="${esc(placeholder)}">${esc(val)}</textarea></label>`;
const selectOptions=(values,chosen)=>values.map(([key,label])=>`<option value="${esc(key)}" ${key===chosen?'selected':''}>${esc(label)}</option>`).join('');
function header(){return `<div class="pw-intro"><span class="pw-overline">PROMPT PRODUCTION PIPELINE</span><h2>เลือกตัวละคร → Storyboard → Prompt วิดีโอ</h2><p>เริ่มจาก Character Master ที่มีอยู่ หรือสร้าง Prompt ตัวละครใหม่ จากนั้นออกแบบรายช็อตและคัดลอกคำสั่งไปสร้างภาพหรือวิดีโอในเครื่องมือที่ใช้จริงได้เลย</p></div><div class="pw-steps">${[['1','ตัวละคร / Character'],['2','Storyboard'],['3','Video Prompt']].map((x,i)=>`<button class="pw-step ${state.step===i+1?'active':''} ${state.step>i+1?'done':''}" data-pw-step="${i+1}"><span>${x[0]}</span>${x[1]}</button>`).join('')}</div>`}

const TOPICS={
 gender:['หญิงไทย','ชายไทย','บุคคลไทยที่มีสไตล์เป็นกลางทางเพศ'],
 occupation:['คนทำงานออฟฟิศที่ชอบทดลองของใช้','พิธีกรอิสระสายรีวิวสินค้า','คนรักการจัดบ้านและอุปกรณ์ใช้ในชีวิตประจำวัน','คนทำงานสายไลฟ์สไตล์'],
 face:['ใบหน้ารูปไข่ โหนกแก้มเล็กน้อย ดวงตาดูมีชีวิต','ใบหน้ารูปหัวใจ กรามไม่คมเกินจริง ยิ้มเห็นฟันธรรมชาติ','ใบหน้าออกเหลี่ยมมน คิ้วเข้มเล็กน้อย จมูกเป็นธรรมชาติ','โครงหน้าเรียวยาวเล็กน้อย มีเอกลักษณ์และความไม่สมมาตรแบบคนจริง'],
 skin:['ผิวแทนโทนอุ่น มีผิวสัมผัสจริงและรูขุมขนเล็กน้อย','ผิวสองสีโทนธรรมชาติ ไม่เนียนแบบฟิลเตอร์','ผิวขาวเหลืองแบบคนไทย มีผิวสัมผัสจริง','ผิวสีน้ำผึ้ง มีความต่างของสีผิวเล็กน้อยตามธรรมชาติ'],
 hair:['ผมดำประบ่า แสกข้างเล็กน้อย ปลายผมไม่เรียบเป๊ะ','ผมดำสั้น ทรงธรรมชาติ ไม่จัดทรงมาก','ผมยาวสีน้ำตาลเข้มรวบต่ำ มีลูกผม','ผมยาวระดับบ่า มีวอลลุ่มเล็กน้อย'],
 body:['รูปร่างสมส่วน ดูสุขภาพดี สัดส่วนมนุษย์จริง','รูปร่างท้วมเล็กน้อย เป็นธรรมชาติ','รูปร่างแข็งแรงแบบคนออกกำลังกายทั่วไป','รูปร่างเพรียวสมส่วน ไม่แต่งภาพเกินจริง'],
 signature:['ยิ้มมุมปากเล็กน้อย มีไฝจาง ๆ ใกล้แก้ม','ใส่แว่นสายตาทรงเรียบ สีหน้ามั่นใจ','ลักยิ้มข้างเดียว สีหน้าสดใส','คิ้วสองข้างไม่เท่ากันเล็กน้อย ยิ้มเป็นธรรมชาติ'],
 personality:['พูดเป็นกันเอง คล้ายเล่าให้เพื่อนฟัง ไม่เร่งขาย','อธิบายเป็นขั้นตอน เห็นใจคนดูและไม่โอ้อวด','ร่าเริง มีอารมณ์ขันเบา ๆ แต่ไม่เล่นใหญ่','สงบ สุขุม ให้ข้อมูลชัดเจนโดยไม่กล่าวอ้างเกินจริง'],
 delivery:['รีวิวธรรมชาติ แบบคนสนิทแนะนำกัน','ถาม–ตอบชวนสงสัย เหมาะกับคลิปสั้น','สาธิตแบบมีเหตุผล เน้นข้อมูลจากสินค้า','เล่าเรื่องแบบอบอุ่น ค่อย ๆ เปิดประเด็น'],
 outfit:['เสื้อเชิ้ตสีครีม กางเกงขายาวสีเข้ม เรียบง่าย','เสื้อยืดสีพื้น กางเกงยีนส์ ลุคสบาย ๆ','เสื้อโปโลสี Navy กับกางเกง Beige','เสื้อคลุมบางสีอ่อน ทับเสื้อขาวและกางเกงสีอ่อน'],
 location:['มุมห้องนั่งเล่นบ้านไทยที่ดูมีคนอยู่จริง','โต๊ะทำงานในคอนโดไทย แสงธรรมชาติ','มุมสาธิตสินค้าภายในบ้านสะอาดเรียบง่าย','ร้านค้าหรือคาเฟ่ไทยขนาดเล็กในช่วงกลางวัน'],
 lighting:['แสงอ่อนจากหน้าต่าง ตกกระทบผิวสมจริง','แสงธรรมชาติช่วงเช้า เงานุ่ม','แสงไฟในห้องผสมแสงหน้าต่าง ไม่ดูจัดฉาก','แสงช่วงบ่ายอุ่นเล็กน้อย คุมความสว่างไม่ให้โอเวอร์'],
 camera:['ภาพถ่ายครึ่งตัวและเต็มตัว เลนส์มือถือสมจริง','มุมกล้องระดับสายตา เลนส์เทียบเท่า 50 มม.','มุมสามส่วนสี่ เห็นใบหน้าและชุดชัดเจน','ภาพแนวตั้ง 9:16 ระยะ Medium Shot ธรรมชาติ'],
 voice:['เสียงผู้พูดไทยวัยทำงาน โทนอบอุ่น พูดชัด ไม่ขายเกินจริง','เสียงผู้พูดไทยมั่นใจ ออกเสียงเป็นธรรมชาติ มีเว้นจังหวะ','เสียงผู้พูดไทยเป็นกันเอง กระชับ คล้ายเล่าประสบการณ์','เสียงผู้พูดไทยสุขุม ให้ข้อมูลด้วยความน่าเชื่อถือ']
};
const PRODUCT_IDEAS={
 fitness:{occupation:['คนทำงานที่ชอบเดินในบ้าน','พิธีกรรีวิวอุปกรณ์ฟิตเนสสำหรับใช้ที่บ้าน','ผู้ชอบดูฟังก์ชันเครื่องออกกำลังกาย'],outfit:['เสื้อยืดออกกำลังกายสีเรียบ กางเกงกีฬา','เสื้อโปโลสีเข้ม กางเกงลำลอง'],location:['มุมออกกำลังกายในคอนโดไทย','ห้องนั่งเล่นบ้านไทยที่วางลู่วิ่งได้จริง'],delivery:['สาธิตรีโมทและจอโดยอิงข้อมูลจริง','เล่าไลฟ์สไตล์คนทำงานกับอุปกรณ์ฟิตเนส']},
 beauty:{occupation:['คนทำงานสายไลฟ์สไตล์ที่ชอบดูแลตัวเอง','พิธีกรรีวิวของใช้ส่วนตัวแบบมีเหตุผล'],outfit:['ชุดลำลองสีครีมเรียบง่าย','เสื้อเชิ้ตสีอ่อนสบาย ๆ'],location:['มุมโต๊ะเครื่องแป้งในบ้านแสงธรรมชาติ','ห้องนั่งเล่นคอนโดไทยสว่าง'],delivery:['เล่าข้อควรตรวจสอบก่อนเลือกซื้อ','รีวิวคุณสมบัติตามข้อมูลผลิตภัณฑ์อย่างจริงใจ']},
 food:{occupation:['คนชอบทำอาหารในบ้าน','เจ้าของร้านอาหารขนาดเล็ก','พิธีกรทดลองทำเมนูที่บ้าน'],outfit:['เสื้อยืดสีพื้นกับผ้ากันเปื้อนเรียบ','เสื้อคอจีนกับผ้ากันเปื้อน'],location:['ครัวบ้านไทยพร้อมอุปกรณ์ใช้งานจริง','เคาน์เตอร์ร้านอาหารหรือแผงขายผลไม้'],delivery:['เล่าวิธีใช้เครื่องครัวทีละขั้น','เปิดด้วยคำถามเรื่องการเตรียมอาหาร']},
 tech:{occupation:['คนทำงานสายเทคโนโลยีที่อธิบายง่าย','พิธีกรสาธิตแก็ดเจ็ตและอุปกรณ์บ้าน'],outfit:['เสื้อโปโลสี Navy กางเกง Beige','เสื้อเชิ้ตแขนพับสีอ่อน'],location:['โต๊ะทำงานจริงพร้อมคอมพิวเตอร์','ห้องนั่งเล่นที่มีอุปกรณ์เทคโนโลยี'],delivery:['เล่าปุ่มและฟังก์ชันที่ตรวจสอบได้','สาธิตการใช้งานโดยไม่แต่งสเปก']}
};
function ideaGroup(){
 const p=(state.project.title+' '+state.project.facts+' '+state.project.category).toLowerCase();
 if(/กันแดด|สกิน|ผิว|ครีม|แฟชั่น|เครื่องสำอาง/.test(p))return 'beauty';
 if(/วิ่ง|ลู่|ฟิตเนส|กีฬา|โยคะ|ออกกำลัง/.test(p))return 'fitness';
 if(/อาหาร|ผลไม้|เครื่องครัว|หม้อ|เครื่องปั่น|ร้านค้า/.test(p))return 'food';
 if(/รีโมท|กล้อง|คอม|แอป|มือถือ|แท็บเล็ต|เทค|โดรน/.test(p))return 'tech';
 return '';
}
function ideaList(field){
 const category=ideaGroup();
 return [...(PRODUCT_IDEAS[category]?.[field]||[]),...(TOPICS[field]||[])];
}
function pickIdea(field,onlyEmpty=false){
 if(!(field in state.draft))return false;
 if(onlyEmpty&&String(state.draft[field]||'').trim())return false;
 const options=ideaList(field);if(!options.length)return false;
 const cycle=state.ideaCycles||(state.ideaCycles={});
 let i=Number(cycle[field]||0)%options.length;
 if(options.length>1&&options[i]===state.draft[field])i=(i+1)%options.length;
 state.draft[field]=options[i];cycle[field]=(i+1)%options.length;
 return true;
}
const IDEA_GROUPS={
 identity:['gender','occupation'],
 appearance:['face','skin','hair','body','signature'],
 behavior:['personality','delivery','voice'],
 visual:['outfit','location','lighting','camera']
};
function fillIdeaGroup(group){const fields=group==='all'?Object.values(IDEA_GROUPS).flat():IDEA_GROUPS[group]||[];let changed=0;for(const key of fields)if(pickIdea(key,true))changed++;save();currentHTML();toast(changed?'เติมไอเดียในช่องที่ยังว่าง '+changed+' หัวข้อแล้ว':'หมวดนี้มีข้อมูลแล้ว กด ✦ ช่วยคิด ในหัวข้อที่อยากเปลี่ยนได้');}
function guidedField(field,label,placeholder,rows=0){
 const val=state.draft[field]||'';
 return '<label class="pw-field pw-guided-field"><span class="pw-guided-title"><b>'+esc(label)+'</b><button type="button" class="pw-idea-button" data-pw-idea="'+field+'" title="เปลี่ยนเฉพาะหัวข้อนี้">✦ ช่วยคิด</button></span>'+
 (rows?'<textarea rows="'+rows+'" data-pw-field="draft.'+field+'" placeholder="'+esc(placeholder)+'">'+esc(val)+'</textarea>':'<input data-pw-field="draft.'+field+'" value="'+esc(val)+'" placeholder="'+esc(placeholder)+'">')+'</label>'
}
function guidedSection(key,title,subtitle,markup,isOpen=false){
 return '<details class="pw-guide-section" '+(isOpen?'open':'')+'><summary><span><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></span><span class="pw-guide-chevron">⌄</span></summary>'+
 '<div class="pw-guide-content"><button type="button" class="pw-mini pw-group-fill" data-pw-idea-group="'+key+'">✦ เติมไอเดียในช่องว่างของหมวดนี้</button>'+markup+'</div></details>'
}
function guidedEditor(d){
 const identity=guidedField('name','ชื่อตัวละคร','เช่น มีน / ธาม')+
 '<div class="pw-two">'+guidedField('age','อายุ (18 ปีขึ้นไป)','เช่น 27')+guidedField('gender','เพศ / ภาพลักษณ์','เช่น หญิงไทย / ชายไทย / เป็นกลาง')+'</div>'+
 guidedField('occupation','อาชีพ / บทบาท','เช่น สาววัยทำงานสายเทค',2);
 const appearance='<div class="pw-two">'+guidedField('face','โครงหน้าและลักษณะใบหน้า','เช่น หน้ารูปไข่ คิ้วเข้ม',2)+guidedField('skin','สีผิว / ผิวสัมผัส','เช่น ผิวแทนโทนอุ่น',2)+'</div>'+
 '<div class="pw-two">'+guidedField('hair','ทรงผม / สีผม','เช่น ผมดำยาวประบ่า')+guidedField('body','รูปร่าง / สัดส่วน','เช่น สมส่วน ดูสุขภาพดี')+'</div>'+
 guidedField('signature','เอกลักษณ์ที่จำง่าย','เช่น ลักยิ้มข้างเดียว / แว่นกรอบบาง',2)+
 guidedField('look','รายละเอียดรูปลักษณ์เสริม (จาก Prompt เดิม)','ถ้าเคยให้ระบบช่วยคิดไว้ จะอยู่ช่องนี้',2);
 const behavior=guidedField('personality','บุคลิก / นิสัย / ท่าที','เช่น สุขุม กวนเล็กน้อย ฉลาดเป็นกันเอง',2)+guidedField('delivery','สไตล์การพูด / บทบาทในการเล่า','เช่น เพื่อนแนะนำของ / สาธิต / ถาม–ตอบ',2)+guidedField('voice','ลักษณะเสียง','เช่น ภาษาไทยโทนอุ่น พูดธรรมชาติ',2);
 const visuals=guidedField('outfit','ชุดประจำตัว / สี / เครื่องแต่งกาย','เช่น เสื้อโปโลสี Navy กางเกง Beige')+
 guidedField('location','ฉากหลัก / สถานที่','เช่น บ้านไทย / คอนโด / ร้านค้า')+
 '<div class="pw-two">'+guidedField('lighting','แสงและบรรยากาศ','เช่น แสงธรรมชาติจากหน้าต่าง',2)+guidedField('camera','มุมกล้อง / โทนภาพ','เช่น ภาพมือถือแนวตั้ง 9:16',2)+'</div>'+
 guidedField('reference','ลิงก์ภาพ Master อ้างอิง (ถ้ามี)','https://drive.google.com/file/d/...');
 return '<div class="pw-guide-intro"><strong>Character Idea Builder</strong><p>ไม่ต้องคิดทั้งหมดเอง กด ✦ ช่วยคิด ทีละหัวข้อ หรือเติมเฉพาะช่องว่างทั้งหมวด คุณแก้คำที่แนะนำได้ทุกช่อง</p><button class="pw-mini" type="button" data-pw-idea-group="all">✦ ช่วยเติมทุกหัวข้อที่ยังว่าง</button></div>'+
 guidedSection('identity','01 · ตัวตน','ชื่อ อายุ เพศ และอาชีพ',identity,true)+
 guidedSection('appearance','02 · หน้าตาและรูปร่าง','โครงหน้า ผิว ผม สัดส่วน และเอกลักษณ์',appearance,true)+
 guidedSection('behavior','03 · บุคลิกและเสียง','นิสัย วิธีพูด โทนเสียง',behavior)+
 guidedSection('visual','04 · เสื้อผ้าและฉาก','ชุด โลเคชัน แสง และมุมกล้อง',visuals);
}
function draftCharacter(d=state.draft){
 const visual=[d.gender,d.occupation,d.face,d.skin,d.hair,d.body,d.signature,d.look].filter(Boolean).join('; ').slice(0,1100);
 const persona=[d.personality,d.delivery].filter(Boolean).join('; ').slice(0,550);
 return {idTag:'CUSTOM-DRAFT',name:d.name||'AI Influencer',age:d.age||'25',desc:visual,look:visual,
   personality:persona,outfit:d.outfit,place:d.location,voice:d.voice,url:d.reference,signature:d.signature,lighting:d.lighting,camera:d.camera,occupation:d.occupation};
}

function stage1(){const p=state.project,d=state.draft,rec=recommend();const isNew=state.primary==='new',none=state.primary==='none';return `<div class="pw-grid"><section class="pw-panel"><div class="pw-head"><div><h3>ข้อมูลคลิป / สินค้า</h3><p>ใส่ข้อมูลจริงก่อน เพื่อให้ Prompt ไม่แต่งสรรพคุณหรือฟังก์ชัน</p></div><button class="pw-mini" data-pw-action="import">↥ ดึงจาก Product Script Factory</button></div>${input('project.title','ชื่อสินค้า / หัวข้อคลิป',p.title,'เช่น ลู่วิ่ง D5-Pro')}${textarea('project.facts','ข้อมูลสินค้า / เนื้อหาที่ต้องเล่า',p.facts,'วางข้อมูลจริงจากสินค้าหรือเนื้อหา ผู้ชมควรทราบอะไรบ้าง',5)}<div class="pw-two">${input('project.audience','กลุ่มผู้ชม',p.audience,'เช่น คนทำงานอยู่คอนโด')}<label class="pw-field"><span>หมวดสินค้า</span><select data-pw-field="project.category">${selectOptions(CATEGORY.map(x=>[x,x]),p.category)}</select></label></div><div class="pw-two"><label class="pw-field"><span>แนวเล่าเรื่อง</span><select data-pw-field="project.mode">${selectOptions(Object.entries(MODES),p.mode)}</select></label><label class="pw-field"><span>ความยาวรวม</span><select data-pw-field="project.length">${selectOptions([[20,'20 วินาที'],[30,'30 วินาที'],[40,'40 วินาที'],[60,'60 วินาที']].map(a=>a.map(String)),String(p.length))}</select></label></div><div class="pw-two"><label class="pw-field"><span>จำนวน Shot</span><select data-pw-field="project.count">${selectOptions([4,5,6,8].map(x=>[String(x),x+' Shot']),String(p.count))}</select></label><label class="pw-field"><span>สัดส่วนวิดีโอ</span><select data-pw-field="project.format">${selectOptions([['9:16','แนวตั้ง 9:16'],['16:9','แนวนอน 16:9']],p.format)}</select></label></div>${input('project.cta','คำชวนท้ายคลิป (CTA)',p.cta,'ดูรายละเอียดสินค้าเพิ่มเติม')}${textarea('project.notes','หมายเหตุให้ผู้กำกับ / AI',p.notes,'ห้ามแต่งราคาหรืออ้างว่าใช้จริงถ้าไม่ได้ใช้จริง',2)}${state.importedLabel?`<p class="pw-note">เชื่อมบทพูดที่เลือกจาก Product Factory: ${esc(state.importedLabel)}</p>`:''}</section><section class="pw-panel"><div class="pw-head"><div><h3>เลือกตัวละคร</h3><p>เลือกได้อิสระ ไม่ผูกกับหมวดสินค้า</p></div></div><div class="pw-tip">แนะนำจากคำสำคัญสินค้า (เปลี่ยนเองได้): ${rec.map(k=>library().find(c=>c.id===k)?.name).filter(Boolean).join(' · ')}</div><div class="pw-characters">${library().map(c=>charButton(c,c.id===state.primary)).join('')}${charButton({id:'new',name:'สร้างตัวละครใหม่',group:'ออกแบบ Character Master ด้วย Prompt',desc:'กำหนดหน้าตา บุคลิก ชุด ฉาก และเอกลักษณ์'},isNew)}${charButton({id:'none',name:'ไม่ใช้ตัวละคร',group:'Product Close-up / Voice Over',desc:'เลือกภาพสินค้าเป็นหลัก และให้เสียงพากย์เล่าเรื่อง'},none)}</div>${selected()?.url?`<p class="pw-source">ภาพมาสเตอร์: <a href="${esc(selected().url)}" target="_blank" rel="noopener noreferrer">เปิด Character Reference ↗</a> (ต้องแนบไฟล์ภาพเองในเครื่องมือสร้างภาพ/วิดีโอ)</p>`:''}<label class="pw-field"><span>ตัวละครเสริม (ถ้าต้องการถาม–ตอบ)</span><select data-pw-field="secondary"><option value="">ไม่มีตัวละครเสริม</option>${library().filter(c=>c.id!==state.primary).map(c=>`<option value="${esc(c.id)}" ${c.id===state.secondary?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><div class="pw-hr"></div><div class="pw-head"><h3>สร้าง Prompt ตัวละครใหม่</h3><div class="pw-buttons"><button class="pw-mini" data-pw-action="suggest-new">✦ แนะนำคาแร็กเตอร์จากสินค้า</button><button class="pw-mini" data-pw-action="choose-new">+ กรอกเอง</button></div></div>${guidedEditor(d)}<div class="pw-buttons"><button class="btn btn-secondary small" data-pw-action="preview-new">ดู Prompt ตัวละคร</button><button class="btn small" data-pw-action="save-new">บันทึกเป็นตัวละครใหม่</button></div><div id="pw-new-prompt" class="pw-promptbox" hidden><div class="pw-prompt-actions"><b>Character Master Prompt</b><button class="pw-mini" data-pw-copy="character">คัดลอก Prompt</button></div><textarea id="pw-new-prompt-text" rows="12" readonly></textarea></div><p class="pw-note">รูปที่ AI สร้างออกมายังต้องตรวจสอบ เลือกภาพที่ชอบ และใช้เป็น Master Reference ในทุกช็อต เพื่อกันหน้าเปลี่ยน</p></section></div><div class="pw-actions"><span>ขั้นตอน 1 / 3 · กรอกข้อมูลและเลือกตัวละคร</span><button class="btn" data-pw-action="make-storyboard">ถัดไป: สร้าง Storyboard →</button></div>`}
function shotEditor(s,i){return `<article class="pw-shot"><div class="pw-shot-title"><strong>SHOT ${String(i+1).padStart(2,'0')} · ${esc(s.title)}</strong><span>${time(s.start)}–${time(s.end)}</span></div><div class="pw-two">${shotInput(i,'title','หัวข้อช็อต',s.title)}${shotInput(i,'overlay','ข้อความขึ้นจอ',s.overlay)}</div>${shotArea(i,'scene','ฉาก / สถานที่',s.scene,2)}${shotArea(i,'action','การกระทำของตัวละครและสินค้า',s.action,2)}<div class="pw-two">${shotInput(i,'angle','มุมกล้อง',s.angle)}${shotInput(i,'mood','อารมณ์',s.mood)}</div>${shotArea(i,'dialogue','บทพูดหรือ Voice Over (ใช้ข้อความนี้ใน Video Prompt)',s.dialogue,3)}<div class="pw-shotbuttons"><button class="pw-mini" data-pw-copy="board:${i}">คัดลอก Prompt Storyboard</button><button class="pw-mini" data-pw-action="jump-video" data-pw-index="${i}">ดู Video Prompt ↗</button></div></article>`}
function shotInput(i,k,label,val){return `<label class="pw-field"><span>${label}</span><input data-pw-shot="${i}" data-pw-shot-field="${k}" value="${esc(val)}"></label>`}
function shotArea(i,k,label,val,rows){return `<label class="pw-field"><span>${label}</span><textarea rows="${rows}" data-pw-shot="${i}" data-pw-shot-field="${k}">${esc(val)}</textarea></label>`}
function stage2(){return `<section class="pw-panel"><div class="pw-head"><div><h3>Storyboard Prompt Builder</h3><p>ระบบสร้าง Shot จากข้อมูลที่กรอกไว้และบทจาก Product Factory (ถ้ามี) — แก้ทุกช็อตได้ก่อนส่งไปทำวิดีโอ</p></div><div class="pw-buttons"><button class="pw-mini" data-pw-action="refresh-shots">↻ สร้างโครงช็อตใหม่</button><button class="pw-mini" data-pw-copy="all-boards">คัดลอก Storyboard ทั้งหมด</button></div></div><div class="pw-tip">${esc(state.project.title)} · ${esc(MODES[state.project.mode])} · ${state.shots.length} Shot / ${state.project.length} วินาที · ตัวละคร: ${esc(selected()?.name||'ไม่ใช้ตัวละคร')}${guest()?' × '+esc(guest().name):''}</div><label class="pw-field pw-small-select"><span>รูปแบบ Prompt ภาพ Storyboard</span><select data-pw-field="project.boardLayout">${selectOptions([['board','Storyboard Sheet (ภาพซ้าย / ข้อมูลขวา)'],['frame','ภาพแนวตั้งช็อตเดียว (ไม่มี panel)']],state.project.boardLayout)}</select></label><div class="pw-shotgrid">${state.shots.map(shotEditor).join('')}</div><div class="pw-actions"><button class="btn btn-ghost" data-pw-step="1">← กลับไปเลือกตัวละคร</button><button class="btn" data-pw-step="3">ถัดไป: Video Prompts →</button></div></section>`}
function stage3(){return `<section class="pw-panel"><div class="pw-head"><div><h3>พร้อมนำ Prompt ไปใช้สร้างภาพและวิดีโอ</h3><p>สร้างไว้แยกรายช็อต ใช้ร่วมกับ Master Reference และข้อมูลสินค้าจริง · ไม่ต้องติดตั้ง API</p></div></div><div class="pw-tip"><b>วิธีใช้:</b> (1) คัดลอก Prompt ภาพมาสเตอร์เมื่อสร้างตัวละครใหม่ (2) สร้างภาพ Storyboard รายช็อตโดยแนบ Master Image (3) ใช้ภาพช็อตนั้นและ Video Prompt ใน Google Flow หรือ AI Video Tool (4) นำช็อตมารวมตัดต่อในภายหลัง</div><div class="pw-exports"><button class="btn" data-pw-download="all">↓ ดาวน์โหลด Prompt ทั้งหมด .txt</button><button class="btn btn-secondary" data-pw-download="json">↓ สำรอง Project .json</button><button class="btn btn-ghost" data-pw-copy="all">คัดลอกทั้งหมด</button></div>${selected()?`<details class="pw-promptbox"><summary>Character Master Prompt · ${esc(selected().name)}</summary><div class="pw-prompt-actions"><button class="pw-mini" data-pw-copy="character">คัดลอก Character Prompt</button></div><textarea readonly rows="12">${esc(characterPrompt())}</textarea></details>`:`<p class="pw-note">เลือกโหมดไม่มีตัวละคร: วิดีโอจะใช้ภาพสินค้าและ Voice Over</p>`}${state.shots.map((s,i)=>`<details class="pw-promptbox" ${i===0?'open':''}><summary>SHOT ${String(i+1).padStart(2,'0')} · ${time(s.start)}–${time(s.end)} · ${esc(s.title)}</summary><div class="pw-prompt-actions"><b>01 / Storyboard Image Prompt</b><button class="pw-mini" data-pw-copy="board:${i}">คัดลอก Storyboard</button></div><textarea readonly rows="11">${esc(shotStoryboard(s))}</textarea><div class="pw-prompt-actions"><b>02 / Google Flow Video Prompt</b><button class="pw-mini" data-pw-copy="video:${i}">คัดลอก Video Prompt</button></div><textarea readonly rows="14">${esc(shotVideo(s))}</textarea></details>`).join('')}<div class="pw-actions"><button class="btn btn-ghost" data-pw-step="2">← กลับไปแก้ Storyboard</button><button class="btn btn-secondary" data-pw-action="new-project">+ เริ่มโปรเจกต์ใหม่</button></div></section>`}
function render(){return `<div class="pw" data-production-wizard>${header()}${state.step===1?stage1():state.step===2?stage2():stage3()}<div id="pw-message" role="status"></div></div>`}
async function clipboard(s){try{await navigator.clipboard.writeText(s);toast('คัดลอก Prompt แล้ว')}catch{const e=document.createElement('textarea');e.value=s;document.body.appendChild(e);e.select();const ok=document.execCommand('copy');e.remove();toast(ok?'คัดลอก Prompt แล้ว':'เบราว์เซอร์นี้คัดลอกไม่ได้ โปรดเลือกข้อความเอง')}}
function downloadable(contents,filename,mime){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([contents],{type:mime||'text/plain;charset=utf-8'}));a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
function importProduct(){let data;try{data=JSON.parse(localStorage.getItem('ken-lab-products-v3')||'{}')}catch{data={}};if(!data?.form?.name){toast('ยังไม่พบข้อมูลใน Product Script Factory — ไปสร้างสคริปต์สินค้าก่อน');return}const product=data.form;state.project.title=clamp(product.name,140);state.project.facts=clamp(product.description,6000);state.project.audience=clamp(product.audience,250);state.project.length=Number(product.duration)||40;const v=(data.variants||[]).find(x=>x.id===data.selected)||data.variants?.[0];state.importedScript=clamp(v?.script||'',5000);state.importedLabel=clamp(v?.styleName||v?.hook||product.name,100);state.shots=[];save();currentHTML();toast('นำข้อมูลสินค้าและบทพูดเข้ามาแล้ว')}
function suggestNew(){
 const category=(state.project.title+' '+state.project.facts+' '+state.project.category).toLowerCase();
 let tag='general';if(/กันแดด|ผิว|ครีม|แฟชั่น|สกิน|ชุด|ความงาม/.test(category))tag='beauty';
 else if(/วิ่ง|ฟิตเนส|ลู่|โยคะ|ออกกำลังกาย/.test(category))tag='fitness';
 else if(/อาหาร|ผลไม้|หม้อ|ครัว|เครื่องปั่น|ร้านค้า/.test(category))tag='food';
 else if(/รีโมท|คอม|แอป|มือถือ|เทค|โดรน|กล้อง/.test(category))tag='tech';
 const models={
  beauty:[['มีน','27','หญิงไทยวัยทำงาน ใบหน้าเป็นเอกลักษณ์ ผิวและผมสมจริง ไม่มีรีทัชเกินจริง','สาวทำงานสาย Lifestyle แนะนำของแบบเพื่อนคุย ไม่อวดอ้างผลลัพธ์','เสื้อเรียบสีครีม กางเกงยีนส์','ห้องพักไทยแสงธรรมชาติ','เสียงหญิงไทยโทนอุ่น พูดสบาย ๆ'],['ต้น','29','ชายไทยวัยทำงาน ใส่แว่นทรงเรียบ ผิวธรรมชาติ โครงหน้ามีเอกลักษณ์','ผู้ชายสายดูแลตัวเอง พูดจริงใจ ไม่ขายเกินจริง','เสื้อโปโลสีเทาเข้ม กางเกงสบาย ๆ','มุมโต๊ะเครื่องแป้งในบ้านที่สมจริง','เสียงชายไทยทุ้มกลาง พูดกระชับ'],['แพร','32','หญิงไทยวัย 32 ผมประบ่า ผิวและใบหน้าสมจริง มีความไม่สมมาตรเล็กน้อย','ผู้ให้ข้อมูลสกินแคร์แบบมีเหตุผล ไม่อ้างเป็นแพทย์','เสื้อเชิ้ตขาวเรียบ','มุมห้องสว่างธรรมชาติ','เสียงหญิงไทยมั่นใจและชัดเจน']],
  fitness:[['อิง','27','หญิงไทยวัย 27 รูปร่างแข็งแรงสมส่วน ผิวแทนธรรมชาติ หน้าตาเป็นเอกลักษณ์','สาวออฟฟิศชอบเดินออกกำลังกาย อธิบายของจากฟังก์ชัน ไม่อ้างประสบการณ์ใช้จริง','ชุดลำลองออกกำลังกายสีเรียบ','คอนโดไทยมีลู่วิ่งหรืออุปกรณ์ตามภาพต้นฉบับ','เสียงหญิงไทยสดใสและชัดเจน'],['ภพ','31','ชายไทยวัย 31 รูปร่างสมส่วน ผิวจริง ผมสั้น ใบหน้ามีเอกลักษณ์','พิธีกรอุปกรณ์ออกกำลังกาย อธิบายเป็นลำดับและเป็นธรรมชาติ','เสื้อกีฬาสี Navy และกางเกงออกกำลังกาย','มุมออกกำลังกายในบ้าน','เสียงชายไทยสุขุม จริงใจ'],['เจน','29','หญิงไทยวัย 29 รูปร่างสมส่วน ผิวจริง ผมรวบต่ำ','คนทำงานชอบอุปกรณ์ช่วยขยับตัวในบ้าน พูดเหมือนเพื่อนแนะนำ','เสื้อยืดครีมและกางเกงกีฬา','ห้องนั่งเล่นบ้านไทย','เสียงหญิงไทยเป็นกันเองไม่เร่งขาย']],
  food:[['เมษา','29','หญิงไทยวัย 29 มีใบหน้าและผิวธรรมชาติ ผมรวบเรียบ','คนชอบทำอาหาร อธิบายวิธีใช้ด้วยภาพจริง ไม่อวดอ้างประสิทธิภาพ','เสื้อยืดกับผ้ากันเปื้อนเรียบ','ครัวบ้านไทยมีแสงหน้าต่าง','เสียงหญิงไทยร่าเริง'],['นนท์','32','ชายไทยวัย 32 ผมสั้น หน้าตาอบอุ่น ผิวสมจริง','คนชอบทดลองสูตรอาหาร พูดเป็นขั้นตอน','เสื้อคอจีนสีเบจ ผ้ากันเปื้อน','ครัวขนาดเล็กในคอนโด','เสียงชายไทยเป็นกันเอง'],['ปลา','35','หญิงไทยวัย 35 ผิวธรรมชาติ ผมดำรวบต่ำ','เจ้าของร้านเล็ก ๆ สื่อสารกระชับเรื่องอุปกรณ์','เสื้อโปโลเรียบ ผ้ากันเปื้อน','ร้านค้าหรือครัวจริง','เสียงหญิงไทยคล่องแคล่วชัดเจน']],
  tech:[['ธาม','28','ชายไทยวัย 28 ใส่แว่นบาง ผิวแทนธรรมชาติ หน้าตามีเอกลักษณ์','พิธีกรสายเทค อธิบายฟังก์ชันให้คนทั่วไปเข้าใจ','เสื้อโปโล Navy กางเกง Beige','โต๊ะคอมในบ้านจริง','เสียงชายไทยโทนกลาง สุขุม'],['ลิน','26','หญิงไทยวัย 26 ผมประบ่า ผิวเป็นธรรมชาติ โครงหน้าจำง่าย','สาวทำงานชอบแก็ดเจ็ต อธิบายปุ่มและเมนูแบบเข้าใจง่าย','เสื้อเชิ้ตสีอ่อน','ออฟฟิศไทยทั่วไป','เสียงหญิงไทยชัดเจนและกระฉับกระเฉง'],['ปาล์ม','33','ชายไทยวัย 33 ผมสั้น ผิวสมจริง ใบหน้ามีเอกลักษณ์','สายสาธิตอุปกรณ์เน้นภาพสินค้า มากกว่าคำโฆษณา','เสื้อยืดสีเทา กางเกงยีนส์','โต๊ะรีวิวอุปกรณ์ในบ้าน','เสียงชายไทยเรียบง่าย']],
  general:[['มีน','27','หญิงไทยวัย 27 ผิวธรรมชาติ ผมประบ่า หน้าตาเป็นเอกลักษณ์','คนทำงานพูดแนะนำสินค้าอย่างเป็นกันเอง','เสื้อสีครีมและกางเกงยีนส์','บ้านไทยแสงธรรมชาติ','เสียงหญิงไทยอบอุ่น'],['นนท์','30','ชายไทยวัย 30 ใบหน้าเฉพาะ ผิวแทน ผมสั้น','พิธีกรรีวิวข้อมูลจริงแบบไม่เร่งขาย','เสื้อเชิ้ตสีฟ้าอ่อน กางเกงสีเข้ม','ห้องทำงานในบ้าน','เสียงชายไทยชัดเจน'],['อิง','29','หญิงไทยวัย 29 ผิวธรรมชาติ ผมดำยาว หน้าตาจำง่าย','ผู้เล่าเรื่องแบบถาม–ตอบ ใจเย็น','เสื้อเชิ้ตสีเบจ','ห้องนั่งเล่นเรียบง่าย','เสียงหญิงไทยธรรมชาติ']]
 };
 const list=models[tag],z=list[(Number(state.suggestionCycle)||0)%list.length];
 if(state.shots.length&&!confirm('การเปลี่ยนตัวละครจะเริ่มสร้าง Storyboard ใหม่ กรุณาสำรองงานเดิมก่อน'))return;
 state.suggestionCycle=(Number(state.suggestionCycle)||0)+1;
 state.primary='new';state.secondary='';state.shots=[];
 state.draft={name:z[0],age:z[1],look:z[2],personality:z[3],outfit:z[4],location:z[5],voice:z[6],reference:''};
 save();currentHTML();toast('สร้างแนวทางตัวละครใหม่จากสินค้าแล้ว ปรับรายละเอียดก่อนบันทึกได้');
}
function saveNew(){const d=state.draft;if(!d.name.trim()||draftCharacter(d).desc.trim().length<10){toast('โปรดใส่ชื่อตัวละครและรูปลักษณ์อย่างน้อย 10 ตัวอักษร');return}const c={id:'custom-'+pid(),idTag:'CUSTOM-'+Date.now(),name:clamp(d.name,80),group:'AI Influencer ใหม่',desc:clamp(draftCharacter(d).desc,1100),look:clamp(draftCharacter(d).desc,1100),personality:clamp(draftCharacter(d).personality,550),outfit:clamp(d.outfit,260),place:clamp(d.location,260),voice:clamp(d.voice,260),url:safeUrl(d.reference),age:clamp(d.age,10),gender:clamp(d.gender,80),occupation:clamp(d.occupation,250),signature:clamp(d.signature,220),lighting:clamp(d.lighting,250),camera:clamp(d.camera,250)};state.custom.unshift(c);state.custom=state.custom.slice(0,25);state.primary=c.id;state.secondary='';save();currentHTML();toast('เพิ่มตัวละครในคลังแล้ว เปิด Step 3 เพื่อคัดลอก Character Master Prompt')}
function getPrompt(x){if(x==='all')return whole();if(x==='character')return characterPrompt(state.primary==='new'?draftCharacter():selected());if(x==='all-boards')return state.shots.map(shotStoryboard).join('\n\n---\n\n');if(x?.startsWith('board:'))return shotStoryboard(state.shots[Number(x.split(':')[1])]||state.shots[0]);if(x?.startsWith('video:'))return shotVideo(state.shots[Number(x.split(':')[1])]||state.shots[0]);return ''}
function checkToShots(){if(state.project.title.trim().length<2){toast('กรุณาระบุชื่อสินค้า / หัวข้ออย่างน้อย 2 ตัวอักษร');return false}if(state.project.facts.trim().length<10){toast('กรุณาใส่ข้อมูลสินค้า / เนื้อหาอย่างน้อย 10 ตัวอักษร');return false}if(!state.primary){toast('กรุณาเลือกตัวละครเดิม สร้างตัวละครใหม่ หรือเลือกไม่มีตัวละคร');return false}if(state.primary==='new'){toast('โปรดบันทึกตัวละครใหม่ก่อน หรือเลือกตัวละครเดิม / ไม่ใช้ตัวละคร');return false}return true}
document.addEventListener('input',e=>{const a=e.target;if(!a.closest('[data-production-wizard]'))return;if(a.dataset.pwField){let path=a.dataset.pwField.split('.');let target=state;for(let i=0;i<path.length-1;i++)target=target[path[i]];target[path.at(-1)]=a.value;save();return}if(a.dataset.pwShotField){const shot=state.shots[Number(a.dataset.pwShot)];if(shot){shot[a.dataset.pwShotField]=clamp(a.value,2000);save()}return}});
document.addEventListener('change',e=>{const a=e.target;if(!a.closest('[data-production-wizard]'))return;if(a.dataset.pwField){const path=a.dataset.pwField.split('.');let t=state;for(let i=0;i<path.length-1;i++)t=t[path[i]];t[path.at(-1)]=a.value;if(path.at(-1)==='count'||path.at(-1)==='length')state.shots=[];save()}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-production-wizard] button');if(!b)return;
 if(b.hasAttribute('data-pw-select')){const next=b.dataset.pwSelect;if(state.primary!==next&&state.shots.length){if(!confirm('การเปลี่ยนตัวละครจะล้าง Storyboard เดิมเพื่อป้องกันชื่อผู้พูดไม่ตรงกัน โปรดดาวน์โหลด Project .json ก่อนหากต้องการเก็บงานเก่า'))return;state.shots=[]}state.primary=next;state.secondary=state.primary===state.secondary||state.primary==='none'?'':state.secondary;save();currentHTML();return}
 if(b.hasAttribute('data-pw-step')){let n=Number(b.dataset.pwStep);if(n>=2&&!state.shots.length){if(!checkToShots())return;state.shots=beatsFor(Number(state.project.count));}updateStage(n);return}
 if(b.hasAttribute('data-pw-copy')){await clipboard(getPrompt(b.dataset.pwCopy));return}
 if(b.hasAttribute('data-pw-download')){let kind=b.dataset.pwDownload;downloadable(kind==='json'?JSON.stringify(state,null,2):whole(),`KENLAB_${(state.project.title||'Production').replace(/[^\p{L}\p{N}\p{M}_-]+/gu,'_').slice(0,45)}_${kind==='json'?'Project.json':'Prompts.txt'}`,kind==='json'?'application/json':'text/plain;charset=utf-8');toast('ดาวน์โหลดชุด Prompt แล้ว');return}
 if(b.hasAttribute('data-pw-idea')){const field=b.dataset.pwIdea;if(pickIdea(field)){save();const input=document.querySelector('[data-pw-field="draft.'+field+'"]');if(input){input.value=state.draft[field];input.focus()}toast('เปลี่ยนไอเดียเฉพาะหัวข้อ '+field+' แล้ว')}return}
 if(b.hasAttribute('data-pw-idea-group')){fillIdeaGroup(b.dataset.pwIdeaGroup);return}
 const act=b.dataset.pwAction;
 if(act==='import'){importProduct();return}
 if(act==='suggest-new'){suggestNew();return}
 if(act==='choose-new'){if(state.shots.length){if(!confirm('การสร้างตัวละครใหม่จะเริ่ม Storyboard ใหม่ โปรดสำรองโครงเดิมก่อน'))return;state.shots=[]}state.primary='new';state.secondary='';save();currentHTML();return}
 if(act==='preview-new'){const d=state.draft;if(!d.name||draftCharacter(d).desc.trim().length<10){toast('โปรดระบุชื่อ และกดช่วยคิด / กรอกรายละเอียดหน้าตาหรือรูปลักษณ์ก่อน');return}const box=document.querySelector('#pw-new-prompt'),out=document.querySelector('#pw-new-prompt-text');if(box&&out){out.value=characterPrompt(draftCharacter(d));box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'nearest'});}return}
 if(act==='save-new'){saveNew();return}
 if(act==='make-storyboard'){if(!checkToShots())return;state.shots=beatsFor(Number(state.project.count));updateStage(2);return}
 if(act==='refresh-shots'){if(!confirm('สร้างโครง Shot ใหม่? ข้อความที่แก้ไขเองในช็อตจะถูกแทนที่'))return;state.shots=beatsFor(Number(state.project.count));save();currentHTML();return}
 if(act==='jump-video'){updateStage(3);return}
 if(act==='new-project'){if(!confirm('เริ่มโปรเจกต์ใหม่? กรุณาดาวน์โหลดไฟล์ JSON ก่อน หากต้องการเก็บงานเดิม'))return;const custom=state.custom;state=EMPTY();state.custom=custom;save();currentHTML();return}
});
window.KenProductionWizard={render,backup:()=>state,restore:(x)=>{if(!x||x.version!==1||!x.project||!Array.isArray(x.shots)||!Array.isArray(x.custom))return;state={...EMPTY(),...x,custom:x.custom.slice(0,25),shots:x.shots.slice(0,16)};save()},generateStoryboard:()=>{if(!checkToShots())return false;state.shots=beatsFor(Number(state.project.count));updateStage(2);return true;},getPrompt, getState:()=>state,PRESETS};
})();