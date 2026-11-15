export async function GET() {
  return Response.json({
    ok: true,
    service: 'น้องโกงกาง (central LINE bot)',
    time: new Date().toISOString()
  });
}
