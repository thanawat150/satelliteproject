export async function GET() {
  return Response.json({
    ok: true,
    service: 'Ken central LINE bot',
    time: new Date().toISOString()
  });
}
