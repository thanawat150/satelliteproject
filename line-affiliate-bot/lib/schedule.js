const AFFILIATE_URL = 'https://raw.githubusercontent.com/thanawat150/satelliteproject/main/docs/affiliate-posting/schedule.json';
const METRICOOL_URL = 'https://raw.githubusercontent.com/thanawat150/satelliteproject/main/docs/affiliate-posting/metricool-schedule.json';
const QUEUE_URL = 'https://raw.githubusercontent.com/thanawat150/satelliteproject/main/docs/affiliate-posting/queue.json';

export function bkkDate(offsetDays=0) {
  const now = new Date();
  const base = new Date(now.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Bangkok',
    year:'numeric', month:'2-digit', day:'2-digit'
  }).format(base);
}

export function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00+07:00');
  return new Intl.DateTimeFormat('th-TH', {
    timeZone:'Asia/Bangkok',
    weekday:'short', day:'numeric', month:'short'
  }).format(d);
}

async function fetchJson(url) {
  const r = await fetch(url, { cache:'no-store' });
  if (!r.ok) throw new Error('fetch failed ' + r.status + ' ' + url);
  return r.json();
}

export async function getAffiliateSchedule() {
  return fetchJson(AFFILIATE_URL);
}

export async function getMetricoolSchedule() {
  return fetchJson(METRICOOL_URL);
}

export async function getQueue() {
  return fetchJson(QUEUE_URL);
}

function networkLabel(n) {
  const key = String(n || '').toLowerCase();
  return ({
    tiktok:'TikTok คลิป',
    instagram:'Instagram',
    facebook:'Facebook',
    youtube:'YouTube'
  })[key] || n;
}

function timeFromLocalDateTime(s) {
  return String(s || '').slice(11,16);
}

function dayFromLocalDateTime(s) {
  return String(s || '').slice(0,10);
}

export async function dayPlan(date) {
  const [affiliate, metricool] = await Promise.all([
    getAffiliateSchedule(),
    getMetricoolSchedule()
  ]);

  const a = (affiliate.items || []).find(x => x.date === date) || null;
  const content = (metricool.items || [])
    .filter(x => dayFromLocalDateTime(x.date) === date)
    .sort((x,y) => String(x.date).localeCompare(String(y.date)));

  return { date, affiliate:a, content };
}

export function dayPlanText(plan, heading) {
  const lines = [heading + ' (' + shortDate(plan.date) + ')'];

  if (plan.affiliate) {
    lines.push('');
    lines.push('🛒 Affiliate');
    lines.push('Shopee Video ' + plan.affiliate.shopee + ' — ' + plan.affiliate.product);
    lines.push('TikTok ขาย ' + plan.affiliate.tiktok + ' — ' + plan.affiliate.product);
  }

  if (plan.content.length) {
    lines.push('');
    lines.push('🎬 Content');
    for (const x of plan.content) {
      const title = String(x.title || '').trim() || String(x.text || '').split('\n')[0].slice(0,80) || 'คอนเทนต์';
      lines.push(networkLabel(x.network) + ' ' + timeFromLocalDateTime(x.date) + ' — ' + title);
    }
  }

  if (!plan.affiliate && !plan.content.length) {
    lines.push('');
    lines.push('ยังไม่มีกำหนดการ');
  }

  return lines.join('\n');
}

export function sevenDayText(plans) {
  const blocks = [];
  for (const plan of plans) {
    const count = (plan.affiliate ? 2 : 0) + plan.content.length;
    if (!count) continue;
    const lines = [shortDate(plan.date) + ' — ' + count + ' งาน'];
    if (plan.affiliate) {
      lines.push('• Shopee ' + plan.affiliate.shopee);
      lines.push('• TikTok ขาย ' + plan.affiliate.tiktok);
    }
    for (const x of plan.content) {
      lines.push('• ' + networkLabel(x.network) + ' ' + timeFromLocalDateTime(x.date));
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.length ? 'กำหนดการ 7 วัน\n\n' + blocks.join('\n\n') : 'ยังไม่มีกำหนดการล่วงหน้า';
}
