import assert from "node:assert/strict";
import test from "node:test";
import cctvSnapshot from "@/data/gwangjin-cctv-konkuk.json";
import securityLightSnapshot from "@/data/gwangjin-security-lights-konkuk.json";
import {
  ACTIVE_FACILITIES,
  FACILITY_COVERAGE_AREA,
  FACILITY_COVERAGE_COORDINATES,
  FACILITY_DATASETS,
  GWANGJIN_CCTV_DATASET_ID,
  GWANGJIN_SECURITY_LIGHT_DATASET_ID,
  PUBLIC_CCTV_FACILITIES,
  PUBLIC_SECURITY_LIGHT_FACILITIES,
} from "@/lib/facilities";
import { distanceMeters } from "@/lib/geo";
import { PILOT_CENTER, PILOT_RADIUS_METERS } from "@/lib/places";

test("건국대 스냅샷 메타데이터와 실제 좌표 수가 일치한다", () => {
  assert.equal(PUBLIC_CCTV_FACILITIES.length, cctvSnapshot.selectedRowCount);
  assert.equal(PUBLIC_SECURITY_LIGHT_FACILITIES.length, securityLightSnapshot.selectedFacilityCount);
  assert.equal(ACTIVE_FACILITIES.length, PUBLIC_CCTV_FACILITIES.length + PUBLIC_SECURITY_LIGHT_FACILITIES.length);
  assert.equal(new Set(ACTIVE_FACILITIES.map(f => f.id)).size, ACTIVE_FACILITIES.length);
});

test("모든 시설은 건국대 공통 파일럿 반경 안에 있다", () => {
  assert.deepEqual(FACILITY_COVERAGE_AREA.center, PILOT_CENTER);
  assert.equal(FACILITY_COVERAGE_AREA.radiusMeters, PILOT_RADIUS_METERS);
  const all = [...FACILITY_COVERAGE_COORDINATES.cctv, ...FACILITY_COVERAGE_COORDINATES.securityLights];
  assert.ok(all.length > 0);
  for (const coordinate of all) assert.ok(distanceMeters(PILOT_CENTER, coordinate) <= PILOT_RADIUS_METERS + 0.5);
});

test("광진구 공식 보안등 출처와 WGS84 좌표 계약을 유지한다", () => {
  const dataset = FACILITY_DATASETS.find(item => item.id === GWANGJIN_SECURITY_LIGHT_DATASET_ID);
  assert.equal(dataset?.sourceUrl, "https://www.gwangjin.go.kr/gooddata/orl/sqt/ssqt.do?type=smsl");
  assert.ok(PUBLIC_SECURITY_LIGHT_FACILITIES.every(f => Number.isFinite(f.coordinate.lat) && Number.isFinite(f.coordinate.lng)));
  assert.ok(PUBLIC_SECURITY_LIGHT_FACILITIES.every(f => !("displayOnMap" in f)));
});

test("CCTV는 광진구 공식 설치 현황이고 페이지 개정일을 보존한다", () => {
  const dataset = FACILITY_DATASETS.find(item => item.id === GWANGJIN_CCTV_DATASET_ID);
  assert.equal(dataset?.sourceUrl, "https://www.gwangjin.go.kr/portal/main/contents.do?menuNo=200896");
  assert.deepEqual(cctvSnapshot.filter.acceptedPurposes, ["생활방범", "공원방범", "어린이보호", "다목적"]);
  assert.ok(PUBLIC_CCTV_FACILITIES.length > 0);
  assert.ok(PUBLIC_CCTV_FACILITIES.every(f => f.referenceDate === cctvSnapshot.pageRevisionDate));
});
