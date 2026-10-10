async function pushMessages(messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  if (!userId) throw new Error('LINE_USER_ID is missing');

  const safeMessages = (messages || []).slice(0, 5).map(m => ({
    type: 'text',
    text: String(m).slice(0, 4900)
  }));

  if (!safeMessages.length) throw new Error('messages required');

  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      to: userId,
      messages: safeMessages
    })
  });

  if (!r.ok) throw new Error('LINE push failed: ' + r.status + ' ' + await r.text());
}

function authorized(request) {
  const expected = process.env.LINE_REMINDER_SECRET;
  const auth = request.headers.get('authorization') || '';
  const supplied = auth.replace(/^Bearer\\s+/i, '');
  return !!expected && supplied === expected;
}

function platformText(platforms) {
  if (!platforms) return '';
  if (Array.isArray(platforms)) return platforms.map(x => String(x).trim()).filter(Boolean).join(' + ');
  return String(platforms).trim();
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ ok:false, error:'unauthorized' }, { status:401 });
  }

  let body={};
  try { body=await request.json(); } catch {}

  let messages = [];

  if (Array.isArray(body.messages)) {
    messages = body.messages;
  } else if (body.download_url || body.platforms || body.post_text) {
    // 1) Download link for the clip only.
    if (body.download_url) messages.push(String(body.download_url).trim());

    // 2) Platform(s) for this same clip, kept as a separate LINE message.
    const p = platformText(body.platforms);
    if (p) messages.push(p);

    // 3) Caption + hashtags only, ready to copy/paste.
    if (body.post_text) messages.push(String(body.post_text).trim());
  } else if (body.text) {
    messages = [body.text];
  }

  try {
    await pushMessages(messages);
    return Response.json({ ok:true, count:messages.length });
  } catch (e) {
    console.error(e);
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function GET() {
  return Response.json({
    ok:true,
    service:'LINE push endpoint',
    format:{
      message1:'download_url only',
      message2:'platform(s) only',
      message3:'caption + hashtags only'
    },
    method:'POST required for sending'
  });
}
