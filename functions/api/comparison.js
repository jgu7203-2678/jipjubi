const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

function parseItems(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('국토교통부 실거래 응답을 해석하지 못했습니다.');
  const code = doc.querySelector('header resultCode')?.textContent;
  const msg = doc.querySelector('header resultMsg')?.textContent;
  if (code && !['00', '000'].includes(code)) throw new Error(msg || ('국토교통부 API 오류: ' + code));
  return [...doc.querySelectorAll('body items item')].map(node =>
    Object.fromEntries([...node.children].map(el => [el.tagName, el.textContent.trim()]))
  );
}

async function geocode(address, key) {
  const url = new URL('https://api.vworld.kr/req/address');
  url.search = new URLSearchParams({
    service: 'address', request: 'getcoord', version: '2.0',
    crs: 'epsg:4326', address, format: 'json', type: 'parcel', key
  }).toString();
  const response = await fetch(url, { headers: { Accept: 'application/json', Referer: 'https://jipjubi-pages.pages.dev/', Origin: 'https://jipjubi-pages.pages.dev' } });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch {
    throw new Error('브이월드 좌표 변환 오류 (HTTP ' + response.status + ', ' + (response.headers.get('content-type') || '응답 형식 미확인') + '): ' + raw.slice(0, 120));
  }
  const point = data?.response?.result?.point;
  if (!response.ok || data?.response?.status !== 'OK' || !point) {
    throw new Error(data?.response?.error?.text || '주소 좌표를 찾지 못했습니다: ' + address);
  }
  return { longitude: Number(point.x), latitude: Number(point.y) };
}

function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function amountManwon(value) {
  const n = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'GET') return Response.json({ error: 'GET 요청만 지원합니다.' }, { status: 405, headers: cors });
  if (!env.DATA_GO_KR_SERVICE_KEY || !env.VWORLD_API_KEY) {
    return Response.json({ error: '공공데이터포털 또는 브이월드 인증키 설정을 확인해주세요.' }, { status: 503, headers: cors });
  }

  const q = new URL(request.url).searchParams;
  const address = (q.get('address') || '').trim();
  const lawdCd = q.get('lawdCd') || '';
  const dealYmd = q.get('dealYmd') || '';
  const salePrice = Number(q.get('salePrice'));
  const saleArea = Number(q.get('saleArea'));
  if (!address || address.length > 200 || !/^\d{5}$/.test(lawdCd) || !/^\d{6}$/.test(dealYmd) || !(salePrice > 0) || !(saleArea > 0)) {
    return Response.json({ error: '주소, 법정동 코드 5자리, 계약월, 분양 총액(만원), 전용면적(㎡)을 올바르게 입력해주세요.' }, { status: 400, headers: cors });
  }

  try {
    const center = await geocode(address, env.VWORLD_API_KEY);
    const tradeUrl = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade');
    tradeUrl.search = new URLSearchParams({
      serviceKey: env.DATA_GO_KR_SERVICE_KEY, LAWD_CD: lawdCd, DEAL_YMD: dealYmd,
      pageNo: '1', numOfRows: '100'
    }).toString();
    const tradeResponse = await fetch(tradeUrl, { headers: { Accept: 'application/xml,text/xml' } });
    const xml = await tradeResponse.text();
    if (!tradeResponse.ok) throw new Error('국토교통부 실거래 API 오류: HTTP ' + tradeResponse.status);
    const items = parseItems(xml);

    // Address prefix keeps each parcel lookup within the city/district entered by the user.
    const prefix = address.split(/\s+/).slice(0, 2).join(' ');
    const unique = new Map();
    for (const item of items) {
      if (!item.umdNm || !item.jibun || !item.aptNm) continue;
      const parcel = prefix + ' ' + item.umdNm + ' ' + item.jibun;
      if (!unique.has(parcel)) unique.set(parcel, item);
    }
    const candidates = [...unique.entries()].slice(0, 30);
    const located = [];
    for (let i = 0; i < candidates.length; i += 3) {
      const batch = candidates.slice(i, i + 3);
      const results = await Promise.all(batch.map(async ([parcel, item]) => {
        try {
          const point = await geocode(parcel, env.VWORLD_API_KEY);
          const km = distanceKm(center, point);
          const amount = amountManwon(item.dealAmount);
          const area = Number(item.excluUseAr);
          if (km > 1 || !amount || !(area > 0)) return null;
          return {
            aptName: item.aptNm, address: parcel, distanceKm: Number(km.toFixed(3)),
            area, dealDate: [item.dealYear, item.dealMonth, item.dealDay].filter(Boolean).join('.'),
            dealAmountManwon: amount,
            pricePerPyeong: Number((amount / area * 3.305785).toFixed(1))
          };
        } catch { return null; }
      }));
      located.push(...results.filter(Boolean));
    }

    const salePricePerPyeong = Number((salePrice / saleArea * 3.305785).toFixed(1));
    const average = located.length ? Number((located.reduce((sum, x) => sum + x.pricePerPyeong, 0) / located.length).toFixed(1)) : null;
    located.sort((a, b) => a.distanceKm - b.distanceKm);
    return Response.json({
      ok: true, address, center, salePricePerPyeong,
      nearby: located, nearbyAveragePerPyeong: average,
      checkedUniqueAddresses: candidates.length,
      note: '해당 법정동 코드·계약월의 실거래 중 주소 좌표를 확인한 최대 30개 고유 지번을 대상으로 계산했습니다.'
    }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error?.message || '주변 시세 비교 중 오류가 발생했습니다.' }, { status: 502, headers: cors });
  }
}
