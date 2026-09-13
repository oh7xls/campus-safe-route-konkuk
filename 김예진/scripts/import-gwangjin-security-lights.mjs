import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const area = JSON.parse(await readFile(new URL("../data/pilot-area.json", import.meta.url), "utf8"));
const SOURCE_URL = "https://www.gwangjin.go.kr/gooddata/orl/sqt/ssqt.do?type=smsl";
const SOURCE_ENDPOINT = "https://www.gwangjin.go.kr/gooddata/map/reqGeoServerProxy.do";
const SOURCE_REQUEST = {
  service: "WFS",
  typeName: "gjgc:smart_security_light",
  storage: "gjgc",
  viewParams: "",
};
const input = process.argv[2];
const outputPath = process.env.FACILITY_OUTPUT_PATH
  ? path.resolve(process.env.FACILITY_OUTPUT_PATH)
  : new URL("../data/gwangjin-security-lights-konkuk.json", import.meta.url);
let raw;
if (input) {
  raw = await readFile(input);
} else {
  const response = await fetch(SOURCE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams(SOURCE_REQUEST),
  });
  if (!response.ok) {
    throw new Error(`광진구 스마트보안등 WFS 요청 실패: ${response.status}`);
  }
  raw = Buffer.from(await response.arrayBuffer());
}
const source = JSON.parse(raw.toString("utf8"));
if (
  source.type !== "FeatureCollection" ||
  !Array.isArray(source.features) ||
  !source.crs?.properties?.name?.endsWith("4326")
) {
  throw new Error("광진구 공식 WGS84 GeoJSON 형식을 확인해 주세요.");
}
const distance = (point) => {
  const rad = Math.PI / 180;
  const a = Math.sin((point.lat - area.center.lat) * rad / 2) ** 2 + Math.cos(point.lat * rad) * Math.cos(area.center.lat * rad) * Math.sin((point.lng - area.center.lng) * rad / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
};
const seen = new Set();
const facilities = [];
for (const feature of source.features) {
  if (feature.geometry?.type !== "Point") continue;
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || distance({lat, lng}) > area.radiusMeters) continue;
  const key = `${lat.toFixed(7)}:${lng.toFixed(7)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const modem = String(feature.properties?.modem_no ?? "").trim();
  if (!modem) throw new Error("보안등 장비 식별자가 없는 원본입니다.");
  facilities.push({ id: `gwangjin-light-${modem}`, name: `스마트보안등 ${modem}`, coordinate: {lat, lng} });
}
if (facilities.length === 0) throw new Error("파일럿 안의 보안등 좌표가 없습니다. 기존 자료를 덮어쓰지 않습니다.");
if (new Set(facilities.map(f => f.id)).size !== facilities.length) throw new Error("중복 장비 ID가 있습니다.");
facilities.sort((a,b) => a.id.localeCompare(b.id));
const snapshot = {
  sourceUrl: SOURCE_URL,
  sourceEndpoint: SOURCE_ENDPOINT,
  request: SOURCE_REQUEST,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  generatedAt: new Date().toISOString(),
  sourceUpdatedAt: null,
  sourceResponseCount: source.features.length,
  selectedFacilityCount: facilities.length,
  filter: { center: area.center, radiusMeters: area.radiusMeters },
  note: "공식 지도 공개 좌표의 수집 시점 스냅샷. 원본에 측정시각이 없어 점등·고장 상태는 앱에 반영하지 않습니다. 서울 열린데이터 측정자료의 갱신일을 이 좌표의 기준일로 사용하지 않습니다.",
  facilities,
};
await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`공식 보안등 ${source.features.length}개 중 파일럿 ${facilities.length}개 위치 저장`);
