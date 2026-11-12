export async function onRequest({ env }) {
  return Response.json({
    ok: true,
    configured: Boolean(env.DATA_GO_KR_SERVICE_KEY),
    vworldConfigured: Boolean(env.VWORLD_API_KEY),
    service: '집줍이 전국청약 API'
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
