// Retired 2026-11-15: TikTok/Affiliate clip push (Drive link + platforms + caption).
// Kept as a stub so old callers get a clear 410 instead of sending old-style alerts.
// Map-system notifications use /api/notify.
const retired = () => Response.json(
  { ok:false, retired:true, error:'affiliate push retired; use /api/notify' },
  { status:410 }
);
export const GET = retired;
export const POST = retired;
