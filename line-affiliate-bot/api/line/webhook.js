// LINE webhook. Affiliate/TikTok schedule commands (วันนี้, พรุ่งนี้, ตาราง, ส่ง..., สถานะ,
// checklist) were retired 2026-11-15. The bot is now the central notifier for all systems;
// notifications are pushed through /api/notify.
import crypto from 'node:crypto';

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

function menuText() {
  return [
    '🔔 Ken LINE Bot',
    'บอทแจ้งเตือนกลาง: รับแจ้งเตือนจากทุกระบบ (Mangrove / Satellite Monitoring / รายงานภาพดาวเทียม / ประมวลผลข้อมูล ฯลฯ)',
    'ข้อความจะขึ้นต้นด้วย [ชื่อระบบ] ที่ส่งมา',
    '',
    'คำสั่ง',
    'userid — ดู LINE User ID',
    'เมนู — ดูข้อความนี้',
    '',
    'หมายเหตุ: แจ้งเตือน TikTok/Affiliate เดิมปิดแล้ว'
  ].join('\n');
}

export async function GET() {
  return Response.json({ ok: true, service: 'Ken central LINE webhook' });
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
    if (!event.replyToken || (event.type !== 'follow' && event.type !== 'message')) continue;
    const incoming = event?.message?.type === 'text' ? String(event.message.text || '').trim().toLowerCase() : '';
    if (incoming === 'userid' || incoming === 'user id' || incoming === 'id') {
      await reply(
        event.replyToken,
        userId
          ? 'LINE User ID ของคุณ:\n' + userId + '\n\nนำค่านี้ไปใส่ใน Vercel Environment Variable ชื่อ LINE_USER_ID'
          : 'ยังอ่าน LINE User ID ไม่ได้ ลองส่งข้อความใหม่อีกครั้ง'
      );
    } else {
      await reply(event.replyToken, menuText());
    }
  }

  return Response.json({ ok: true }, { status: 200 });
}
