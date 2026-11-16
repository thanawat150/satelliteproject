// Run: node apps-script/gs_sim.test.mjs apps-script/line-intake.gs
// Simulates Apps Script services to test line-intake.gs (finalize retry, redate owner, zip structure).
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(process.argv[2], 'utf8');
let seq = 0; const files = {}, folders = {};
const failOnce = new Set();
const it = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
class Folder {
  constructor(name, parent) { this.id = 'D' + (++seq); this.name = name; this.parent = parent; folders[this.id] = this; }
  getId() { return this.id; } getName() { return this.name; } setName(n) { this.name = n; } getUrl() { return 'url/' + this.id; }
  subs() { return Object.values(folders).filter(f => f.parent === this); }
  getFolders() { return it(this.subs()); }
  getFoldersByName(n) { return it(this.subs().filter(f => f.name === n)); }
  createFolder(n) { return new Folder(n, this); }
  getFiles() { return it(Object.values(files).filter(f => f.parent === this)); }
  getFilesByName(n) { return it(Object.values(files).filter(f => f.parent === this && f.name === n)); }
  createFile(blob) { return new File(blob.name, this, blob); }
  moveTo(dest) { this.parent = dest; }
  path() { return (this.parent ? this.parent.path() + '/' : '') + this.name; }
}
class File {
  constructor(name, parent, blob) { this.id = 'F' + (++seq); this.name = name; this.parent = parent; this.blob = blob; this.desc = ''; this.created = Date.now(); files[this.id] = this; }
  getId() { return this.id; } getName() { return this.name; } setName(n) { this.name = n; } getUrl() { return 'url/' + this.id; }
  getDescription() { return this.desc; } setDescription(d) { this.desc = d; }
  getBlob() { return { ...this.blob, setContentType() { return this; } }; }
  getDateCreated() { return new Date(this.created); }
  moveTo(dest) { if (failOnce.has(this.id)) { failOnce.delete(this.id); throw new Error('simulated Drive failure'); } this.parent = dest; }
}
const root = new Folder('ข้อมูลรอตรวจ', null);
folders['1r5OFlLF2RtYjtQ2Y-0a_2G5QreNFVBoG'] = root;
const topicF = new Folder('งาน A', root);
const props = {};
const rows = [];
const sheet = {
  appendRow: r => rows.push(r.slice()),
  getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
  getLastRow: () => rows.length,
  getRange: (r, c, n, m) => ({
    getValue: () => (rows[r - 1] || [])[c - 1] || '',
    setValue: v => { rows[r - 1][c - 1] = v; },
    getValues: () => rows.slice(r - 1, r - 1 + n).map(x => x.slice(c - 1, c - 1 + (m || 1)))
  })
};
const ss = { getSheets: () => [sheet], getId: () => 'SS' };
const ctx = {
  console, JSON, Date, String, Number, Math, Set, Object, Array, Error,
  DriveApp: { getFolderById: id => { if (id === undefined || !folders[id]) throw new Error('Invalid argument: id'); return folders[id]; }, getFileById: id => files[id] },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props })
  }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  SpreadsheetApp: { create: () => { const f = new File('_LINE ส่งงาน (log)', null, {}); ss.getId = () => f.id; return ss; }, open: () => ss },
  Utilities: {
    newBlob: (bytes, mime, name) => ({ name, mime, parts: bytes.parts, setName(n) { this.name = n; return this; } }),
    base64Decode: s => JSON.parse(s),
    unzip: blob => blob.parts.map(p => ({ name: p, getName() { return this.name; }, setName(n) { return { name: n, setName() { return this; } }; } })),
    formatDate: (d, tz, f) => f === 'yyyy' ? '2026' : f === '-MM-dd' ? '-11-16' : '2026-11-16T10:00'
  },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const call = req => ctx.doPost({ postData: { contents: JSON.stringify({ secret: 'S', ...req }) } }).s;
props.DRIVE_UPLOAD_SECRET = 'S';
const J = s => JSON.parse(s);
const meta = id => ({ messageId: id, userId: 'U1', chatId: 'G1', senderName: 'เคน', chatName: 'กลุ่ม' });
// stage a zip (with folders inside) and a photo
console.log('stage1', call({ action: 'stage', name: 'งาน.zip', mimeType: 'application/zip', base64: JSON.stringify({ parts: ['a/b.txt', 'a/c.txt', 'd.txt'] }), meta: meta('m1') }));
const s2 = J(call({ action: 'stage', name: 'รูป.jpg', mimeType: 'image/jpeg', base64: JSON.stringify({}), meta: meta('m2') }));
failOnce.add(s2.fileId); // photo move fails the first time
const r1 = J(call({ action: 'finalize', chatId: 'G1', userId: 'U1', topicId: topicF.id }));
console.log('1st finalize ->', r1.ok ? 'ok' : 'error: ' + r1.error, '| still pending:', JSON.parse(props['p:G1:U1'] || '[]').length, '| log rows:', rows.length);
const r2 = J(call({ action: 'finalize', chatId: 'G1', userId: 'U1', topicId: topicF.id }));
const zipFolders = Object.values(folders).filter(f => f.name === 'งาน');
console.log('retry finalize ->', r2.ok, 'count', r2.count, '| log rows (expect 1 header + 5):', rows.length, '| zip folders (expect 1):', zipFolders.length,
  '| dup fileIds:', rows.length - 1 - new Set(rows.slice(1).map(r => r[8])).size);
// redate by another member
const bad = J(call({ action: 'redate', batchId: r2.batchId, date: '2569-11-10', userId: 'U2', chatId: 'G1' }));
console.log('redate by other ->', JSON.stringify(bad));
// first batch (zip) redate by owner: moves the zip folder whole
const firstBatch = Object.keys(props).filter(k => k.startsWith('b:'));
console.log('batches stored:', firstBatch.length);
const okR = J(call({ action: 'redate', batchId: r2.batchId, date: '2569-11-10', userId: 'U1', chatId: 'G1' }));
console.log('redate by owner ->', okR.ok, okR.date, '| photo now in:', files[s2.fileId].parent.path());
// zip batch was finalized in the failed call (no batch id returned); test zip redate with a clean run
const s3 = J(call({ action: 'stage', name: 'ชุด2.zip', mimeType: 'application/zip', base64: JSON.stringify({ parts: ['x/y/z.txt', 'top.txt'] }), meta: meta('m3') }));
const r3 = J(call({ action: 'finalize', chatId: 'G1', userId: 'U1', topicId: topicF.id }));
J(call({ action: 'redate', batchId: r3.batchId, date: '2569-11-01', userId: 'U1', chatId: 'G1' }));
const z = Object.values(files).find(f => f.name === 'z.txt');
console.log('zip file after redate:', z.parent.path(), '| zip itself:', files[s3.fileId].parent.path());
console.log('log dates for batch:', rows.filter(r => String(r[10]) === r3.batchId).map(r => r[1]).join(','));
console.log('old date folder leftovers:', Object.values(folders).filter(f => f.name === '2569-11-16').map(f => f.subs().map(s => s.name).join('|') + ' files:' + Object.values(files).filter(x => x.parent === f).map(x => x.name).join('|')).join(' ; '));
