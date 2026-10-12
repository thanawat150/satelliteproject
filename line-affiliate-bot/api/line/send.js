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


function verifiedDriveLink(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && url.hostname === 'drive.google.com' ? url.toString() : '';
  } catch { return ''; }
}

function resolveDriveDownload(body) {
  const id = String(body.drive_file_id || '').trim();
  if (/^[a-zA-Z0-9_-]{12,}$/.test(id)) {
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
  }
  return verifiedDriveLink(body.download_url) || verifiedDriveLink(body.drive_url);
}

function containsMetricoolUrl(value) {
  return /https?:\/\/[^\s]*metricool\.com\//i.test(String(value || ''));
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
  } else if (body.download_url || body.drive_url || body.drive_file_id || body.platforms || body.post_text) {
    // The caller must supply a verified Google Drive file, not a Metricool media URL.
    const drive = resolveDriveDownload(body);
    if ((body.download_url || body.drive_url || body.drive_file_id) && !drive) {
      return Response.json({ok:false,error:'Google Drive link or drive_file_id required; Metricool media links cannot be used for downloads'}, {status:422});
    }
    if (drive) messages.push(drive);

    // 2) Platform(s) for this same clip, kept as a separate LINE message.
    const p = platformText(body.platforms);
    if (p) messages.push(p);

    // 3) Caption + hashtags only, ready to copy/paste.
    if (body.post_text) messages.push(String(body.post_text).trim());
  } else if (body.text) {
    messages = [body.text];
  }

  if (messages.some(containsMetricoolUrl)) {
    return Response.json({ok:false,error:'Metricool media links are not accepted for LINE downloads; supply a verified Google Drive link'}, {status:422});
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
