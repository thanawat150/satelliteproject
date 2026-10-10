async function pushText(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  if (!userId) throw new Error('LINE_USER_ID is missing');

  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }]
    })
  });
  if (!r.ok) throw new Error('LINE push failed: ' + r.status + ' ' + await r.text());
}

module.exports = async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ ok:false });

  const expected = process.env.LINE_REMINDER_SECRET;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i,'') || req.query?.key;
  if (!expected || supplied !== expected) return res.status(401).json({ ok:false, error:'unauthorized' });

  const text = req.method === 'POST' ? req.body?.text : req.query?.text;
  if (!text) return res.status(400).json({ ok:false, error:'text required' });

  try {
    await pushText(String(text).slice(0, 4900));
    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:e.message });
  }
};