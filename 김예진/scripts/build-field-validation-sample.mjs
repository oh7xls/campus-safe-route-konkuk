import { mkdir, readFile, writeFile } from "node:fs/promises";

const [delivery, pilotArea] = await Promise.all([
  readFile(
    new URL("../data/processed/safety-facilities-v1.json", import.meta.url),
    "utf8",
  ).then(JSON.parse),
  readFile(new URL("../data/pilot-area.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
]);
const center = {
  latitude: pilotArea.center.lat,
  longitude: pilotArea.center.lng,
};
const samples = ["cctv", "security_light"].flatMap((type) =>
  spatialSample(
    delivery.facilities.filter((facility) => facility.type === type),
    10,
  ),
).map((facility) => ({
  id: facility.id,
  type: facility.type,
  name: facility.name,
  latitude: facility.latitude,
  longitude: facility.longitude,
  address: facility.address,
  distanceFromPilotCenterMeters: Math.round(distanceMeters(center, facility)),
  mapUrl: `https://map.kakao.com/link/map/${encodeURIComponent(facility.name)},${facility.latitude},${facility.longitude}`,
  mapVerificationStatus: "not_checked",
  fieldVerificationStatus: "not_checked",
  notes: null,
}));

const result = {
  schemaVersion: "1.0.0",
  generatedAt: delivery.generatedAt,
  selectionMethod: "시설 종류별 중심점 1개를 시작으로 좌표 간 최소거리가 최대가 되는 위치를 반복 선택한 공간 분산 표본",
  sampleCount: samples.length,
  samples,
};
const outputDirectory = new URL("../data/qa/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const sampleCsv = toCsv(samples);
await Promise.all([
  writeFile(
    new URL("facility-validation-sample.json", outputDirectory),
    `${JSON.stringify(result, null, 2)}\n`,
  ),
  writeFile(
    new URL("facility-validation-sample.csv", outputDirectory),
    sampleCsv,
  ),
]);
const resultsUrl = new URL("facility-validation-results.csv", outputDirectory);
let resultsStatus = "기존 현장검증 결과 보존";
try {
  await writeFile(resultsUrl, sampleCsv, { flag: "wx" });
  resultsStatus = "현장검증 결과 입력 파일 최초 생성";
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
}
console.log(`지도·현장 검증 대기 표본 ${samples.length}개 생성 · ${resultsStatus}`);

function spatialSample(facilities, count) {
  if (facilities.length <= count) return facilities;
  const remaining = [...facilities].sort((left, right) => left.id.localeCompare(right.id));
  const firstIndex = remaining.reduce(
    (best, facility, index) =>
      distanceMeters(center, facility) < distanceMeters(center, remaining[best])
        ? index
        : best,
    0,
  );
  const selected = remaining.splice(firstIndex, 1);
  while (selected.length < count) {
    const nextIndex = remaining.reduce((best, facility, index) => {
      const nearest = Math.min(...selected.map((item) => distanceMeters(item, facility)));
      const bestNearest = Math.min(...selected.map((item) => distanceMeters(item, remaining[best])));
      return nearest > bestNearest ? index : best;
    }, 0);
    selected.push(remaining.splice(nextIndex, 1)[0]);
  }
  return selected;
}

function distanceMeters(left, right) {
  const radians = Math.PI / 180;
  const latDelta = (right.latitude - left.latitude) * radians;
  const lngDelta = (right.longitude - left.longitude) * radians;
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(left.latitude * radians) *
      Math.cos(right.latitude * radians) *
      Math.sin(lngDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value));
}

function csv(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  const columns = Object.keys(rows[0]);
  return `${[columns.join(","), ...rows.map((row) => columns.map((key) => csv(row[key])).join(","))].join("\n")}\n`;
}
