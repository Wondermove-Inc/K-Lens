#!/usr/bin/env node

/**
 * 🎯 목적: DAIVE 프로젝트 postinstall 자동화 스크립트
 *
 * 기능:
 * - Electron 네이티브 모듈 ARM64 재빌드
 * - 새 환경에서 자동 설정으로 수동 작업 최소화
 *
 * 실행 시점:
 * - pnpm install 완료 후 자동 실행
 *
 * 📝 주의사항:
 * - ARM64 아키텍처가 아닌 경우 경고 출력
 *
 * 🔄 변경이력: 2025-10-27 - 초기 생성 (Git 전달 시 빌드 오류 방지)
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
  const prefix = `[${timestamp}] [post-install]`;

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
 * Git 저장소 확인
 */
function isGitRepository() {
  return fs.existsSync(path.join(projectRoot, ".git"));
}

/**
 * Electron 네이티브 모듈 재빌드
 */
function rebuildNativeModules() {
  log("start", "Electron ARM64 네이티브 모듈 재빌드 중...");

  // ARM64 아키텍처 확인
  const arch = process.arch;
  if (arch !== "arm64") {
    log("warning", `현재 아키텍처: ${arch} (ARM64 최적화는 macOS Apple Silicon 전용)`);
  }

  try {
    // 🔧 skuberplus의 electron-rebuild 스크립트 사용
    // 이유: skuberplus에 Electron이 설치되어 있고, pnpm의 경로 문제를 회피
    log("start", "skuberplus electron-rebuild 실행 중...");

    execSync("cd skuberplus && pnpm electron-rebuild", {
      cwd: projectRoot,
      stdio: "inherit",
    });

    log("success", "Electron 네이티브 모듈 재빌드 완료");
  } catch (error) {
    log("error", `Electron 네이티브 모듈 재빌드 실패: ${error.message}`);
    log("warning", "일부 기능(터미널 등)이 작동하지 않을 수 있습니다.");
    log("warning", "수동 재빌드 명령어:");
    console.log("  cd skuberplus && pnpm electron-rebuild");
    process.exit(1);
  }
}

/**
 * 아키텍처 검증
 */
function verifyArchitecture() {
  log("start", "node-pty 아키텍처 검증 중...");

  try {
    execSync("node scripts/verify-node-pty-arch.js", {
      cwd: projectRoot,
      stdio: "inherit",
    });

    log("success", "node-pty 아키텍처 검증 완료");
  } catch (error) {
    log("error", "node-pty 아키텍처 검증 실패");
    log("warning", "앱 실행 시 터미널 기능이 작동하지 않을 수 있습니다.");
    process.exit(1);
  }
}

/**
 * 메인 실행 함수
 */
function main() {
  console.log("");
  log("start", "DAIVE postinstall 작업 시작");
  console.log("");

  // CI 환경에서는 네이티브 모듈 재빌드 스킵
  if (process.env.CI) {
    log("warning", "CI 환경 감지 — electron-rebuild 스킵");
  } else {
    // 2. Electron 네이티브 모듈 재빌드
    rebuildNativeModules();
    console.log("");

    // 3. 아키텍처 검증
    verifyArchitecture();
    console.log("");
  }

  log("success", "DAIVE postinstall 작업 완료");
  console.log("");
}

// 실행
main();
