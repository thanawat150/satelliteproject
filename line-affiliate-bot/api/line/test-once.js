async function lineFetch(path, options={}) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
  const r = await fetch('https://api.line.me' + path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': 'Bearer ' + token
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw:text }; }
  if (!r.ok) throw new Error('LINE API ' + r.status + ': ' + text);
  return data;
}

async function push(to, texts) {
  return lineFetch('/v2/bot/message/push', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      to,
      messages:texts.map(text => ({type:'text', text}))
    })
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!process.env.LINE_TEST_TRIGGER_SECRET || key !== process.env.LINE_TEST_TRIGGER_SECRET) {
    return Response.json({ok:false,error:'unauthorized'},{status:401});
  }

  try {
    const followers = await lineFetch('/v2/bot/followers/ids?limit=1000');
    const ids = Array.isArray(followers.userIds) ? followers.userIds : [];
    if (ids.length !== 1) {
      return Response.json({
        ok:false,
        error:'safe-recipient-check-failed',
        followerCount:ids.length,
        note:'Test will send only when exactly one follower is returned.'
      }, {status:409});
    }

    await push(ids[0], [
      'https://drive.google.com/uc?export=download&id=1AYfRABxoeMq-7Huydwm624OK4YYEtU6X',
      'TikTok + Shopee',
      'นั่งนานแล้วขาตึง ลองมายืนยืดกับเก้าอี้มหัศจรรย์คุณตาแสวงครับ ใช้ง่าย ขนาดไม่ใหญ่ เหมาะไว้ใช้ทั้งที่บ้านและออฟฟิศ\n\n#เก้าอี้มหัศจรรย์ #คุณตาแสวง #แท่นยืนยืดเส้น #ยืดเหยียด #ShopeeVideo #TikTokAffiliate'
    ]);

    return Response.json({ok:true,sent:true,followerCount:1});
  } catch (e) {
    console.error(e);
    return Response.json({ok:false,error:e.message},{status:500});
  }
}
