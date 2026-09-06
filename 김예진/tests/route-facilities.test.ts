import assert from "node:assert/strict";
import test from "node:test";
import { distanceToRouteMeters, getRouteFacilities } from "@/lib/route-facilities";
import { calculateSafetyAnalysis } from "@/lib/safety-score";
import type { RoutePlan, SafetyFacility } from "@/lib/types";

const route: RoutePlan = {
  mode: "tmap", source: "test", distanceMeters: 1000, durationMinutes: 15,
  generatedAt: "2026-09-05T00:00:00Z", expiresAt: "2026-09-05T01:00:00Z",
  points: [{ lat: 37.542, lng: 127.069 }, { lat: 37.542, lng: 127.079 }],
};
function facility(id: string, kind: SafetyFacility["kind"], offsetMeters: number): SafetyFacility {
  return { id, kind, name: id, coordinate: { lat: 37.542 + offsetMeters / 111195, lng: 127.074 }, sourceDatasetId: "test", sourceMode: "public" };
}
const facilities = [facility("cctv-near", "cctv", 69), facility("cctv-far", "cctv", 71), facility("light-near", "security-light", 34), facility("light-far", "security-light", 36)];

test("초기 화면·데모·불완전 경로에는 시설이 하나도 표시되지 않는다", () => {
  assert.deepEqual(getRouteFacilities(null, facilities), []);
  assert.deepEqual(getRouteFacilities({ ...route, mode: "demo" }, facilities), []);
  assert.deepEqual(getRouteFacilities({ ...route, points: [route.points[0]] }, facilities), []);
});
test("출발·도착점에서 멀어도 경로 선분의 70m/35m 이내 시설만 표시한다", () => {
  assert.deepEqual(getRouteFacilities(route, facilities).map(f => f.id), ["cctv-near", "light-near"]);
  assert.ok(distanceToRouteMeters(facilities[0].coordinate, route.points) < 70);
});
test("역방향 경로의 시설은 같고 경로를 변경하면 이전 시설은 남지 않는다", () => {
  assert.deepEqual(getRouteFacilities({ ...route, points: [...route.points].reverse() }, facilities), getRouteFacilities(route, facilities));
  assert.deepEqual(getRouteFacilities({ ...route, points: route.points.map(p => ({...p, lat: p.lat + 0.01})) }, facilities), []);
});
test("동일한 꼭짓점과 빈 경로를 처리하고 선분 연장선의 먼 시설은 제외한다", () => {
  assert.equal(distanceToRouteMeters(route.points[0], []), Infinity);
  assert.equal(distanceToRouteMeters(route.points[0], [route.points[0], route.points[0]]), 0);
  assert.ok(distanceToRouteMeters({lat:37.542,lng:127.09}, route.points) > 900);
});
test("시설 카드와 참고지수의 주변 시설 개수가 일치한다", () => {
  const shown = getRouteFacilities(route, facilities);
  const analysis = calculateSafetyAnalysis(route, facilities);
  assert.equal(analysis.cctvNearRoute, shown.filter(f=>f.kind === "cctv").length);
  assert.equal(analysis.securityLightsNearRoute, shown.filter(f=>f.kind === "security-light").length);
});
