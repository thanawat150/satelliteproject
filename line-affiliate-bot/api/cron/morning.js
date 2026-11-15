// Retired 2026-11-15: the 07:00 TikTok/Affiliate daily push is turned off.
// The cron entry was removed from vercel.json. This handler stays as a stub so a
// manual or leftover trigger can never send a duplicate message.
export async function GET() {
  return Response.json({ ok:false, retired:true, error:'affiliate morning alert retired' }, { status:410 });
}
