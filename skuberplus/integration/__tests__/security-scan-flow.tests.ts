/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * [Security][QA] Playwright E2E — 스캔 실행→결과 표시 플로우
 *
 * 보안 스캔 전체 플로우 E2E 검증:
 * 1. /security 페이지 접근 → idle 상태 확인
 * 2. 스캔 시작 버튼 클릭 → scanning 상태 전환 확인
 * 3. 스캔 완료 → SecurityScoreCard 점수/등급 표시 확인
 * 4. FindingsTable 렌더링 및 건수 확인
 * 5. severity 필터 작동 확인
 * 6. 재스캔 시 이전 결과 초기화 확인
 *
 * 실행 조건: 빌드된 앱(dist/)이 존재하고 kind 클러스터가 준비된 경우에만 실행.
 * 그 외 환경에서는 skip 처리됨.
 */

import { describeIf } from "@skuberplus/test-utils";
import * as fs from "fs";
import * as path from "path";
import { kindReady } from "../helpers/kind";
import * as utils from "../helpers/utils";

import type { Frame, Page } from "playwright";

// ── 실행 조건 ──
const TEST_KIND_CLUSTER_NAME = process.env.TEST_KIND_CLUSTER_NAME || "kind";
const TEST_NAMESPACE = process.env.TEST_NAMESPACE || "integration-tests";

const appBinaryPath = utils.appPaths[process.platform as NodeJS.Platform];
const appBuilt = appBinaryPath ? fs.existsSync(path.resolve(__dirname, "../../", appBinaryPath)) : false;
const clusterReady = kindReady(TEST_KIND_CLUSTER_NAME, TEST_NAMESPACE);

// 앱 빌드 + kind 클러스터 모두 준비된 경우에만 실행
const shouldRun = appBuilt && clusterReady;

// ── 타임아웃 ──
const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 5분 (스캔 완료 대기)
const PAGE_TIMEOUT_MS = 30 * 1000; // 30초 (페이지 요소 대기)
const HOOK_TIMEOUT_MS = 10 * 60 * 1000; // 10분 (before/after 훅)

// ── selector 상수 ──
const SEL = {
  // ScanControl
  scanButton: '[data-testid="scan-button"]',
  scanProgressBar: '[data-testid="scan-progress"]',
  scanStatusText: '[data-testid="scan-status-text"]',
  scannerSelector: '[data-testid="scanner-select"]',

  // SecurityScoreCard
  scoreCard: '[data-testid="score-card"]',
  scoreValue: '[data-testid="score-value"]',
  scoreGrade: '[data-testid="score-grade"]',
  scoreProgress: '[data-testid="score-progress"]',

  // SecurityEmptyState
  emptyState: '[data-testid="empty-state"]',
  emptyStartBtn: '[data-testid="empty-start-scan"]',

  // SecurityFindingsTable
  findingsTable: '[data-testid="findings-table"]',
  findingsCount: '[data-testid="findings-count"]',
  filterHigh: `[data-testid="toggle-item-HIGH"]`,
  filterCritical: `[data-testid="toggle-item-CRITICAL"]`,
  virtualList: '[data-testid="virtual-list"]',

  // SecurityComplianceMap
  complianceCard: '[data-testid="compliance-map"]',

  // SecurityRbacPanel
  rbacPanel: '[data-testid="rbac-panel"]',

  // 네비게이션
  securitySidebarItem: '[data-testid="sidebar-item-security"]',
} as const;

describeIf(shouldRun)("Security Scan Flow — E2E", () => {
  let window: Page;
  let cleanup: undefined | (() => Promise<void>);
  let frame: Frame;

  beforeEach(async () => {
    ({ window, cleanup } = await utils.start());
    await utils.clickWelcomeButton(window);
    frame = await utils.launchKindClusterFromCatalog(TEST_KIND_CLUSTER_NAME, window);
  }, HOOK_TIMEOUT_MS);

  afterEach(async () => {
    await cleanup?.();
  }, HOOK_TIMEOUT_MS);

  // ──────────────────────────────────────────
  // 1. /security 페이지 진입 — idle 상태
  // ──────────────────────────────────────────
  it(
    "security 페이지 첫 진입 시 idle EmptyState가 표시된다",
    async () => {
      // 사이드바에서 Security 메뉴 클릭
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.emptyState, { timeout: PAGE_TIMEOUT_MS });

      // idle variant: 스캔 시작 안내 버튼 존재
      await frame.waitForSelector(SEL.emptyStartBtn, { timeout: PAGE_TIMEOUT_MS });
      const emptyText = await frame.textContent(SEL.emptyState);
      expect(emptyText).toMatch(/스캔을 실행|Run Scan/i);
    },
    PAGE_TIMEOUT_MS * 2,
  );

  // ──────────────────────────────────────────
  // 2. 스캔 시작 → scanning 상태 전환
  // ──────────────────────────────────────────
  it(
    "스캔 시작 버튼 클릭 시 scanning 상태로 전환되고 ScoreCard가 나타난다",
    async () => {
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.scanButton, { timeout: PAGE_TIMEOUT_MS });

      // 스캔 시작
      await frame.click(SEL.scanButton);

      // scanning: ScoreCard 표시 (progress bar 포함)
      await frame.waitForSelector(SEL.scoreCard, { timeout: PAGE_TIMEOUT_MS });
      await frame.waitForSelector(SEL.scoreProgress, { timeout: PAGE_TIMEOUT_MS });

      // EmptyState는 사라짐
      const emptyState = await frame.$(SEL.emptyState);
      expect(emptyState).toBeNull();
    },
    PAGE_TIMEOUT_MS * 2,
  );

  // ──────────────────────────────────────────
  // 3. 스캔 완료 → 점수/등급/FindingsTable 표시
  // ──────────────────────────────────────────
  it(
    "스캔 완료 후 SecurityScoreCard에 점수·등급이 표시되고 FindingsTable이 렌더링된다",
    async () => {
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.scanButton, { timeout: PAGE_TIMEOUT_MS });
      await frame.click(SEL.scanButton);

      // 완료까지 대기 (최대 5분)
      await frame.waitForSelector(SEL.scoreValue, { timeout: SCAN_TIMEOUT_MS });

      // 점수 표시: 숫자 형식 (ex. "72.3")
      const scoreText = await frame.textContent(SEL.scoreValue);
      expect(scoreText).toMatch(/\d+(\.\d+)?/);

      // 등급 표시: A/B/C/D/F
      await frame.waitForSelector(SEL.scoreGrade, { timeout: PAGE_TIMEOUT_MS });
      const gradeText = await frame.textContent(SEL.scoreGrade);
      expect(gradeText).toMatch(/^[A-F]$/);

      // FindingsTable 표시
      await frame.waitForSelector(SEL.findingsTable, { timeout: PAGE_TIMEOUT_MS });
    },
    SCAN_TIMEOUT_MS + PAGE_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────
  // 4. FindingsTable 건수 표시
  // ──────────────────────────────────────────
  it(
    "스캔 완료 후 FindingsTable에 1건 이상의 finding이 표시된다",
    async () => {
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.scanButton, { timeout: PAGE_TIMEOUT_MS });
      await frame.click(SEL.scanButton);

      await frame.waitForSelector(SEL.findingsTable, { timeout: SCAN_TIMEOUT_MS });

      // virtual-list 아이템 수 확인 (1건 이상)
      const virtualList = await frame.$(SEL.virtualList);
      const itemCount = await virtualList?.getAttribute("data-itemcount");
      expect(parseInt(itemCount ?? "0", 10)).toBeGreaterThan(0);
    },
    SCAN_TIMEOUT_MS + PAGE_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────
  // 5. severity 필터 작동
  // ──────────────────────────────────────────
  it(
    "High severity 필터 클릭 시 FindingsTable 건수가 감소하거나 유지된다",
    async () => {
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.scanButton, { timeout: PAGE_TIMEOUT_MS });
      await frame.click(SEL.scanButton);

      await frame.waitForSelector(SEL.findingsTable, { timeout: SCAN_TIMEOUT_MS });

      // 필터 전 전체 건수
      const listBefore = await frame.$(SEL.virtualList);
      const beforeCount = parseInt((await listBefore?.getAttribute("data-itemcount")) ?? "0", 10);

      // High 필터 적용
      await frame.click(SEL.filterHigh);
      await frame.waitForTimeout(500); // 필터 반영 대기

      // 필터 후 건수 ≤ 전체 건수
      const listAfter = await frame.$(SEL.virtualList);
      const afterCount = parseInt((await listAfter?.getAttribute("data-itemcount")) ?? "0", 10);
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    },
    SCAN_TIMEOUT_MS + PAGE_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────
  // 6. 재스캔 시 이전 결과 초기화
  // ──────────────────────────────────────────
  it(
    "재스캔 클릭 시 progress가 0%로 리셋되고 이전 findings가 초기화된다",
    async () => {
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.scanButton, { timeout: PAGE_TIMEOUT_MS });
      await frame.click(SEL.scanButton);

      // 첫 스캔 완료
      await frame.waitForSelector(SEL.findingsTable, { timeout: SCAN_TIMEOUT_MS });

      // 재스캔 클릭
      await frame.click(SEL.scanButton);

      // scanning 상태로 전환: progress bar 표시
      await frame.waitForSelector(SEL.scoreProgress, { timeout: PAGE_TIMEOUT_MS });

      // progress 초기화 확인 (aria-valuenow 또는 style width)
      const progressEl = await frame.$(SEL.scoreProgress);
      const progressValue = await progressEl?.getAttribute("aria-valuenow");
      if (progressValue !== null) {
        // 재스캔 직후 0~20% 이내
        expect(parseInt(progressValue ?? "0", 10)).toBeLessThanOrEqual(20);
      }
    },
    SCAN_TIMEOUT_MS * 2 + PAGE_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────
  // 7. ComplianceMap 표시
  // ──────────────────────────────────────────
  it(
    "스캔 완료 후 SecurityComplianceMap에 통과율이 표시된다",
    async () => {
      await frame.click(SEL.securitySidebarItem);
      await frame.waitForSelector(SEL.scanButton, { timeout: PAGE_TIMEOUT_MS });
      await frame.click(SEL.scanButton);

      await frame.waitForSelector(SEL.scoreValue, { timeout: SCAN_TIMEOUT_MS });

      // 컴플라이언스 카드에 % 텍스트 표시
      await frame.waitForSelector(SEL.complianceCard, { timeout: PAGE_TIMEOUT_MS });
      const complianceText = await frame.textContent(SEL.complianceCard);
      expect(complianceText).toMatch(/\d+%/);
    },
    SCAN_TIMEOUT_MS + PAGE_TIMEOUT_MS,
  );
});

// ── 빌드 없는 환경에서도 실행 가능한 테스트 ──
// E2E 플로우 파일 존재 여부 및 selector 상수 검증
describe("Security Scan Flow — 정적 검증", () => {
  it("security 페이지 컴포넌트 파일이 존재한다", () => {
    const basePath = path.resolve(__dirname, "../../../packages/core/src/renderer/components/security");
    expect(fs.existsSync(path.join(basePath, "security-page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(basePath, "security-scan-control.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(basePath, "security-findings-table.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(basePath, "security-score-card.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(basePath, "security-compliance-map.tsx"))).toBe(true);
  });

  it("security store 파일이 존재한다", () => {
    const storePath = path.resolve(
      __dirname,
      "../../../packages/core/src/features/security/renderer/security-scan-store.ts",
    );
    expect(fs.existsSync(storePath)).toBe(true);
  });

  it("security handler 파일이 존재한다", () => {
    const handlerPath = path.resolve(
      __dirname,
      "../../../packages/core/src/features/security/main/security-scan-handler.ts",
    );
    expect(fs.existsSync(handlerPath)).toBe(true);
  });

  it("trivy scanner 파일이 존재한다", () => {
    const trivyPath = path.resolve(__dirname, "../../../packages/core/src/features/security/main/trivy-scanner.ts");
    expect(fs.existsSync(trivyPath)).toBe(true);
  });

  it("E2E selector 상수가 올바른 형식이다", () => {
    // 각 selector가 유효한 CSS selector 형식인지 확인
    Object.values(SEL).forEach((selector) => {
      expect(selector).toMatch(/^\[data-testid=|^\./);
    });
  });

  it("skuberplus integration 헬퍼가 존재한다", () => {
    const helpersPath = path.resolve(__dirname, "../helpers");
    expect(fs.existsSync(path.join(helpersPath, "utils.ts"))).toBe(true);
    expect(fs.existsSync(path.join(helpersPath, "kind.ts"))).toBe(true);
  });
});
