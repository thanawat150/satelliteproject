// Tap-to-ask menus: Flex carousels whose buttons send a ready-made question
// (a "message" action), so tapping a card asks the bot automatically.
const GREEN = '#06C755';

function msgButton(label, text, primary = true) {
  return { type: 'button', style: primary ? 'primary' : 'secondary', color: primary ? GREEN : undefined, height: 'sm', action: { type: 'message', label: label.slice(0, 40), text } };
}
function uriButton(label, uri) {
  return { type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: label.slice(0, 40), uri } };
}

function card({ emoji, title, desc, buttons, color = '#ECFDF3' }) {
  return {
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: color, paddingAll: '16px', contents: [
      { type: 'text', text: emoji, size: '3xl', align: 'center' },
      { type: 'text', text: title, weight: 'bold', size: 'md', align: 'center', wrap: true, margin: 'sm' }
    ] },
    body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: desc, size: 'sm', color: '#667085', wrap: true, align: 'center' }] },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons }
  };
}

function carousel(altText, bubbles) {
  return { type: 'flex', altText, contents: { type: 'carousel', contents: bubbles.slice(0, 12) } };
}

export function mainCarousel(owner) {
  const cards = [
    card({ emoji: '📤', title: 'วิธีส่งงาน', desc: 'ส่งไฟล์เข้าแชตนี้หรือในกลุ่ม แล้วเลือกหัวข้องาน ระบบเก็บลง Drive ให้', buttons: [msgButton('ดูวิธีส่งงาน', 'วิธีส่งงาน')] }),
    card({ emoji: '📁', title: 'หัวข้องาน', desc: 'ดูรายชื่องานที่เปิดรับไฟล์', buttons: [msgButton('ดูหัวข้องาน', 'หัวข้องาน')], color: '#EFF8FF' }),
    card({ emoji: '🧾', title: 'งานที่ฉันส่ง', desc: 'เช็กว่าไฟล์ที่ส่งไปเข้าระบบแล้วหรือยัง', buttons: [msgButton('ดูงานที่ฉันส่ง', 'งานที่ฉันส่ง')], color: '#FEF6EE' })
  ];
  if (owner) {
    cards.unshift(
      card({ emoji: '📤', title: 'ส่งงาน', desc: 'ถ่ายรูป เลือกรูป หรือแนบไฟล์ แล้วเลือกหัวข้อ', buttons: [msgButton('ส่งงาน', 'ส่งงาน')] }),
      card({ emoji: '➕', title: 'เพิ่มงาน', desc: 'สร้างหัวข้องานใหม่ (โฟลเดอร์ใน Drive)', buttons: [msgButton('เพิ่มงาน', 'เพิ่มงาน'), msgButton('ใครส่งงานบ้าง', 'ใครส่งงาน', false)], color: '#FEF6EE' }),
      card({ emoji: '📅', title: 'ปฏิทินส่งงาน', desc: 'ดูว่าวันไหนมีคนส่งงานบ้าง', buttons: [msgButton('เดือนนี้', 'ปฏิทิน')], color: '#EEF2FF' }),
      card({ emoji: '🤖', title: 'ถาม AI', desc: 'ถามเรื่องการส่งงานด้วยภาษาพูด', buttons: [msgButton('เริ่มถาม', 'ถาม AI')], color: '#F4F3FF' })
    );
  }
  return carousel('เมนูน้องโกงกาง', cards);
}

export function topicsCarousel(topics, owner) {
  if (!topics.length) return 'ยังไม่มีหัวข้องาน (ผู้ดูแลสร้างโฟลเดอร์หัวข้อใน Drive ได้)';
  const bubbles = topics.slice(0, 12).map(t => card({
    emoji: '📁', title: t.name, desc: 'ส่งไฟล์เข้ามา แล้วกดเลือกหัวข้อนี้ตอนบอทถาม',
    buttons: [
      ...(owner ? [msgButton('ใครส่งงานนี้', 'ใครส่งงาน ' + t.name)] : []),
      ...(t.url ? [uriButton('เปิดโฟลเดอร์', t.url)] : [])
    ].concat(owner || t.url ? [] : [msgButton('วิธีส่งงาน', 'วิธีส่งงาน')])
  }));
  return carousel('หัวข้องาน ' + topics.length + ' หัวข้อ', bubbles);
}

export function howToText() {
  return [
    '📤 วิธีส่งงาน',
    '1) ส่งไฟล์เข้าแชตนี้ หรือในกลุ่มที่มีบอท (PDF, รูป, zip ฯลฯ ไม่เกิน 20 MB)',
    '2) บอทถาม "งานนี้เป็นงานอะไร" → กดเลือกหัวข้อ',
    '3) บอทตอบกลับว่าเก็บแล้ว พร้อมลิงก์ Drive (zip แตกไฟล์ให้อัตโนมัติ)',
    '4) วันที่ใช้วันนี้ ถ้าเป็นงานวันอื่นกด "📅 เปลี่ยนวันที่"',
    '',
    'เคล็ดลับ: รูปถ้าต้องการความละเอียดเต็ม ให้ส่งแบบ "ไฟล์" หรือเลือกรูปต้นฉบับ'
  ].join('\n');
}

export function askAiPrompt() {
  const examples = ['วันนี้มีใครส่งงานบ้าง', 'สัปดาห์นี้งานไหนยังไม่มีคนส่ง', 'เดือนนี้ใครส่งงานเยอะที่สุด'];
  return {
    type: 'text',
    text: '🤖 พิมพ์คำถามได้เลย หรือกดตัวอย่างด้านล่าง',
    quickReply: { items: examples.map(q => ({ type: 'action', action: { type: 'message', label: q.slice(0, 20), text: q } })) }
  };
}

// "ส่งงาน": camera / photo buttons (LINE quick reply). Other files: attach with the chat's + button.
export function sendWorkPrompt() {
  return {
    type: 'text',
    text: '📤 ส่งงานได้เลย\n• รูป: กดปุ่มกล้องหรือรูปด้านล่าง\n• PDF / zip / ไฟล์อื่น: กด + ที่ช่องแชต → ไฟล์\nส่งแล้วบอทจะถามว่าเป็นงานอะไร',
    quickReply: { items: [
      { type: 'action', action: { type: 'camera', label: '📷 ถ่ายรูป' } },
      { type: 'action', action: { type: 'cameraRoll', label: '🖼️ เลือกรูป' } }
    ] }
  };
}
