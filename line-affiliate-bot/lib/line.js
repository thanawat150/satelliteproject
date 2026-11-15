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

const API = 'https://api.line.me/v2/bot';
const DATA_API = 'https://api-data.line.me/v2/bot';

function authHeader() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  return { 'Authorization': 'Bearer ' + token };
}

// Reply (free, does not count toward the monthly push quota). messages: LINE message objects or strings.
export async function replyLine(replyToken, messages) {
  if (!replyToken) return;
  const list = (Array.isArray(messages) ? messages : [messages])
    .slice(0, 5)
    .map(m => typeof m === 'string' ? textMessage(m) : m);
  const r = await fetch(API + '/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ replyToken, messages: list })
  });
  if (!r.ok) console.error('LINE reply failed', r.status, await r.text());
}

// Download the binary content of a file/image/video/audio message.
export async function getMessageContent(messageId) {
  const r = await fetch(DATA_API + '/message/' + encodeURIComponent(messageId) + '/content', { headers: authHeader() });
  if (r.status === 202) return { notReady: true };
  if (!r.ok) throw new Error('LINE content failed: ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, contentType: r.headers.get('content-type') || 'application/octet-stream' };
}

export async function getDisplayName(source) {
  const uid = source?.userId;
  if (!uid) return 'ไม่ทราบชื่อ';
  const path = source.type === 'group' ? '/group/' + source.groupId + '/member/' + uid
    : source.type === 'room' ? '/room/' + source.roomId + '/member/' + uid
    : '/profile/' + uid;
  try {
    const r = await fetch(API + path, { headers: authHeader() });
    if (r.ok) return (await r.json()).displayName || ('ผู้ใช้ ' + uid.slice(-6));
  } catch {}
  return 'ผู้ใช้ ' + uid.slice(-6);
}

export async function getChatName(source) {
  if (source?.type !== 'group') return source?.type === 'room' ? 'ห้องแชต' : 'แชตส่วนตัว';
  try {
    const r = await fetch(API + '/group/' + source.groupId + '/summary', { headers: authHeader() });
    if (r.ok) return 'กลุ่ม ' + ((await r.json()).groupName || '');
  } catch {}
  return 'กลุ่ม';
}

export function chatIdOf(source) {
  return source?.groupId || source?.roomId || source?.userId || 'unknown';
}
