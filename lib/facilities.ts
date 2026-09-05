import cctvSnapshot from "@/data/gwangjin-cctv-konkuk.json";
import securityLightSnapshot from "@/data/gwangjin-security-lights-konkuk.json";
import type { FacilityCoverageArea, FacilityDataset, SafetyFacility } from "@/lib/types";

export const GWANGJIN_CCTV_DATASET_ID = "gwangjin-cctv-installations";
export const GWANGJIN_SECURITY_LIGHT_DATASET_ID = "gwangjin-smart-security-light";
export const FACILITY_SNAPSHOT_GENERATED_AT = [cctvSnapshot.generatedAt, securityLightSnapshot.generatedAt].sort((a,b) => b.localeCompare(a))[0];

export const PUBLIC_CCTV_FACILITIES: SafetyFacility[] = cctvSnapshot.facilities.map(facility => ({
  id: `gwangjin-cctv-${facility.id}`,
  kind: "cctv",
  name: facility.name,
  coordinate: facility.coordinate,
  address: facility.address,
  purpose: facility.purpose,
  referenceDate: facility.referenceDate,
  sourceDatasetId: GWANGJIN_CCTV_DATASET_ID,
  sourceMode: "public",
}));

export const PUBLIC_SECURITY_LIGHT_FACILITIES: SafetyFacility[] = securityLightSnapshot.facilities.map(facility => ({
  id: facility.id,
  kind: "security-light",
  name: facility.name,
  coordinate: facility.coordinate,
  sourceDatasetId: GWANGJIN_SECURITY_LIGHT_DATASET_ID,
  sourceMode: "public",
}));

export const ACTIVE_FACILITIES: SafetyFacility[] = [...PUBLIC_CCTV_FACILITIES, ...PUBLIC_SECURITY_LIGHT_FACILITIES];
export const FACILITY_COVERAGE_COORDINATES = {
  cctv: PUBLIC_CCTV_FACILITIES.map(f => f.coordinate),
  securityLights: PUBLIC_SECURITY_LIGHT_FACILITIES.map(f => f.coordinate),
};

if (JSON.stringify(cctvSnapshot.filter.center) !== JSON.stringify(securityLightSnapshot.filter.center)) {
  throw new Error("CCTV와 보안등 스냅샷의 파일럿 중심이 일치하지 않습니다.");
}
export const FACILITY_COVERAGE_AREA: FacilityCoverageArea = {
  center: cctvSnapshot.filter.center,
  radiusMeters: Math.min(cctvSnapshot.filter.radiusMeters, securityLightSnapshot.filter.radiusMeters),
};

export const FACILITY_DATASETS: FacilityDataset[] = [
  {
    id: GWANGJIN_CCTV_DATASET_ID,
    kind: "cctv",
    name: "광진구 CCTV 설치 현황 · 건국대 1km 추출본",
    provider: "서울특별시 광진구",
    sourceUrl: cctvSnapshot.sourcePageUrl,
    coordinateSystem: "WGS84",
    updateCycle: "공식 원본 갱신 후 앱 스냅샷 수동 갱신",
    sourceUpdatedAt: cctvSnapshot.pageRevisionDate,
    snapshotGeneratedAt: cctvSnapshot.generatedAt,
    status: "active",
    note: `광진구가 공개한 ${cctvSnapshot.sourceRowCount}개 설치 위치에서 생활방범·공원방범·어린이보호·다목적 용도, 건국대 파일럿 ${cctvSnapshot.filter.radiusMeters}m 이내 ${cctvSnapshot.selectedRowCount}개 위치를 추출했습니다. 공식 페이지 개정일은 ${cctvSnapshot.pageRevisionDate}입니다.`,
  },
  {
    id: GWANGJIN_SECURITY_LIGHT_DATASET_ID,
    kind: "security-light",
    name: "광진구 스마트보안등 · 건국대 1km 추출본",
    provider: "서울특별시 광진구 빅데이터포털",
    sourceUrl: securityLightSnapshot.sourceUrl,
    coordinateSystem: "WGS84",
    updateCycle: "공식 지도 원본 기준 앱 스냅샷 수동 갱신",
    snapshotGeneratedAt: securityLightSnapshot.generatedAt,
    status: "active",
    note: `광진구 공식 지도 WFS ${securityLightSnapshot.sourceResponseCount}개 중 건국대 파일럿 ${securityLightSnapshot.filter.radiusMeters}m 이내 ${securityLightSnapshot.selectedFacilityCount}개 좌표입니다. 측정시각이 없는 위치 스냅샷이므로 점등·고장 상태는 표시하지 않습니다.`,
  },
];
