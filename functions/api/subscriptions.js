const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!env.DATA_GO_KR_SERVICE_KEY) {
    return Response.json({ error: '서버에 공공데이터포털 인증키가 설정되지 않았습니다.' }, { status: 503, headers: cors });
  }

  const incoming = new URL(request.url);
  const startmonth = incoming.searchParams.get('startmonth');
  const endmonth = incoming.searchParams.get('endmonth');
  const sido = incoming.searchParams.get('sido') || '';

  if (!/^\\d{6}$/.test(startmonth || '') || !/^\\d{6}$/.test(endmonth || '') || startmonth > endmonth) {
    return Response.json({ error: '공고 조회 기간은 YYYYMM 형식으로 입력해주세요.' }, { status: 400, headers: cors });
  }

  // 청약홈 분양정보 최신 OpenAPI (오픈데이터포털 API)
  const startDate = `${startmonth.slice(0, 4)}-${startmonth.slice(4, 6)}-01`;
  const endYear = Number(endmonth.slice(0, 4));
  const endMonth = Number(endmonth.slice(4, 6));
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const endDate = `${endmonth.slice(0, 4)}-${endmonth.slice(4, 6)}-${String(lastDay).padStart(2, '0')}`;

  const api = new URL('https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail');
  const params = new URLSearchParams({
    serviceKey: env.DATA_GO_KR_SERVICE_KEY,
    page: '1',
    perPage: '100',
    returnType: 'JSON',
    'cond[RCRIT_PBLANC_DE::GTE]': startDate,
    'cond[RCRIT_PBLANC_DE::LTE]': endDate
  });
  if (sido) params.set('cond[SUBSCRPT_AREA_CODE_NM::EQ]', sido);
  api.search = params.toString();

  try {
    const upstream = await fetch(api, { headers: { 'Accept': 'application/json' } });
    const body = await upstream.text();
    let payload;
    try { payload = JSON.parse(body); }
    catch {
      return Response.json({
        error: '청약 데이터 서버가 JSON이 아닌 응답을 보냈습니다.',
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get('content-type') || 'unknown',
        upstreamPreview: body.slice(0, 300)
      }, { status: 502, headers: cors });
    }
    if (!upstream.ok || payload?.error || payload?.message && !Array.isArray(payload?.data)) {
      return Response.json({
        error: payload?.message || payload?.errMsg || payload?.error || '청약 API 요청에 실패했습니다.',
        upstreamStatus: upstream.status,
        details: payload
      }, { status: 502, headers: cors });
    }
    return Response.json(payload, {
      headers: { ...cors, 'Cache-Control': 'public, max-age=300' }
    });
  } catch {
    return Response.json({ error: '청약홈 데이터 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 502, headers: cors });
  }
}
