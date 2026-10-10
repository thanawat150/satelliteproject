const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function run() {
  if (!token) {
    console.log('ONE_SHOT_LINE_TEST_SKIPPED missing token');
    return;
  }

  const followersRes = await fetch('https://api.line.me/v2/bot/followers/ids?limit=1000', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const followersText = await followersRes.text();
  if (!followersRes.ok) {
    console.log('ONE_SHOT_LINE_TEST_SKIPPED follower lookup unavailable ' + followersRes.status);
    return;
  }

  let data = {};
  try { data = followersText ? JSON.parse(followersText) : {}; } catch {}
  const ids = Array.isArray(data.userIds) ? data.userIds : [];
  if (ids.length !== 1) {
    console.log('ONE_SHOT_LINE_TEST_SKIPPED safe recipient count=' + ids.length);
    return;
  }

  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      to: ids[0],
      messages: [
        { type:'text', text:'https://drive.google.com/uc?export=download&id=1AYfRABxoeMq-7Huydwm624OK4YYEtU6X' },
        { type:'text', text:'TikTok + Shopee' },
        { type:'text', text:'นั่งนานแล้วขาตึง ลองมายืนยืดกับเก้าอี้มหัศจรรย์คุณตาแสวงครับ ใช้ง่าย ขนาดไม่ใหญ่ เหมาะไว้ใช้ทั้งที่บ้านและออฟฟิศ\n\n#เก้าอี้มหัศจรรย์ #คุณตาแสวง #แท่นยืนยืดเส้น #ยืดเหยียด #ShopeeVideo #TikTokAffiliate' }
      ]
    })
  });

  if (r.ok) console.log('ONE_SHOT_LINE_TEST_SENT');
  else console.log('ONE_SHOT_LINE_TEST_FAILED ' + r.status);
}

run().catch(e => console.log('ONE_SHOT_LINE_TEST_SKIPPED ' + e.message));
