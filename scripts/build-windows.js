#!/usr/bin/env node

/**
 * Purpose: Build SkuberPlus on Windows without corepack or arch wrappers.
 * Notes:
 * - Runs workspace builds directly with pnpm.
 * - Builds @skuberplus/webpack first to provide lens-webpack-build.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

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

console.log("Windows build start");

console.log("1) Check Node.js version");
run("node", ["scripts/check-node-version.js"]);

console.log("2) Build @skuberplus/webpack first");
run("pnpm", ["--filter", "@skuberplus/webpack", "build"], {
  env: { NODE_ENV: "production" },
});

console.log("3) Build remaining workspaces (exclude root)");
run("pnpm", ["-r", "--filter", "!skuberplus-client", "build"], {
  env: { NODE_ENV: "production" },
});

console.log("4) Build SkuberPlus app bundle");
run("pnpm", ["build"], {
  env: { NODE_ENV: "production" },
  cwd: path.join(projectRoot, "skuberplus"),
});

console.log("Windows build complete");
