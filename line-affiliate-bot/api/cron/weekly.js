// Weekly submission summary to the owner (Vercel cron, Monday 09:00 Bangkok).
// Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
// Skips the push when nothing was submitted, so quiet weeks send nothing.
import { pushLine, textMessage } from '../../lib/line.js';
import { driveCall, driveConfigured } from '../../lib/drive.js';
import { summaryText } from '../../lib/assistant.js';

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (request.headers.get('authorization') || '') === 'Bearer ' + secret;
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!driveConfigured()) return Response.json({ ok: false, error: 'drive not configured' }, { status: 500 });
  try {
    const { items } = await driveCall('list', { sinceDays: 7 });
    if (!items.length) return Response.json({ ok: true, sent: false, files: 0 });
    const text = '🗓️ สรุปการส่งงานประจำสัปดาห์\n\n' + summaryText(items, 7);
    await pushLine([textMessage(text)]);
    return Response.json({ ok: true, sent: true, files: items.length });
  } catch (e) {
    console.error('WEEKLY_ERROR', e.message);
    return Response.json({ ok: false, error: 'weekly summary failed' }, { status: 500 });
  }
}
