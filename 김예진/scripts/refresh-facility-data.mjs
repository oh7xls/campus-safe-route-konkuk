import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const snapshots = [
  {
    script: "import-gwangjin-cctv.mjs",
    target: path.join(projectRoot, "data/gwangjin-cctv-konkuk.json"),
    stagedName: "gwangjin-cctv-konkuk.json",
  },
  {
    script: "import-gwangjin-security-lights.mjs",
    target: path.join(
      projectRoot,
      "data/gwangjin-security-lights-konkuk.json",
    ),
    stagedName: "gwangjin-security-lights-konkuk.json",
  },
];
const originalContents = await Promise.all(
  snapshots.map((snapshot) => readFile(snapshot.target)),
);
const stagingDirectory = await mkdtemp(
  path.join(tmpdir(), "facility-refresh-"),
);
let replacementStarted = false;

try {
  for (const snapshot of snapshots) {
    snapshot.stagedPath = path.join(stagingDirectory, snapshot.stagedName);
    await run(snapshot.script, {
      FACILITY_OUTPUT_PATH: snapshot.stagedPath,
    });
  }

  // 두 출처가 모두 수집·검증된 뒤에만 현재 스냅샷을 함께 교체한다.
  const stagedContents = await Promise.all(
    snapshots.map((snapshot) => readFile(snapshot.stagedPath)),
  );
  replacementStarted = true;
  await Promise.all(
    snapshots.map((snapshot, index) =>
      writeFile(snapshot.target, stagedContents[index]),
    ),
  );
  await run("build-facility-delivery.mjs");
} catch (error) {
  if (replacementStarted) {
    await Promise.all(
      snapshots.map((snapshot, index) =>
        writeFile(snapshot.target, originalContents[index]),
      ),
    );
    try {
      await run("build-facility-delivery.mjs");
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "데이터 갱신과 이전 스냅샷 복구가 모두 실패했습니다.",
      );
    }
  }
  throw error;
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}

console.log("광진구 안전시설 수집·정제·품질검사·전달 파일 생성 완료");

function run(script, extraEnvironment = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = fileURLToPath(new URL(script, import.meta.url));
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: { ...process.env, ...extraEnvironment },
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} 실행 실패(exit ${code ?? "unknown"})`));
    });
  });
}
