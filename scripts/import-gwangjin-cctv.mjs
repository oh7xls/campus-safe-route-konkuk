import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const area = JSON.parse(
  await readFile(new URL("../data/pilot-area.json", import.meta.url), "utf8"),
);

const SOURCE_PAGE_URL =
  "https://www.gwangjin.go.kr/portal/main/contents.do?menuNo=200896";
const DEFAULT_PAGE_REVISION_DATE = "2025-09-25";
const ACCEPTED_PURPOSES = new Set([
  "생활방범",
  "공원방범",
  "어린이보호",
  "다목적",
]);
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "data/gwangjin-cctv-konkuk.json",
);

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function textNodes(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    textNodes(match[1]),
  );
}

function parseWorksheet(xml, sharedStrings) {
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const values = {};

    for (const cellMatch of rowMatch[1].matchAll(
      /<c\b([^>]*)>([\s\S]*?)<\/c>/g,
    )) {
      const attributes = cellMatch[1];
      const reference = /\br="([A-Z]+)\d+"/.exec(attributes)?.[1];
      if (!reference) continue;

      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      const rawValue = /<v>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1] ?? "";
      values[reference] =
        type === "s"
          ? (sharedStrings[Number(rawValue)] ?? "")
          : type === "inlineStr"
            ? textNodes(cellMatch[2])
            : rawValue;
    }

    rows.push(values);
  }

  return rows;
}

function distanceMeters(point) {
  const radians = Math.PI / 180;
  const latitudeDelta = (point.lat - area.center.lat) * radians;
  const longitudeDelta = (point.lng - area.center.lng) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(point.lat * radians) *
      Math.cos(area.center.lat * radians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
}

async function readArchiveEntry(archivePath, entryPath) {
  const command = process.platform === "win32" ? "tar" : "unzip";
  const args =
    process.platform === "win32"
      ? ["-xOf", archivePath, entryPath]
      : ["-p", archivePath, entryPath];
  const { stdout } = await execFile(command, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

async function resolveCurrentWorkbook() {
  const inputPath = process.argv[2];
  if (inputPath) {
    return {
      bytes: await readFile(path.resolve(inputPath)),
      sourceFileUrl: SOURCE_PAGE_URL,
      pageRevisionDate: DEFAULT_PAGE_REVISION_DATE,
    };
  }

  const pageResponse = await fetch(SOURCE_PAGE_URL);
  if (!pageResponse.ok) {
    throw new Error(`광진구 CCTV 페이지 요청 실패: ${pageResponse.status}`);
  }

  const html = await pageResponse.text();
  const pageText = decodeXml(html.replace(/<[^>]*>/g, " "));
  const revisionDates = [...pageText.matchAll(
    /(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*:\s*개정/g,
  )]
    .map((match) =>
      [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join(
        "-",
      ),
    )
    .sort();
  const pageRevisionDate = revisionDates.at(-1) ?? DEFAULT_PAGE_REVISION_DATE;
  const linkMatch = /<a[^>]+href="([^"]+)"[^>]*>\s*광진구 CCTV 설치 현황\s*<\/a>/i.exec(
    html,
  );
  if (!linkMatch) {
    throw new Error("공식 페이지에서 CCTV 설치 현황 파일 링크를 찾지 못했습니다.");
  }

  const sourceFileUrl = new URL(decodeXml(linkMatch[1]), SOURCE_PAGE_URL).href;
  const fileResponse = await fetch(sourceFileUrl);
  if (!fileResponse.ok) {
    throw new Error(`광진구 CCTV 파일 요청 실패: ${fileResponse.status}`);
  }

  return {
    bytes: Buffer.from(await fileResponse.arrayBuffer()),
    sourceFileUrl,
    pageRevisionDate,
  };
}

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "gwangjin-cctv-"));
const workbookPath = path.join(temporaryDirectory, "cctv.xlsx");

try {
  const { bytes, sourceFileUrl, pageRevisionDate } =
    await resolveCurrentWorkbook();
  await writeFile(workbookPath, bytes);

  const [sharedStringsXml, worksheetXml] = await Promise.all([
    readArchiveEntry(workbookPath, "xl/sharedStrings.xml"),
    readArchiveEntry(workbookPath, "xl/worksheets/sheet1.xml"),
  ]);
  const rows = parseWorksheet(
    worksheetXml,
    parseSharedStrings(sharedStringsXml),
  );
  const [headerRow, ...dataRows] = rows;
  const columnByHeader = Object.fromEntries(
    Object.entries(headerRow).map(([column, header]) => [String(header), column]),
  );

  const requiredHeaders = ["카레고리2", "시설명", "소재지", "위도", "경도"];
  for (const header of requiredHeaders) {
    if (!columnByHeader[header]) {
      throw new Error(`광진구 CCTV 원본에 '${header}' 열이 없습니다.`);
    }
  }

  const deduplicated = new Map();
  for (const row of dataRows) {
    const purpose = String(row[columnByHeader["카레고리2"]] ?? "").trim();
    const lat = Number(row[columnByHeader["위도"]]);
    const lng = Number(row[columnByHeader["경도"]]);
    if (
      !ACCEPTED_PURPOSES.has(purpose) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      distanceMeters({ lat, lng }) > area.radiusMeters
    ) {
      continue;
    }

    const facilityName = String(row[columnByHeader["시설명"]] ?? purpose).trim();
    const address = String(row[columnByHeader["소재지"]] ?? "주소 미제공").trim();
    const coordinateKey = `${lat.toFixed(7)}:${lng.toFixed(7)}`;
    if (deduplicated.has(coordinateKey)) continue;

    const id = createHash("sha256")
      .update(`${coordinateKey}|${facilityName}|${purpose}`)
      .digest("hex")
      .slice(0, 16);
    deduplicated.set(coordinateKey, {
      id,
      name: `${purpose} CCTV · ${facilityName}`,
      address,
      purpose,
      coordinate: { lat, lng },
      referenceDate: pageRevisionDate,
    });
  }

  const facilities = [...deduplicated.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  if (facilities.length === 0) {
    throw new Error("건국대 파일럿 반경 안의 안전 관련 CCTV를 찾지 못했습니다.");
  }

  const snapshot = {
    sourceDatasetId: "gwangjin-cctv-installations",
    sourcePageUrl: SOURCE_PAGE_URL,
    sourceFileUrl,
    sourceSheetName: "광진구 CCTV 설치 현황",
    sourceRowCount: dataRows.length,
    selectedRowCount: facilities.length,
    pageRevisionDate,
    generatedAt: new Date().toISOString(),
    filter: {
      acceptedPurposes: [...ACCEPTED_PURPOSES],
      center: area.center,
      radiusMeters: area.radiusMeters,
    },
    facilities,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `광진구 CCTV ${dataRows.length}행 중 파일럿 안전 관련 ${facilities.length}개 위치 저장`,
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
