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

function authorized(request) {
  const expected = process.env.LINE_REMINDER_SECRET;
  const auth = request.headers.get('authorization') || '';
  const supplied = auth.replace(/^Bearer\s+/i, '');
  return !!expected && supplied === expected;
}

export async function POST(request) {
  if (!authorized(request)) return Response.json({ ok:false, error:'unauthorized' }, { status:401 });

  let body={};
  try { body=await request.json(); } catch {}
  if (!body.text) return Response.json({ ok:false, error:'text required' }, { status:400 });

  try {
    await pushText(String(body.text).slice(0,4900));
    return Response.json({ ok:true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}

export async function GET() {
  return Response.json({ ok:true, service:'LINE push endpoint', method:'POST required for sending' });
}
