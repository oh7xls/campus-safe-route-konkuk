# SafetyFacility v1 데이터 계약

## 적용 범위

이 문서는 팀원이 CCTV와 보안등 데이터를 주고받을 때 사용하는 공통 규격을 정의한다. 기존 김예진 앱 내부의 `kind`·`coordinate` 구조는 현재 화면의 호환성을 위해 유지하고, 팀 통합본에 전달할 때 이 규격으로 변환한다.

기계 판독 규격은 `data/schema/safety-facility-v1.schema.json`을 기준으로 한다.
팀 전달 파일은 `data/processed/`에 JSON·CSV·GeoJSON으로 생성한다.

```ts
export type FacilityType = "cctv" | "security_light";

export type SafetyFacilityV1 = {
  id: string;
  type: FacilityType;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  purpose: string | null;
  managingAgency: string | null;
  sourceDatasetId: string;
  sourceRecordId: string | null;
  sourceUpdatedAt: string | null;
  collectedAt: string;
};
```

## 고정 규칙

- 규격 버전은 `1`이다.
- 시설 종류는 `cctv`, `security_light` 두 값만 사용한다.
- 좌표는 WGS84(EPSG:4326) 십진수 위·경도다.
- 앱·CSV에서는 `latitude`, `longitude`를 사용한다.
- GeoJSON의 좌표 순서는 표준에 따라 `[longitude, latitude]`다.
- 날짜와 시각은 시간대가 포함된 RFC 3339 형식으로 기록한다.
- 원본에서 알 수 없는 값은 빈 문자열이나 추정값 대신 `null`을 사용한다.
- 위치만 공개된 시설에 작동·점등 상태를 임의로 추가하지 않는다.
- 화면 표시 여부나 선택 상태처럼 UI에 종속된 값은 데이터 계약에 넣지 않는다.

## ID 규칙

ID는 `<지역>:<종류>:<원본 식별자>` 형식을 우선 사용한다.

```text
gwangjin:cctv:다목적-036
gwangjin:security_light:LA0564
```

신뢰할 수 있는 원본 식별자가 없으면 데이터셋 ID, 정규화한 좌표, 시설명으로 결정적 해시를 만들며 같은 원본을 다시 처리해도 ID가 같아야 한다.

## 버전 변경

필드 삭제, 필드 의미 변경, 허용 값 변경은 `v2`에서만 수행한다. 선택 필드 추가나 문구 보완은 팀 합의 후 `v1`에 반영할 수 있다.
