// Client for the Apps Script web app (apps-script/line-intake.gs) that writes to Google Drive.
export async function driveCall(action, payload = {}) {
  const url = process.env.DRIVE_UPLOAD_URL;
  const secret = process.env.DRIVE_UPLOAD_SECRET;
  if (!url || !secret) throw new Error('DRIVE_UPLOAD_URL / DRIVE_UPLOAD_SECRET missing');
  const r = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    signal: AbortSignal.timeout(Number(process.env.DRIVE_TIMEOUT_MS) || 35000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, action, secret })
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error('Drive web app returned non-JSON (check deployment access = Anyone): HTTP ' + r.status);
  }
  if (!data.ok) throw new Error('Drive web app error: ' + (data.error || 'unknown'));
  return data;
}

export function driveConfigured() {
  return !!(process.env.DRIVE_UPLOAD_URL && process.env.DRIVE_UPLOAD_SECRET);
}
