# 캠퍼스 안심길 — 건국대·건대입구 데이터 1~3주 차

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
corepack pnpm data:refresh
```

위 명령은 광진구 공식 CCTV와 스마트보안등 위치를 일괄 재수집하고 `SafetyFacility v1` JSON·CSV·GeoJSON과 품질 보고서를 생성합니다. 개별 단계만 다시 실행하려면 다음 명령을 사용합니다.

```powershell
corepack pnpm data:cctv
corepack pnpm data:security-lights
corepack pnpm data:build
```

데이터 담당 3주 차의 PostGIS 전달 CSV, 거리 민감도 분석, 지도·현장 검증 표본을 다시 만들려면 실행합니다.

```powershell
corepack pnpm data:week3
```

PostGIS 적용 방법은 `docs/POSTGIS_HANDOFF.md`, 거리 기준 해석은 `docs/DISTANCE_SENSITIVITY.md`, 직접 확인 절차는 `docs/FIELD_VALIDATION.md`를 참고합니다.

파생 데이터의 `generatedAt`은 실행 시각이 아니라 최신 원본 수집 시각을 사용합니다. 원본이 같으면 다시 실행해도 결과가 같으며, `data/processed/CHECKSUMS.sha256`으로 팀에 전달한 6개 파일의 무결성을 확인할 수 있습니다. 현장검증 입력 파일 `data/qa/facility-validation-results.csv`는 최초 한 번만 만들고 이후 자동 실행에서는 덮어쓰지 않습니다.

`data:cctv`는 광진구 공식 페이지의 현재 설치 현황 엑셀을, `data:security-lights`는 광진구 공식 지도 WFS를 자동으로 요청합니다. 이미 받은 공식 원본을 쓰려면 각 명령 뒤에 파일 경로를 전달할 수도 있습니다. 가져오기 스크립트는 건국대 파일럿 반경 안의 WGS84 위치만 저장하며, 결과가 0개이거나 형식이 다르면 기존 스냅샷을 덮어쓰지 않습니다. 자세한 계보와 한계는 `DATA.md`와 `docs/`를 참고합니다.
