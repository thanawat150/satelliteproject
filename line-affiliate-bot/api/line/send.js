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
  const supplied = auth.replace(/^Bearer\s+/i, '');
  return !!expected && supplied === expected;
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
  } else if (body.download_url || body.post_text || body.info) {
    // Message 1: download URL only, so it is clean and easy to tap.
    if (body.download_url) messages.push(String(body.download_url).trim());

    // Message 2: caption + hashtags only. No labels or extra sentences.
    if (body.post_text) messages.push(String(body.post_text).trim());

    // Message 3: optional extra information, kept separate from the post text.
    if (body.info) messages.push(String(body.info).trim());
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
      message2:'caption + hashtags only',
      message3:'optional info'
    },
    method:'POST required for sending'
  });
}
