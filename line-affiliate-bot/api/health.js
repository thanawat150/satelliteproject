export async function GET() {
  return Response.json({
    ok: true,
    service: 'Ken Affiliate LINE Bot',
    time: new Date().toISOString()
  });
}
