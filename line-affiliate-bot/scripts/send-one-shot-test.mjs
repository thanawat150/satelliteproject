const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const userId = process.env.LINE_USER_ID;

async function run() {
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  if (!userId) throw new Error('LINE_USER_ID is missing');

  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        { type:'text', text:'https://drive.google.com/uc?export=download&id=1AYfRABxoeMq-7Huydwm624OK4YYEtU6X' },
        { type:'text', text:'TikTok + Shopee' },
        { type:'text', text:'นั่งนานแล้วขาตึง ลองมายืนยืดกับเก้าอี้มหัศจรรย์คุณตาแสวงครับ ใช้ง่าย ขนาดไม่ใหญ่ เหมาะไว้ใช้ทั้งที่บ้านและออฟฟิศ\n\n#เก้าอี้มหัศจรรย์ #คุณตาแสวง #แท่นยืนยืดเส้น #ยืดเหยียด #ShopeeVideo #TikTokAffiliate' }
      ]
    })
  });

  const body = await r.text();
  if (!r.ok) throw new Error('LINE push failed ' + r.status + ' ' + body);
  console.log('ONE_SHOT_LINE_TEST_SENT');
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
