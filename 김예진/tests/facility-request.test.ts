import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FACILITY_ROUTE_POINTS,
  parseFacilityRoutePoints,
} from "@/lib/facility-request";

test("시설 필터 요청은 2개 이상의 올바른 경로 좌표를 허용한다", () => {
  const points = [
    { lat: 37.54, lng: 127.07 },
    { lat: 37.55, lng: 127.08 },
  ];
  assert.deepEqual(parseFacilityRoutePoints({ points }), points);
});

test("시설 필터 요청은 불완전하거나 범위를 벗어난 좌표를 거절한다", () => {
  assert.equal(parseFacilityRoutePoints({ points: [{ lat: 37.54, lng: 127.07 }] }), null);
  assert.equal(
    parseFacilityRoutePoints({
      points: [
        { lat: 37.54, lng: 127.07 },
        { lat: 91, lng: 127.08 },
      ],
    }),
    null,
  );
  assert.equal(parseFacilityRoutePoints({ points: "not-an-array" }), null);
});

test("시설 필터 요청의 경로 좌표 수를 제한한다", () => {
  const point = { lat: 37.54, lng: 127.07 };
  assert.equal(
    parseFacilityRoutePoints({
      points: Array.from({ length: MAX_FACILITY_ROUTE_POINTS + 1 }, () => point),
    }),
    null,
  );
});
