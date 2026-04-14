#!/usr/bin/env node
/**
 * 🎯 목적: 빌드 버전 자동 업데이트 스크립트
 *
 * 버전 구조:
 * - version: a.b.c (semver 표준 - electron-builder 호환)
 * - buildNumber: YYYYMMDDHHMMSS (빌드 일시)
 *
 * 사용법:
 *   node scripts/update-build-version.js           # 빌드 번호만 업데이트
 *   node scripts/update-build-version.js major     # a+1.0.0으로 올림
 *   node scripts/update-build-version.js minor     # a.b+1.0으로 올림
 *   node scripts/update-build-version.js patch     # a.b.c+1로 올림
 *
 * 🔄 변경이력: 2026-01-04 - 초기 생성
 */

const fs = require("fs");
const path = require("path");

const PACKAGE_JSON_PATH = path.resolve(__dirname, "..", "skuberplus", "package.json");

/**
 * 🎯 목적: 현재 시간을 YYYYMMDDHHMMSS 형식으로 반환
 */
function getBuildTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 🎯 목적: 버전 문자열을 파싱하여 major, minor, patch 객체로 반환
 */
function parseVersion(version) {
  const cleanVersion = version.split(".").slice(0, 3).join(".");
  const parts = cleanVersion.split(".");
  return {
    major: parseInt(parts[0] || "0", 10),
    minor: parseInt(parts[1] || "0", 10),
    patch: parseInt(parts[2] || "0", 10),
  };
}

/**
 * 🎯 목적: 버전 객체를 문자열로 포맷팅
 */
function formatVersion(ver) {
  return `${ver.major}.${ver.minor}.${ver.patch}`;
}

/**
 * 🎯 목적: 메인 함수 - 버전 업데이트 수행
 */
function main() {
  const bumpType = process.argv[2];

  // package.json 읽기
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  const currentVersion = packageJson.version;
  const currentBuildNumber = packageJson.buildNumber || "N/A";

  // 버전 파싱
  const parsed = parseVersion(currentVersion);

  // 새 빌드 번호 생성
  const newBuildNumber = getBuildTimestamp();

  // 버전 업데이트
  switch (bumpType) {
    case "major":
      parsed.major += 1;
      parsed.minor = 0;
      parsed.patch = 0;
      break;
    case "minor":
      parsed.minor += 1;
      parsed.patch = 0;
      break;
    case "patch":
      parsed.patch += 1;
      break;
    // 기본: 빌드 번호만 업데이트
  }

  const newVersion = formatVersion(parsed);

  // package.json 업데이트
  packageJson.version = newVersion;
  packageJson.buildNumber = newBuildNumber;

  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + "\n");

  // 결과 출력
  console.log("============================================");
  console.log("[VERSION] 빌드 버전 업데이트");
  console.log("============================================");
  console.log(`  Version: ${currentVersion} → ${newVersion}`);
  console.log(`  Build:   ${currentBuildNumber} → ${newBuildNumber}`);
  console.log("");
  console.log(`  Major: ${parsed.major} (전체 개편)`);
  console.log(`  Minor: ${parsed.minor} (기능 추가)`);
  console.log(`  Patch: ${parsed.patch} (버그 수정)`);
  console.log(`  Build: ${newBuildNumber} (빌드 일시)`);
  console.log("");
  console.log(`  Full Version: ${newVersion}.${newBuildNumber}`);
  console.log("============================================");

  return { version: newVersion, buildNumber: newBuildNumber };
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { main, getBuildTimestamp, parseVersion, formatVersion };
