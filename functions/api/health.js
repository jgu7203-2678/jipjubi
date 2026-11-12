export async function onRequest({ env }) {
  const configured = Boolean(env.DATA_GO_KR_SERVICE_KEY);
  return Response.json({ ok: true, configured, service: '집줍이 전국청약 API' }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
