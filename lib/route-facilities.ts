import { distanceMeters } from "@/lib/geo";
import type { Coordinate, FacilityKind, RoutePlan, SafetyFacility } from "@/lib/types";

export const FACILITY_LABEL: Record<FacilityKind, string> = { cctv: "CCTV", "security-light": "보안등" };
// 표시·참고지수의 공통 가정 거리. 실제 촬영/조명 범위가 아닙니다.
export const FACILITY_RADIUS_METERS: Record<FacilityKind, number> = { cctv: 70, "security-light": 35 };

export function distanceToRouteMeters(point: Coordinate, route: Coordinate[]) {
  if (route.length === 0) return Number.POSITIVE_INFINITY;
  if (route.length === 1) return distanceMeters(point, route[0]);
  // 1km 파일럿의 선분을 국소 평면으로 투영합니다. 꼭짓점 사이 시설도 검사합니다.
  const radians = Math.PI / 180;
  const metersPerDegree = 6_371_000 * radians;
  const lngScale = metersPerDegree * Math.cos(point.lat * radians);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1];
    const b = route[index];
    const ax = (a.lng - point.lng) * lngScale;
    const ay = (a.lat - point.lat) * metersPerDegree;
    const dx = (b.lng - a.lng) * lngScale;
    const dy = (b.lat - a.lat) * metersPerDegree;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    nearest = Math.min(nearest, Math.hypot(ax + ratio * dx, ay + ratio * dy));
  }
  return nearest;
}

export function getRouteFacilities(route: RoutePlan | null, facilities: SafetyFacility[]) {
  if (route?.mode !== "tmap" || route.points.length < 2) return [];
  return facilities.filter((facility) =>
    distanceToRouteMeters(facility.coordinate, route.points) <= FACILITY_RADIUS_METERS[facility.kind],
  );
}
