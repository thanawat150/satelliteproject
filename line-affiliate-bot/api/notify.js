// Central LINE notification API: every system (Mangrove Monitoring, Satellite
// Monitoring, satellite reports, data processing, future systems) pushes to the
// one existing LINE OA through this endpoint. LINE credentials stay on Vercel only.
//
// POST /api/notify
//   Authorization: Bearer <MAP_NOTIFY_SECRET>
//   {
//     "source": "Mangrove Monitoring",   // required: name of the sending system
//     "title": "แผนที่ร่าง AI เสร็จแล้ว", // optional
//     "text": "รายละเอียด...",            // text and/or image_url required
//     "level": "info|success|warning|error", // optional, default info
//     "image_url": "https://...png",     // optional, public HTTPS only
//     "preview_url": "https://...jpg"    // optional, defaults to image_url
//   }
// The message is shown as "<icon> [<source>] <title>\n<text>".
import crypto from 'node:crypto';
import { pushLine, textMessage, httpsUrl } from '../lib/line.js';

const LEVEL_ICON = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

function authorized(request) {
  const expected = process.env.MAP_NOTIFY_SECRET || '';
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(a, b);
}

function oneLine(value, max) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

export function formatNotification({ source, title, text, level }) {
  const icon = LEVEL_ICON[String(level || 'info').toLowerCase()] || LEVEL_ICON.info;
  const head = icon + ' [' + oneLine(source, 40) + ']' + (oneLine(title, 100) ? ' ' + oneLine(title, 100) : '');
  const body = String(text || '').trim();
  return body ? head + '\n' + body : head;
}

export async function GET() {
  return Response.json({
    ok: true,
    service: 'Central LINE notify',
    method: 'POST required',
    fields: ['source (required)', 'title', 'text', 'level', 'image_url', 'preview_url']
  });
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  let body = {};
  try { body = await request.json(); } catch {}

  const source = oneLine(body.source, 40);
  if (!source) return Response.json({ ok: false, error: 'source required' }, { status: 422 });

  let image = '';
  if (body.image_url) {
    image = httpsUrl(body.image_url);
    if (!image) return Response.json({ ok: false, error: 'image_url must be https' }, { status: 422 });
  }
  if (!String(body.text || '').trim() && !oneLine(body.title, 100) && !image) {
    return Response.json({ ok: false, error: 'text, title or image_url required' }, { status: 422 });
  }

  const messages = [textMessage(formatNotification(body))];
  if (image) {
    messages.push({ type: 'image', originalContentUrl: image, previewImageUrl: httpsUrl(body.preview_url) || image });
  }

  try {
    await pushLine(messages);
    console.log('NOTIFY_SENT', source, messages.length);
    return Response.json({ ok: true, source, count: messages.length });
  } catch (e) {
    console.error('NOTIFY_ERROR', source, e.message);
    return Response.json({ ok: false, error: 'LINE push failed' }, { status: 502 });
  }
}
