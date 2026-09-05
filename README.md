# 캠퍼스 안심길 — 건국대·건대입구 2주 차

건국대학교 서울캠퍼스와 건대입구역 주변에서 TMAP 실제 보행 경로를 조회하고, 그 경로에 가까운 공공 CCTV·스마트보안등만 보여 주는 MVP입니다.

## 현재 동작

- 기본 경로: `건대입구역 2번 출구 → 건국대학교 건국문`
- 장소 검색, 실제 TMAP 지도·보행 경로, 데모 폴백
- 위·경도, 최소 15m, 파일럿 중심 반경 1km 입력 검증
- 실제 TMAP 경로가 완성되기 전에는 CCTV·보안등을 표시하지 않음
- 시설 데이터도 첫 화면에는 요청하지 않고, 실제 경로 좌표를 받은 뒤 서버에서 주변 시설만 골라 불러옴
- 경로선에서 CCTV 70m, 보안등 35m 이내인 위치만 표시
- 장소 편집·경로 재조회 시 이전 경로와 시설을 즉시 제거
- 경로 전체에 균등 분배한 약 20m 간격 표본으로 진행 방향과 무관한 시설 기반 참고지수 계산

위의 70m·35m는 MVP 계산 기준일 뿐 실제 촬영·조명 범위가 아닙니다. 이 서비스는 안전을 보장하지 않습니다.

## 실행

Node.js 20.9 이상과 Corepack이 필요합니다.

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm build
corepack pnpm start
```

브라우저에서 `http://localhost:3000`을 엽니다. 실제 TMAP 기능은 프로젝트 루트의 개인 `.env.local`에 아래 환경변수가 있어야 합니다.

```dotenv
TMAP_API_KEY=본인의_TMAP_키
```

`.env.local`과 실제 키는 공유하거나 Git에 올리지 않습니다. 키가 없거나 TMAP 장애가 발생하면 건물을 관통할 수 있는 합성 경로선은 그리지 않고 거리·시간 추정만 제공합니다.

## 공공데이터 갱신

```powershell
corepack pnpm data:cctv
corepack pnpm data:security-lights -- "C:\path\to\gwangjin-smart-lights.geojson"
```

`data:cctv`는 광진구 공식 페이지의 현재 설치 현황 엑셀을 자동으로 찾아 내려받습니다. 이미 받은 공식 엑셀을 쓰려면 명령 뒤에 파일 경로를 전달할 수도 있습니다. 가져오기 스크립트는 건국대 파일럿 반경 안의 WGS84 위치만 저장하며, 결과가 0개이거나 형식이 다르면 기존 스냅샷을 덮어쓰지 않습니다. 자세한 계보와 한계는 `DATA.md`를 참고합니다.
