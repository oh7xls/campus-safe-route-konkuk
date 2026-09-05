import { NextResponse } from "next/server";
import { buildDemoRoute } from "@/lib/demo-route";
import { validateRouteRequest } from "@/lib/route-validation";
import type { Coordinate, RoutePlan } from "@/lib/types";

type TmapFeature = {
  geometry?: {
    type?: string;
    coordinates?: number[] | number[][];
  };
  properties?: {
    totalDistance?: number;
    totalTime?: number;
  };
};

type TmapRoutePayload = {
  features?: TmapFeature[];
};

function parseTmapRoute(payload: TmapRoutePayload): RoutePlan | null {
  const features = payload.features ?? [];
  const summary = features.find(
    (feature) => feature.properties?.totalDistance !== undefined,
  )?.properties;

  const points = features.flatMap((feature) => {
    if (feature.geometry?.type !== "LineString") {
      return [];
    }

    const coordinates = feature.geometry.coordinates as number[][] | undefined;
    return (coordinates ?? []).flatMap<Coordinate>((coordinate) => {
      const [lng, lat] = coordinate;
      return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
    });
  });

  if (!summary?.totalDistance || !summary.totalTime || points.length < 2) {
    return null;
  }

  const now = new Date();
  return {
    mode: "tmap",
    source: "TMAP 보행자 경로",
    distanceMeters: Math.round(summary.totalDistance),
    durationMinutes: Math.max(1, Math.ceil(summary.totalTime / 60)),
    points,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_ROUTE_INPUT", message: "요청 내용을 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const validation = validateRouteRequest(body);
  if (!validation.ok) {
    return NextResponse.json(
      { code: "INVALID_ROUTE_INPUT", message: validation.message },
      { status: 400 },
    );
  }

  const { origin, destination } = validation.value;
  const appKey = process.env.TMAP_API_KEY;

  if (!appKey) {
    return NextResponse.json(
      buildDemoRoute(
        origin,
        destination,
        "TMAP 키가 없어 실제 경로선 대신 거리·시간 데모 추정값만 제공합니다.",
      ),
    );
  }

  try {
    const result = await fetch(
      "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json",
      {
        method: "POST",
        headers: {
          appKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startX: String(origin.coordinate.lng),
          startY: String(origin.coordinate.lat),
          endX: String(destination.coordinate.lng),
          endY: String(destination.coordinate.lat),
          startName: encodeURIComponent(origin.name),
          endName: encodeURIComponent(destination.name),
          reqCoordType: "WGS84GEO",
          resCoordType: "WGS84GEO",
          searchOption: "0",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!result.ok) {
      throw new Error(`TMAP route returned ${result.status}`);
    }

    const route = parseTmapRoute((await result.json()) as TmapRoutePayload);
    if (!route) {
      throw new Error("TMAP route payload was incomplete");
    }

    return NextResponse.json(route);
  } catch {
    const fallback = buildDemoRoute(
      origin,
      destination,
      "TMAP 경로 서비스에 연결하지 못해 거리·시간 데모 추정값만 제공합니다.",
    );

    return NextResponse.json(
      {
        code: "TMAP_ROUTE_UNAVAILABLE",
        message:
          "TMAP 보행 경로를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        fallback,
      },
      { status: 502 },
    );
  }
}
