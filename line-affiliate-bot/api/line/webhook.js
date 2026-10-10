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
      if (incoming === 'testalert' || incoming === 'test alert' || incoming === 'เทส') {
        await reply(event.replyToken, [
          'https://drive.google.com/uc?export=download&id=1AYfRABxoeMq-7Huydwm624OK4YYEtU6X',
          'TikTok + Shopee',
          'นั่งนานแล้วขาตึง ลองมายืนยืดกับเก้าอี้มหัศจรรย์คุณตาแสวงครับ ใช้ง่าย ขนาดไม่ใหญ่ เหมาะไว้ใช้ทั้งที่บ้านและออฟฟิศ\n\n#เก้าอี้มหัศจรรย์ #คุณตาแสวง #แท่นยืนยืดเส้น #ยืดเหยียด #ShopeeVideo #TikTokAffiliate'
        ]);
      } else if (incoming === 'userid' || incoming === 'user id' || incoming === 'id') {
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
