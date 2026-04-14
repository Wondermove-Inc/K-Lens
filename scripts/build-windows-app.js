#!/usr/bin/env node

/**
 * Purpose: Build Windows x64 app package without npm pre/post scripts.
 * Steps:
 * - Build Windows resources (kubectl/helm/proxy).
 * - Ensure dist/<version> exists.
 * - Run electron-builder directly.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const appDir = path.join(projectRoot, "skuberplus");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: options.cwd || projectRoot,
    shell: true,
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(appDir)) {
  console.error("Missing skuberplus directory");
  process.exit(1);
}

console.log("Windows x64 app packaging start");

console.log("1) Build Windows resources");
run("pnpm", ["run", "build:resources:win:x64"], { cwd: appDir });

console.log("2) Ensure dist/<version> exists");
const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8"));
const distVersionDir = path.join(appDir, "dist", packageJson.version);
if (!fs.existsSync(distVersionDir)) {
  fs.mkdirSync(distVersionDir, { recursive: true });
}

console.log("3) Run electron-builder");
run("pnpm", ["exec", "electron-builder", "--win", "--x64", "--publish", "always"], { cwd: appDir });

console.log("Windows x64 app packaging complete");
