# 집줍이 | 전국청약

청약홈 모집공고와 국토교통부 아파트 매매 실거래가를 서버 측에서 조회하도록 만든 Cloudflare Pages 프로젝트입니다.

## 현재 구현
- 전국/시도별 APT 모집공고 검색 (청약홈 분양정보 API)
- 법정동 지역코드 + 계약년월 기준 아파트 매매 실거래가 조회 (국토교통부 API)
- API 키는 브라우저에 노출하지 않고 Cloudflare Pages 환경변수로 보관
- 실제 API 연결 전에는 예시 단지/가격을 생성하지 않음

## 배포
Cloudflare Pages에서 Git 저장소를 연결하고 Framework preset은 None, Build command는 비움, Build output directory는 프로젝트 루트로 설정하세요. Pages Functions는 `functions/` 디렉터리를 통해 배포됩니다.

Cloudflare Pages 프로젝트 Settings > Variables and Secrets에 `DATA_GO_KR_SERVICE_KEY`를 Secret으로 등록하세요. 인증키는 저장소에 올리지 마세요.

## API 테스트
- `/api/health`
- `/api/subscriptions?startmonth=202611&endmonth=202611&sido=대전`
- `/api/trades?lawdCd=30170&dealYmd=202610`

청약 자격과 접수 일정은 반드시 청약홈의 입주자모집공고 원문으로 최종 확인하세요. 실거래가는 신고·정정·해제에 따라 변동될 수 있습니다.
