#!/usr/bin/env node

/**
 * 🎯 목적: skuber+ client 전체 빌드 프로세스 통합 스크립트
 *
 * 실행 순서:
 * 1. 소스 빌드 (pnpm build)
 * 2. Storybook 빌드 (pnpm --filter @skuberplus/storybook-shadcn run storybook:build)
 * 3. Electron 앱 패키징 (cd skuberplus && pnpm build:app)
 * 4. 빌드 경고/에러 수집 및 분석 (collect-build-warnings.js)
 * 5. 패키징된 앱 검증 (verify-packaged-app.js)
 *
 * 사용 예시:
 *   node scripts/build-full.js
 *   pnpm build:full  (package.json에 등록된 스크립트)
 *
 * 🔄 변경이력:
 *   2025-10-16 - 초기 생성 (PHASE2 앱 패키징 로깅 표준화)
 *   2025-10-16 - 빌드 경고/에러 수집 기능 추가
 *   2025-10-16 - 로그 수집 개선 (tee -a 사용 + 빌드 시작 시 이전 로그 삭제)
 *   2025-10-16 - Storybook 빌드 단계 추가 (shadcn Storybook 9.1.8)
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const chalk = require("chalk");

/**
 * 현재 시각을 HH:MM:SS 형식으로 반환
 */
function getTimestamp() {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

/**
 * 표준 로그 형식 출력
 *
 * @param {string} level - 로그 레벨 (START, SUCCESS, ERROR)
 * @param {string} message - 메시지
 */
function log(level, message) {
  const timestamp = getTimestamp();
  const levelColors = {
    START: chalk.blue,
    SUCCESS: chalk.green,
    ERROR: chalk.red,
    INFO: chalk.cyan,
  };

  const colorFn = levelColors[level] || chalk.white;
  const prefix = `[${timestamp}] [build-full] [${level}]`;
  console.log(colorFn(prefix), message);
}

/**
 * 명령 실행 및 시간 측정 (로그 파일 저장 옵션)
 *
 * @param {string} command - 실행할 명령
 * @param {string} description - 명령 설명
 * @param {string|null} logFile - 로그 파일 경로 (null이면 로그 저장 안 함)
 * @returns {number} - 소요 시간 (초)
 */
function runCommand(command, description, logFile = null) {
  const startTime = Date.now();
  log("START", description);

  try {
    // 로그 파일 저장이 필요한 경우 tee 명령 사용
    let actualCommand = command;
    if (logFile) {
      // bash -c로 감싸서 파이프 처리 (append 모드 사용)
      actualCommand = `bash -c "${command.replace(/"/g, '\\"')} 2>&1 | tee -a ${logFile}"`;
    }

    execSync(actualCommand, { stdio: "inherit", cwd: path.join(__dirname, "..") });
    const duration = (Date.now() - startTime) / 1000;
    log("SUCCESS", `${description} 완료 (${duration.toFixed(1)}초)`);
    return duration;
  } catch (error) {
    log("ERROR", `${description} 실패`);
    throw error;
  }
}

/**
 * Node.js 버전 검증 (>= 22 필수)
 */
function checkNodeVersion() {
  const currentVersion = process.version;
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
}

/**
 * 🎯 프로세스 안전 종료 (SIGTERM → SIGKILL 2단계)
 * 📝 목적: 데이터 손실 방지를 위한 우아한 종료 우선
 * 🔄 변경이력: 2025-10-17 - 백그라운드 프로세스 자동 정리 기능 추가
 *
 * @param {string[]} pids - 종료할 프로세스 PID 배열
 */
function killProcesses(pids) {
  if (pids.length === 0) return;

  try {
    // 1단계: SIGTERM (우아한 종료)
    pids.forEach((pid) => {
      try {
        process.kill(pid, "SIGTERM");
      } catch (e) {
        // 이미 종료된 프로세스는 무시
      }
    });

    // 2초 대기
    execSync("sleep 2", { stdio: "ignore" });

    // 2단계: 여전히 살아있는 프로세스는 SIGKILL
    pids.forEach((pid) => {
      try {
        // 프로세스가 아직 살아있는지 확인
        process.kill(pid, 0); // 시그널 0은 존재 여부만 체크
        // 살아있으면 강제 종료
        process.kill(pid, "SIGKILL");
      } catch (e) {
        // 이미 종료됨 (정상)
      }
    });
  } catch (error) {
    log("INFO", "프로세스 종료 중 일부 오류 발생 (무시하고 계속 진행)");
  }
}

/**
 * 🎯 백그라운드 개발 서버 프로세스 감지 및 자동 종료
 * 📝 목적: build:full 실행 전 충돌 방지를 위한 프로세스 정리
 * 🔄 변경이력: 2025-10-17 - 초기 생성 (자동 종료, 사용자 확인 없음)
 */
function checkAndKillBackgroundProcesses() {
  const projectPath = path.join(__dirname, "..");

  try {
    // 프로젝트 경로 + 개발 패턴 기반 프로세스 검색
    const psOutput = execSync(
      `ps aux | grep -E "(pnpm|node|webpack|electron)" | grep "${projectPath}" | grep -E "(dev|watch)" | grep -v "grep" | grep -v "build-full"`,
      { encoding: "utf-8" },
    ).trim();

    if (!psOutput) {
      return; // 백그라운드 프로세스 없음
    }

    // 프로세스 PID 추출
    const processes = psOutput.split("\n").map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parts[1],
        command: parts.slice(10).join(" "),
      };
    });

    log("INFO", `백그라운드 개발 서버 프로세스 ${processes.length}개 감지됨`);
    log("INFO", "자동 종료 중...");

    // 각 프로세스 정보 출력
    processes.forEach((proc) => {
      console.log(`  - PID ${proc.pid}: ${proc.command.substring(0, 80)}...`);
    });

    // 프로세스 종료
    killProcesses(processes.map((p) => p.pid));

    log("SUCCESS", `백그라운드 프로세스 ${processes.length}개 종료 완료`);
  } catch (error) {
    // ps 명령 실패 또는 프로세스 없음 (무시)
    if (error.status === 1) {
      // grep 매치 없음 (정상)
      return;
    }
    // 다른 오류는 로그만 출력하고 계속 진행
    log("INFO", "백그라운드 프로세스 체크 중 오류 발생 (무시하고 계속 진행)");
  }
}

/**
 * 메인 함수
 */
function main() {
  // ============================================
  // 0. Node.js 버전 체크 (v22 필수)
  // ============================================
  checkNodeVersion();

  // ============================================
  // 1. 백그라운드 프로세스 자동 정리
  // ============================================
  checkAndKillBackgroundProcesses();

  // 🎯 목적: CLI 인자에서 --skip-storybook 플래그 확인
  const skipStorybook = process.argv.includes("--skip-storybook");

  // 🎯 목적: CLI 인자에서 --arch 플래그 확인 (x64 크로스 빌드 지원)
  const archIndex = process.argv.indexOf("--arch");
  const targetArch = archIndex !== -1 ? process.argv[archIndex + 1] : "arm64";

  console.log("======================================");
  log("INFO", "skuber+ client 전체 빌드 프로세스 시작");
  if (skipStorybook) {
    log("INFO", "Storybook 빌드 스킵 모드 활성화");
  }
  if (targetArch === "x64") {
    log("INFO", "x64 크로스 빌드 모드 활성화");
  }
  console.log("======================================");

  const totalStartTime = Date.now();
  const durations = {};
  const buildLogPath = path.join(__dirname, "..", "build.log");

  try {
    // ============================================
    // 0. 빌드 로그 파일 초기화 (이전 빌드 로그 삭제)
    // ============================================
    if (fs.existsSync(buildLogPath)) {
      fs.unlinkSync(buildLogPath);
      log("INFO", "이전 빌드 로그 삭제 완료");
    }

    // ============================================
    // 1. 소스 빌드 (pnpm build) - 로그 저장
    // ============================================
    durations.sourceBuild = runCommand("pnpm build", "소스 빌드 (Webpack 번들링)", buildLogPath);

    // ============================================
    // 2. Storybook 빌드 (shadcn Storybook 9.1.8) - 조건부 실행
    // ============================================
    if (!skipStorybook) {
      durations.storybookBuild = runCommand(
        "pnpm --filter @skuberplus/storybook-shadcn run storybook:build",
        "Storybook 빌드 (shadcn UI)",
        buildLogPath,
      );
    } else {
      log("INFO", "Storybook 빌드 스킵 (--skip-storybook 플래그 사용)");
      durations.storybookBuild = 0;
    }

    // ============================================
    // 3. Electron 앱 패키징 - 로그 저장 (append)
    // ============================================
    if (targetArch === "x64") {
      durations.appPackaging = runCommand(
        "cd skuberplus && TARGET_ARCH=x64 corepack pnpm build:app:darwin:x64",
        "Electron 앱 패키징 (x64 크로스 빌드)",
        buildLogPath,
      );
    } else {
      durations.appPackaging = runCommand("cd skuberplus && pnpm build:app", "Electron 앱 패키징", buildLogPath);
    }

    // ============================================
    // 4. 빌드 경고/에러 수집 및 분석
    // ============================================
    log("START", "빌드 경고/에러 분석 중...");
    try {
      execSync(`node scripts/collect-build-warnings.js ${buildLogPath}`, {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });
    } catch (analysisError) {
      // 경고 분석 실패는 무시 (빌드는 성공했으므로)
      log("ERROR", "빌드 경고/에러 분석 실패 (무시하고 계속 진행)");
    }

    // ============================================
    // 5. 최종 결과 요약
    // ============================================

    const totalDuration = (Date.now() - totalStartTime) / 1000;

    console.log("");
    console.log("======================================");
    log("SUCCESS", "전체 빌드 프로세스 완료");
    console.log("======================================");
    console.log("");
    console.log("📊 빌드 요약:");
    console.log(`  - 소스 빌드 시간: ${durations.sourceBuild.toFixed(1)}초`);
    if (!skipStorybook) {
      console.log(`  - Storybook 빌드 시간: ${durations.storybookBuild.toFixed(1)}초`);
    } else {
      console.log(`  - Storybook 빌드 시간: 스킵됨`);
    }
    console.log(`  - 앱 패키징 시간: ${durations.appPackaging.toFixed(1)}초`);
    console.log(`  - 앱 검증 시간: ${durations.appVerification.toFixed(1)}초`);
    console.log(`  - 총 소요 시간: ${totalDuration.toFixed(1)}초`);
    console.log("");
    const distFolder = targetArch === "x64" ? "mac" : "mac-arm64";
    console.log("✅ 빌드가 성공적으로 완료되었습니다.");
    console.log(`   패키징된 앱: skuberplus/dist/${distFolder}/skuber+ client.app`);
    if (!skipStorybook) {
      console.log("   Storybook: packages/storybook-shadcn/storybook-static/");
    }
    console.log("");
    console.log("📄 빌드 로그:");
    console.log(`   ${buildLogPath}`);
    console.log("");
    console.log("🚀 앱 실행:");
    console.log("   pnpm start");
    console.log(`   또는: open skuberplus/dist/${distFolder}/skuber+ client.app`);
    if (!skipStorybook) {
      console.log("");
      console.log("📚 Storybook 확인:");
      console.log("   open packages/storybook-shadcn/storybook-static/index.html");
    }

    process.exit(0);
  } catch (error) {
    console.log("");
    console.log("======================================");
    log("ERROR", "전체 빌드 프로세스 실패");
    console.log("======================================");
    console.log("");
    console.log("❌ 빌드 중 오류가 발생했습니다.");
    console.log("   위의 에러 메시지를 확인하여 문제를 해결하세요.");
    console.log("");
    console.log("💡 도움말:");
    console.log("   - docs/problem/ 디렉토리에서 관련 문서 확인");
    console.log("   - BUILD-ERROR-MAPPING.md에서 에러 패턴 및 해결 방법 참고");
    process.exit(1);
  }
}

// ============================================
// 🎯 스크립트 실행
// ============================================

if (require.main === module) {
  main();
}

module.exports = { main };
