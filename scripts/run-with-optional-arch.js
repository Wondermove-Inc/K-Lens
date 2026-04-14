#!/usr/bin/env node

/**
 * 🎯 목적: Apple Silicon(macOS arm64) 환경에서만 `arch -arm64` 프리픽스를 적용해 명령을 실행합니다.
 * ⚙️ 동작: 현재 호스트 아키텍처가 arm64인 경우 `arch -arm64`를 붙여 실행하고, 그 외에는 원본 명령을 그대로 실행합니다.
 * @returns {void}
 */
const { spawnSync } = require("child_process");
const os = require("os");

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0) {
  console.error("❌ 실행할 명령이 필요합니다. 예) node scripts/run-with-optional-arch.js pnpm build");
  process.exit(1);
}

/**
 * 🎯 목적: 아키텍처 조건을 검사해 `arch` 프리픽스를 적용할지 결정합니다.
 * @param {string[]} args 실행할 명령과 인자 목록
 * @returns {number} 자식 프로세스 종료 코드
 */
function runWithOptionalArch(args) {
  const isMacOs = process.platform === "darwin";
  const hostArch = os.arch();
  const shouldUseArchPrefix = isMacOs && hostArch === "arm64";

  // ⚠️ 중요: Apple Silicon에서만 `arch -arm64`를 사용해 일관된 네이티브 바이너리를 사용하도록 강제
  const commandArgs = shouldUseArchPrefix ? ["arch", "-arm64", ...args] : args;
  const [command, ...commandParams] = commandArgs;

  const result = spawnSync(command, commandParams, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error("❌ 명령 실행 중 오류가 발생했습니다:", result.error);
    return 1;
  }

  return typeof result.status === "number" ? result.status : 1;
}

const exitCode = runWithOptionalArch(rawArgs);

process.exit(exitCode);
