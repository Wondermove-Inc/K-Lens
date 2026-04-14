#!/usr/bin/env node

/**
 * 🎯 목적: DAIVE 빌드 검증 스크립트 (Node.js 기반, 크로스 플랫폼 호환)
 *
 * 검증 항목:
 * 1. ARM64 아키텍처 바이너리 확인
 * 2. Renderer 번들에 필요 모듈 포함 확인
 * 3. 빌드 결과물 파일 존재 확인
 *
 * 사용 예시:
 *   node scripts/verify-build.js
 *
 * 🔄 변경이력: 2025-10-15 - 초기 생성 (PHASE1 빌드 로깅 표준화)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 검증 실패 카운터
let FAILED = 0;

/**
 * ARM64 아키텍처 검증을 위해 file 명령 실행
 *
 * @param {string} filePath - 검증할 바이너리 파일 경로
 * @returns {string} - 아키텍처 정보 (arm64, x86_64 등)
 */
function getArchitecture(filePath) {
  try {
    // macOS/Linux: file 명령 사용
    const output = execSync(`file "${filePath}"`, { encoding: "utf-8" });
    if (output.includes("arm64")) return "arm64";
    if (output.includes("x86_64") || output.includes("x86-64")) return "x86_64";
    if (output.includes("i386")) return "i386";
    return "unknown";
  } catch (error) {
    console.error(`  ⚠️  파일 아키텍처 확인 실패: ${filePath}`);
    return "error";
  }
}

/**
 * 번들 파일에 필요한 모듈이 포함되어 있는지 확인 (grep 기반)
 *
 * @param {string} bundlePath - 번들 파일 경로
 * @param {string} bundleName - 번들 이름
 * @returns {boolean} - 검증 성공 여부
 */
function verifyBundleModules(bundlePath, bundleName) {
  const REQUIRED_MODULES = ["js-yaml", "tar", "byline", "rfc4648", "isomorphic-ws"];

  if (!fs.existsSync(bundlePath)) {
    console.log(`  ⚠️  ${bundleName} 번들 파일 없음: ${bundlePath}`);
    return false;
  }

  const missingModules = [];

  // 번들 파일을 읽어서 모듈명이 포함되어 있는지 확인
  const bundleContent = fs.readFileSync(bundlePath, "utf-8");

  for (const moduleName of REQUIRED_MODULES) {
    // ⚠️  주의: 난독화/압축 시 오탐 가능 (간단한 문자열 검색)
    if (!bundleContent.includes(moduleName)) {
      missingModules.push(moduleName);
    }
  }

  if (missingModules.length === 0) {
    console.log(`  ✅ ${bundleName} 번들 모듈 검증 통과`);
    return true;
  } else {
    console.log(`  ⚠️  ${bundleName} 번들에서 누락된 모듈: ${missingModules.join(", ")}`);
    console.log("     해결 방법: webpack externals 설정 확인");
    console.log("     관련 문서: docs/problem/2025-10-15-webpack-renderer-module-bundling.md");
    return false;
  }
}

/**
 * 메인 검증 함수
 */
function main() {
  console.log("🔍 빌드 검증 시작...");
  console.log("======================================");

  if (process.platform === "win32") {
    console.log("Windows detected: skipping macOS ARM64 verification checks.");
    process.exit(0);
  }

  // ============================================
  // 1. ARM64 아키텍처 검증
  // ============================================

  console.log("");
  console.log("📦 1. ARM64 아키텍처 검증");

  // 기존 verify-architecture.sh 스크립트가 있으면 실행
  const verifyArchSh = path.join(__dirname, "verify-architecture.sh");
  if (fs.existsSync(verifyArchSh)) {
    try {
      execSync(`bash "${verifyArchSh}"`, { stdio: "inherit" });
      console.log("  ✅ ARM64 아키텍처 검증 통과");
    } catch (error) {
      console.log("  ⚠️  ARM64 아키텍처 검증 실패 (경고)");
      FAILED++;
    }
  } else {
    // verify-architecture.sh가 없으면 개발 환경 바이너리 직접 검증
    console.log("  📝 개발 환경 Kubernetes 바이너리 검증:");

    const DEV_BINARIES_DIR = path.join(__dirname, "../skuberplus/binaries/client/darwin/arm64");
    const K8S_BINARIES = ["kubectl", "helm", "skuberplus-k8s-proxy"];

    for (const binaryName of K8S_BINARIES) {
      const binaryPath = path.join(DEV_BINARIES_DIR, binaryName);
      if (fs.existsSync(binaryPath)) {
        const arch = getArchitecture(binaryPath);
        if (arch === "arm64") {
          console.log(`  ✅ ${binaryName}: arm64 (정상)`);
        } else {
          console.log(`  ❌ ${binaryName}: ${arch} (ARM64 필요)`);
          FAILED++;
        }
      } else {
        console.log(`  ⚠️  ${binaryName}: 파일 없음 (패키징 시 필요)`);
      }
    }
  }

  // ============================================
  // 2. Renderer 번들 모듈 검증
  // ============================================

  console.log("");
  console.log("📦 2. Renderer 번들 모듈 검증");
  console.log("  📝 참고: grep 기반 검증은 간단하지만 압축/난독화 시 오탐 가능");
  console.log("  📝 더 정확한 검증이 필요하면 Webpack stats JSON 분석 권장");

  const RENDERER_BUNDLE_CORE = path.join(__dirname, "../packages/core/static/build/library/renderer.js");
  const RENDERER_BUNDLE_SKUBERPLUS = path.join(__dirname, "../skuberplus/static/build/skuberplus.js");

  if (!verifyBundleModules(RENDERER_BUNDLE_CORE, "@skuberplus/core")) {
    FAILED++;
  }

  if (!verifyBundleModules(RENDERER_BUNDLE_SKUBERPLUS, "skuberplus")) {
    FAILED++;
  }

  // ============================================
  // 3. 빌드 결과물 파일 존재 확인
  // ============================================

  console.log("");
  console.log("📦 3. 빌드 결과물 파일 검증");

  const REQUIRED_FILES = [
    "packages/core/static/build/library/main.js",
    "packages/core/static/build/library/renderer.js",
    "packages/core/static/build/library/renderer.css",
    "skuberplus/static/build/main.js",
    "skuberplus/static/build/skuberplus.js",
  ];

  const missingFiles = [];

  for (const relativeFile of REQUIRED_FILES) {
    const filePath = path.join(__dirname, "..", relativeFile);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${relativeFile}`);
    } else {
      console.log(`  ❌ ${relativeFile} (없음)`);
      missingFiles.push(relativeFile);
    }
  }

  if (missingFiles.length === 0) {
    console.log("  ✅ 모든 빌드 결과물 파일 존재");
  } else {
    console.log(`  ⚠️  누락된 빌드 결과물: ${missingFiles.length}개`);
    FAILED++;
  }

  // ============================================
  // 4. 최종 결과
  // ============================================

  console.log("");
  console.log("======================================");
  if (FAILED === 0) {
    console.log("✅ 빌드 검증 완료: 모든 검증 통과");
    process.exit(0);
  } else {
    console.log(`⚠️  빌드 검증 완료: ${FAILED}개 경고 발생`);
    console.log("");
    console.log("주의: 경고가 발생했지만 빌드는 성공했습니다.");
    console.log("      문제 해결을 위해 위 경고 메시지를 확인하세요.");
    // 경고만 발생, 빌드는 중단하지 않음
    process.exit(0);
  }
}

// ============================================
// 🎯 스크립트 실행
// ============================================

if (require.main === module) {
  main();
}

module.exports = { main, verifyBundleModules, getArchitecture };
