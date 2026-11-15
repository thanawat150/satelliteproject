// One-off setup of the LINE rich menus (bottom tap menu). Run after deploy:
//   curl -X POST https://<host>/api/setup-richmenu -H "Authorization: Bearer $MAP_NOTIFY_SECRET"
// Creates a default menu for everyone and an owner menu linked to LINE_USER_ID.
// Each tap sends a ready-made message, so the bot answers automatically.
// Re-running replaces menus this endpoint created earlier (names start with "ken-").
import crypto from 'node:crypto';

const API = 'https://api.line.me/v2/bot';
const DATA_API = 'https://api-data.line.me/v2/bot';

function authorized(request) {
  const expected = process.env.MAP_NOTIFY_SECRET || '';
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(supplied).digest();
  return crypto.timingSafeEqual(a, b);
}

function grid(width, height, cols, rows, texts) {
  const w = Math.floor(width / cols), h = Math.floor(height / rows);
  return texts.map((text, i) => ({
    bounds: { x: (i % cols) * w, y: Math.floor(i / cols) * h, width: w, height: h },
    action: { type: 'message', text }
  }));
}

const MENUS = {
  user: {
    image: 'richmenu-user.jpg',
    body: { size: { width: 2500, height: 843 }, selected: true, name: 'ken-user', chatBarText: 'เมนูส่งงาน',
      areas: grid(2500, 843, 3, 1, ['วิธีส่งงาน', 'หัวข้องาน', 'งานที่ฉันส่ง']) }
  },
  owner: {
    image: 'richmenu-owner.jpg',
    body: { size: { width: 2500, height: 1686 }, selected: true, name: 'ken-owner', chatBarText: 'เมนูผู้ดูแล',
      areas: grid(2500, 1686, 3, 2, ['ใครส่งงาน', 'ปฏิทิน', 'ถาม AI', 'หัวข้องาน', 'งานวันนี้', 'วิธีส่งงาน']) }
  }
};

async function line(method, url, body, headers = {}) {
  const r = await fetch(url, {
    method,
    headers: { 'Authorization': 'Bearer ' + process.env.LINE_CHANNEL_ACCESS_TOKEN, ...headers },
    body
  });
  const text = await r.text();
  if (!r.ok) throw new Error(method + ' ' + url.replace(API, '').replace(DATA_API, '') + ' -> ' + r.status + ' ' + text);
  return text ? JSON.parse(text) : {};
}

async function createMenu(def, origin) {
  const { richMenuId } = await line('POST', API + '/richmenu', JSON.stringify(def.body), { 'Content-Type': 'application/json' });
  const res = await fetch(new URL('/' + def.image, origin)); // served from public/ (see build script)
  if (!res.ok) throw new Error('image ' + def.image + ' -> ' + res.status);
  const img = Buffer.from(await res.arrayBuffer());
  await line('POST', DATA_API + '/richmenu/' + richMenuId + '/content', img, { 'Content-Type': 'image/jpeg' });
  return richMenuId;
}

export async function POST(request) {
  if (!authorized(request)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_USER_ID) {
    return Response.json({ ok: false, error: 'LINE env missing' }, { status: 500 });
  }
  try {
    const { richmenus = [] } = await line('GET', API + '/richmenu/list');
    const old = richmenus.filter(m => String(m.name).startsWith('ken-'));
    const origin = new URL(request.url).origin;
    const userId = await createMenu(MENUS.user, origin);
    const ownerId = await createMenu(MENUS.owner, origin);
    await line('POST', API + '/user/all/richmenu/' + userId);
    await line('POST', API + '/user/' + process.env.LINE_USER_ID + '/richmenu/' + ownerId);
    for (const m of old) await line('DELETE', API + '/richmenu/' + m.richMenuId).catch(() => {});
    return Response.json({ ok: true, userMenu: userId, ownerMenu: ownerId, replaced: old.length });
  } catch (e) {
    console.error('RICHMENU_ERROR', e.message);
    return Response.json({ ok: false, error: e.message.slice(0, 300) }, { status: 502 });
  }
}
