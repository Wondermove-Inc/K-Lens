#!/usr/bin/env node
/**
 * 🎯 목적: latest-mac.yml의 url/path에 버전 경로 추가
 *
 * 📝 사용법:
 *   node fix-latest-yml.js
 *
 * 📝 주의사항:
 * - 빌드 후 수동으로 실행
 * - skuberplus/dist/latest-mac.yml 파일을 수정
 * - url/path에 버전 폴더 경로 추가 (예: 0.0.1/Skuber+Client-...)
 *
 * 🔄 변경이력: 2025-12-03 - 초기 생성
 */

const fs = require("fs");
const path = require("path");

// yaml 파서 대신 간단한 텍스트 처리 사용
const distDir = path.join(__dirname, "skuberplus", "dist");
const latestMacYmlPath = path.join(distDir, "latest-mac.yml");
const packageJsonPath = path.join(__dirname, "skuberplus", "package.json");

console.log("[fix-latest-yml] 🚀 latest-mac.yml 후처리 시작...");

// 파일 존재 확인
if (!fs.existsSync(latestMacYmlPath)) {
  console.error("[fix-latest-yml] ❌ latest-mac.yml 파일이 없습니다.");
  console.error(`[fix-latest-yml] 📍 경로: ${latestMacYmlPath}`);
  process.exit(1);
}

// package.json에서 버전 가져오기
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const version = packageJson.version;

console.log(`[fix-latest-yml] 📦 버전: ${version}`);

// yaml 파일 읽기
let content = fs.readFileSync(latestMacYmlPath, "utf-8");

console.log("[fix-latest-yml] 📄 원본 내용:");
console.log(content);
console.log("---");

// url: 패턴 수정 (버전 경로가 없는 경우에만)
// url: SkuberPlusClient-0.0.1-arm64.zip → url: 0.0.1/SkuberPlusClient-0.0.1-arm64.zip
content = content.replace(/url: (?![\d.]+\/)(SkuberPlusClient-[\d.]+-[^/\n]+)/g, `url: ${version}/$1`);

// path: 패턴 수정 (버전 경로가 없는 경우에만)
// path: SkuberPlusClient-0.0.1-arm64.zip → path: 0.0.1/SkuberPlusClient-0.0.1-arm64.zip
content = content.replace(/path: (?![\d.]+\/)(SkuberPlusClient-[\d.]+-[^/\n]+)/g, `path: ${version}/$1`);

// 저장
fs.writeFileSync(latestMacYmlPath, content, "utf-8");

console.log("[fix-latest-yml] ✅ 수정된 내용:");
console.log(content);
console.log("---");
console.log("[fix-latest-yml] ✅ latest-mac.yml 후처리 완료!");
console.log(`[fix-latest-yml] 📍 파일 위치: ${latestMacYmlPath}`);
