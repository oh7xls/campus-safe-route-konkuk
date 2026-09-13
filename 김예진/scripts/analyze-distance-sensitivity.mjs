import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = process.argv[2];
const delivery = JSON.parse(
  await readFile(new URL("../data/processed/safety-facilities-v1.json", import.meta.url), "utf8"),
);
const facilities = delivery.facilities;
const routeInput = inputPath
  ? JSON.parse(await readFile(path.resolve(inputPath), "utf8"))
  : null;
const routes = routeInput ? readRoutes(routeInput) : proxyRoutes();
const analysisBasis = inputPath
  ? "provided-route-geometry"
  : "pilot-place-straight-line-proxy";
const cctvRadii = [50, 70, 100];
const securityLightRadii = [20, 35, 50];
const combinations = [];

for (const route of routes) {
  const samples = sampleRoute(route.points, 20);
  const routeDistanceMeters = routeLength(route.points);
  for (const cctvRadiusMeters of cctvRadii) {
    for (const securityLightRadiusMeters of securityLightRadii) {
      const nearbyCctv = facilities.filter(
        (facility) =>
          facility.type === "cctv" &&
          distanceToRouteMeters(facility, route.points) <= cctvRadiusMeters,
      ).length;
      const nearbySecurityLights = facilities.filter(
        (facility) =>
          facility.type === "security_light" &&
          distanceToRouteMeters(facility, route.points) <= securityLightRadiusMeters,
      ).length;
      let cctvCovered = 0;
      let securityLightCovered = 0;
      let combinedCovered = 0;
      for (const sample of samples) {
        const hasCctv = facilities.some(
          (facility) =>
            facility.type === "cctv" &&
            distanceMeters(sample, facility) <= cctvRadiusMeters,
        );
        const hasSecurityLight = facilities.some(
          (facility) =>
            facility.type === "security_light" &&
            distanceMeters(sample, facility) <= securityLightRadiusMeters,
        );
        if (hasCctv) cctvCovered += 1;
        if (hasSecurityLight) securityLightCovered += 1;
        if (hasCctv || hasSecurityLight) combinedCovered += 1;
      }
      combinations.push({
        routeId: route.id,
        routeName: route.name,
        routeDistanceMeters: Math.round(routeDistanceMeters),
        sampleCount: samples.length,
        cctvRadiusMeters,
        securityLightRadiusMeters,
        nearbyCctv,
        nearbySecurityLights,
        cctvCoveredSampleCount: cctvCovered,
        securityLightCoveredSampleCount: securityLightCovered,
        combinedCoveredSampleCount: combinedCovered,
        cctvCoveragePercent: percent(cctvCovered, samples.length),
        securityLightCoveragePercent: percent(
          securityLightCovered,
          samples.length,
        ),
        combinedCoveragePercent: percent(combinedCovered, samples.length),
      });
    }
  }
}

const summary = [];
for (const cctvRadiusMeters of cctvRadii) {
  for (const securityLightRadiusMeters of securityLightRadii) {
    const rows = combinations.filter(
      (row) =>
        row.cctvRadiusMeters === cctvRadiusMeters &&
        row.securityLightRadiusMeters === securityLightRadiusMeters,
    );
    const totalSampleCount = sum(rows.map((row) => row.sampleCount));
    summary.push({
      cctvRadiusMeters,
      securityLightRadiusMeters,
      averageNearbyCctv: average(rows.map((row) => row.nearbyCctv)),
      averageNearbySecurityLights: average(
        rows.map((row) => row.nearbySecurityLights),
      ),
      averageCctvCoveragePercent: average(
        rows.map((row) => row.cctvCoveragePercent),
      ),
      averageSecurityLightCoveragePercent: average(
        rows.map((row) => row.securityLightCoveragePercent),
      ),
      averageCombinedCoveragePercent: average(
        rows.map((row) => row.combinedCoveragePercent),
      ),
      totalSampleCount,
      weightedCctvCoveragePercent: percent(
        sum(rows.map((row) => row.cctvCoveredSampleCount)),
        totalSampleCount,
      ),
      weightedSecurityLightCoveragePercent: percent(
        sum(rows.map((row) => row.securityLightCoveredSampleCount)),
        totalSampleCount,
      ),
      weightedCombinedCoveragePercent: percent(
        sum(rows.map((row) => row.combinedCoveredSampleCount)),
        totalSampleCount,
      ),
    });
  }
}

const report = {
  schemaVersion: "1.0.0",
  generatedAt: deterministicGeneratedAt(delivery.generatedAt, routeInput?.generatedAt),
  analysisBasis,
  baseline: { cctvRadiusMeters: 70, securityLightRadiusMeters: 35 },
  routeCount: routes.length,
  facilityCount: facilities.length,
  routes,
  summary,
  combinations,
  limitations: [
    inputPath
      ? "전달받은 경로 좌표를 사용했으며 경로 출처와 정확도는 입력 파일에 의존합니다."
      : "현재 결과는 파일럿 장소 사이 직선 대리경로를 사용한 예비 분석이며 실제 보행 경로 결론이 아닙니다.",
    "반경이 커질수록 커버리지가 증가하는 것은 계산상 당연하므로 가장 높은 수치를 안전성 근거로 선택하지 않습니다.",
    "대표 결과는 모든 경로 표본을 합산한 가중 커버리지이며, 경로별 단순 평균은 비교용으로만 제공합니다.",
    "CCTV와 보안등 반경은 실제 촬영·조명 범위가 아니라 비교용 분석 기준입니다.",
  ],
};

const outputDirectory = new URL("../data/analysis/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    new URL("distance-sensitivity.json", outputDirectory),
    `${JSON.stringify(report, null, 2)}\n`,
  ),
  writeFile(
    new URL("distance-sensitivity.csv", outputDirectory),
    toCsv(combinations),
  ),
]);
console.log(
  `거리 기준 ${cctvRadii.length * securityLightRadii.length}조합 × ${routes.length}경로 분석 완료 (${analysisBasis})`,
);

function readRoutes(input) {
  if (input === null || typeof input !== "object") {
    throw new Error("경로 입력은 경로 객체 또는 routes 배열이어야 합니다.");
  }
  const routesFromInput = Array.isArray(input) ? input : input.routes ?? [input];
  if (!Array.isArray(routesFromInput) || routesFromInput.length === 0) {
    throw new Error("분석할 경로가 한 개 이상 필요합니다.");
  }
  const routeIds = new Set();
  for (const route of routesFromInput) {
    if (
      typeof route.id !== "string" ||
      !route.id.trim() ||
      typeof route.name !== "string" ||
      !route.name.trim() ||
      !Array.isArray(route.points) ||
      route.points.length < 2
    ) {
      throw new Error("경로 입력은 id, name, 2개 이상의 points가 필요합니다.");
    }
    if (routeIds.has(route.id)) {
      throw new Error(`중복 경로 ID가 있습니다: ${route.id}`);
    }
    routeIds.add(route.id);
    for (const point of route.points) {
      if (
        !Number.isFinite(point.lat) ||
        point.lat < -90 ||
        point.lat > 90 ||
        !Number.isFinite(point.lng) ||
        point.lng < -180 ||
        point.lng > 180
      ) {
        throw new Error(`${route.id} 경로에 올바르지 않은 좌표가 있습니다.`);
      }
    }
    if (routeLength(route.points) < 1) {
      throw new Error(`${route.id} 경로의 전체 길이가 1m 미만입니다.`);
    }
  }
  return routesFromInput;
}

function proxyRoutes() {
  const place = {
    station: { lat: 37.54012558, lng: 127.07045784 },
    sangheo: { lat: 37.53948681, lng: 127.07259655 },
    geonguk: { lat: 37.54518066, lng: 127.07656825 },
    foodStreet: { lat: 37.54270851, lng: 127.06443054 },
    childrenPark: { lat: 37.54704152, lng: 127.07448505 },
    ilgam: { lat: 37.53895912, lng: 127.07429086 },
  };
  return [
    { id: "station-sangheo", name: "건대입구역 2번 출구 → 상허문", points: [place.station, place.sangheo] },
    { id: "station-geonguk", name: "건대입구역 2번 출구 → 건국문", points: [place.station, place.geonguk] },
    { id: "children-geonguk", name: "어린이대공원역 3번 출구 → 건국문", points: [place.childrenPark, place.geonguk] },
    { id: "food-sangheo", name: "건대맛의거리 → 상허문", points: [place.foodStreet, place.sangheo] },
    { id: "ilgam-geonguk", name: "일감문 → 건국문", points: [place.ilgam, place.geonguk] },
  ];
}

function routeLength(points) {
  return points.slice(1).reduce(
    (sum, point, index) => sum + distanceMeters(points[index], point),
    0,
  );
}

function sampleRoute(points, intervalMeters) {
  const segments = points.slice(1).map((end, index) => ({
    start: points[index],
    end,
    length: distanceMeters(points[index], end),
  })).filter((segment) => segment.length > 0);
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength === 0) return [points[0]];
  const intervalCount = Math.max(1, Math.ceil(totalLength / intervalMeters));
  const samples = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;
  for (let index = 0; index <= intervalCount; index += 1) {
    const target = (totalLength * index) / intervalCount;
    while (
      segmentIndex < segments.length - 1 &&
      target > segmentStartDistance + segments[segmentIndex].length
    ) {
      segmentStartDistance += segments[segmentIndex].length;
      segmentIndex += 1;
    }
    const segment = segments[segmentIndex];
    const ratio = Math.min(1, Math.max(0, (target - segmentStartDistance) / segment.length));
    samples.push({
      lat: segment.start.lat + (segment.end.lat - segment.start.lat) * ratio,
      lng: segment.start.lng + (segment.end.lng - segment.start.lng) * ratio,
    });
  }
  return samples;
}

function distanceMeters(left, right) {
  const leftLat = left.lat ?? left.latitude;
  const leftLng = left.lng ?? left.longitude;
  const rightLat = right.lat ?? right.latitude;
  const rightLng = right.lng ?? right.longitude;
  const radians = Math.PI / 180;
  const latDelta = (rightLat - leftLat) * radians;
  const lngDelta = (rightLng - leftLng) * radians;
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat * radians) *
      Math.cos(rightLat * radians) *
      Math.sin(lngDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value));
}

function distanceToRouteMeters(facility, points) {
  const point = { lat: facility.latitude, lng: facility.longitude };
  const radians = Math.PI / 180;
  const metersPerDegree = 6_371_000 * radians;
  const lngScale = metersPerDegree * Math.cos(point.lat * radians);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const ax = (start.lng - point.lng) * lngScale;
    const ay = (start.lat - point.lat) * metersPerDegree;
    const dx = (end.lng - start.lng) * lngScale;
    const dy = (end.lat - start.lat) * metersPerDegree;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    nearest = Math.min(nearest, Math.hypot(ax + ratio * dx, ay + ratio * dy));
  }
  return nearest;
}

function percent(value, total) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function average(values) {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function deterministicGeneratedAt(deliveryGeneratedAt, routeGeneratedAt) {
  const values = [deliveryGeneratedAt, routeGeneratedAt].filter(Boolean);
  if (values.some((value) => Number.isNaN(Date.parse(value)))) {
    throw new Error("분석 입력의 generatedAt 값이 올바르지 않습니다.");
  }
  return new Date(Math.max(...values.map((value) => Date.parse(value)))).toISOString();
}

function csv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const columns = Object.keys(rows[0]);
  return `${[columns.join(","), ...rows.map((row) => columns.map((key) => csv(row[key])).join(","))].join("\n")}\n`;
}
