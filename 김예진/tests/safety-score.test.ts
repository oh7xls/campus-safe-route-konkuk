import assert from "node:assert/strict";
import test from "node:test";
import { distanceMeters } from "@/lib/geo";
import { calculateSafetyAnalysis, sampleRoute } from "@/lib/safety-score";
import type { Coordinate, RoutePlan, SafetyFacility } from "@/lib/types";

const routeBase: Omit<RoutePlan, "mode" | "points"> = {
  source: "test",
  distanceMeters: 111,
  durationMinutes: 2,
  generatedAt: "2026-08-29T00:00:00.000Z",
  expiresAt: "2026-08-29T00:30:00.000Z",
};

test("경로 표본은 원본 geometry 점 밀도와 무관하게 일정 간격을 유지한다", () => {
  const sparse: Coordinate[] = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.001 },
  ];
  const dense: Coordinate[] = Array.from({ length: 11 }, (_, index) => ({
    lat: 0,
    lng: index * 0.0001,
  }));

  const sparseSamples = sampleRoute(sparse, 20);
  const denseSamples = sampleRoute(dense, 20);

  assert.equal(sparseSamples.length, 7);
  assert.equal(denseSamples.length, sparseSamples.length);
  denseSamples.forEach((sample, index) => {
    assert.ok(Math.abs(sample.lng - sparseSamples[index].lng) < 1e-9);
  });
});

test("0 이하 표본 간격은 기본 20m 간격으로 안전하게 대체한다", () => {
  const points = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.001 },
  ];

  assert.deepEqual(sampleRoute(points, 0), sampleRoute(points, 20));
});

test("같은 경로 geometry의 표본은 진행 방향과 무관하다", () => {
  const points = [
    { lat: 37.54, lng: 127.07 },
    { lat: 37.5404, lng: 127.0703 },
    { lat: 37.5407, lng: 127.0711 },
  ];
  const forward = sampleRoute(points, 20);
  const reverse = sampleRoute([...points].reverse(), 20).reverse();

  assert.equal(forward.length, reverse.length);
  forward.forEach((sample, index) => {
    assert.ok(distanceMeters(sample, reverse[index]) < 0.01);
  });
});

test("데모 경로에는 시설 커버리지 참고지수를 계산하지 않는다", () => {
  const route: RoutePlan = {
    ...routeBase,
    mode: "demo",
    points: [],
  };

  const analysis = calculateSafetyAnalysis(route, []);
  assert.equal(analysis.status, "route-required");
  assert.equal(analysis.score, null);
});

test("실제 경로에는 공개 CCTV와 보안등 근거를 함께 반영한다", () => {
  const route: RoutePlan = {
    ...routeBase,
    mode: "tmap",
    points: [
      { lat: 37.5545, lng: 126.9248 },
      { lat: 37.5545, lng: 126.9258 },
    ],
  };
  const facilities: SafetyFacility[] = [
    {
      id: "cctv-1",
      kind: "cctv",
      name: "테스트 CCTV",
      coordinate: { lat: 37.5545, lng: 126.9253 },
      sourceDatasetId: "test-cctv",
      sourceMode: "public",
    },
    {
      id: "light-1",
      kind: "security-light",
      name: "테스트 보안등",
      coordinate: { lat: 37.5545, lng: 126.9253 },
      sourceDatasetId: "test-light",
      sourceMode: "public",
    },
  ];

  const analysis = calculateSafetyAnalysis(route, facilities);
  assert.equal(analysis.status, "ready");
  assert.equal(analysis.cctvNearRoute, 1);
  assert.equal(analysis.securityLightsNearRoute, 1);
  assert.ok(analysis.sampleCount >= 5);
  assert.ok(analysis.score !== null && analysis.score > 0);
});

test("지도용 상세 시설이 축약돼도 전체 계산 좌표를 사용할 수 있다", () => {
  const route: RoutePlan = {
    ...routeBase,
    mode: "tmap",
    points: [
      { lat: 37.5545, lng: 126.9248 },
      { lat: 37.5545, lng: 126.9258 },
    ],
  };

  const analysis = calculateSafetyAnalysis(route, [], {
    cctv: [{ lat: 37.5545, lng: 126.9253 }],
    securityLights: [{ lat: 37.5545, lng: 126.9253 }],
  });

  assert.equal(analysis.status, "ready");
  assert.equal(analysis.cctvNearRoute, 1);
  assert.equal(analysis.securityLightsNearRoute, 1);
});

test("시설 데이터 범위 밖 경로 표본은 안전지수 계산에서 제외한다", () => {
  const route: RoutePlan = {
    ...routeBase,
    mode: "tmap",
    points: [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
    ],
  };

  const analysis = calculateSafetyAnalysis(
    route,
    [],
    {
      cctv: [{ lat: 0, lng: 0 }],
      securityLights: [{ lat: 0, lng: 0 }],
    },
    {
      center: { lat: 0, lng: 0 },
      radiusMeters: 55,
    },
  );

  assert.equal(analysis.status, "ready");
  assert.equal(analysis.sampleCount, 7);
  assert.equal(analysis.scoredSampleCount, 3);
  assert.equal(analysis.coverageAreaPercent, 43);
  assert.ok(
    analysis.limitations.some((limitation) =>
      limitation.includes("파일럿 반경 밖 구간"),
    ),
  );
});

test("시설 데이터 범위와 전혀 겹치지 않는 경로에는 점수를 만들지 않는다", () => {
  const route: RoutePlan = {
    ...routeBase,
    mode: "tmap",
    points: [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
    ],
  };

  const analysis = calculateSafetyAnalysis(
    route,
    [],
    {
      cctv: [{ lat: 0, lng: 0 }],
      securityLights: [],
    },
    {
      center: { lat: 1, lng: 1 },
      radiusMeters: 10,
    },
  );

  assert.equal(analysis.status, "facility-data-required");
  assert.equal(analysis.score, null);
  assert.equal(analysis.sampleCount, 7);
  assert.equal(analysis.scoredSampleCount, 0);
  assert.equal(analysis.coverageAreaPercent, 0);
});

test("계산 전용 좌표 배열이 비어 있으면 상세 시설 좌표로 안전하게 대체한다", () => {
  const route: RoutePlan = {
    ...routeBase,
    mode: "tmap",
    points: [
      { lat: 37.5545, lng: 126.9248 },
      { lat: 37.5545, lng: 126.9258 },
    ],
  };
  const facilities: SafetyFacility[] = [
    {
      id: "fallback-cctv",
      kind: "cctv",
      name: "상세 CCTV",
      coordinate: { lat: 37.5545, lng: 126.9253 },
      sourceDatasetId: "test-cctv",
      sourceMode: "public",
    },
  ];

  const analysis = calculateSafetyAnalysis(route, facilities, {
    cctv: [],
    securityLights: [],
  });

  assert.equal(analysis.status, "ready");
  assert.equal(analysis.cctvNearRoute, 1);
  assert.ok(analysis.cctvCoveragePercent > 0);
});
