#!/usr/bin/env node

/**
 * 🎯 목적: pnpm dev 실행 전에 포트 9191, 9223을 자동으로 정리하여 EADDRINUSE 에러 방지
 *
 * 📝 배경:
 * - pnpm dev를 timeout이나 Ctrl+C로 강제 종료 시, 자식 프로세스(webpack-dev-server, nodemon)가
 *   좀비 상태로 남아 포트를 계속 점유하는 문제 발생
 * - 이로 인해 다음 pnpm dev 실행 시 "EADDRINUSE: address already in use" 에러 발생
 *
 * 🔧 해결 방법:
 * - pnpm dev 실행 전(predev 훅)에 자동으로 해당 포트를 점유한 프로세스 종료
 * - lsof 명령어로 포트 점유 PID 찾아서 kill -9로 강제 종료
 *
 * ⚠️ 주의사항:
 * - 개발 환경에서만 사용 (프로덕션 환경에서는 실행되지 않음)
 * - macOS/Linux 환경 전용 (Windows는 별도 처리 필요)
 *
 * 🔄 변경이력: 2025-10-19 - 초기 생성 (포트 충돌 문제 근본 해결)
 */

const { execSync } = require("child_process");

// 🎯 정리할 포트 목록
const PORTS = [
  9191, // webpack-dev-server (Renderer)
  9223, // Electron remote debugging
];

console.log("\n🧹 개발 환경 포트 정리 시작...\n");

let cleanedCount = 0;

PORTS.forEach((port) => {
  try {
    // lsof -ti :PORT 명령어로 해당 포트를 사용하는 PID 목록 가져오기
    const result = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();

    if (result) {
      const pids = result.split("\n").filter((pid) => pid);

      pids.forEach((pid) => {
        try {
          // 프로세스 정보 가져오기 (어떤 프로세스인지 확인용)
          const processInfo = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8" }).trim();
          console.log(`  ⚠️  포트 ${port} 점유 프로세스 발견: ${processInfo} (PID ${pid})`);

          // 강제 종료
          execSync(`kill -9 ${pid}`);
          console.log(`  ✅ PID ${pid} 종료 완료`);
          cleanedCount++;
        } catch (killError) {
          console.log(`  ⚠️  PID ${pid} 종료 실패 (이미 종료되었거나 권한 없음)`);
        }
      });
    }
  } catch (e) {
    // lsof가 아무것도 찾지 못하면 exit code 1 반환 (정상 - 포트가 비어있음)
    // 에러는 무시하고 계속 진행
  }
});

if (cleanedCount > 0) {
  console.log(`\n✅ 총 ${cleanedCount}개 프로세스 정리 완료\n`);
} else {
  console.log("✅ 모든 포트가 이미 비어있음\n");
}
