// Shared LINE Messaging API push helper. Reads secrets from env only.
export async function pushLine(messages, to = process.env.LINE_USER_ID) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  if (!to) throw new Error('LINE_USER_ID is missing');
  const list = (messages || []).slice(0, 5);
  if (!list.length) throw new Error('messages required');
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ to, messages: list })
  });
  if (!r.ok) throw new Error('LINE push failed: ' + r.status + ' ' + await r.text());
}

export function textMessage(text) {
  return { type: 'text', text: String(text).slice(0, 4900) };
}

export function httpsUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'https:' ? u.toString() : '';
  } catch { return ''; }
}
