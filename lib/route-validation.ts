import { distanceMeters } from "@/lib/geo";
import {
  PILOT_AREA_LABEL,
  PILOT_CENTER,
  PILOT_RADIUS_METERS,
} from "@/lib/places";
import type { Place } from "@/lib/types";

export const MIN_ROUTE_DISTANCE_METERS = 15;

export type ValidatedRouteRequest = {
  origin: Place;
  destination: Place;
};

export type RouteValidationResult =
  | { ok: true; value: ValidatedRouteRequest }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validatePlace(value: unknown, label: "출발지" | "목적지") {
  if (!isRecord(value)) {
    return { ok: false as const, message: `${label}를 선택해 주세요.` };
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) {
    return { ok: false as const, message: `${label} 이름을 확인해 주세요.` };
  }

  if (!isRecord(value.coordinate)) {
    return { ok: false as const, message: `${label} 좌표를 확인해 주세요.` };
  }

  const lat = value.coordinate.lat;
  const lng = value.coordinate.lng;

  if (typeof lat !== "number" || !Number.isFinite(lat)) {
    return { ok: false as const, message: `${label} 위도가 올바르지 않습니다.` };
  }

  if (lat < -90 || lat > 90) {
    return {
      ok: false as const,
      message: `${label} 위도는 -90~90 범위여야 합니다.`,
    };
  }

  if (typeof lng !== "number" || !Number.isFinite(lng)) {
    return { ok: false as const, message: `${label} 경도가 올바르지 않습니다.` };
  }

  if (lng < -180 || lng > 180) {
    return {
      ok: false as const,
      message: `${label} 경도는 -180~180 범위여야 합니다.`,
    };
  }

  const coordinate = { lat, lng };
  if (distanceMeters(PILOT_CENTER, coordinate) > PILOT_RADIUS_METERS) {
    return {
      ok: false as const,
      message: `${label}는 ${PILOT_AREA_LABEL} 파일럿 중심에서 ${(PILOT_RADIUS_METERS / 1_000).toFixed(1)}km 이내여야 합니다.`,
    };
  }

  const id = typeof value.id === "string" && value.id ? value.id : name;
  const address = typeof value.address === "string" ? value.address : "";
  const source = value.source === "tmap" ? "tmap" : "pilot";

  return {
    ok: true as const,
    value: { id, name, address, coordinate, source } satisfies Place,
  };
}

export function validateRouteRequest(value: unknown): RouteValidationResult {
  if (!isRecord(value)) {
    return { ok: false, message: "요청 내용을 확인해 주세요." };
  }

  const originResult = validatePlace(value.origin, "출발지");
  if (!originResult.ok) return originResult;

  const destinationResult = validatePlace(value.destination, "목적지");
  if (!destinationResult.ok) return destinationResult;

  const endpointDistance = distanceMeters(
    originResult.value.coordinate,
    destinationResult.value.coordinate,
  );

  if (endpointDistance < MIN_ROUTE_DISTANCE_METERS) {
    return {
      ok: false,
      message: `출발지와 목적지는 ${MIN_ROUTE_DISTANCE_METERS}m 이상 떨어진 장소로 선택해 주세요.`,
    };
  }

  return {
    ok: true,
    value: {
      origin: originResult.value,
      destination: destinationResult.value,
    },
  };
}
