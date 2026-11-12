const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!env.DATA_GO_KR_SERVICE_KEY) return Response.json({ error: '서버에 공공데이터포털 인증키가 아직 설정되지 않았습니다.' }, { status: 503, headers: cors });
  const incoming = new URL(request.url);
  const startmonth = incoming.searchParams.get('startmonth');
  const endmonth = incoming.searchParams.get('endmonth');
  if (!/^\d{6}$/.test(startmonth || '') || !/^\d{6}$/.test(endmonth || '') || startmonth > endmonth) return Response.json({ error: '공고 조회 기간은 YYYYMM 형식으로 입력해주세요.' }, { status: 400, headers: cors });
  const api = new URL('https://openapi.reb.or.kr/OpenAPI_ToolInstallPackage/service/rest/ApplyhomeInfoSvc/getLttotPblancList');
  api.search = new URLSearchParams({ serviceKey: env.DATA_GO_KR_SERVICE_KEY, startmonth, endmonth, houseSecd: '01', sido: incoming.searchParams.get('sido') || '', houseName: '', rentSecd: '0', pageNo: '1', numOfRows: '100' }).toString();
  try {
    const upstream = await fetch(api, { headers: { 'Accept': 'application/xml,text/xml' } });
    const body = await upstream.text();
    return new Response(body, { status: upstream.ok ? 200 : upstream.status, headers: { ...cors, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch { return Response.json({ error: '청약홈 데이터 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 502, headers: cors }); }
}
