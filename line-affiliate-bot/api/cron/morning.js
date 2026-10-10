import { dayPlan, dayPlanText, bkkDate } from '../../lib/schedule.js';

async function pushLine(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  if (!userId) throw new Error('LINE_USER_ID is missing');

  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer ' + token
    },
    body:JSON.stringify({
      to:userId,
      messages:[{ type:'text', text:String(text).slice(0,4900) }]
    })
  });

  const body = await r.text();
  if (!r.ok) throw new Error('LINE push failed ' + r.status + ' ' + body);
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === 'Bearer ' + secret;
}

export async function GET(request) {
  if (!authorized(request)) {
    return Response.json({ ok:false, error:'unauthorized' }, { status:401 });
  }

  try {
    const date = bkkDate(0);
    const plan = await dayPlan(date);
    const text = '⏰ 07:00 แจ้งเตือนประจำวัน\n\n' +
      dayPlanText(plan, 'วันนี้ต้องลง') +
      '\n\nพิมพ์ “สถานะ” เพื่อดู Checklist วันนี้';
    await pushLine(text);
    return Response.json({ ok:true, date, sent:true });
  } catch (e) {
    console.error('MORNING_CRON_ERROR', e);
    return Response.json({ ok:false, error:e.message }, { status:500 });
  }
}
