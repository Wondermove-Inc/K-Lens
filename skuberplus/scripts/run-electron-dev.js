#!/usr/bin/env node
/**
 * 🎯 개발 모드에서 Electron 실행 시 remote-debugging-port 기본값(9224)을 보장한다.
 * ⚙️ REMOTE_DEBUGGING_PORT 환경변수를 미리 설정하면 해당 값을 사용한다.
 */

const { spawn } = require("child_process");

const remoteDebuggingPort = process.env.REMOTE_DEBUGGING_PORT || "9224";

let electronBinary;

try {
  electronBinary = require("electron");
} catch (error) {
  console.error("[DEV-ELECTRON] electron 패키지를 찾을 수 없습니다.", error);
  process.exit(1);
}

const child = spawn(electronBinary, ["--inspect=9223", `--remote-debugging-port=${remoteDebuggingPort}`, "."], {
  stdio: "inherit",
  env: {
    ...process.env,
    REMOTE_DEBUGGING_PORT: remoteDebuggingPort,
  },
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[DEV-ELECTRON] Electron 실행 실패", error);
  process.exit(1);
});
