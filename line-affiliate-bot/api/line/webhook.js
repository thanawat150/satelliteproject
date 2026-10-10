const crypto = require('crypto');

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

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

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'Ken Affiliate LINE webhook' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const raw = await readRaw(req);
  const signature = req.headers['x-line-signature'];
  if (!validSignature(raw, signature, process.env.LINE_CHANNEL_SECRET)) {
    return res.status(401).json({ ok: false, error: 'invalid signature' });
  }

  let body;
  try { body = JSON.parse(raw.toString('utf8')); }
  catch { return res.status(400).json({ ok: false, error: 'invalid json' }); }

  for (const event of body.events || []) {
    const userId = event?.source?.userId;
    if (userId) {
      // Use Vercel Runtime Logs to retrieve this once, then store it as LINE_USER_ID.
      console.log('LINE_USER_ID_DISCOVERED', userId);
    }

    if (event.replyToken && (event.type === 'follow' || event.type === 'message')) {
      await reply(
        event.replyToken,
        'Ken Affiliate Alert เชื่อมต่อสำเร็จ ✅\nระบบพร้อมรับการแจ้งเตือนคิวโพสต์แล้ว'
      );
    }
  }

  return res.status(200).json({ ok: true });
};