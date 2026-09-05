import { distanceMeters } from "@/lib/geo";
import { distanceToRouteMeters, FACILITY_RADIUS_METERS } from "@/lib/route-facilities";
import type {
  Coordinate,
  FacilityCoverageArea,
  RoutePlan,
  SafetyAnalysis,
  SafetyFacility,
} from "@/lib/types";

const SAMPLE_INTERVAL_METERS = 20;
const CCTV_COVERAGE_RADIUS_METERS = FACILITY_RADIUS_METERS.cctv;
const SECURITY_LIGHT_COVERAGE_RADIUS_METERS = FACILITY_RADIUS_METERS["security-light"];

function interpolate(from: Coordinate, to: Coordinate, ratio: number) {
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

export function sampleRoute(
  points: Coordinate[],
  intervalMeters = SAMPLE_INTERVAL_METERS,
) {
  if (points.length === 0) return [];

  const safeInterval =
    Number.isFinite(intervalMeters) && intervalMeters > 0
      ? intervalMeters
      : SAMPLE_INTERVAL_METERS;

  const segments = points.slice(1).map((end, index) => ({
    start: points[index],
    end,
    length: distanceMeters(points[index], end),
  })).filter((segment) => segment.length > 0);
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  if (totalLength <= 0) return [points[0]];

  // 남는 짧은 구간을 한쪽 끝에 몰지 않고 전체 경로에 균등 분배한다.
  // 같은 geometry를 역방향으로 조회해도 동일한 위치 집합을 표본으로 쓴다.
  const intervalCount = Math.max(1, Math.ceil(totalLength / safeInterval));
  const samples: Coordinate[] = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;

  for (let sampleIndex = 0; sampleIndex <= intervalCount; sampleIndex += 1) {
    const targetDistance = (totalLength * sampleIndex) / intervalCount;

    while (
      segmentIndex < segments.length - 1 &&
      targetDistance > segmentStartDistance + segments[segmentIndex].length
    ) {
      segmentStartDistance += segments[segmentIndex].length;
      segmentIndex += 1;
    }

    const segment = segments[segmentIndex];
    const ratio = Math.min(
      1,
      Math.max(0, (targetDistance - segmentStartDistance) / segment.length),
    );
    samples.push(interpolate(segment.start, segment.end, ratio));
  }

  return samples;
}

function percentage(matched: number, total: number) {
  return total === 0 ? 0 : Math.round((matched / total) * 100);
}

function coordinatesNearRoute(
  coordinates: Coordinate[],
  points: Coordinate[],
  radiusMeters: number,
) {
  return coordinates.filter((coordinate) =>
    distanceToRouteMeters(coordinate, points) <= radiusMeters,
  );
}

export function calculateSafetyAnalysis(
  route: RoutePlan | null,
  facilities: SafetyFacility[],
  coverageCoordinates?: {
    cctv: Coordinate[];
    securityLights: Coordinate[];
  },
  coverageArea?: FacilityCoverageArea,
): SafetyAnalysis {
  if (route?.mode !== "tmap" || route.points.length < 2) {
    return {
      status: "route-required",
      score: null,
      label: "실제 경로 필요",
      cctvNearRoute: 0,
      securityLightsNearRoute: 0,
      combinedCoveragePercent: 0,
      cctvCoveragePercent: 0,
      securityLightCoveragePercent: 0,
      coverageAreaPercent: 0,
      sampleCount: 0,
      scoredSampleCount: 0,
      reasons: ["TMAP 실제 보행 경로를 조회하면 시설 커버리지를 계산합니다."],
      limitations: ["직선거리나 합성 경로에는 점수를 계산하지 않습니다."],
    };
  }

  const hasCoverageCoordinates =
    (coverageCoordinates?.cctv.length ?? 0) > 0 ||
    (coverageCoordinates?.securityLights.length ?? 0) > 0;

  if (facilities.length === 0 && !hasCoverageCoordinates) {
    return {
      status: "facility-data-required",
      score: null,
      label: "시설 데이터 필요",
      cctvNearRoute: 0,
      securityLightsNearRoute: 0,
      combinedCoveragePercent: 0,
      cctvCoveragePercent: 0,
      securityLightCoveragePercent: 0,
      coverageAreaPercent: 0,
      sampleCount: 0,
      scoredSampleCount: 0,
      reasons: ["경로 주변 시설 데이터를 불러오지 못했습니다."],
      limitations: ["시설 데이터가 복구된 뒤 다시 계산해 주세요."],
    };
  }

  const routeSamples = sampleRoute(route.points);
  const samples = coverageArea
    ? routeSamples.filter(
        (sample) =>
          distanceMeters(sample, coverageArea.center) <=
          coverageArea.radiusMeters,
      )
    : routeSamples;
  const coverageAreaPercent = percentage(samples.length, routeSamples.length);

  if (samples.length === 0) {
    return {
      status: "facility-data-required",
      score: null,
      label: "시설 데이터 범위 밖",
      cctvNearRoute: 0,
      securityLightsNearRoute: 0,
      combinedCoveragePercent: 0,
      cctvCoveragePercent: 0,
      securityLightCoveragePercent: 0,
      coverageAreaPercent,
      sampleCount: routeSamples.length,
      scoredSampleCount: 0,
      reasons: ["조회한 경로가 현재 시설 데이터 제공 범위와 겹치지 않습니다."],
      limitations: [
        "파일럿 반경 밖 구간을 시설이 없는 구간으로 오인하지 않도록 참고지수를 계산하지 않았습니다.",
      ],
    };
  }
  const publicFacilities = facilities.filter(
    (facility) => facility.sourceMode === "public",
  );
  const scoringFacilities =
    publicFacilities.length > 0 ? publicFacilities : facilities;
  const usesPublicData = hasCoverageCoordinates || publicFacilities.length > 0;
  const detailedCctv = scoringFacilities
    .filter((facility) => facility.kind === "cctv")
    .map((facility) => facility.coordinate);
  const detailedLights = scoringFacilities
    .filter((facility) => facility.kind === "security-light")
    .map((facility) => facility.coordinate);
  const cctv =
    coverageCoordinates && coverageCoordinates.cctv.length > 0
      ? coverageCoordinates.cctv
      : detailedCctv;
  const lights =
    coverageCoordinates && coverageCoordinates.securityLights.length > 0
      ? coverageCoordinates.securityLights
      : detailedLights;

  let cctvCovered = 0;
  let lightCovered = 0;
  let combinedCovered = 0;

  for (const sample of samples) {
    const hasCctv = cctv.some(
      (coordinate) =>
        distanceMeters(sample, coordinate) <= CCTV_COVERAGE_RADIUS_METERS,
    );
    const hasLight = lights.some(
      (coordinate) =>
        distanceMeters(sample, coordinate) <=
        SECURITY_LIGHT_COVERAGE_RADIUS_METERS,
    );

    if (hasCctv) cctvCovered += 1;
    if (hasLight) lightCovered += 1;
    if (hasCctv || hasLight) combinedCovered += 1;
  }

  const cctvCoveragePercent = percentage(cctvCovered, samples.length);
  const securityLightCoveragePercent = percentage(lightCovered, samples.length);
  const combinedCoveragePercent = percentage(combinedCovered, samples.length);
  const score =
    cctv.length > 0 && lights.length > 0
      ? Math.round(
          combinedCoveragePercent * 0.5 +
            cctvCoveragePercent * 0.25 +
            securityLightCoveragePercent * 0.25,
        )
      : cctv.length > 0
        ? cctvCoveragePercent
        : securityLightCoveragePercent;
  const nearbyCctv = coordinatesNearRoute(
    cctv,
    route.points,
    CCTV_COVERAGE_RADIUS_METERS,
  ).length;
  const nearbyLights = coordinatesNearRoute(
    lights,
    route.points,
    SECURITY_LIGHT_COVERAGE_RADIUS_METERS,
  ).length;

  return {
    status: "ready",
    score,
    label:
      score >= 80
        ? `${lights.length > 0 ? "시설" : "CCTV"} 커버리지 높음`
        : score >= 55
          ? `${lights.length > 0 ? "시설" : "CCTV"} 커버리지 보통`
          : `${lights.length > 0 ? "시설" : "CCTV"} 커버리지 낮음`,
    cctvNearRoute: nearbyCctv,
    securityLightsNearRoute: nearbyLights,
    combinedCoveragePercent,
    cctvCoveragePercent,
    securityLightCoveragePercent,
    coverageAreaPercent,
    sampleCount: routeSamples.length,
    scoredSampleCount: samples.length,
    reasons: [
      lights.length > 0
        ? `시설 데이터 범위 안의 약 ${SAMPLE_INTERVAL_METERS}m 간격 ${samples.length}개 지점 중 ${combinedCoveragePercent}%가 CCTV 또는 보안등 영향권에 있습니다.`
        : `시설 데이터 범위 안의 약 ${SAMPLE_INTERVAL_METERS}m 간격 ${samples.length}개 지점 중 ${cctvCoveragePercent}%가 공개 CCTV 위치의 가정 영향권에 있습니다.`,
      lights.length > 0
        ? `경로 주변 CCTV ${nearbyCctv}개, 보안등 ${nearbyLights}개를 근거로 계산했습니다.`
        : `경로 주변 공개 CCTV ${nearbyCctv}개를 근거로 계산했으며 보안등 데이터는 현재 응답에 없습니다.`,
      ...(coverageAreaPercent < 100
        ? [
            `전체 경로 표본 ${routeSamples.length}개 중 시설 데이터 범위에 포함된 ${samples.length}개(${coverageAreaPercent}%)만 계산했습니다.`,
          ]
        : []),
    ],
    limitations: [
      lights.length > 0
        ? `CCTV ${CCTV_COVERAGE_RADIUS_METERS}m·보안등 ${SECURITY_LIGHT_COVERAGE_RADIUS_METERS}m를 단순 영향 반경으로 가정한 참고지수입니다.`
        : `CCTV 위치에서 ${CCTV_COVERAGE_RADIUS_METERS}m를 단순 영향 반경으로 가정한 참고지수입니다.`,
      usesPublicData
        ? "공개 데이터는 설치 위치만 나타내며 실시간 작동 여부, 촬영 사각지대, 조도와 실제 안전을 보장하지 않습니다."
        : "현재 시설 좌표는 기능 검증용 시연 데이터이며 실제 안전이나 범죄 가능성을 의미하지 않습니다.",
      ...(usesPublicData && lights.length === 0
        ? ["보안등 데이터가 누락된 응답에서는 CCTV 영향권만으로 참고지수를 계산합니다."]
        : []),
      ...(coverageAreaPercent < 100
        ? ["파일럿 반경 밖 구간은 시설 데이터가 없어 참고지수에서 제외했습니다."]
        : []),
    ],
  };
}
