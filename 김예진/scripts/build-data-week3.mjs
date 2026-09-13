import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

for (const script of [
  "build-facility-delivery.mjs",
  "analyze-distance-sensitivity.mjs",
  "build-field-validation-sample.mjs",
]) {
  await run(script);
}

console.log("데이터 담당 3주 차 전달·분석·검증대기 표본 생성 완료");

function run(script) {
  return new Promise((resolve, reject) => {
    const scriptPath = fileURLToPath(new URL(script, import.meta.url));
    const child = spawn(process.execPath, [scriptPath], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} 실행 실패(exit ${code ?? "unknown"})`));
    });
  });
}
