#!/usr/bin/env node

/**
 * 🎯 목적: node-pty 네이티브 모듈 아키텍처 검증 스크립트
 *
 * 기능:
 * - node-pty의 pty.node 아키텍처를 검증 (TARGET_ARCH 기반 동적 검증)
 * - pnpm hoisted 위치와 root 위치 모두 확인
 * - 대상 아키텍처가 아닌 경우 오류 메시지 및 해결 방법 제시
 *
 * 실행 시점:
 * - postinstall 후 자동 실행
 * - 빌드 전 수동 검증
 *
 * 📝 주의사항:
 * - macOS 전용 (다른 플랫폼에서는 경고만 출력)
 * - TARGET_ARCH 환경변수로 검증 대상 아키텍처 지정 (기본값: arm64)
 * - 파일이 없을 경우 오류로 처리
 *
 * 🔄 변경이력: 2025-10-27 - 초기 생성 (Rosetta 2 환경 빌드 방지)
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// 🎯 프로젝트 루트 디렉토리
const projectRoot = path.resolve(__dirname, "..");

/**
 * 색상 출력 유틸리티 (CI 환경에서는 비활성화)
 */
const useColor = !process.env.CI;
const colors = {
  blue: (text) => (useColor ? `\x1b[34m${text}\x1b[0m` : text),
  green: (text) => (useColor ? `\x1b[32m${text}\x1b[0m` : text),
  yellow: (text) => (useColor ? `\x1b[33m${text}\x1b[0m` : text),
  red: (text) => (useColor ? `\x1b[31m${text}\x1b[0m` : text),
};

/**
 * 타임스탬프 생성 (HH:MM:SS)
 */
function getTimestamp() {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

/**
 * 로그 출력 헬퍼
 */
function log(type, message) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [verify-arch]`;

  switch (type) {
    case "start":
      console.log(colors.blue(`${prefix} [🚀 START]`), message);
      break;
    case "success":
      console.log(colors.green(`${prefix} [✅ SUCCESS]`), message);
      break;
    case "warning":
      console.log(colors.yellow(`${prefix} [⚠️  WARNING]`), message);
      break;
    case "error":
      console.log(colors.red(`${prefix} [❌ ERROR]`), message);
      break;
    default:
      console.log(`${prefix}`, message);
  }
}

/**
 * 파일 아키텍처 확인
 */
function getArchitecture(filePath) {
  try {
    const output = execSync(`file "${filePath}"`, { encoding: "utf-8" });
    if (output.includes("arm64")) {
      return "arm64";
    } else if (output.includes("x86_64")) {
      return "x86_64";
    }
    return "unknown";
  } catch (error) {
    return "error";
  }
}

/**
 * node-pty 아키텍처 검증
 */
function verifyNodePtyArchitecture() {
  const targetArch = process.env.TARGET_ARCH || "arm64";
  const targetFileArch = targetArch === "x64" ? "x86_64" : targetArch;
  const archLabel = targetArch.toUpperCase();

  log("start", `node-pty 아키텍처 검증 시작 (대상: ${archLabel})`);
  console.log("");

  // pnpm 구조를 고려한 경로 목록
  const paths = [
    "node_modules/.pnpm/node-pty@1.1.0-beta34/node_modules/node-pty/build/Release/pty.node",
    "node_modules/node-pty/build/Release/pty.node",
  ];

  let foundValidNative = false;
  const results = [];

  for (const relativePath of paths) {
    const fullPath = path.join(projectRoot, relativePath);

    // 파일 존재 확인
    if (!fs.existsSync(fullPath)) {
      // pnpm symlink 구조에서는 일부 경로가 없을 수 있음 (경고만 출력)
      log("warning", `파일을 찾을 수 없습니다 (선택적): ${relativePath}`);
      results.push({ path: relativePath, arch: "missing", valid: false });
      continue;
    }

    // 아키텍처 확인
    const arch = getArchitecture(fullPath);

    if (arch === targetFileArch) {
      log("success", `✅ ${relativePath}: ${arch}`);
      results.push({ path: relativePath, arch, valid: true });
      foundValidNative = true;
    } else {
      log("error", `❌ ${relativePath}: ${arch} (${archLabel} 필요)`);
      results.push({ path: relativePath, arch, valid: false });
    }
  }

  console.log("");

  // 최종 결과: 최소 하나라도 대상 아키텍처면 성공
  if (foundValidNative) {
    log("success", `node-pty 네이티브 모듈이 ${archLabel}로 정상 빌드되었습니다! 🎉`);
    console.log("");
    return true;
  } else {
    log("error", `${archLabel}로 빌드된 node-pty 네이티브 모듈을 찾을 수 없습니다.`);
    console.log("");
    log("warning", "해결 방법:");
    console.log("");
    console.log(`  1. ${archLabel} 환경에서 재빌드:`);
    console.log(`     cd skuberplus && pnpm electron-rebuild --arch=${targetArch}`);
    console.log("");
    console.log("  2. 또는 postinstall 재실행:");
    console.log("     pnpm install");
    console.log("");
    if (targetArch === "arm64") {
      log("warning", "현재 터미널이 Rosetta 2 환경에서 실행 중일 수 있습니다.");
      console.log("     ARM64 네이티브 터미널에서 실행하세요:");
      console.log("     arch -arm64 /bin/zsh (또는 /bin/bash)");
      console.log("");
    }
    return false;
  }
}

/**
 * 메인 실행 함수
 */
function main() {
  console.log("");
  log("start", "DAIVE node-pty 아키텍처 검증 시작");
  console.log("");

  // 플랫폼 확인
  if (process.platform !== "darwin") {
    log("warning", `현재 플랫폼: ${process.platform} (macOS 전용 검증 스크립트)`);
    console.log("");
    return;
  }

  // 아키텍처 검증
  const isValid = verifyNodePtyArchitecture();

  if (!isValid) {
    log("error", "검증 실패");
    console.log("");
    process.exit(1);
  }

  log("success", "DAIVE node-pty 아키텍처 검증 완료");
  console.log("");
}

// 실행
main();
