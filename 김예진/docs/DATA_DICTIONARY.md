# 데이터 사전

| 필드 | 형식 | 필수 | 설명 | 예시 |
|---|---|---:|---|---|
| `id` | string | O | 팀 전체에서 중복되지 않는 시설 ID | `gwangjin:security_light:LA0564` |
| `type` | enum | O | `cctv` 또는 `security_light` | `cctv` |
| `name` | string | O | 사용자에게 보여 줄 시설명 | `다목적 CCTV · 다목적-036` |
| `latitude` | number | O | WGS84 위도 | `37.548809` |
| `longitude` | number | O | WGS84 경도 | `127.070781` |
| `address` | string/null | O | 원본에 공개된 주소 | `군자로 70 두산위브 앞` |
| `purpose` | string/null | O | 생활방범·다목적 등 공개된 용도 | `다목적` |
| `managingAgency` | string/null | O | 공개된 관리기관 | `서울특별시 광진구` |
| `sourceDatasetId` | string | O | 출처 데이터셋 식별자 | `gwangjin-cctv-installations` |
| `sourceRecordId` | string/null | O | 원본의 장비·시설 식별자 | `LA0564` |
| `sourceUpdatedAt` | RFC 3339/null | O | 원본 자체의 확인 가능한 갱신시각 | `2025-09-25T00:00:00+09:00` |
| `collectedAt` | RFC 3339 | O | 우리 팀이 원본을 수집한 시각 | `2026-09-13T23:12:17+09:00` |

## 값 작성 원칙

- `sourceUpdatedAt`과 `collectedAt`을 혼동하지 않는다.
- 보안등 WFS처럼 원본 갱신시각을 알 수 없으면 `sourceUpdatedAt`은 `null`이다.
- 시설 좌표 스냅샷에 별도 IoT 측정자료의 갱신일을 복사하지 않는다.
- `address`, `purpose`, `managingAgency`가 원본에 없거나 `-`, 빈 문자열처럼 미제공을 뜻하면 `null`로 둔다.
- CCTV의 실제 작동 여부·촬영 방향·촬영 범위, 보안등의 점등·고장 상태는 현재 규격에 포함하지 않는다.
