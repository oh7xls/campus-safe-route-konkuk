import { distanceMeters } from "@/lib/geo";
import type { Place, RoutePlan } from "@/lib/types";

export function buildDemoRoute(
  origin: Pick<Place, "name" | "coordinate">,
  destination: Pick<Place, "name" | "coordinate">,
  notice?: string,
): RoutePlan {
  const straightDistance = distanceMeters(
    origin.coordinate,
    destination.coordinate,
  );
  const distance = Math.max(120, Math.round(straightDistance * 1.23));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  return {
    mode: "demo",
    source: "파일럿 거리·시간 추정",
    distanceMeters: distance,
    durationMinutes: Math.max(2, Math.ceil(distance / 72)),
    // A synthetic line can cut through buildings and be mistaken for a walkable path.
    // Demo fallback therefore exposes estimates only; only TMAP routes carry geometry.
    points: [],
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    notice:
      notice ??
      `${origin.name}에서 ${destination.name}까지의 거리와 시간 추정값입니다. 실제 보행 동선이 아니므로 지도 경로선은 표시하지 않습니다.`,
  };
}
