const BASE = 'https://raw.githubusercontent.com/thanawat150/satelliteproject/main/docs/affiliate-posting/';
const AFFILIATE_URL = BASE + 'schedule.json';
const METRICOOL_URL = BASE + 'metricool-schedule.json';
const QUEUE_URL = BASE + 'queue.json';
const DASHBOARD_URL = 'https://thanawat150.github.io/satelliteproject/affiliate-posting/';
const READY_FOLDER = 'https://drive.google.com/drive/folders/1kY02WlyrCcv9q13HKn2LcArrpLGGckM4';

export function bkkDate(offsetDays = 0) {
  const time = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(time);
}

export function shortDate(iso) {
  const date = new Date(String(iso).slice(0,10) + 'T00:00:00+07:00');
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short', day: 'numeric', month: 'short'
  }).format(date);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('schedule fetch failed: ' + response.status + ' ' + url);
  return response.json();
}

export function getAffiliateSchedule() { return fetchJson(AFFILIATE_URL); }
export function getMetricoolSchedule() { return fetchJson(METRICOOL_URL); }
export function getQueue() { return fetchJson(QUEUE_URL); }

export function networkLabel(network) {
  return ({
    instagram: 'Instagram Reels',
    facebook: 'Facebook Page Reels',
    tiktok: 'TikTok คอนเทนต์',
    youtube: 'YouTube Shorts'
  })[String(network||'').toLowerCase()] || String(network||'ไม่ทราบแพลตฟอร์ม');
}

function localTime(value) { return String(value || '').slice(11, 16) || '--:--'; }
function localDay(value) { return String(value || '').slice(0, 10); }
function mediaUrl(post) { return String(post.media || '').trim(); }
function masterUrl(post) { return String(post.drive_url || post.download_url || '').trim(); }
function titleForPost(post) { return String(post.title || '').trim(); }

function statusLabel(post) {
  const status = String(post.status || '').toUpperCase();
  if (status === 'ERROR') return '❌ ERROR — Metricool แจ้งว่าโพสต์ไม่สำเร็จ';
  if (status === 'PENDING') return '⏳ PENDING — อยู่ในคิว ไม่ได้ยืนยันว่าเผยแพร่แล้ว';
  if (status === 'SUCCESS' || status === 'PUBLISHED') return '✅ ' + status + ' — รายงานโดย Metricool';
  return '⚪ ' + (status || 'ไม่ทราบ') + ' — สถานะจากข้อมูล Metricool';
}

export async function dayPlan(date) {
  const [affiliate, metricool] = await Promise.all([getAffiliateSchedule(), getMetricoolSchedule()]);
  const sale = (affiliate.items || []).find(x => x.date === date) || null;
  const content = (metricool.items || [])
    .filter(x => localDay(x.date) === date && ['instagram','facebook','tiktok','youtube'].includes(x.network))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { date, affiliate: sale, content };
}

export function dayPlanText(plan, heading = 'วันนี้ต้องลง') {
  const lines = [heading + ' (' + shortDate(plan.date) + ')'];
  if (plan.affiliate) {
    const a = plan.affiliate;
    lines.push('', '🛒 Affiliate (ตามตาราง ยังไม่ได้ตรวจเนื้อหาคลิปจริง)');
    lines.push('Shopee Video ' + a.shopee + ' — ' + a.product);
    lines.push('TikTok ขาย ' + a.tiktok + ' — ' + a.product);
    lines.push('ไฟล์: ' + a.file);
    if (a.file_id) lines.push('Drive: https://drive.google.com/file/d/' + encodeURIComponent(a.file_id) + '/view');
  }
  if (plan.content.length) {
    lines.push('', '🎬 คิวคอนเทนต์แยกแพลตฟอร์ม');
    for (const x of plan.content) {
      const title = titleForPost(x);
      lines.push('• ' + networkLabel(x.network) + ' ' + localTime(x.date) + ' — ' + statusLabel(x));
      if (title) lines.push('  ชื่อคลิป: ' + title);
      else if (x.network === 'youtube' || x.network === 'facebook') lines.push('  ชื่อคลิป: รอตรวจสอบ');
      lines.push('  ไฟล์ที่ตั้งโพสต์: ' + (mediaUrl(x) || 'ไม่พบลิงก์'));
    }
  }
  if (!plan.affiliate && !plan.content.length) lines.push('', 'ยังไม่มีกำหนดการ');
  lines.push('', 'พิมพ์ “ส่ง” เพื่อรับรายละเอียดและแคปชั่นแยกแต่ละช่อง');
  lines.push('ข้อมูล Metricool เป็น Snapshot ไม่ใช่สถานะสด');
  return lines.join('\n');
}

export function affiliatePostMessage(affiliate, date) {
  if (!affiliate) return '🛒 Affiliate (' + shortDate(date) + ')\nวันนี้ไม่มีคิวคลิปขาย';
  const link = affiliate.file_id
    ? 'https://drive.google.com/file/d/' + encodeURIComponent(affiliate.file_id) + '/view'
    : 'ยังไม่พบลิงก์ไฟล์';
  return [
    '🛒 Affiliate | ' + shortDate(date),
    'Shopee Video ' + affiliate.shopee,
    'TikTok ขาย ' + affiliate.tiktok,
    'สินค้าตามแผน: ' + affiliate.product,
    'ไฟล์: ' + affiliate.file,
    '📥 Google Drive: ' + link,
    '',
    '⚠️ ยังไม่ได้ตรวจว่าเนื้อหาไฟล์ตรงกับสินค้า และยังไม่มีแคปชั่นรายแพลตฟอร์มที่ตรวจแล้ว จึงไม่ดึงแคปชั่นจาก queue.json เก่ามาใช้',
    'เลือกดูสถานะที่บันทึกเอง: พิมพ์ “สถานะ”',
    'Dashboard: ' + DASHBOARD_URL
  ].join('\n');
}

export function contentPostMessage(post) {
  const name = networkLabel(post.network);
  const lines = [
    '🎬 ' + name + ' | ' + shortDate(localDay(post.date)),
    '⏰ ' + localTime(post.date) + ' น.'
  ];
  const title = titleForPost(post);
  if (post.network === 'facebook' || post.network === 'youtube') {
    lines.push('ชื่อคลิป (Title): ' + (title || 'ไม่พบชื่อคลิปใน Metricool'));
  } else if (title) {
    lines.push('ชื่อคอนเทนต์: ' + title);
  }
  lines.push('สถานะจาก Metricool: ' + statusLabel(post));
  lines.push('📹 คลิปที่ตั้งโพสต์ใน Metricool: ' + (mediaUrl(post) || 'ยังไม่พบไฟล์สื่อ'));
  if (masterUrl(post)) {
    lines.push('📂 ไฟล์ต้นฉบับ Drive (อาจเป็นคนละเวอร์ชัน): ' + masterUrl(post));
  }
  const rawText = String(post.text || '').trim();
  const draft = String(post.suggested_text || '').trim();
  if (rawText) lines.push('', (post.network === 'youtube' ? 'คำอธิบายจาก Metricool:' : 'แคปชั่นจาก Metricool:') + '\n' + rawText);
  else lines.push('', 'ยังไม่พบข้อความโพสต์ใน Metricool');
  if (draft && draft !== rawText) {
    lines.push('', '✍️ ร่างใหม่ใน GitHub สำหรับโพสต์เอง (ยังไม่ได้แก้ใน Metricool):\n' + draft);
  }
  lines.push('', 'หมายเหตุ: สถานะเป็น Snapshot ไม่ใช่การตรวจเผยแพร่สด');
  return lines.join('\n');
}

export function dayPostMessages(plan, selector = 'all') {
  const selected = String(selector || 'all').toLowerCase();
  const includeSale = ['all','affiliate','shopee','tiktok-affiliate'].includes(selected);
  const includeContent = selected === 'all' || selected === 'content';
  const names = includeContent ? ['instagram','facebook','tiktok','youtube']
    : (['instagram','facebook','tiktok','youtube'].includes(selected) ? [selected] : []);
  const messages = [];
  if (includeSale && plan.affiliate) messages.push(affiliatePostMessage(plan.affiliate, plan.date));
  for (const network of names) {
    const rows = plan.content.filter(x => x.network === network);
    // One LINE message per platform. This preserves separate captions and media links.
    if (rows.length) {
      messages.push(rows.map(contentPostMessage).join('\n\n────────\n\n'));
    } else if (selected !== 'all' && selected !== 'content') {
      messages.push('🎬 ' + networkLabel(network) + ' (' + shortDate(plan.date) + ')\nยังไม่มีคิวโพสต์แพลตฟอร์มนี้');
    }
  }
  if (!messages.length) return ['ไม่มีคิวโพสต์สำหรับตัวเลือกนี้ในวันที่ ' + shortDate(plan.date)];
  if (messages.length > 5) {
    return messages.slice(0,4).concat('มีคิวเพิ่มอีก กรุณาพิมพ์ “ส่ง IG”, “ส่ง Facebook”, “ส่ง TikTok”, หรือ “ส่ง YouTube” เพื่อดูแยก');
  }
  return messages.map(s => s.length <= 4800
    ? s
    : s.slice(0,4450) + '\n\n⚠️ ข้อความยาวเกินกำหนด ดูรายละเอียดที่ ' + DASHBOARD_URL);
}

export function sevenDayText(plans) {
  const blocks = [];
  for (const plan of plans) {
    const tasks = [];
    if (plan.affiliate) {
      tasks.push('• Shopee Video ' + plan.affiliate.shopee + ' — ' + plan.affiliate.product);
      tasks.push('• TikTok ขาย ' + plan.affiliate.tiktok + ' — ' + plan.affiliate.product);
    }
    for (const x of plan.content) {
      const title = titleForPost(x);
      tasks.push('• ' + networkLabel(x.network) + ' ' + localTime(x.date) +
        (title ? ' — ' + title : '') + ' [' + String(x.status||'?') + ']');
    }
    if (tasks.length) blocks.push(shortDate(plan.date) + '\n' + tasks.join('\n'));
  }
  return blocks.length
    ? '📅 ตาราง 7 วัน (Shopee / IG / FB / TikTok / YouTube)\n\n' + blocks.join('\n\n') +
      '\n\nสถานะ Metricool มาจาก Snapshot'
    : 'ยังไม่มีกำหนดการล่วงหน้า';
}

export { READY_FOLDER, DASHBOARD_URL };
