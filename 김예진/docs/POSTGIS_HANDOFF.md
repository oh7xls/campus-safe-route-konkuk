# Supabase PostGIS 전달 안내

## 전달 파일

- 마이그레이션: `supabase/migrations/202609130001_create_safety_facilities.sql`
- 반복 적재 스크립트: `supabase/import-safety-facilities.psql`
- 데이터셋 CSV: `data/processed/facility-datasets-postgis.csv`
- 시설 CSV: `data/processed/safety-facilities-postgis.csv`
- 전달 파일 체크섬: `data/processed/CHECKSUMS.sha256`

## 구조

`facility_datasets`는 출처·수집일·원본 해시를 보존하고, `safety_facilities`는 개별 시설을 저장한다. 위치는 WGS84 위·경도로 받고 `geography(Point, 4326)` 생성 열로 변환한다. 공간 검색용 GiST 인덱스와 공개 읽기 전용 RLS 정책·권한을 포함한다.

PostGIS 점 생성 순서는 `경도, 위도`다.

```sql
extensions.st_makepoint(longitude, latitude)
```

## Supabase 적용 순서

1. 새 Supabase 개발 프로젝트를 준비한다.
2. SQL Editor에서 마이그레이션 파일을 실행한다.
3. 로컬에서 데이터 파이프라인을 실행한다.
4. 프로젝트 루트인 `김예진/`에서 `psql`로 적재 스크립트를 실행한다.

```powershell
corepack pnpm data:refresh
psql "본인의 Supabase 연결 문자열" -f supabase/import-safety-facilities.psql
```

연결 문자열과 비밀번호는 문서·Git·터미널 캡처에 남기지 않는다. 팀원이 관리하는 Supabase 프로젝트에는 백엔드 담당자의 승인 후 적용한다. 반복 적재는 새 행 추가와 기존 행 갱신뿐 아니라, 이번 원본에서 사라진 같은 데이터셋의 기존 시설도 삭제해 DB를 최신 전달본과 동기화한다.

## 적재 후 확인

```sql
select facility_type, count(*)
from public.safety_facilities
group by facility_type;

select *
from public.nearby_safety_facilities(37.542, 127.073, 100);
```

현재 전달본의 예상 개수는 CCTV 214개, 스마트보안등 902개다. 실제 적재 시 최신 데이터 갱신으로 달라질 수 있으므로 품질 보고서의 개수와 비교한다.

## 현재 검증 상태

DDL·CSV 열·ID·좌표 규격은 자동 검사한다. 현재 작업 환경에는 `psql`, Docker, 팀 Supabase 접속정보가 없어 실제 데이터베이스 실행은 아직 수행하지 않았다.
