#!/usr/bin/env node
/**
 * 🎯 목적: 새 클론 환경에서 dev 실행 전에 필요한 작업(설치/선행 빌드)을 자동화한다.
 *
 * 단계:
 * 1. ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install (이미 설치돼 있으면 건너뜀)
 * 2. 자주 필요한 패키지(@skuberplus/core 등) 빌드
 * 3. 전체 pnpm build (필요 시 --skip 옵션으로 건너뛸 수 있음)
 *
 * 사용 예:
 *   node scripts/bootstrap-fresh-clone.js
 *   node scripts/bootstrap-fresh-clone.js --skip-full-build
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = path.resolve(path.join(import.meta.url.replace("file://", ""), "..", ".."));
const requireFromRoot = createRequire(path.join(repoRoot, "package.json"));
const workspaceBuildTargets = [
  "@skuberplus/core",
  "@skuberplus/logger",
  "@skuberplus/metrics",
  "@skuberplus/routing",
  "@skuberplus/list-layout",
  "@skuberplus/generate-tray-icons",
];

function run(command, options = {}) {
  console.log(`\n>>> ${command}`);
  execSync(command, {
    stdio: "inherit",
    cwd: repoRoot,
    ...options,
  });
}

function installDependencies() {
  if (existsSync(path.join(repoRoot, "node_modules"))) {
    console.log("node_modules 디렉터리가 존재하므로 pnpm install을 건너뜁니다.");
    return;
  }

  run("ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install");
}

function buildWorkspacePackages() {
  console.log("자주 필요한 워크스페이스 패키지를 선행 빌드합니다...");

  for (const pkg of workspaceBuildTargets) {
    run(`pnpm --filter ${pkg} run build`);
  }
}

function ensureElectronBinary() {
  try {
    const electronPkgPath = requireFromRoot.resolve("electron/package.json");
    const electronDir = path.dirname(electronPkgPath);
    const installScript = path.join(electronDir, "install.js");

    if (!existsSync(installScript)) {
      console.warn(`electron install.js를 찾을 수 없습니다: ${installScript}`);
      return;
    }

    console.log("Electron 바이너리 다운로드 상태를 확인합니다...");
    run(`node "${installScript}"`);
  } catch (error) {
    console.warn("electron 패키지를 찾을 수 없어 install.js 실행을 건너뜁니다.", error);
  }
}

const skipFullBuild = process.argv.includes("--skip-full-build");
installDependencies();
buildWorkspacePackages();
ensureElectronBinary();

if (skipFullBuild) {
  console.log("전체 pnpm build는 생략합니다 (--skip-full-build 옵션). 필요 시 수동으로 `pnpm build`를 실행하세요.");
} else {
  run("pnpm build");
}

console.log("\n✅ bootstrap-fresh-clone 완료! 이제 `pnpm --filter ./skuberplus run dev`를 실행할 수 있습니다.");
