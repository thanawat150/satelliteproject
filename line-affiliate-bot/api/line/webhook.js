import crypto from 'node:crypto';
import { readChecklist, writeChecklist, emptyChecklist, statusText, doneIntent, undoIntent, targetFromText } from '../../lib/checklist.js';

function validSignature(raw, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function reply(replyToken, texts) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!replyToken || !token) return;
  const list = Array.isArray(texts) ? texts : [texts];
  const messages = list.slice(0,5).map(text => ({ type:'text', text:String(text).slice(0,4900) }));
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ replyToken, messages })
  });
  if (!r.ok) console.error('LINE reply failed', r.status, await r.text());
}

const QUEUE_URL = 'https://raw.githubusercontent.com/thanawat150/satelliteproject/main/docs/affiliate-posting/queue.json';
const SCHEDULE_URL = 'https://raw.githubusercontent.com/thanawat150/satelliteproject/main/docs/affiliate-posting/schedule.json';
const DASHBOARD_URL = 'https://thanawat150.github.io/satelliteproject/affiliate-posting/';

async function getQueue() {
  const r = await fetch(QUEUE_URL, { cache:'no-store' });
  if (!r.ok) throw new Error('queue fetch failed');
  return r.json();
}

async function getSchedule() {
  const r = await fetch(SCHEDULE_URL, { cache:'no-store' });
  if (!r.ok) throw new Error('schedule fetch failed');
  return r.json();
}

function bkkDate(offsetDays=0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Bangkok',
    year:'numeric', month:'2-digit', day:'2-digit'
  }).format(d);
}

function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00+07:00');
  return new Intl.DateTimeFormat('th-TH', {
    timeZone:'Asia/Bangkok',
    weekday:'short', day:'numeric', month:'short'
  }).format(d);
}

function scheduleLine(x) {
  return shortDate(x.date) + ' — ' + x.product +
    '\nShopee ' + x.shopee + ' | TikTok ' + x.tiktok;
}

function detailText(label, x) {
  if (!x) return label + ': ยังไม่มีคิว';
  return label + ' (' + shortDate(x.date) + ')' +
    '\nสินค้า: ' + x.product +
    '\nคลิป: ' + x.file +
    '\nPlatform: TikTok + Shopee' +
    '\nShopee ' + x.shopee + ' | TikTok ' + x.tiktok;
}

function menuText() {
  return [
    'คำสั่งสั้น ๆ',
    'วันนี้ — ดูของที่ต้องลงวันนี้',
    'พรุ่งนี้ — ดูว่าพรุ่งนี้ต้องลงอะไร',
    'ตาราง — ดูกำหนดการ 7 วันในแชต',
    'ส่ง — ส่งลิงก์คลิป + Platform + Caption',
    'สถานะ — ดู Checklist วันนี้',
    'TikTok ขาย ลงแล้ว',
    'TikTok คลิป ลงแล้ว',
    'Shopee ลงแล้ว',
    'Instagram ลงแล้ว',
    'Facebook ลงแล้ว',
    'YouTube ลงแล้ว',
    'ครบแล้ว — ติ๊กครบทุกงาน',
    'รีเซ็ตวันนี้ — ล้าง Checklist วันนี้',
    'พร้อม — เปิดโฟลเดอร์คลิปพร้อม',
    'เมนู — ดูคำสั่งทั้งหมด'
  ].join('\n');
}

function platformText(q) {
  const p=[];
  if (q?.tiktok_time) p.push('TikTok');
  if (q?.shopee_time) p.push('Shopee');
  return p.join(' + ') || 'TikTok + Shopee';
}

function timeText(q) {
  const x=[];
  if (q?.shopee_time) x.push('Shopee ' + q.shopee_time);
  if (q?.tiktok_time) x.push('TikTok ' + q.tiktok_time);
  return x.join(' | ');
}

export async function GET() {
  return Response.json({ ok: true, service: 'Ken Affiliate LINE webhook' });
}

export async function POST(request) {
  const raw = await request.text();
  const signature = request.headers.get('x-line-signature');

  if (!validSignature(raw, signature, process.env.LINE_CHANNEL_SECRET)) {
    return Response.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  for (const event of body.events || []) {
    const userId = event?.source?.userId;
    if (userId) console.log('LINE_USER_ID_DISCOVERED', userId);

    if (event.replyToken && (event.type === 'follow' || event.type === 'message')) {
      const incoming = event?.message?.type === 'text' ? String(event.message.text || '').trim().toLowerCase() : '';
      if (incoming === 'userid' || incoming === 'user id' || incoming === 'id') {
        await reply(
          event.replyToken,
          userId
            ? 'LINE User ID ของคุณ:\n' + userId + '\n\nนำค่านี้ไปใส่ใน Vercel Environment Variable ชื่อ LINE_USER_ID'
            : 'ยังอ่าน LINE User ID ไม่ได้ ลองส่งข้อความใหม่อีกครั้ง'
        );
      } else if (['เมนู','menu','ช่วย','help'].includes(incoming)) {
        await reply(event.replyToken, menuText());
      } else if (['วันนี้','ส่ง','ส่งของวันนี้'].includes(incoming)) {
        try {
          const q = await getQueue();
          await reply(event.replyToken, [
            q.download_url || q.drive_url || 'ยังไม่มีลิงก์คลิป',
            platformText(q),
            q.post_text || [q.caption,q.hashtags].filter(Boolean).join('\n\n'),
            timeText(q) || 'ยังไม่ได้ตั้งเวลาโพสต์'
          ]);
        } catch {
          await reply(event.replyToken, 'อ่านคิววันนี้ไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'สถานะ' || incoming === 'เช็คลิส' || incoming === 'checklist') {
        try {
          const s = await readChecklist();
          await reply(event.replyToken, statusText(s));
        } catch (e) {
          console.error('CHECKLIST_STATUS_ERROR', e);
          await reply(event.replyToken, 'อ่านสถานะไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'ครบแล้ว' || incoming === 'ลงครบแล้ว' || incoming === 'โพสต์ครบแล้ว') {
        try {
          const s = await readChecklist();
          s.tiktok_affiliate = true;
          s.tiktok_content = true;
          s.shopee_video = true;
          s.instagram = true;
          s.facebook = true;
          s.youtube = true;
          const saved = await writeChecklist(s);
          await reply(event.replyToken, statusText(saved, '✅ อัปเดตแล้ว'));
        } catch (e) {
          console.error('CHECKLIST_ALL_ERROR', e);
          await reply(event.replyToken, 'บันทึกสถานะไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'รีเซ็ตวันนี้' || incoming === 'reset วันนี้' || incoming === 'reset') {
        try {
          const saved = await writeChecklist(emptyChecklist());
          await reply(event.replyToken, statusText(saved, '🔄 รีเซ็ตวันนี้แล้ว'));
        } catch (e) {
          console.error('CHECKLIST_RESET_ERROR', e);
          await reply(event.replyToken, 'รีเซ็ตสถานะไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (doneIntent(incoming) || undoIntent(incoming)) {
        const target = targetFromText(incoming);
        if (target === 'tiktok_ambiguous') {
          await reply(event.replyToken, [
            'TikTok วันนี้มี 2 งาน เลือกอันไหนครับ?',
            'พิมพ์: TikTok ขาย ลงแล้ว\nหรือ\nTikTok คลิป ลงแล้ว'
          ]);
        } else if (target) {
          try {
            const s = await readChecklist();
            s[target] = doneIntent(incoming) && !undoIntent(incoming);
            const saved = await writeChecklist(s);
            const labels = {
              tiktok_affiliate:'TikTok ขาย',
              tiktok_content:'TikTok คลิป',
              shopee_video:'Shopee Video',
              instagram:'Instagram',
              facebook:'Facebook',
              youtube:'YouTube'
            };
            const label = labels[target] || target;
            await reply(event.replyToken, statusText(saved, '✅ อัปเดต ' + label + ' แล้ว'));
          } catch (e) {
            console.error('CHECKLIST_UPDATE_ERROR', e);
            await reply(event.replyToken, 'บันทึกสถานะไม่สำเร็จ ลองใหม่อีกครั้ง');
          }
        } else {
          await reply(event.replyToken, menuText());
        }
      } else if (['พรุ่งนี้','พรุ่ง','tomorrow'].includes(incoming)) {
        try {
          const s = await getSchedule();
          const item = (s.items || []).find(x => x.date === bkkDate(1));
          await reply(event.replyToken, detailText('พรุ่งนี้ต้องลง', item));
        } catch {
          await reply(event.replyToken, 'อ่านตารางพรุ่งนี้ไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'ตาราง') {
        try {
          const s = await getSchedule();
          const start = bkkDate(0);
          const items = (s.items || []).filter(x => x.date >= start).slice(0,7);
          const text = items.length
            ? 'กำหนดการ 7 วัน\n\n' + items.map(scheduleLine).join('\n\n')
            : 'ยังไม่มีกำหนดการล่วงหน้า';
          await reply(event.replyToken, text);
        } catch {
          await reply(event.replyToken, 'อ่านตารางไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'dashboard' || incoming === 'แดชบอร์ด') {
        await reply(event.replyToken, DASHBOARD_URL);
      } else if (incoming === 'พร้อม') {
        try {
          const q = await getQueue();
          await reply(event.replyToken, q?.source_folder?.url || DASHBOARD_URL);
        } catch {
          await reply(event.replyToken, DASHBOARD_URL);
        }
      } else {
        await reply(event.replyToken, menuText());
      }
    }
  }

  return Response.json({ ok: true }, { status: 200 });
}
