import type { Coordinate } from "@/lib/types";

export const MAX_FACILITY_ROUTE_POINTS = 2_000;

export function parseFacilityRoutePoints(value: unknown): Coordinate[] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("points" in value) ||
    !Array.isArray(value.points) ||
    value.points.length < 2 ||
    value.points.length > MAX_FACILITY_ROUTE_POINTS
  ) {
    return null;
  }

  const points = value.points.filter(
    (point): point is Coordinate =>
      typeof point === "object" &&
      point !== null &&
      "lat" in point &&
      "lng" in point &&
      typeof point.lat === "number" &&
      Number.isFinite(point.lat) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      typeof point.lng === "number" &&
      Number.isFinite(point.lng) &&
      point.lng >= -180 &&
      point.lng <= 180,
  );

  return points.length === value.points.length ? points : null;
}
