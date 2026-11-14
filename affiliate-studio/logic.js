// Ken Affiliate Studio v4 — pure data logic. Never invent source metrics.
export const STORE_VERSION = 4;
export const EMPTY = () => ({version:STORE_VERSION,products:[],characters:[],campaigns:[],posts:[],metrics:[],audit:[],settings:{platforms:['TikTok','Shopee Video','Instagram','Facebook'],campaignClips:3,spacingDays:2,budgetTHB:150}});
export const uid=()=> (globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const safeText=(x)=>String(x??'').trim();
export const finite=(x)=>{let v=safeText(x).replace(/[฿,%\s]/g,'').replace(/,/g,'');if(!v)return null;const n=Number(v);return Number.isFinite(n)?n:null};
export const isoTime=(x)=>{if(!safeText(x))return null;const d=new Date(x);return Number.isNaN(d.valueOf())?null:d.toISOString()};
export const safeUrl=(x)=>{try{let u=new URL(safeText(x));return ['https:','http:'].includes(u.protocol)?u.toString():null}catch{return null}};
export function parseCSV(input){
 const text=String(input).replace(/^\uFEFF/,'');const delim=(text.split(/\r?\n/,1)[0].match(/\t/g)||[]).length>(text.split(/\r?\n/,1)[0].match(/,/g)||[]).length?'\t':',';
 const out=[];let row=[],field='',quote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){field+='"';i++}else quote=!quote}
  else if(c===delim&&!quote){row.push(field);field=''}
  else if((c==='\r'||c==='\n')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))out.push(row);row=[];field=''}
  else field+=c;
 }
 if(quote)throw new Error('รูปแบบ CSV ผิดพลาด: เครื่องหมายคำพูดไม่ครบ');row.push(field);if(row.some(v=>v.trim()))out.push(row);
 if(out.length<2)throw new Error('ไม่พบรายการข้อมูล ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว');
 const headers=out[0].map((h)=>safeText(h).toLowerCase());if(new Set(headers).size!==headers.length)throw new Error('ชื่อคอลัมน์ซ้ำกัน');
 return out.slice(1).map((r,i)=>Object.fromEntries(headers.map((h,j)=>[h,safeText(r[j])]))).map((v,i)=>({...v,__row:i+2}));
}
const ALIASES={product_id:['product_id','item_id','sku','รหัสสินค้า'],name:['name','product_name','ชื่อสินค้า'],platform:['platform','แพลตฟอร์ม'],price:['price','ราคาขาย','ราคา'],commission_rate:['commission_rate','commission_percent','commission_pct','อัตราคอมมิชชัน'],commission_amount:['commission_amount','commission_thb','คอมมิชชันบาท'],sales_count:['sales_count','units_sold','จำนวนขาย'],sales_period:['sales_period','ช่วงยอดขาย'],rating:['rating','คะแนนรีวิว'],stock:['stock','stock_count','คงเหลือ'],product_url:['product_url','item_url','ลิงก์สินค้า'],affiliate_url:['affiliate_url','promotion_link','ลิงก์affiliate'],category:['category','หมวดหมู่'],source_url:['source_url','ต้นทาง'],observed_at:['observed_at','updated_at','verified_at','timestamp','เวลาอัปเดต'],description:['description','รายละเอียด'],claims:['claims','ข้อมูลยืนยัน']};
export function pick(row,key){for(const alias of ALIASES[key]||[key])if(safeText(row[alias]))return safeText(row[alias]);return ''}
export function importProducts(csv,{fileName='',importedAt=new Date().toISOString()}={}){
 const rows=parseCSV(csv);let products=[],errors=[];for(const row of rows){
  const name=pick(row,'name'),productId=pick(row,'product_id'),platform=pick(row,'platform'),purl=safeUrl(pick(row,'product_url')),aurl=safeUrl(pick(row,'affiliate_url'));
  if(!name||!productId||!platform){errors.push({row:row.__row,message:'ต้องมี product_id, name, platform'});continue}
  const price=finite(pick(row,'price')),rate=finite(pick(row,'commission_rate')),amount=finite(pick(row,'commission_amount')),
   sales=finite(pick(row,'sales_count')),rating=finite(pick(row,'rating')),stock=finite(pick(row,'stock'));
  if([price,rate,amount,sales,rating,stock].some(v=>v!==null&&v<0)||(rate!==null&&rate>100)||(rating!==null&&rating>5)){
   errors.push({row:row.__row,message:'ข้อมูลตัวเลขผิดเงื่อนไข (ค่าติดลบ, rate >100 หรือ rating >5)'});continue;
  }
  products.push({id:uid(),sourceKey:`${platform.toLowerCase()}::${productId}`,productId,name,platform,price,commissionRate:rate,commissionAmount:amount,salesCount:sales,salesPeriod:pick(row,'sales_period')||null,rating,stock,productUrl:purl,affiliateUrl:aurl,category:pick(row,'category'),sourceUrl:safeUrl(pick(row,'source_url')),observedAt:isoTime(pick(row,'observed_at')),description:pick(row,'description'),claims:pick(row,'claims'),importedAt,importFile:fileName,sourceKind:fileName==='manual-entry'?'manual_entered':'uploaded_export',reviewedAt:null,reviewedBy:null});
 }
 return {products,errors,total:rows.length};
}
export const commissionTHB=(p)=>p.commissionAmount!==null&&Number.isFinite(p.commissionAmount)?p.commissionAmount:(p.price!==null&&p.commissionRate!==null?p.price*p.commissionRate/100:null);
export const isRecent=(p,hours=48,at=Date.now())=>Boolean(p.observedAt&&new Date(p.observedAt).getTime()<=at&&at-new Date(p.observedAt).getTime()<=hours*3600000);
export const productIssues=(p,at=Date.now())=>{
 const a=[];if(!p.productId||!p.name||!p.platform)a.push('ไม่พบข้อมูลระบุสินค้า');if(p.price===null)a.push('ไม่พบราคา');if(commissionTHB(p)===null)a.push('ไม่พบคอมมิชชัน');if(!p.productUrl&&!p.affiliateUrl)a.push('ไม่พบ URL สินค้า');if(!p.sourceUrl)a.push('ไม่มี URL หลักฐานต้นทาง');if(!p.observedAt)a.push('ไม่พบเวลาของข้อมูลต้นทาง');else if(!isRecent(p,48,at))a.push('ข้อมูลเก่ากว่า 48 ชม. หรือเวลาไม่ถูกต้อง');if(!p.reviewedAt)a.push('ยังไม่ผ่านการตรวจของผู้ใช้');if(p.stock===0)a.push('สินค้าหมด');return a;
};
export const canCampaign=(p,at=Date.now())=>productIssues(p,at).length===0;
// No fictitious "sales potential" score: only a transparent calculated commission-per-sale from imported fields.
export function rankProducts(products,at=Date.now()){
 return [...products].map(p=>({...p,earn:commissionTHB(p),issues:productIssues(p,at),eligible:canCampaign(p,at)})).sort((a,b)=>(Number(b.eligible)-Number(a.eligible))||((b.earn??-1)-(a.earn??-1))||a.name.localeCompare(b.name,'th'));
}
export const dateAdd=(iso,days)=>{const d=new Date(`${iso}T12:00:00+07:00`);if(Number.isNaN(d.valueOf()))throw new Error('วันที่ไม่ถูกต้อง');d.setUTCDate(d.getUTCDate()+days);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
export const todayBangkok=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const chooseProduct=(products)=>rankProducts(products).find(p=>p.eligible)||null;
const MODES=[{key:'pain',label:'แก้ปัญหา',hook:(n)=>`ปัญหาที่คนมักเจอ ก่อนเลือก ${n} คืออะไร?`,scene:'เริ่มจากสถานการณ์ที่ผู้ชมคุ้นเคย โดยไม่อ้างผลการใช้จริง'},{key:'detail',label:'เจาะรายละเอียด',hook:(n)=>`ก่อนตัดสินใจซื้อ ${n} มีอะไรที่ควรตรวจบ้าง?`,scene:'ซูมรายละเอียดจากรูปสินค้าต้นฉบับที่ผู้ผลิตอนุญาตให้ใช้'},{key:'checklist',label:'เช็กลิสต์ก่อนซื้อ',hook:(n)=>`อย่าเพิ่งกดซื้อ ${n} ถ้ายังไม่ได้เช็ก 3 ข้อนี้`,scene:'แสดงรายการตรวจสอบราคา รุ่น และเงื่อนไขจากข้อมูลจริง'}];
export function createCampaign(product,character,{quantity=3,startDate=todayBangkok(),spacingDays=2,platforms=['TikTok'],budgetTHB=150}={}){
 if(!canCampaign(product))throw new Error(`สินค้าไม่ผ่าน Data Gate: ${productIssues(product).join(', ')}`);
 if(!character?.name)throw new Error('ต้องเลือกคาแรคเตอร์');
 const count=Math.max(1,Math.min(12,Math.floor(Number(quantity)||1)));const spacing=Math.max(1,Math.floor(Number(spacingDays)||2));const outputs=[];
 for(let i=0;i<count;i++){
  const mode=MODES[i%MODES.length],date=dateAdd(startDate,i*spacing);
  const transcript=[mode.hook(product.name),`วันนี้เรามาดู ${product.name} กันแบบเน้นข้อมูลที่ตรวจสอบได้`,`ก่อนตัดสินใจ ดูรายละเอียด ราคา และเงื่อนไขล่าสุดที่หน้าสินค้า`, `หากสนใจให้เปิดลิงก์ Affiliate ที่แนบไว้ และตรวจสอบรายละเอียดอีกครั้งก่อนซื้อ`].join('\n');
  outputs.push({id:uid(),date,variant:mode.label,platforms:[...platforms],title:`${product.name} — ${mode.label}`,hook:mode.hook(product.name),script:transcript,caption:`${product.name} | เช็กข้อมูลล่าสุดจากหน้าสินค้าก่อนซื้อ #รีวิวสินค้า #Affiliate\nโฆษณา / มีลิงก์ Affiliate`,storyboard:[`00-05s: ${mode.hook(product.name)}`,`05-15s: ${mode.scene}`,`15-30s: แสดงภาพสินค้าและข้อเท็จจริงที่มีหลักฐาน`, '30-40s: ชวนตรวจรายละเอียดล่าสุดและลิงก์ Affiliate'],status:'draft',basketStatus:'manual_pending',videoStatus:'not_generated',approved:false});
 }
 return {id:uid(),createdAt:new Date().toISOString(),productId:product.id,productName:product.name,characterId:character.id,characterName:character.name,sourceFile:product.importFile,productObservedAt:product.observedAt,plannedBudgetTHB:budgetTHB,status:'draft',outputs};
}
export function importMetrics(csv,{fileName='',importedAt=new Date().toISOString()}={}){
 const rows=parseCSV(csv),valid=[],errors=[];
 for(const row of rows){
  const platform=safeText(row.platform||row['แพลตฟอร์ม']),url=safeUrl(row.post_url||row.video_url||row['ลิงก์คลิป']),at=isoTime(row.observed_at||row.updated_at||row['เวลาอัปเดต']);
  if(!platform||!url||!at){errors.push({row:row.__row,message:'ต้องมี platform, post_url, observed_at ที่ถูกต้อง'});continue}
  const num=(k)=>finite(row[k]);const v={id:uid(),platform,postUrl:url,observedAt:at,views:num('views'),likes:num('likes'),comments:num('comments'),shares:num('shares'),orders:num('orders'),commissionTHB:num('commission_thb'),sourceFile:fileName,importedAt,sourceKind:'uploaded_export'};
  if(['views','likes','comments','shares','orders','commissionTHB'].some(k=>v[k]!==null&&v[k]<0)){errors.push({row:row.__row,message:'ค่า metric ต้องไม่ติดลบ'});continue}valid.push(v);
 }
 return {metrics:valid,errors,total:rows.length};
}
export function mergeByKey(oldItems,newItems,key){const m=new Map(oldItems.map(x=>[key(x),x]));for(const item of newItems){const old=m.get(key(item));m.set(key(item),{...item,id:old?.id??item.id,reviewedAt:null,reviewedBy:null})}return [...m.values()]}
export const exportCSV=(rows,fields)=>[fields.join(','),...rows.map(r=>fields.map(k=>{let x=String(r[k]??'');return /[",\n\r]/.test(x)?`"${x.replace(/"/g,'""')}"`:x}).join(','))].join('\r\n');
export const productTemplate='product_id,name,platform,price,commission_rate,commission_amount,sales_count,sales_period,rating,stock,product_url,affiliate_url,category,source_url,observed_at,description,claims\r\n';
export const metricsTemplate='platform,post_url,observed_at,views,likes,comments,shares,orders,commission_thb\r\n';