/**
 * 🎯 목적: /plan 슬래시 커맨드 테스트
 * 02: /plan Slash Command 추가
 *
 * 📝 테스트 범위:
 * - 커맨드 파싱
 * - 계획 모드 진입
 * - 옵션 처리
 * - 에러 처리
 *
 * @packageDocumentation
 */

import { executePlanCommand, isPlanCommand, PlanCommand, PlanCommandOptions, parsePlanCommand } from "../plan-command";
import { planState } from "../plan-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("Plan Command", () => {
  beforeEach(() => {
    planState.reset();
  });

  afterEach(() => {
    planState.reset();
  });

  // ============================================
  // 🔹 커맨드 감지
  // ============================================

  describe("isPlanCommand", () => {
    it("/plan으로 시작하는 메시지 감지", () => {
      expect(isPlanCommand("/plan")).toBe(true);
      expect(isPlanCommand("/plan 테스트")).toBe(true);
      expect(isPlanCommand("/plan --help")).toBe(true);
    });

    it("/plan으로 시작하지 않으면 false", () => {
      expect(isPlanCommand("plan")).toBe(false);
      expect(isPlanCommand("hello /plan")).toBe(false);
      expect(isPlanCommand("/plans")).toBe(false);
      expect(isPlanCommand("/planning")).toBe(false);
    });

    it("대소문자 구분 없음", () => {
      expect(isPlanCommand("/PLAN")).toBe(true);
      expect(isPlanCommand("/Plan")).toBe(true);
    });

    it("공백 포함 처리", () => {
      expect(isPlanCommand("  /plan  ")).toBe(true);
    });
  });

  // ============================================
  // 🔹 커맨드 파싱
  // ============================================

  describe("parsePlanCommand", () => {
    it("기본 /plan 파싱", () => {
      const result = parsePlanCommand("/plan");

      expect(result.action).toBe("start");
      expect(result.title).toBeUndefined();
    });

    it("/plan [제목] 파싱", () => {
      const result = parsePlanCommand("/plan Kubernetes 정리");

      expect(result.action).toBe("start");
      expect(result.title).toBe("Kubernetes 정리");
    });

    it("/plan --help 파싱", () => {
      const result = parsePlanCommand("/plan --help");

      expect(result.action).toBe("help");
    });

    it("/plan --cancel 파싱", () => {
      const result = parsePlanCommand("/plan --cancel");

      expect(result.action).toBe("cancel");
    });

    it("/plan --status 파싱", () => {
      const result = parsePlanCommand("/plan --status");

      expect(result.action).toBe("status");
    });

    it("/plan --approve 파싱", () => {
      const result = parsePlanCommand("/plan --approve");

      expect(result.action).toBe("approve");
    });

    it("/plan --reject 파싱", () => {
      const result = parsePlanCommand("/plan --reject");

      expect(result.action).toBe("reject");
    });

    it("여러 옵션 중 첫 번째만 처리", () => {
      const result = parsePlanCommand("/plan --help --cancel");

      expect(result.action).toBe("help");
    });

    it("옵션과 제목 함께 사용 시 옵션 우선", () => {
      const result = parsePlanCommand("/plan --status 테스트");

      expect(result.action).toBe("status");
    });
  });

  // ============================================
  // 🔹 커맨드 실행: start
  // ============================================

  describe("executePlanCommand - start", () => {
    it("제목 없이 시작", async () => {
      const result = await executePlanCommand({ action: "start" });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Plan Mode");
      expect(planState.isActive).toBe(true);
      expect(planState.title).toBe("새 계획");
    });

    it("제목과 함께 시작", async () => {
      const result = await executePlanCommand({
        action: "start",
        title: "배포 계획",
      });

      expect(result.success).toBe(true);
      expect(planState.title).toBe("배포 계획");
    });

    it("이미 활성화된 상태에서 시작 시 경고", async () => {
      planState.startPlanMode("기존 계획");

      const result = await executePlanCommand({
        action: "start",
        title: "새 계획",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("새 계획으로 교체");
      expect(planState.title).toBe("새 계획");
    });
  });

  // ============================================
  // 🔹 커맨드 실행: cancel
  // ============================================

  describe("executePlanCommand - cancel", () => {
    it("활성화된 계획 취소", async () => {
      planState.startPlanMode("테스트");

      const result = await executePlanCommand({ action: "cancel" });

      expect(result.success).toBe(true);
      expect(planState.isActive).toBe(false);
    });

    it("비활성 상태에서 취소 시 안내", async () => {
      const result = await executePlanCommand({ action: "cancel" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("활성화된 계획이 없습니다");
    });
  });

  // ============================================
  // 🔹 커맨드 실행: status
  // ============================================

  describe("executePlanCommand - status", () => {
    it("비활성 상태에서 상태 조회", async () => {
      const result = await executePlanCommand({ action: "status" });

      expect(result.success).toBe(true);
      expect(result.message).toContain("비활성");
    });

    it("활성 상태에서 상태 조회", async () => {
      planState.startPlanMode("테스트 계획");

      const result = await executePlanCommand({ action: "status" });

      expect(result.success).toBe(true);
      expect(result.message).toContain("테스트 계획");
      expect(result.message).toContain("drafting");
    });

    it("실행 중 상태에서 진행률 포함", async () => {
      planState.startPlanMode("테스트");
      planState.addStep({ title: "단계 1", status: "pending" });
      planState.addStep({ title: "단계 2", status: "pending" });
      planState.approvePlan();
      planState.startStep(0);
      planState.completeStep(0);

      const result = await executePlanCommand({ action: "status" });

      expect(result.success).toBe(true);
      expect(result.message).toContain("50%");
    });
  });

  // ============================================
  // 🔹 커맨드 실행: approve
  // ============================================

  describe("executePlanCommand - approve", () => {
    it("계획 승인", async () => {
      planState.startPlanMode("테스트");
      planState.addStep({ title: "단계", status: "pending" });

      const result = await executePlanCommand({ action: "approve" });

      expect(result.success).toBe(true);
      expect(planState.status).toBe("executing");
    });

    it("빈 계획 승인 실패", async () => {
      planState.startPlanMode("빈 계획");

      const result = await executePlanCommand({ action: "approve" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("승인할 수 없습니다");
    });

    it("비활성 상태에서 승인 실패", async () => {
      const result = await executePlanCommand({ action: "approve" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("활성화된 계획이 없습니다");
    });
  });

  // ============================================
  // 🔹 커맨드 실행: reject
  // ============================================

  describe("executePlanCommand - reject", () => {
    it("계획 거부", async () => {
      planState.startPlanMode("테스트");
      planState.addStep({ title: "단계", status: "pending" });

      const result = await executePlanCommand({ action: "reject" });

      expect(result.success).toBe(true);
      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });

    it("비활성 상태에서 거부 실패", async () => {
      const result = await executePlanCommand({ action: "reject" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("활성화된 계획이 없습니다");
    });
  });

  // ============================================
  // 🔹 커맨드 실행: help
  // ============================================

  describe("executePlanCommand - help", () => {
    it("도움말 표시", async () => {
      const result = await executePlanCommand({ action: "help" });

      expect(result.success).toBe(true);
      expect(result.message).toContain("/plan");
      expect(result.message).toContain("--help");
      expect(result.message).toContain("--cancel");
      expect(result.message).toContain("--status");
      expect(result.message).toContain("--approve");
      expect(result.message).toContain("--reject");
    });
  });

  // ============================================
  // 🔹 통합 테스트
  // ============================================

  describe("통합 테스트", () => {
    it("전체 플로우: 시작 → 상태 확인 → 승인", async () => {
      // 시작
      const start = await executePlanCommand({
        action: "start",
        title: "배포 계획",
      });
      expect(start.success).toBe(true);

      // 단계 추가 (실제로는 AI가 추가)
      planState.addStep({ title: "빌드", status: "pending" });
      planState.addStep({ title: "테스트", status: "pending" });

      // 상태 확인
      const status = await executePlanCommand({ action: "status" });
      expect(status.message).toContain("배포 계획");
      expect(status.message).toContain("2");

      // 승인
      const approve = await executePlanCommand({ action: "approve" });
      expect(approve.success).toBe(true);
      expect(planState.status).toBe("executing");
    });

    it("전체 플로우: 시작 → 거부", async () => {
      await executePlanCommand({
        action: "start",
        title: "위험한 작업",
      });
      planState.addStep({ title: "모든 데이터 삭제", status: "pending" });

      const reject = await executePlanCommand({ action: "reject" });

      expect(reject.success).toBe(true);
      expect(planState.isActive).toBe(false);
    });

    it("전체 플로우: 시작 → 취소", async () => {
      await executePlanCommand({
        action: "start",
        title: "취소할 계획",
      });

      const cancel = await executePlanCommand({ action: "cancel" });

      expect(cancel.success).toBe(true);
      expect(planState.isActive).toBe(false);
    });
  });
});
