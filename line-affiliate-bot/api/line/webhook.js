// LINE webhook.
// - Files sent in a 1:1 chat or a group are staged to Google Drive; the sender picks a
//   job topic, then the bot replies to the sender only (lib/intake.js).
// - 1:1 text: tap-to-ask menus for everyone; the owner (LINE_USER_ID) also gets
//   submission summaries, a calendar and AI answers (lib/assistant.js).
// - Group text is ignored so the bot never answers ordinary chat.
// Notifications from other systems still go through /api/notify.
import crypto from 'node:crypto';
import { replyLine } from '../../lib/line.js';
import { isFileMessage, handleFile, handlePostback } from '../../lib/intake.js';
import { handleText } from '../../lib/assistant.js';

function validSignature(raw, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const JOIN_TEXT = '👋 สวัสดีครับ ส่งไฟล์งานในกลุ่มนี้ได้เลย บอทจะถามว่าเป็นงานอะไร แล้วเก็บลง Google Drive ให้ (zip แตกไฟล์ให้อัตโนมัติ)';

async function handleEvent(event) {
  const source = event.source || {};
  if (event.type === 'join') return replyLine(event.replyToken, JOIN_TEXT);
  if (event.type === 'postback') return handlePostback(event);
  if (isFileMessage(event)) return handleFile(event);
  if (event.type === 'follow') return replyLine(event.replyToken, await handleText('เมนู', source));
  if (event.type !== 'message' || event.message?.type !== 'text') return;
  if (source.type !== 'user') return; // group / room chat: stay quiet
  const text = String(event.message.text || '').trim();
  if (['userid', 'user id', 'id'].includes(text.toLowerCase())) {
    return replyLine(event.replyToken, 'LINE User ID ของคุณ:\n' + source.userId);
  }
  return replyLine(event.replyToken, await handleText(text, source));
}

export async function GET() {
  return Response.json({ ok: true, service: 'Ken central LINE webhook' });
}

export async function POST(request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-line-signature'), process.env.LINE_CHANNEL_SECRET)) {
    return Response.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  for (const event of body.events || []) {
    try {
      await handleEvent(event);
    } catch (e) {
      console.error('EVENT_ERROR', event.type, event.message?.type, e?.message);
      if (event.replyToken && (isFileMessage(event) || event.type === 'postback')) {
        await replyLine(event.replyToken, '⚠️ บันทึกไฟล์ไม่สำเร็จ ลองส่งใหม่อีกครั้ง หรือแจ้งผู้ดูแล').catch(() => {});
      }
    }
  }
  return Response.json({ ok: true });
}
