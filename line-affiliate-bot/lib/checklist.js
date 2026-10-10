import { get, put } from '@vercel/blob';

function bkkDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function pathFor(date = bkkDate()) {
  return 'affiliate-checklist/' + date + '.json';
}

export function emptyChecklist(date = bkkDate()) {
  return {
    date,
    tiktok_affiliate: false,
    tiktok_content: false,
    shopee_video: false,
    instagram: false,
    facebook: false,
    youtube: false,
    updated_at: new Date().toISOString()
  };
}

export async function readChecklist(date = bkkDate()) {
  try {
    const result = await get(pathFor(date), {
      access: 'private',
      useCache: false
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return emptyChecklist(date);
    }
    const raw = await new Response(result.stream).text();
    return { ...emptyChecklist(date), ...JSON.parse(raw), date };
  } catch {
    return emptyChecklist(date);
  }
}

export async function writeChecklist(state) {
  const next = {
    ...emptyChecklist(state.date || bkkDate()),
    ...state,
    updated_at: new Date().toISOString()
  };

  await put(pathFor(next.date), JSON.stringify(next), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });

  return next;
}

export function statusText(s, heading = '📋 สถานะวันนี้') {
  const rows = [
    ['TikTok ขาย', !!s.tiktok_affiliate],
    ['TikTok คลิป', !!s.tiktok_content],
    ['Shopee Video', !!s.shopee_video],
    ['Instagram', !!s.instagram],
    ['Facebook', !!s.facebook],
    ['YouTube', !!s.youtube]
  ];
  const done = rows.filter(([, value]) => value).length;

  return heading + '\n' +
    rows.map(([name, value]) => (value ? '✅ ' : '⬜ ') + name).join('\n') +
    '\n\nความคืบหน้า ' + done + '/6' +
    (done === 6 ? '\n🎉 วันนี้ครบแล้ว' : '');
}

export function doneIntent(text) {
  return /(ลงแล้ว|โพสต์แล้ว|เสร็จแล้ว|เรียบร้อยแล้ว|เสร็จ|ลงละ|โพสต์ละ)/i.test(text);
}

export function undoIntent(text) {
  return /(ยังไม่ลง|ยังไม่ได้ลง|ยกเลิก|เอาออก|ไม่เสร็จ|ยังไม่เสร็จ)/i.test(text);
}

export function targetFromText(text) {
  if (/(tiktok\s*affiliate|affiliate\s*tiktok|ติ๊กต็อก\s*affiliate|ติ๊กต๊อก\s*affiliate|tiktok\s*ขาย|ติ๊กต็อก\s*ขาย)/i.test(text)) {
    return 'tiktok_affiliate';
  }
  if (/(tiktok\s*content|content\s*tiktok|ติ๊กต็อก\s*content|ติ๊กต๊อก\s*content|tiktok\s*คอนเทนต์|ติ๊กต็อก\s*คอนเทนต์)/i.test(text)) {
    return 'tiktok_content';
  }
  if (/(shopee|ช้อปปี้|ช็อปปี้|ชอปปี้)/i.test(text)) {
    return 'shopee_video';
  }
  if (/(instagram|ig|อินสตาแกรม|ไอจี)/i.test(text)) {
    return 'instagram';
  }
  if (/(facebook|fb|เฟซบุ๊ก|เฟสบุ๊ก)/i.test(text)) {
    return 'facebook';
  }
  if (/(youtube|yt|ยูทูบ|ยูทูป)/i.test(text)) {
    return 'youtube';
  }
  if (/(tiktok|ติ๊กต็อก|ติ๊กต๊อก)/i.test(text)) {
    return 'tiktok_ambiguous';
  }
  return null;
}
