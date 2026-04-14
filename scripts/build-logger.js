#!/usr/bin/env node

/**
 * 🎯 목적: DAIVE 빌드 프로세스 표준 로깅 유틸리티
 *
 * 기능:
 * - 일관된 로그 형식으로 빌드 진행 상황 출력
 * - 에러 발생 시 명확한 원인과 해결 방법 제공
 * - CI 환경에서 색상 비활성화
 *
 * 사용 예시:
 *   node scripts/build-logger.js start "@skuberplus/core" "빌드 시작..."
 *   node scripts/build-logger.js success "@skuberplus/core" "빌드 완료" 7.2
 *   node scripts/build-logger.js error "skuberplus" "빌드 실패"
 *
 * 🔄 변경이력: 2025-10-15 - 초기 생성 (PHASE1 빌드 로깅 표준화)
 */

const chalk = require("chalk");

// 🎯 CI 환경에서는 색상 비활성화
const useColor = !process.env.CI;

/**
 * 현재 시각을 HH:MM:SS 형식으로 반환
 */
function getTimestamp() {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

/**
 * 빌드 시작 로그 출력
 *
 * @param {string} packageName - 패키지명 (예: "@skuberplus/core", "skuberplus")
 * @param {string} message - 시작 메시지
 */
function logStart(packageName, message) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${packageName}] [🚀 START]`;
  console.log(useColor ? chalk.blue(prefix) : prefix, message);
}

/**
 * 빌드 성공 로그 출력
 *
 * @param {string} packageName - 패키지명
 * @param {string} message - 성공 메시지
 * @param {number} [duration] - 소요 시간 (초 단위, 선택사항)
 */
function logSuccess(packageName, message, duration) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${packageName}] [✅ SUCCESS]`;
  const durationText = duration ? ` (${duration.toFixed(1)}초)` : "";
  console.log(useColor ? chalk.green(prefix) : prefix, message + durationText);
}

/**
 * 빌드 에러 로그 출력
 *
 * @param {string} packageName - 패키지명
 * @param {string} message - 에러 메시지
 * @param {Object} [errorDetails] - 에러 상세 정보 (선택사항)
 * @param {string} [errorDetails.module] - 문제가 발생한 모듈명
 * @param {string} [errorDetails.location] - 에러 위치
 * @param {string} [errorDetails.cause] - 에러 원인
 * @param {string[]} [errorDetails.solution] - 해결 방법 목록
 * @param {string} [errorDetails.docs] - 관련 문서 경로
 */
function logError(packageName, message, errorDetails = {}) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${packageName}] [❌ ERROR]`;
  console.error(useColor ? chalk.red(prefix) : prefix, message);

  // 상세 에러 정보가 있으면 박스 형태로 출력
  if (errorDetails.module || errorDetails.location || errorDetails.cause || errorDetails.solution) {
    console.error("┌" + "─".repeat(60));
    if (errorDetails.module) console.error(`│ 모듈: ${errorDetails.module}`);
    if (errorDetails.location) console.error(`│ 위치: ${errorDetails.location}`);
    if (errorDetails.cause) console.error(`│ 원인: ${errorDetails.cause}`);
    if (errorDetails.solution) {
      console.error("│");
      console.error("│ 🔧 해결 방법:");
      errorDetails.solution.forEach((step) => console.error(`│   ${step}`));
    }
    if (errorDetails.docs) console.error(`│   관련 문서: ${errorDetails.docs}`);
    console.error("└" + "─".repeat(60));
  }
}

/**
 * 빌드 경고 로그 출력
 *
 * @param {string} packageName - 패키지명
 * @param {string} message - 경고 메시지
 */
function logWarn(packageName, message) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${packageName}] [⚠️  WARN]`;
  console.warn(useColor ? chalk.yellow(prefix) : prefix, message);
}

/**
 * 빌드 정보 로그 출력
 *
 * @param {string} packageName - 패키지명
 * @param {string} message - 정보 메시지
 */
function logInfo(packageName, message) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${packageName}] [📦 INFO]`;
  console.log(useColor ? chalk.cyan(prefix) : prefix, message);
}

/**
 * 🔧 Webpack 모듈 없음 에러 로그 (템플릿)
 *
 * @param {string} packageName - 패키지명
 * @param {string} moduleName - 모듈명 (예: "js-yaml")
 * @param {string} location - 에러 위치 (예: "./src/renderer/index.ts:15")
 */
function logWebpackModuleNotFound(packageName, moduleName, location) {
  logError(packageName, "빌드 실패: 모듈을 찾을 수 없음", {
    module: moduleName,
    location: location,
    cause: "Webpack externals 설정으로 인해 번들에서 제외됨",
    solution: [
      `1. ${packageName}/webpack/renderer.ts에서 externals 패턴 확인`,
      "2. packages/core/webpack/renderer.ts에서 allowlist에 추가",
      "3. pnpm build 재실행",
    ],
    docs: "docs/problem/2025-10-15-webpack-renderer-module-bundling.md",
  });
}

/**
 * 🔧 아키텍처 불일치 에러 로그 (템플릿)
 *
 * @param {string} packageName - 패키지명
 * @param {string} binaryName - 바이너리명 (예: "pty.node")
 * @param {string} expectedArch - 예상 아키텍처 (예: "arm64")
 * @param {string} actualArch - 실제 아키텍처 (예: "x86_64")
 */
function logArchitectureMismatch(packageName, binaryName, expectedArch, actualArch) {
  logError(packageName, "빌드 실패: 아키텍처 불일치", {
    module: binaryName,
    cause: `기대: ${expectedArch}, 실제: ${actualArch}`,
    solution: [
      "1. pnpm install 실행 (postinstall 스크립트 자동 실행)",
      "2. pnpm electron-rebuild --arch=arm64 수동 실행",
      "3. ./scripts/verify-architecture.sh로 확인",
    ],
    docs: "docs/problem/2025-10-15-node-pty-arm64-architecture-mismatch.md",
  });
}

/**
 * 🔧 바이너리 파일 없음 에러 로그 (템플릿)
 *
 * @param {string} packageName - 패키지명
 * @param {string} binaryName - 바이너리명 (예: "skuberplus-k8s-proxy")
 * @param {string} expectedPath - 예상 경로 (예: "skuberplus/binaries/client/darwin/arm64/")
 */
function logBinaryMissing(packageName, binaryName, expectedPath) {
  logError(packageName, "빌드 실패: 바이너리 파일 없음", {
    module: binaryName,
    location: expectedPath,
    cause: "ARM64 바이너리가 소스 디렉토리에 존재하지 않음",
    solution: [
      "1. skuberplus/binaries/client/darwin/arm64/ 디렉토리 확인",
      "2. 바이너리 다운로드 또는 빌드",
      "3. Git에 커밋하여 영구 보존",
    ],
    docs: "docs/problem/2025-10-15-skuberplus-k8s-proxy-arm64-binary-missing.md",
  });
}

// ============================================
// 🎯 CLI 인터페이스 (직접 실행 시)
// ============================================

if (require.main === module) {
  const [, , command, packageName, ...args] = process.argv;

  switch (command) {
    case "start":
      logStart(packageName, args.join(" "));
      break;

    case "success": {
      // 마지막 인자가 숫자면 duration으로 처리
      const lastArg = args[args.length - 1];
      const duration = !isNaN(parseFloat(lastArg)) ? parseFloat(lastArg) : null;
      const successMsg = duration ? args.slice(0, -1).join(" ") : args.join(" ");
      logSuccess(packageName, successMsg, duration);
      break;
    }

    case "error":
      logError(packageName, args.join(" "));
      break;

    case "warn":
      logWarn(packageName, args.join(" "));
      break;

    case "info":
      logInfo(packageName, args.join(" "));
      break;

    case "webpack-module-not-found": {
      const [moduleName, location] = args;
      logWebpackModuleNotFound(packageName, moduleName, location);
      break;
    }

    case "architecture-mismatch": {
      const [binaryName, expectedArch, actualArch] = args;
      logArchitectureMismatch(packageName, binaryName, expectedArch, actualArch);
      break;
    }

    case "binary-missing": {
      const [binaryName, expectedPath] = args;
      logBinaryMissing(packageName, binaryName, expectedPath);
      break;
    }

    default:
      console.error("Usage:");
      console.error("  build-logger.js start <packageName> <message>");
      console.error("  build-logger.js success <packageName> <message> [duration]");
      console.error("  build-logger.js error <packageName> <message>");
      console.error("  build-logger.js warn <packageName> <message>");
      console.error("  build-logger.js info <packageName> <message>");
      console.error("  build-logger.js webpack-module-not-found <packageName> <moduleName> <location>");
      console.error("  build-logger.js architecture-mismatch <packageName> <binaryName> <expectedArch> <actualArch>");
      console.error("  build-logger.js binary-missing <packageName> <binaryName> <expectedPath>");
      process.exit(1);
  }
}

// ============================================
// 🎯 모듈 내보내기 (프로그래밍 방식 사용)
// ============================================

module.exports = {
  logStart,
  logSuccess,
  logError,
  logWarn,
  logInfo,
  logWebpackModuleNotFound,
  logArchitectureMismatch,
  logBinaryMissing,
};
