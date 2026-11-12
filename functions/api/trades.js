const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!env.DATA_GO_KR_SERVICE_KEY) return Response.json({ error: '서버에 공공데이터포털 인증키가 아직 설정되지 않았습니다.' }, { status: 503, headers: cors });
  const incoming = new URL(request.url);
  const lawdCd = incoming.searchParams.get('lawdCd');
  const dealYmd = incoming.searchParams.get('dealYmd');
  if (!/^\d{5}$/.test(lawdCd || '') || !/^\d{6}$/.test(dealYmd || '')) return Response.json({ error: '법정동 코드 5자리와 계약년월 YYYYMM을 입력해주세요.' }, { status: 400, headers: cors });
  const api = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade');
  api.search = new URLSearchParams({ serviceKey: env.DATA_GO_KR_SERVICE_KEY, LAWD_CD: lawdCd, DEAL_YMD: dealYmd, pageNo: '1', numOfRows: '100' }).toString();
  try {
    const upstream = await fetch(api, { headers: { 'Accept': 'application/xml,text/xml' } });
    const body = await upstream.text();
    return new Response(body, { status: upstream.ok ? 200 : upstream.status, headers: { ...cors, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch { return Response.json({ error: '국토교통부 실거래가 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 502, headers: cors }); }
}
