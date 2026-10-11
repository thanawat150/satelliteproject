import crypto from 'node:crypto';
import { readChecklist, writeChecklist, emptyChecklist, statusText, doneIntent, undoIntent, targetFromText } from '../../lib/checklist.js';
import { dayPlan, dayPlanText, dayPostMessages, sevenDayText, bkkDate as scheduleDate, READY_FOLDER, DASHBOARD_URL } from '../../lib/schedule.js';

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

function postSelector(text) {
  const query = String(text || '').trim().toLowerCase().replace(/\s+/g,' ');
  if (['ส่ง', 'ส่งของวันนี้', 'ส่งทั้งหมด', 'ส่งทุกช่อง', 'ส่งครบทุกช่อง'].includes(query)) return 'all';
  if (!query.startsWith('ส่ง')) return null;
  const channel=query.slice('ส่ง'.length).trim();
  if (['คอนเทนต์','content','คลิปคอนเทนต์'].includes(channel)) return 'content';
  if (/^(?:tiktok|tik tok|ติ๊กต็อก|ติ๊กต๊อก|ติ๊กตอก)\s*(?:ขาย|affiliate)$/i.test(channel)) return 'tiktok-affiliate';
  if (/^(?:shopee|ช้อปปี้|ช็อปปี้|ชอปปี้|ชอปปี้วิดีโอ|shopee video)$/i.test(channel)) return 'shopee';
  if (/^(?:tiktok|tik tok|ติ๊กต็อก|ติ๊กต๊อก|ติ๊กตอก)(?:\s*(?:คลิป|content|คอนเทนต์))?$/i.test(channel)) return 'tiktok';
  if (/^(?:facebook|fb|เฟซบุ๊ก|เฟสบุ๊ก|เพจ)$/i.test(channel)) return 'facebook';
  if (/^(?:instagram|ig|อินสตาแกรม|ไอจี)$/i.test(channel)) return 'instagram';
  if (/^(?:youtube|yt|ยูทูบ|ยูทูป|ยูทิวบ์)$/i.test(channel)) return 'youtube';
  return null;
}

function menuText() {
  return [
    'คำสั่งสั้น ๆ',
    'วันนี้ — ดูของที่ต้องลงวันนี้',
    'พรุ่งนี้ — ดูว่าพรุ่งนี้ต้องลงอะไร',
    'ตาราง — ดูกำหนดการ 7 วันในแชต',
    'ส่ง — รายละเอียดคลิป+เวลา+แคปชั่นแยกทุกช่อง',
    'ส่ง Facebook / ส่ง IG / ส่ง TikTok / ส่ง YouTube',
    'ส่ง TikTok ขาย / ส่ง Shopee',
    'ส่งคอนเทนต์ — ดูเฉพาะ IG, Facebook, TikTok, YouTube',
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
      } else if (incoming === 'วันนี้') {
        try {
          const plan = await dayPlan(scheduleDate(0));
          await reply(event.replyToken, dayPlanText(plan, 'วันนี้ต้องลง'));
        } catch {
          await reply(event.replyToken, 'อ่านกำหนดการวันนี้ไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (postSelector(incoming)) {
        try {
          const plan = await dayPlan(scheduleDate(0));
          await reply(event.replyToken, dayPostMessages(plan, postSelector(incoming)));
        } catch (e) {
          console.error('POST_DETAILS_ERROR', e);
          await reply(event.replyToken, 'อ่านคิวจากตารางล่าสุดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
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
          const plan = await dayPlan(scheduleDate(1));
          await reply(event.replyToken, dayPlanText(plan, 'พรุ่งนี้ต้องลง'));
        } catch {
          await reply(event.replyToken, 'อ่านตารางพรุ่งนี้ไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'ตาราง') {
        try {
          const plans = [];
          for (let i=0; i<7; i++) plans.push(await dayPlan(scheduleDate(i)));
          await reply(event.replyToken, sevenDayText(plans));
        } catch {
          await reply(event.replyToken, 'อ่านตารางไม่สำเร็จ ลองใหม่อีกครั้ง');
        }
      } else if (incoming === 'dashboard' || incoming === 'แดชบอร์ด') {
        await reply(event.replyToken, DASHBOARD_URL);
      } else if (incoming === 'พร้อม') {
        await reply(event.replyToken, READY_FOLDER);
      } else {
        await reply(event.replyToken, menuText());
      }
    }
  }

  return Response.json({ ok: true }, { status: 200 });
}
