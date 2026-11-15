// Mangrove map system notifications (STC/VSD draft maps).
// POST /api/notify
//   Authorization: Bearer <MAP_NOTIFY_SECRET>
//   { "text": "...", "image_url": "https://...png", "preview_url": "https://...jpg" }
// image_url / preview_url must be public HTTPS (LINE cannot receive local files or PDFs).
import crypto from 'node:crypto';
import { pushLine, textMessage, httpsUrl } from '../lib/line.js';

function authorized(request) {
  const expected = process.env.MAP_NOTIFY_SECRET || '';
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET() {
  return Response.json({ ok: true, service: 'Mangrove map LINE notify', method: 'POST required' });
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  let body = {};
  try { body = await request.json(); } catch {}

  const messages = [];
  const texts = Array.isArray(body.messages) ? body.messages : (body.text ? [body.text] : []);
  for (const t of texts.slice(0, 4)) if (String(t).trim()) messages.push(textMessage(t));

  if (body.image_url) {
    const img = httpsUrl(body.image_url);
    if (!img) return Response.json({ ok: false, error: 'image_url must be https' }, { status: 422 });
    messages.push({ type: 'image', originalContentUrl: img, previewImageUrl: httpsUrl(body.preview_url) || img });
  }
  if (!messages.length) return Response.json({ ok: false, error: 'text or image_url required' }, { status: 422 });

  try {
    await pushLine(messages);
    return Response.json({ ok: true, count: messages.length });
  } catch (e) {
    console.error('MAP_NOTIFY_ERROR', e.message);
    return Response.json({ ok: false, error: 'LINE push failed' }, { status: 502 });
  }
}
