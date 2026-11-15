/**
 * LINE file intake -> Google Drive (Apps Script web app)
 *
 * The LINE bot on Vercel calls this web app. Files people send to the bot are
 * staged, the sender picks a job topic (= a subfolder of ROOT_FOLDER_ID), then the
 * files are moved to <topic>/<date>/, zip files are extracted, and every file is
 * logged in the "LINE ส่งงาน (log)" spreadsheet inside ROOT_FOLDER_ID.
 *
 * Setup (once):
 *   1. Script Properties: DRIVE_UPLOAD_SECRET = <random secret, same value as on Vercel>
 *   2. Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone".
 *   3. Put the web app URL on Vercel as DRIVE_UPLOAD_URL.
 * The account running this script must be able to add files to ROOT_FOLDER_ID.
 *
 * Folder conventions inside ROOT_FOLDER_ID:
 *   - every subfolder whose name does not start with "_" is a topic shown to senders
 *   - "_รอเลือกหัวข้อ" holds files waiting for the sender to choose a topic
 */
const ROOT_FOLDER_ID = '1r5OFlLF2RtYjtQ2Y-0a_2G5QreNFVBoG'; // ข้อมูลรอตรวจ
const STAGING_NAME = '_รอเลือกหัวข้อ';
const LOG_NAME = '_LINE ส่งงาน (log)';
const TZ = 'Asia/Bangkok';
const KEEP_KEYS_DAYS = 7;

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('DRIVE_UPLOAD_SECRET');
  if (!secret || req.secret !== secret) return out_({ ok: false, error: 'unauthorized' });
  try {
    switch (req.action) {
      case 'topics': return out_(topics_());
      case 'stage': return out_(withLock_(() => stage_(req)));
      case 'finalize': return out_(withLock_(() => finalize_(req)));
      case 'redate': return out_(withLock_(() => redate_(req)));
      case 'list': return out_(list_(req));
      case 'await': return out_(withLock_(() => awaitTopic_(req)));
      case 'createTopic': return out_(withLock_(() => createTopic_(req)));
      default: return out_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() { return out_({ ok: true, service: 'LINE intake' }); }

// ---------- actions ----------

function topics_() {
  const it = root_().getFolders();
  const list = [];
  while (it.hasNext()) {
    const f = it.next();
    if (!f.getName().startsWith('_')) list.push({ id: f.getId(), name: f.getName(), url: f.getUrl() });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  return { ok: true, topics: list };
}

function stage_(req) {
  const props = PropertiesService.getScriptProperties();
  const m = req.meta || {};
  const key = 'm:' + m.messageId;
  const known = props.getProperty(key);
  const pkey = pendingKey_(m.chatId, m.userId);
  const pending = JSON.parse(props.getProperty(pkey) || '[]');
  if (known) return { ok: true, duplicate: true, fileId: known, pendingCount: pending.length };

  const blob = Utilities.newBlob(Utilities.base64Decode(req.base64), req.mimeType || 'application/octet-stream', req.name);
  const file = folder_(root_(), STAGING_NAME).createFile(blob);
  file.setName(safeName_((m.senderName || 'ไม่ทราบชื่อ') + ' - ' + req.name));
  file.setDescription(JSON.stringify(Object.assign({}, m, { originalName: req.name })));

  pending.push(file.getId());
  props.setProperty(pkey, JSON.stringify(pending));
  props.setProperty(key, file.getId());
  // Ask for a topic on the first file of a batch, or again if the last question was over a
  // minute ago (an earlier batch was never answered), so the sender is never left in silence.
  const akey = 'a:' + m.chatId + ':' + m.userId;
  const ask = pending.length === 1 || Date.now() - Number(props.getProperty(akey) || 0) > 60000;
  if (ask) props.setProperty(akey, String(Date.now()));
  prune_(props);
  return { ok: true, fileId: file.getId(), name: file.getName(), pendingCount: pending.length, ask: ask };
}

function finalize_(req) {
  const props = PropertiesService.getScriptProperties();
  const pkey = pendingKey_(req.chatId, req.userId);
  const pending = JSON.parse(props.getProperty(pkey) || '[]');
  if (!pending.length) {
    // No files waiting: a typed name right after "เพิ่มงาน" creates a new topic folder.
    const wkey = awaitKey_(req.chatId, req.userId);
    const since = Number(props.getProperty(wkey) || 0);
    if (req.topicName && since && Date.now() - since < 15 * 60000) {
      props.deleteProperty(wkey);
      const t = ensureTopic_(req.topicName);
      if (!t) return { ok: false, error: 'topic name required' };
      return { ok: true, count: 0, awaited: true, topicName: t.folder.getName(), topicCreated: t.created, folderUrl: t.folder.getUrl() };
    }
    return { ok: true, count: 0 };
  }
  // topicId = existing topic folder; topicName = typed name -> find or create that folder
  let topic, created = false;
  if (req.topicId) topic = DriveApp.getFolderById(req.topicId);
  else {
    const t = ensureTopic_(req.topicName);
    if (!t) return { ok: false, error: 'topic name required' };
    topic = t.folder; created = t.created;
  }
  const date = req.date || today_();
  const dest = folder_(topic, date);
  const res = placeFiles_(pending, dest, topic.getName(), date);
  props.deleteProperty(pkey);
  const batchId = String(Date.now());
  props.setProperty('b:' + batchId, JSON.stringify({ ids: res.ids, topicId: topic.getId() }));
  return Object.assign({ ok: true, batchId: batchId, topicName: topic.getName(), topicCreated: created, date: date, folderUrl: dest.getUrl() }, res.summary);
}

// "เพิ่มงาน": remember that this sender's next typed text is a new topic name.
function awaitTopic_(req) {
  PropertiesService.getScriptProperties().setProperty(awaitKey_(req.chatId, req.userId), String(Date.now()));
  return { ok: true };
}

// "เพิ่มงาน <ชื่อ>": create (or find) the topic folder right away.
function createTopic_(req) {
  const t = ensureTopic_(req.topicName);
  if (!t) return { ok: false, error: 'topic name required' };
  return { ok: true, topicName: t.folder.getName(), topicCreated: t.created, folderUrl: t.folder.getUrl() };
}

function ensureTopic_(rawName) {
  const name = safeName_(String(rawName || '').trim().replace(/^_+/, '')).slice(0, 80);
  if (!name) return null;
  const it = root_().getFoldersByName(name);
  if (it.hasNext()) return { folder: it.next(), created: false };
  return { folder: root_().createFolder(name), created: true };
}

function awaitKey_(chatId, userId) { return 'w:' + chatId + ':' + userId; }

function redate_(req) {
  const props = PropertiesService.getScriptProperties();
  const b = JSON.parse(props.getProperty('b:' + req.batchId) || 'null');
  if (!b) return { ok: false, error: 'batch not found' };
  const topic = DriveApp.getFolderById(b.topicId);
  const dest = folder_(topic, req.date);
  b.ids.forEach(id => {
    const f = DriveApp.getFileById(id);
    f.moveTo(dest);
  });
  relog_(b.ids, req.date);
  return { ok: true, count: b.ids.length, topicName: topic.getName(), date: req.date, folderUrl: dest.getUrl() };
}

function list_(req) {
  const sinceDays = Math.min(Number(req.sinceDays) || 30, 366);
  const since = Date.now() - sinceDays * 86400000;
  const rows = logSheet_().getDataRange().getValues().slice(1);
  const items = rows
    .filter(r => r[0] && new Date(r[0]).getTime() >= since)
    .map(r => ({
      receivedAt: Utilities.formatDate(new Date(r[0]), TZ, "yyyy-MM-dd'T'HH:mm"),
      workDate: String(r[1]), topic: r[2], sender: r[3], chat: r[4], fileName: r[5],
      fromZip: r[6] || '', url: r[7], fileId: r[8], userId: r[9] || ''
    }));
  return { ok: true, items: items.slice(-Math.min(Number(req.limit) || 500, 2000)) };
}

// ---------- helpers ----------

function placeFiles_(ids, dest, topicName, date) {
  const placed = [];
  const summary = { count: 0, files: [], extracted: 0, zipErrors: [] };
  ids.forEach(id => {
    const f = DriveApp.getFileById(id);
    f.moveTo(dest);
    const meta = JSON.parse(f.getDescription() || '{}');
    meta.topic = topicName;
    f.setDescription(JSON.stringify(meta));
    placed.push(id);
    summary.count++;
    summary.files.push({ name: f.getName(), url: f.getUrl() });
    log_(meta, topicName, date, f.getName(), '', f.getUrl(), id);
    if (/\.zip$/i.test(meta.originalName || f.getName())) {
      try {
        const n = unzipInto_(f, dest, meta, topicName, date, placed);
        summary.extracted += n;
      } catch (err) {
        summary.zipErrors.push(f.getName() + ': ' + (err && err.message || err));
      }
    }
  });
  return { ids: placed, summary: summary };
}

function unzipInto_(zipFile, dest, meta, topicName, date, placed) {
  const blob = zipFile.getBlob().setContentType('application/zip');
  const parts = Utilities.unzip(blob);
  const base = folder_(dest, zipFile.getName().replace(/\.zip$/i, ''));
  let n = 0;
  parts.forEach(p => {
    const name = p.getName();
    if (!name || name.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store)/.test(name)) return;
    const segs = name.split('/').filter(Boolean);
    let target = base;
    segs.slice(0, -1).forEach(s => { target = folder_(target, s); });
    const f = target.createFile(p.setName(segs[segs.length - 1]));
    f.setDescription(JSON.stringify(Object.assign({}, meta, { topic: topicName, fromZip: zipFile.getName() })));
    placed.push(f.getId());
    log_(meta, topicName, date, name, zipFile.getName(), f.getUrl(), f.getId());
    n++;
  });
  return n;
}

function log_(meta, topic, date, fileName, fromZip, url, id) {
  logSheet_().appendRow([new Date(), date, topic, meta.senderName || '', meta.chatName || meta.chatType || '', fileName, fromZip, url, id, meta.userId || '']);
}

function relog_(ids, date) {
  const sh = logSheet_();
  const data = sh.getDataRange().getValues();
  const set = new Set(ids);
  for (let i = 1; i < data.length; i++) if (set.has(data[i][8])) sh.getRange(i + 1, 2).setValue(date);
}

function logSheet_() {
  const it = root_().getFilesByName(LOG_NAME);
  let ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else {
    ss = SpreadsheetApp.create(LOG_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(root_());
    ss.getSheets()[0].appendRow(['เวลารับ', 'วันที่งาน', 'หัวข้อ', 'ผู้ส่ง', 'แชต', 'ชื่อไฟล์', 'แตกจาก zip', 'ลิงก์', 'fileId', 'userId']);
  }
  return ss.getSheets()[0];
}

function root_() { return DriveApp.getFolderById(ROOT_FOLDER_ID); }

function folder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function pendingKey_(chatId, userId) { return 'p:' + chatId + ':' + userId; }

function today_() {
  const d = new Date();
  const y = Number(Utilities.formatDate(d, TZ, 'yyyy')) + 543;
  return y + Utilities.formatDate(d, TZ, '-MM-dd');
}

function safeName_(s) { return String(s).replace(/[\\\/:*?"<>|\r\n]+/g, '_').slice(0, 200); }

function prune_(props) {
  const all = props.getProperties();
  const cutoff = Date.now() - KEEP_KEYS_DAYS * 86400000;
  Object.keys(all).forEach(k => {
    if (k.startsWith('b:') && Number(k.slice(2)) < cutoff) props.deleteProperty(k);
  });
  const mKeys = Object.keys(all).filter(k => k.startsWith('m:'));
  if (mKeys.length > 3000) mKeys.slice(0, mKeys.length - 3000).forEach(k => props.deleteProperty(k));
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
