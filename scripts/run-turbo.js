#!/usr/bin/env node
/**
 * pnpm exec 환경에서 turbo의 child process spawn이 깨지는 문제 우회.
 *
 * 원인: pnpm이 PATH 앞에 ./node_modules/.bin (상대경로)을 추가하는데,
 * turbo가 각 패키지 디렉토리에서 child를 spawn할 때 이 상대경로가
 * 존재하지 않는 경로로 해석되어 ENOENT 발생.
 *
 * 해결: PATH에서 상대경로 ./node_modules/.bin을 제거하고
 * 절대경로만 유지한 상태로 turbo를 실행한다.
 */
const { execFileSync } = require("child_process");
const path = require("path");

const turbo = path.resolve(__dirname, "../node_modules/.bin/turbo");
const args = process.argv.slice(2);

const cleanPath = (process.env.PATH || "")
  .split(":")
  .filter((p) => !p.startsWith("./"))
  .join(":");

try {
  execFileSync(turbo, args, {
    stdio: "inherit",
    env: { ...process.env, PATH: cleanPath },
  });
} catch (e) {
  process.exit(e.status || 1);
}
