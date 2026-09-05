import assert from "node:assert/strict";
import test from "node:test";
import { PILOT_PLACES } from "@/lib/places";
import { validateRouteRequest } from "@/lib/route-validation";

test("건국대 파일럿의 서로 다른 두 장소는 경로 입력으로 허용한다", () => {
  const result = validateRouteRequest({
    origin: PILOT_PLACES[0],
    destination: PILOT_PLACES[1],
  });

  assert.equal(result.ok, true);
});

test("동일하거나 15m보다 가까운 출발지와 목적지는 거절한다", () => {
  const result = validateRouteRequest({
    origin: PILOT_PLACES[0],
    destination: PILOT_PLACES[0],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /15m 이상/);
});

test("파일럿 반경 밖 장소는 거절한다", () => {
  const result = validateRouteRequest({
    origin: PILOT_PLACES[0],
    destination: {
      ...PILOT_PLACES[1],
      coordinate: { lat: 37.562, lng: 127.073 },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /1\.0km 이내/);
});

test("위·경도 범위를 벗어난 좌표는 거절한다", () => {
  const result = validateRouteRequest({
    origin: {
      ...PILOT_PLACES[0],
      coordinate: { lat: 91, lng: 127.073 },
    },
    destination: PILOT_PLACES[1],
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /위도는 -90~90/);
});
