// Owner-only assistant (1:1 chat with LINE_USER_ID): answers "who submitted what"
// from the Drive log, shows a submission calendar, and uses Claude for free-form questions.
import Anthropic from '@anthropic-ai/sdk';
import { driveCall, driveConfigured } from './drive.js';
import { mainCarousel, topicsCarousel, howToText, askAiPrompt } from './menus.js';

const TZ = 'Asia/Bangkok';
const MODEL = 'claude-opus-5-5';
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function isOwner(source) {
  return source?.type === 'user' && !!process.env.LINE_USER_ID && source.userId === process.env.LINE_USER_ID;
}

function bkkParts(d = new Date()) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-').map(Number);
  return { y, m, d: day };
}

// receivedAt "2026-11-15T21:05" (BKK) -> "2026-11-15"
function dayOf(item) { return String(item.receivedAt).slice(0, 10); }

export function summaryText(items, days) {
  if (!items.length) return 'ช่วง ' + days + ' วันที่ผ่านมา ยังไม่มีใครส่งงานเข้ามา';
  const groups = new Map();
  for (const it of items) {
    const k = dayOf(it) + '|' + it.sender + '|' + it.topic + '|' + it.chat;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const lines = ['📋 งานที่ส่งเข้ามา ' + days + ' วันล่าสุด (' + items.length + ' ไฟล์)'];
  for (const [k, list] of [...groups.entries()].reverse().slice(0, 30)) {
    const [day, sender, topic, chat] = k.split('|');
    const names = list.filter(x => !x.fromZip).map(x => x.fileName);
    const zipped = list.filter(x => x.fromZip).length;
    lines.push('', '• ' + day + ' ' + sender + ' — ' + topic + ' (' + chat + ')',
      '  ' + names.slice(0, 5).join(', ') + (names.length > 5 ? ' …+' + (names.length - 5) : '') + (zipped ? ' [แตกจาก zip ' + zipped + ' ไฟล์]' : ''));
  }
  return lines.join('\n').slice(0, 4900);
}

export function calendarFlex(items, year, month) {
  const key = year + '-' + String(month).padStart(2, '0');
  const counts = {};
  const senders = {};
  for (const it of items) {
    const day = dayOf(it);
    if (!day.startsWith(key)) continue;
    const d = Number(day.slice(8, 10));
    counts[d] = (counts[d] || 0) + 1;
    (senders[d] = senders[d] || new Set()).add(it.sender);
  }
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const daysIn = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = bkkParts();
  const cell = (d) => {
    if (!d) return { type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'filler' }] };
    const n = counts[d] || 0;
    const isToday = today.y === year && today.m === month && today.d === d;
    return {
      type: 'box', layout: 'vertical', flex: 1, paddingAll: '2px', cornerRadius: '6px',
      backgroundColor: n ? '#D1FADF' : (isToday ? '#EEF2FF' : '#FFFFFF'),
      contents: [
        { type: 'text', text: String(d), size: 'xs', align: 'center', color: n ? '#05603A' : '#475467', weight: n || isToday ? 'bold' : 'regular' },
        { type: 'text', text: n ? String(n) : ' ', size: 'xxs', align: 'center', color: '#039855' }
      ]
    };
  };
  const rows = [];
  let week = [];
  for (let i = 0; i < first; i++) week.push(cell(0));
  for (let d = 1; d <= daysIn; d++) {
    week.push(cell(d));
    if (week.length === 7) { rows.push({ type: 'box', layout: 'horizontal', spacing: '2px', contents: week }); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(cell(0)); rows.push({ type: 'box', layout: 'horizontal', spacing: '2px', contents: week }); }
  const head = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(t => ({ type: 'text', text: t, size: 'xxs', align: 'center', color: '#98A2B3', flex: 1 }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeDays = Object.keys(counts).map(Number).sort((a, b) => a - b);
  const footer = activeDays.length
    ? activeDays.slice(-6).map(d => d + ': ' + [...senders[d]].join(', ')).join('\n')
    : 'เดือนนี้ยังไม่มีการส่งงาน';
  return {
    type: 'flex',
    altText: 'ปฏิทินการส่งงาน ' + TH_MONTHS[month - 1] + ' ' + (year + 543) + ' (' + total + ' ไฟล์)',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', spacing: '4px', contents: [
          { type: 'text', text: '📅 ปฏิทินการส่งงาน', weight: 'bold', size: 'md' },
          { type: 'text', text: TH_MONTHS[month - 1] + ' ' + (year + 543) + ' • ' + total + ' ไฟล์ • ' + activeDays.length + ' วัน', size: 'xs', color: '#667085' },
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'horizontal', margin: 'md', contents: head },
          ...rows,
          { type: 'separator', margin: 'md' },
          { type: 'text', text: footer, size: 'xxs', color: '#475467', wrap: true, margin: 'md' }
        ]
      }
    }
  };
}

// "ปฏิทิน", "ปฏิทิน 2569-10", "ปฏิทิน 10/2569", "ปฏิทิน 2026-10"
export function parseCalendarMonth(text) {
  const m = String(text).match(/(\d{4})[-/](\d{1,2})|(\d{1,2})[-/](\d{4})/);
  const now = bkkParts();
  if (!m) return { y: now.y, m: now.m };
  let y = Number(m[1] || m[4]);
  const mo = Number(m[2] || m[3]);
  if (y > 2400) y -= 543;
  return { y, m: Math.min(Math.max(mo, 1), 12) };
}

const SYSTEM_PROMPT = 'คุณเป็นผู้ช่วยของ Ken ตอบคำถามเรื่องการส่งงานเข้าระบบ LINE → Google Drive จากบันทึกที่ให้มาเท่านั้น ' +
  'ตอบภาษาไทย สั้น กระชับ เหมาะกับการอ่านใน LINE (ไม่ใช้ตาราง markdown) ถ้าบันทึกไม่มีข้อมูลให้บอกตรง ๆ ว่าไม่มี ' +
  'วันที่ในบันทึกเป็นเวลาไทย (ค.ศ.) ส่วนวันที่งานเป็น พ.ศ.';

function userPrompt(question, items) {
  const log = items.map(i => [i.receivedAt, i.workDate, i.topic, i.sender, i.chat, i.fileName, i.fromZip].join(' | ')).join('\n');
  return 'วันนี้: ' + new Intl.DateTimeFormat('th-TH', { timeZone: TZ, dateStyle: 'full' }).format(new Date()) +
    '\n\nบันทึกการส่งงาน (เวลารับ | วันที่งาน | หัวข้อ | ผู้ส่ง | แชต | ชื่อไฟล์ | แตกจาก zip):\n' + (log || '(ว่าง)') +
    '\n\nคำถาม: ' + question;
}

// Google Gemini (free tier available via Google AI Studio). Model override: GEMINI_MODEL.
export async function askGemini(question, items) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(question, items) }] }],
      generationConfig: { maxOutputTokens: 2000 }
    })
  });
  if (!r.ok) { const e = new Error('gemini ' + r.status); e.status = r.status; throw e; }
  const data = await r.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  return text || 'ไม่มีคำตอบ';
}

export async function askClaude(question, items) {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt(question, items) }]
  });
  if (response.stop_reason === 'refusal') return 'ขอโทษครับ ตอบคำถามนี้ไม่ได้';
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return text || 'ไม่มีคำตอบ';
}

function within(items, days) {
  const cutoff = Date.now() - days * 86400000;
  return items.filter(i => Date.parse(i.receivedAt + ':00+07:00') >= cutoff);
}

function todayItems(items) {
  const p = bkkParts();
  const key = p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0');
  return items.filter(i => dayOf(i) === key);
}

// Text from a 1:1 chat. Rich-menu / card buttons send these same words.
export async function handleText(text, source) {
  const t = text.trim();
  const owner = isOwner(source);
  const lower = t.toLowerCase();
  if (['เมนู', 'menu', 'help', 'ช่วย', 'ช่วยเหลือ'].includes(lower)) return [mainCarousel(owner)];
  if (t === 'วิธีส่งงาน') return [howToText()];
  if (!driveConfigured()) return ['ระบบเก็บไฟล์ยังไม่ได้ตั้งค่า (DRIVE_UPLOAD_URL / DRIVE_UPLOAD_SECRET)'];
  if (t === 'หัวข้องาน') {
    const { topics } = await driveCall('topics');
    return [topicsCarousel(topics, owner)];
  }
  if (t === 'งานที่ฉันส่ง') {
    const { items } = await driveCall('list', { sinceDays: 30 });
    const mine = items.filter(i => i.userId && i.userId === source.userId);
    return [mine.length ? summaryText(mine, 30).replace('งานที่ส่งเข้ามา', 'งานที่คุณส่ง') : 'ช่วง 30 วันที่ผ่านมา ยังไม่พบไฟล์ที่คุณส่ง'];
  }
  if (!owner) return [mainCarousel(false)];

  // ----- owner only -----
  if (t === 'ถาม AI') return [askAiPrompt()];
  if (/^ปฏิทิน/.test(t)) {
    const { y, m } = parseCalendarMonth(t);
    const { items } = await driveCall('list', { sinceDays: 400, limit: 2000 });
    return [calendarFlex(items, y, m)];
  }
  if (t === 'งานวันนี้') {
    const { items } = await driveCall('list', { sinceDays: 2 });
    const today = todayItems(items);
    return [today.length ? summaryText(today, 1).replace('1 วันล่าสุด', 'วันนี้') : 'วันนี้ยังไม่มีใครส่งงาน'];
  }
  const who = t.match(/^(?:ใครส่งงาน|ส่งงาน|สรุปงาน)\s*(.*)$/);
  if (who) {
    const { items } = await driveCall('list', { sinceDays: 30 });
    const topic = who[1].trim();
    if (topic) {
      const hit = items.filter(i => String(i.topic).includes(topic));
      return [hit.length ? summaryText(hit, 30).replace('งานที่ส่งเข้ามา', 'งาน "' + topic + '"') : 'ช่วง 30 วัน ยังไม่มีใครส่งงาน "' + topic + '"'];
    }
    return [summaryText(within(items, 7), 7)];
  }
  const { items } = await driveCall('list', { sinceDays: 60, limit: 400 });
  const ask = process.env.ANTHROPIC_API_KEY ? askClaude : process.env.GEMINI_API_KEY ? askGemini : null;
  if (!ask) return [summaryText(within(items, 7), 7) + '\n\n(ยังไม่ได้ตั้ง ANTHROPIC_API_KEY หรือ GEMINI_API_KEY จึงตอบเป็นสรุปแทน AI)'];
  try {
    return [await ask(t, items)];
  } catch (e) {
    console.error('AI_ERROR', e?.status, e?.message);
    return ['AI ตอบไม่ได้ตอนนี้ (' + (e?.status || 'error') + ')\n\n' + summaryText(within(items, 7), 7)];
  }
}
