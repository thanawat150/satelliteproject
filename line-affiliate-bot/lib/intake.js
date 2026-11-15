// File intake: people send files to the bot (1:1 or group). Each file is staged in
// Drive, the sender picks a job topic (quick-reply buttons from Drive subfolders),
// then files go to <topic>/<date>/ (zip files are extracted by the Apps Script).
// Only the sender gets a reply; nothing is pushed to anyone else.
import { replyLine, getMessageContent, getDisplayName, getChatName, chatIdOf } from './line.js';
import { driveCall, driveConfigured } from './drive.js';

export const MAX_BYTES = 20 * 1024 * 1024;
const FILE_TYPES = ['file', 'image', 'video', 'audio'];
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'video/mp4': '.mp4', 'audio/m4a': '.m4a', 'audio/x-m4a': '.m4a' };

export function isFileMessage(event) {
  return event.type === 'message' && FILE_TYPES.includes(event.message?.type);
}

function bkkStamp() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(new Date()).replace(/[^0-9]/g, '').slice(0, 14);
}

function fileNameFor(msg, contentType) {
  if (msg.type === 'file' && msg.fileName) return msg.fileName;
  return msg.type + '_' + bkkStamp() + (EXT[contentType.split(';')[0]] || '');
}

function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }

export function toBuddhistDate(iso) { // "2026-11-15" -> "2569-11-15"
  const [y, m, d] = String(iso).split('-');
  return (Number(y) + 543) + '-' + m + '-' + d;
}

export function topicQuickReply(topics) {
  const items = topics.slice(0, 13).map(t => ({
    type: 'action',
    action: { type: 'postback', label: t.name.slice(0, 20), data: 'a=t&f=' + t.id, displayText: 'งาน: ' + t.name }
  }));
  return { items };
}

export async function handleFile(event) {
  const msg = event.message;
  if (!driveConfigured()) {
    await replyLine(event.replyToken, 'ระบบเก็บไฟล์ยังไม่พร้อม (ยังไม่ได้ตั้งค่า Drive) — แจ้งผู้ดูแลระบบ');
    return;
  }
  if (msg.type === 'file' && msg.fileSize > MAX_BYTES) {
    await replyLine(event.replyToken, '⚠️ ไฟล์ ' + msg.fileName + ' ใหญ่ ' + mb(msg.fileSize) + ' เกิน 20 MB — กรุณาอัปขึ้น Google Drive โดยตรง');
    return;
  }
  const content = await getMessageContent(msg.id);
  if (content.notReady || !content.buf?.length) {
    await replyLine(event.replyToken, '⏳ ไฟล์ยังเตรียมไม่เสร็จ (วิดีโอ/เสียง) — ลองส่งใหม่อีกครั้งในอีกสักครู่');
    return;
  }
  if (content.buf.length > MAX_BYTES) {
    await replyLine(event.replyToken, '⚠️ ไฟล์ใหญ่ ' + mb(content.buf.length) + ' เกิน 20 MB — กรุณาอัปขึ้น Google Drive โดยตรง');
    return;
  }
  const source = event.source || {};
  const [senderName, chatName] = await Promise.all([getDisplayName(source), getChatName(source)]);
  const name = fileNameFor(msg, content.contentType);
  const staged = await driveCall('stage', {
    name,
    mimeType: content.contentType,
    base64: content.buf.toString('base64'),
    meta: {
      messageId: msg.id, userId: source.userId || '', senderName,
      chatType: source.type || '', chatId: chatIdOf(source), chatName,
      receivedAt: new Date(event.timestamp || Date.now()).toISOString(), size: content.buf.length
    }
  });
  // Ask the topic once per batch (first pending file only), so an album of photos gets one question.
  if (staged.duplicate || staged.pendingCount !== 1) return;
  const { topics } = await driveCall('topics');
  if (!topics.length) {
    await replyLine(event.replyToken, '📥 รับไฟล์ ' + name + ' แล้ว\nงานนี้เป็นงานอะไรครับ? พิมพ์ชื่องานได้เลย (ระบบจะสร้างโฟลเดอร์ให้)');
    return;
  }
  await replyLine(event.replyToken, {
    type: 'text',
    text: '📥 รับไฟล์ ' + name + ' แล้ว\nงานนี้เป็นงานอะไรครับ? กดเลือกหัวข้อด้านล่าง\nหรือพิมพ์ชื่องานใหม่ได้เลย (ระบบจะสร้างโฟลเดอร์ให้)' + (topics.length > 13 ? '\n(แสดง 13 หัวข้อแรก)' : ''),
    quickReply: topicQuickReply(topics)
  });
}

const NOT_TOPIC = /^(เมนู|menu|help|ช่วย|ช่วยเหลือ|วิธีส่งงาน|หัวข้องาน|งานที่ฉันส่ง|ใครส่งงาน|งานวันนี้|ปฏิทิน|ถาม AI|userid|user id|id)$/i;

async function finalizeAndReply(event, payload) {
  const source = event.source || {};
  const res = await driveCall('finalize', { chatId: chatIdOf(source), userId: source.userId || '', ...payload });
  if (!res.count) return false;
  const lines = ['✅ เก็บ ' + res.count + ' ไฟล์ ในงาน "' + res.topicName + '"' + (res.topicCreated ? ' (สร้างหัวข้อใหม่)' : '') + ' วันที่ ' + res.date + ' แล้ว'];
  if (res.extracted) lines.push('📦 แตก zip ได้ ' + res.extracted + ' ไฟล์');
  if (res.zipErrors?.length) lines.push('⚠️ แตก zip ไม่ได้: ' + res.zipErrors.join('; ').slice(0, 300) + ' (เก็บ zip ไว้แล้ว)');
  lines.push('📂 ' + res.folderUrl);
  await replyLine(event.replyToken, {
    type: 'text',
    text: lines.join('\n'),
    quickReply: { items: [{ type: 'action', action: { type: 'datetimepicker', label: '📅 เปลี่ยนวันที่', data: 'a=d&b=' + res.batchId, mode: 'date' } }] }
  });
  return true;
}

// Text typed while the sender has files waiting = a topic name (new folder if needed).
// Returns true when the text was used as a topic.
export async function handleTopicText(event, text) {
  const name = String(text || '').trim();
  if (!driveConfigured() || !name || name.length > 80 || NOT_TOPIC.test(name)) return false;
  return finalizeAndReply(event, { topicName: name });
}

export async function handlePostback(event) {
  const data = new URLSearchParams(event.postback?.data || '');
  const source = event.source || {};
  if (data.get('a') === 't') {
    const done = await finalizeAndReply(event, { topicId: data.get('f') });
    if (!done) await replyLine(event.replyToken, 'ไม่มีไฟล์ที่รอเลือกหัวข้อ (อาจเลือกไปแล้ว)');
    return;
  }
  if (data.get('a') === 'd') {
    const iso = event.postback?.params?.date;
    if (!iso) return;
    const res = await driveCall('redate', { batchId: data.get('b'), date: toBuddhistDate(iso) });
    await replyLine(event.replyToken, '📅 ย้าย ' + res.count + ' ไฟล์ ไปวันที่ ' + res.date + ' แล้ว\n📂 ' + res.folderUrl);
  }
}
