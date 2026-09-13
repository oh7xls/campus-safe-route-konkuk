import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { distanceMeters } from "@/lib/geo";

const delivery = JSON.parse(
  readFileSync("data/processed/safety-facilities-v1.json", "utf8"),
);
const geoJson = JSON.parse(
  readFileSync("data/processed/safety-facilities-v1.geojson", "utf8"),
);
const quality = JSON.parse(
  readFileSync("data/processed/data-quality-report.json", "utf8"),
);
const csv = readFileSync("data/processed/safety-facilities-v1.csv", "utf8");
const postgisCsv = readFileSync(
  "data/processed/safety-facilities-postgis.csv",
  "utf8",
);
const datasetCsv = readFileSync(
  "data/processed/facility-datasets-postgis.csv",
  "utf8",
);
const sensitivity = JSON.parse(
  readFileSync("data/analysis/distance-sensitivity.json", "utf8"),
);
const validationSample = JSON.parse(
  readFileSync("data/qa/facility-validation-sample.json", "utf8"),
);
const migration = readFileSync(
  "supabase/migrations/202609130001_create_safety_facilities.sql",
  "utf8",
);
const importScript = readFileSync("supabase/import-safety-facilities.psql", "utf8");
const checksumManifest = readFileSync("data/processed/CHECKSUMS.sha256", "utf8");

test("SafetyFacility v1 전달 데이터는 필수 규격과 건국대 범위를 만족한다", () => {
  assert.equal(delivery.schemaVersion, "1.0.0");
  assert.ok(delivery.facilities.length > 0);
  assert.equal(
    new Set(delivery.facilities.map((item: { id: string }) => item.id)).size,
    delivery.facilities.length,
  );

  for (const facility of delivery.facilities) {
    assert.ok(["cctv", "security_light"].includes(facility.type));
    assert.ok(facility.id && facility.name && facility.sourceDatasetId);
    assert.ok(Number.isFinite(facility.latitude));
    assert.ok(Number.isFinite(facility.longitude));
    assert.ok(!Number.isNaN(Date.parse(facility.collectedAt)));
    assert.ok(
      distanceMeters(
        { lat: 37.542, lng: 127.073 },
        { lat: facility.latitude, lng: facility.longitude },
      ) <= 1000.5,
    );
  }
});

test("GeoJSON은 경도·위도 순서를 지키고 JSON 전달 데이터와 일치한다", () => {
  assert.equal(geoJson.type, "FeatureCollection");
  assert.equal("crs" in geoJson, false);
  assert.equal(geoJson.features.length, delivery.facilities.length);
  for (let index = 0; index < delivery.facilities.length; index += 1) {
    const facility = delivery.facilities[index];
    const feature = geoJson.features[index];
    assert.equal(feature.id, facility.id);
    assert.deepEqual(feature.geometry.coordinates, [
      facility.longitude,
      facility.latitude,
    ]);
  }
});

test("CSV와 품질 보고서의 시설 개수가 전달 데이터와 일치한다", () => {
  const nonEmptyLines = csv.split(/\r?\n/).filter(Boolean);
  assert.equal(nonEmptyLines.length, delivery.facilities.length + 1);
  assert.equal(quality.summary.selectedRecordCount, delivery.facilities.length);
  assert.equal(quality.checks.fatalIssueCount, 0);
  assert.equal(quality.generatedAt, delivery.generatedAt);
  assert.equal(
    delivery.facilities.filter(
      (facility: { address: string | null }) => facility.address === null,
    ).length,
    quality.missingOptionalValues.address,
  );
  assert.ok(
    delivery.facilities.every(
      (facility: { address: string | null }) => facility.address !== "-",
    ),
  );
});

test("전달 파일 체크섬이 실제 SHA-256과 일치한다", () => {
  const entries = checksumManifest.trim().split(/\r?\n/);
  assert.equal(entries.length, 6);
  for (const entry of entries) {
    const match = entry.match(/^([0-9a-f]{64}) {2}(.+)$/);
    assert.ok(match, `잘못된 체크섬 행: ${entry}`);
    const [, expected, fileName] = match;
    const actual = createHash("sha256")
      .update(readFileSync(`data/processed/${fileName}`))
      .digest("hex");
    assert.equal(actual, expected, fileName);
  }
});

test("PostGIS 적재 CSV와 마이그레이션이 공간검색 계약을 유지한다", () => {
  assert.equal(
    postgisCsv.split(/\r?\n/).filter(Boolean).length,
    delivery.facilities.length + 1,
  );
  assert.equal(datasetCsv.split(/\r?\n/).filter(Boolean).length, 3);
  assert.match(postgisCsv.split(/\r?\n/, 1)[0], /facility_type/);
  assert.match(migration, /geography\(POINT, 4326\)/);
  assert.match(migration, /using gist \(location\)/i);
  assert.match(migration, /nearby_safety_facilities/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /grant select on table public\.facility_datasets/i);
  assert.doesNotMatch(migration, /st_point\(query_longitude/i);
  assert.match(migration, /st_setsrid\([\s\S]*query_longitude[\s\S]*4326/i);
  assert.match(importScript, /delete from public\.safety_facilities/i);
});

test("거리 민감도 분석은 9개 반경 조합을 모든 대표 경로에 적용한다", () => {
  assert.equal(sensitivity.summary.length, 9);
  assert.equal(
    sensitivity.combinations.length,
    sensitivity.routeCount * sensitivity.summary.length,
  );
  assert.deepEqual(sensitivity.baseline, {
    cctvRadiusMeters: 70,
    securityLightRadiusMeters: 35,
  });
  for (const row of sensitivity.combinations) {
    assert.ok(row.combinedCoveragePercent >= 0);
    assert.ok(row.combinedCoveragePercent <= 100);
    assert.ok(row.combinedCoveredSampleCount <= row.sampleCount);
  }
  for (const row of sensitivity.summary) {
    assert.ok(row.totalSampleCount > 0);
    assert.ok(row.weightedCombinedCoveragePercent >= 0);
    assert.ok(row.weightedCombinedCoveragePercent <= 100);
  }
  assert.equal(sensitivity.generatedAt, delivery.generatedAt);
});

test("지도·현장 표본은 종류별 10개이며 아직 검증 완료로 표시하지 않는다", () => {
  assert.equal(validationSample.sampleCount, 20);
  assert.equal(
    validationSample.samples.filter(
      (item: { type: string }) => item.type === "cctv",
    ).length,
    10,
  );
  assert.equal(
    validationSample.samples.filter(
      (item: { type: string }) => item.type === "security_light",
    ).length,
    10,
  );
  assert.ok(
    validationSample.samples.every(
      (item: { mapVerificationStatus: string; fieldVerificationStatus: string }) =>
        item.mapVerificationStatus === "not_checked" &&
        item.fieldVerificationStatus === "not_checked",
    ),
  );
  assert.equal(validationSample.generatedAt, delivery.generatedAt);
  assert.ok(existsSync("data/qa/facility-validation-results.csv"));
});
