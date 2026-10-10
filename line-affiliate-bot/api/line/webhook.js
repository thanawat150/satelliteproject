import crypto from 'node:crypto';

function validSignature(raw, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function reply(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!replyToken || !token) return;
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    })
  });
  if (!r.ok) console.error('LINE reply failed', r.status, await r.text());
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
      } else {
        await reply(
          event.replyToken,
          'Ken Affiliate Alert เชื่อมต่อสำเร็จ ✅\nระบบพร้อมรับการแจ้งเตือนคิวโพสต์แล้ว'
        );
      }
    }
  }

  return Response.json({ ok: true }, { status: 200 });
}
