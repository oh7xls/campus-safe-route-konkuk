# 작업 인수인계

현재 기준 폴더는 `konkuk-week2-v1/김예진`이며, 건국대·건대입구 앱 2주 차와 데이터 담당 1~3주 차 진행본이다.

핵심 구조:

- `data/pilot-area.json`: 건국대 파일럿 단일 설정
- `lib/places.ts`: TMAP 검증 기본 장소
- `lib/route-facilities.ts`: 경로 선분 거리와 시설 필터의 단일 기준
- `lib/safety-score.ts`: 20m 표본 커버리지와 동일한 주변 시설 개수
- `lib/facilities.ts`: 광진구 CCTV·스마트보안등 스냅샷 정규화
- `components/safe-route-planner.tsx`: 실제 경로가 있을 때만 경로 시설을 지도에 전달
- `components/safe-route-planner.tsx`: 실제 경로가 준비된 뒤 해당 경로 기준 시설 API 호출, 이전 요청 취소
- `app/api/facilities/route.ts`: 경로 좌표 검증 후 서버에서 주변 시설만 반환
- `components/map-stage.tsx`: 방어적으로 경로 시설을 다시 필터링; 데모 지도 시설 없음
- `components/place-combobox.tsx`: 사용자가 직접 입력을 편집할 때만 검색; 확정 장소 교환 시 재검색 없음

공식 데이터:

- CCTV: 광진구 공식 CCTV 설치 현황, 전체 1,327개 중 안전 관련 파일럿 214개
- 보안등: 광진구 빅데이터포털 `gjgc:smart_security_light` WFS, 전체 3,699개 중 파일럿 902개
- 보안등 위치 자료에는 측정시각이 없어 점등·고장 상태를 표시하지 않는다.

데이터 담당 전달물:

- 공통 계약: `docs/DATA_CONTRACT.md`, `data/schema/safety-facility-v1.schema.json`
- 통합 데이터·품질 보고·체크섬: `data/processed/`
- PostGIS 마이그레이션·반복 적재: `supabase/`
- 거리 기준 예비 분석: `data/analysis/`, `docs/DISTANCE_SENSITIVITY.md`
- 현장검증 표본과 결과 입력: `data/qa/`, `docs/FIELD_VALIDATION.md`
- 전체 재검토 결과: `docs/WEEK1_TO_3_REVIEW.md`

`corepack pnpm data:refresh`는 두 공식 원본을 임시 위치에서 모두 검증한 뒤에만 현재 스냅샷을 교체한다. `data:week3`는 같은 원본에서 동일한 파생 결과를 만들며 기존 현장검증 결과 CSV를 덮어쓰지 않는다.

실제 키 브라우저 검증:

- 기본 실제 경로: 949m·13분
- 경로 주변 시설: CCTV 13개·보안등 24개
- 정·역방향 참고지수: 모두 71점
- 조회 전 시설 없음, 조회 뒤 경로 주변 시설만 표시
- 경로 교환·빠른 선택 시 이전 경로와 시설 즉시 제거
- 모바일 390×844 정상, 브라우저 콘솔 오류 없음

검증 명령:

```powershell
corepack pnpm check
corepack pnpm build
corepack pnpm start
```

실제 TMAP 검증에는 사용자의 `.env.local`과 `TMAP_API_KEY`가 필요하며 해당 파일은 ZIP·Git에 포함하지 않는다.
