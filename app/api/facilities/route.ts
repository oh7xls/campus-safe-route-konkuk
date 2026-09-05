import { NextResponse } from "next/server";
import {
  FACILITY_COVERAGE_AREA,
  FACILITY_SNAPSHOT_GENERATED_AT,
  FACILITY_DATASETS,
  ACTIVE_FACILITIES,
} from "@/lib/facilities";
import {
  MAX_FACILITY_ROUTE_POINTS,
  parseFacilityRoutePoints,
} from "@/lib/facility-request";
import { getRouteFacilities } from "@/lib/route-facilities";
import type { FacilityResponse, RoutePlan } from "@/lib/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "경로 좌표 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

  const points = parseFacilityRoutePoints(body);
  if (!points) {
    return NextResponse.json(
      { message: `경로 좌표는 2개 이상 ${MAX_FACILITY_ROUTE_POINTS.toLocaleString("ko-KR")}개 이하의 올바른 위·경도여야 합니다.` },
      { status: 400 },
    );
  }

  const route: RoutePlan = {
    mode: "tmap",
    source: "시설 필터 요청",
    distanceMeters: 0,
    durationMinutes: 0,
    points,
    generatedAt: "",
    expiresAt: "",
  };
  const facilities = getRouteFacilities(route, ACTIVE_FACILITIES);
  const routeCctvCount = facilities.filter(
    (facility) => facility.kind === "cctv",
  ).length;
  const routeSecurityLightCount = facilities.length - routeCctvCount;
  const checkedAt = new Date().toISOString();
  const payload: FacilityResponse = {
    mode: "public",
    facilities,
    coverageArea: FACILITY_COVERAGE_AREA,
    datasets: FACILITY_DATASETS,
    generatedAt: FACILITY_SNAPSHOT_GENERATED_AT,
    source: {
      status: "ready",
      checkedAt,
      message:
        `경로 주변 CCTV ${routeCctvCount.toLocaleString("ko-KR")}개 · ` +
        `보안등 ${routeSecurityLightCount.toLocaleString("ko-KR")}개`,
      publicCctvCount: routeCctvCount,
      publicSecurityLightLocationCount: routeSecurityLightCount,
    },
    notice:
      "CCTV는 광진구 공식 설치 현황의 생활방범·공원방범·어린이보호·다목적 위치, 보안등은 광진구 빅데이터포털 스마트보안등의 WGS84 위치입니다. 실제 경로에서 각각 70m·35m 이내인 시설만 지도에 표시하며, 이는 실제 촬영·조명 범위나 안전을 보장하지 않습니다.",
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
