#!/usr/bin/env node

/**
 * 🎯 목적: Node.js 버전 검증 스크립트
 * 📝 사용: package.json scripts에서 "node scripts/check-node-version.js && pnpm build" 형태로 사용
 * 🔄 변경이력: 2025-10-17 - 초기 생성 (Node.js v22 필수 검증)
 */

const chalk = require("chalk");

const currentVersion = process.version; // "v22.20.0" 형식
const major = parseInt(currentVersion.slice(1).split(".")[0], 10);

if (major < 22) {
  console.log("");
  console.log(chalk.red("======================================"));
  console.log(chalk.red("  Node.js version error"));
  console.log(chalk.red("======================================"));
  console.log("");
  console.log(chalk.yellow(`  Current: ${currentVersion}`));
  console.log(chalk.yellow(`  Required: >= v22.0.0`));
  console.log("");
  process.exit(1);
}

console.log(chalk.green(`Node.js version OK: ${currentVersion}`));
