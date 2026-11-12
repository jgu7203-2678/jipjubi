const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return Response.json({ error: 'GET 요청만 지원합니다.' }, { status: 405, headers: cors });
  if (!env.VWORLD_API_KEY) return Response.json({ error: '서버에 브이월드 인증키(VWORLD_API_KEY)가 설정되지 않았습니다.' }, { status: 503, headers: cors });

  const incoming = new URL(request.url);
  const address = (incoming.searchParams.get('address') || '').trim();
  const type = (incoming.searchParams.get('type') || 'ROAD').toUpperCase();
  if (!address || address.length > 200) return Response.json({ error: '검색할 주소를 입력해주세요.' }, { status: 400, headers: cors });
  if (!['ROAD', 'PARCEL'].includes(type)) return Response.json({ error: '주소 유형은 ROAD 또는 PARCEL이어야 합니다.' }, { status: 400, headers: cors });

  const api = new URL('https://api.vworld.kr/req/address');
  api.search = new URLSearchParams({
    service: 'address',
    request: 'getcoord',
    version: '2.0',
    crs: 'epsg:4326',
    address,
    format: 'json',
    type: type.toLowerCase(),
    key: env.VWORLD_API_KEY
  }).toString();

  try {
    const upstream = await fetch(api, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://jipjubi-pages.pages.dev/',
        'Origin': 'https://jipjubi-pages.pages.dev'
      }
    });
    const body = await upstream.text();
    let payload;
    try { payload = JSON.parse(body); }
    catch {
      return Response.json({
        error: '브이월드가 JSON이 아닌 응답을 반환했습니다.',
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get('content-type') || 'unknown',
        upstreamPreview: body.slice(0, 180)
      }, { status: 502, headers: cors });
    }
    const result = payload?.response?.result;
    const point = result?.point;
    if (!upstream.ok || payload?.response?.status !== 'OK' || !point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
      return Response.json({
        error: payload?.response?.error?.text || payload?.response?.error?.message || '주소의 좌표를 찾지 못했습니다. 도로명 주소로 다시 검색해주세요.',
        upstreamStatus: upstream.status,
        upstreamCode: payload?.response?.error?.code || payload?.response?.status || 'NO_RESULT'
      }, { status: 422, headers: cors });
    }
    return Response.json({
      ok: true,
      address: result?.text || address,
      longitude: Number(point.x),
      latitude: Number(point.y)
    }, { headers: { ...cors, 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return Response.json({ error: '브이월드 주소 검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 502, headers: cors });
  }
}
