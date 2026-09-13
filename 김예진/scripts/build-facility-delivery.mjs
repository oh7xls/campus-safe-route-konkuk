import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const outputDirectory = new URL("../data/processed/", import.meta.url);
const [cctvSnapshot, securityLightSnapshot, pilotArea] = await Promise.all([
  readJson(new URL("data/gwangjin-cctv-konkuk.json", root)),
  readJson(new URL("data/gwangjin-security-lights-konkuk.json", root)),
  readJson(new URL("data/pilot-area.json", root)),
]);

function readJson(url) {
  return readFile(url, "utf8").then(JSON.parse);
}

function nullableText(value) {
  const text = String(value ?? "").trim();
  const missingValues = new Set(["", "-", "없음", "n/a", "null", "주소 미제공"]);
  return missingValues.has(text.toLowerCase()) ? null : text;
}

function cctvSourceRecordId(facility) {
  return nullableText(facility.name.split(" · ").at(-1));
}

function securityLightSourceRecordId(facility) {
  return nullableText(facility.id.replace(/^gwangjin-light-/, ""));
}

const cctvFacilities = cctvSnapshot.facilities.map((facility) => {
  const sourceRecordId = cctvSourceRecordId(facility);
  return {
    id: `gwangjin:cctv:${sourceRecordId ?? facility.id}`,
    type: "cctv",
    name: facility.name,
    latitude: facility.coordinate.lat,
    longitude: facility.coordinate.lng,
    address: nullableText(facility.address),
    purpose: nullableText(facility.purpose),
    managingAgency: "서울특별시 광진구",
    sourceDatasetId: "gwangjin-cctv-installations",
    sourceRecordId,
    sourceUpdatedAt: cctvSnapshot.pageRevisionDate
      ? `${cctvSnapshot.pageRevisionDate}T00:00:00+09:00`
      : null,
    collectedAt: cctvSnapshot.generatedAt,
  };
});

const securityLightFacilities = securityLightSnapshot.facilities.map(
  (facility) => {
    const sourceRecordId = securityLightSourceRecordId(facility);
    return {
      id: `gwangjin:security_light:${sourceRecordId ?? facility.id}`,
      type: "security_light",
      name: facility.name,
      latitude: facility.coordinate.lat,
      longitude: facility.coordinate.lng,
      address: null,
      purpose: null,
      managingAgency: "서울특별시 광진구",
      sourceDatasetId: "gwangjin-smart-security-light",
      sourceRecordId,
      sourceUpdatedAt: securityLightSnapshot.sourceUpdatedAt ?? null,
      collectedAt: securityLightSnapshot.generatedAt,
    };
  },
);

const facilities = [...cctvFacilities, ...securityLightFacilities].sort(
  (left, right) =>
    left.type.localeCompare(right.type) || left.id.localeCompare(right.id),
);
const datasetDelivery = [
  {
    id: "gwangjin-cctv-installations",
    type: "cctv",
    name: "광진구 CCTV 설치 현황",
    provider: "서울특별시 광진구",
    sourceUrl: cctvSnapshot.sourcePageUrl,
    coordinateSystem: "EPSG:4326",
    sourceRecordCount: cctvSnapshot.sourceRowCount,
    selectedRecordCount: cctvFacilities.length,
    sourceUpdatedAt: cctvSnapshot.pageRevisionDate
      ? `${cctvSnapshot.pageRevisionDate}T00:00:00+09:00`
      : null,
    collectedAt: cctvSnapshot.generatedAt,
    sourceSha256: cctvSnapshot.sourceSha256 ?? null,
  },
  {
    id: "gwangjin-smart-security-light",
    type: "security_light",
    name: "광진구 스마트보안등 위치",
    provider: "서울특별시 광진구 빅데이터포털",
    sourceUrl: securityLightSnapshot.sourceUrl,
    coordinateSystem: "EPSG:4326",
    sourceRecordCount: securityLightSnapshot.sourceResponseCount,
    selectedRecordCount: securityLightFacilities.length,
    sourceUpdatedAt: securityLightSnapshot.sourceUpdatedAt ?? null,
    collectedAt: securityLightSnapshot.generatedAt,
    sourceSha256: securityLightSnapshot.sourceSha256 ?? null,
  },
];

const allowedTypes = new Set(["cctv", "security_light"]);
const invalidFacilities = facilities.filter(
  (facility) =>
    !facility.id ||
    !allowedTypes.has(facility.type) ||
    !facility.name ||
    !Number.isFinite(facility.latitude) ||
    facility.latitude < -90 ||
    facility.latitude > 90 ||
    !Number.isFinite(facility.longitude) ||
    facility.longitude < -180 ||
    facility.longitude > 180 ||
    !facility.sourceDatasetId ||
    !isDateTime(facility.collectedAt) ||
    (facility.sourceUpdatedAt !== null &&
      !isDateTime(facility.sourceUpdatedAt)),
);
const duplicateIdCount = duplicateCount(facilities.map((item) => item.id));
const duplicateCoordinateCount = duplicateCount(
  facilities.map(
    (item) =>
      `${item.type}:${item.latitude.toFixed(7)}:${item.longitude.toFixed(7)}`,
  ),
);
const outsidePilotCount = facilities.filter(
  (facility) => distanceMeters(pilotArea.center, facility) > pilotArea.radiusMeters,
).length;
const metadataMismatchCount =
  Math.abs(cctvFacilities.length - cctvSnapshot.selectedRowCount) +
  Math.abs(
    securityLightFacilities.length -
      securityLightSnapshot.selectedFacilityCount,
  );

const fatalIssueCount =
  invalidFacilities.length +
  duplicateIdCount +
  duplicateCoordinateCount +
  outsidePilotCount +
  metadataMismatchCount;
// 원본 스냅샷이 같으면 파생 파일도 바뀌지 않도록 수집 시각을 사용한다.
const generatedAt = latestTimestamp(
  cctvSnapshot.generatedAt,
  securityLightSnapshot.generatedAt,
);
const qualityReport = {
  schemaVersion: "1.0.0",
  generatedAt,
  pilotArea,
  summary: {
    sourceRecordCount:
      cctvSnapshot.sourceRowCount + securityLightSnapshot.sourceResponseCount,
    selectedRecordCount: facilities.length,
    cctvCount: cctvFacilities.length,
    securityLightCount: securityLightFacilities.length,
  },
  checks: {
    invalidFacilityCount: invalidFacilities.length,
    duplicateIdCount,
    duplicateCoordinateCount,
    outsidePilotCount,
    metadataMismatchCount,
    fatalIssueCount,
  },
  missingOptionalValues: {
    address: facilities.filter((item) => item.address === null).length,
    purpose: facilities.filter((item) => item.purpose === null).length,
    managingAgency: facilities.filter(
      (item) => item.managingAgency === null,
    ).length,
    sourceRecordId: facilities.filter(
      (item) => item.sourceRecordId === null,
    ).length,
    sourceUpdatedAt: facilities.filter(
      (item) => item.sourceUpdatedAt === null,
    ).length,
  },
  datasets: datasetDelivery,
  warnings: [
    "스마트보안등 위치 WFS에는 원본 갱신시각과 점등·고장 상태가 없어 sourceUpdatedAt을 null로 유지합니다.",
    "CCTV 70m·보안등 35m는 앱의 비교용 공간 기준이며 실제 촬영·조명 범위가 아닙니다.",
  ],
};

if (fatalIssueCount > 0) {
  throw new Error(
    `시설 데이터 품질검사 실패: ${JSON.stringify(qualityReport.checks)}`,
  );
}

const delivery = {
  schemaVersion: "1.0.0",
  generatedAt,
  coordinateSystem: "EPSG:4326",
  facilities,
};
const geoJson = {
  type: "FeatureCollection",
  name: "konkuk-safety-facilities-v1",
  features: facilities.map(({ latitude, longitude, ...properties }) => ({
    type: "Feature",
    id: properties.id,
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties,
  })),
};

await mkdir(outputDirectory, { recursive: true });
const outputFiles = new Map([
  ["safety-facilities-v1.json", stringifyJson(delivery)],
  ["safety-facilities-v1.geojson", stringifyJson(geoJson)],
  ["safety-facilities-v1.csv", toCsv(facilities)],
  [
    "safety-facilities-postgis.csv",
    toCsv(
      facilities.map((facility) => ({
        id: facility.id,
        facility_type: facility.type,
        name: facility.name,
        latitude: facility.latitude,
        longitude: facility.longitude,
        address: facility.address,
        purpose: facility.purpose,
        managing_agency: facility.managingAgency,
        source_dataset_id: facility.sourceDatasetId,
        source_record_id: facility.sourceRecordId,
        source_updated_at: facility.sourceUpdatedAt,
        collected_at: facility.collectedAt,
      })),
      [
        "id",
        "facility_type",
        "name",
        "latitude",
        "longitude",
        "address",
        "purpose",
        "managing_agency",
        "source_dataset_id",
        "source_record_id",
        "source_updated_at",
        "collected_at",
      ],
    ),
  ],
  [
    "facility-datasets-postgis.csv",
    toCsv(
      datasetDelivery.map((dataset) => ({
        id: dataset.id,
        facility_type: dataset.type,
        name: dataset.name,
        provider: dataset.provider,
        source_url: dataset.sourceUrl,
        coordinate_system: dataset.coordinateSystem,
        source_record_count: dataset.sourceRecordCount,
        selected_record_count: dataset.selectedRecordCount,
        source_updated_at: dataset.sourceUpdatedAt,
        collected_at: dataset.collectedAt,
        source_sha256: dataset.sourceSha256,
      })),
      [
        "id",
        "facility_type",
        "name",
        "provider",
        "source_url",
        "coordinate_system",
        "source_record_count",
        "selected_record_count",
        "source_updated_at",
        "collected_at",
        "source_sha256",
      ],
    ),
  ],
  ["data-quality-report.json", stringifyJson(qualityReport)],
]);
const checksumManifest = `${[...outputFiles.entries()]
  .map(([fileName, content]) => `${sha256(content)}  ${fileName}`)
  .join("\n")}\n`;

await Promise.all([
  ...[...outputFiles.entries()].map(([fileName, content]) =>
    writeFile(new URL(fileName, outputDirectory), content),
  ),
  writeFile(new URL("CHECKSUMS.sha256", outputDirectory), checksumManifest),
]);

console.log(
  `SafetyFacility v1 ${facilities.length}개(CCTV ${cctvFacilities.length}, 보안등 ${securityLightFacilities.length}) 생성 · 치명적 품질 문제 0개`,
);

function isDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function latestTimestamp(...values) {
  if (values.some((value) => !isDateTime(value))) {
    throw new Error("원본 스냅샷의 generatedAt 값이 올바르지 않습니다.");
  }
  return new Date(Math.max(...values.map((value) => Date.parse(value)))).toISOString();
}

function duplicateCount(values) {
  return values.length - new Set(values).size;
}

function distanceMeters(origin, point) {
  const radians = Math.PI / 180;
  const latitudeDelta = (point.latitude - origin.lat) * radians;
  const longitudeDelta = (point.longitude - origin.lng) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(point.latitude * radians) *
      Math.cos(origin.lat * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
}

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(items, columns = [
    "id",
    "type",
    "name",
    "latitude",
    "longitude",
    "address",
    "purpose",
    "managingAgency",
    "sourceDatasetId",
    "sourceRecordId",
    "sourceUpdatedAt",
    "collectedAt",
  ]) {
  return `${[
    columns.join(","),
    ...items.map((item) =>
      columns.map((column) => csvValue(item[column])).join(","),
    ),
  ].join("\n")}\n`;
}

function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
