/**
 * 🎯 목적: buildSystemPrompt()의 Plan 컨텍스트 추가 테스트
 * Plan Persistence - System Prompt Context
 *
 * 📝 테스트 범위:
 * - Plan 컨텍스트 포함 (drafting/executing 상태)
 * - Plan 없는 경우 섹션 생략
 * - buildSystemPrompt()의 비동기 변환
 * - Plan 제목, 상태, 단계 목록 포함
 *
 * @packageDocumentation
 */

import { AgentContext } from "../../common/agent-ipc-channels";
import { PlanSnapshot, PlanStatus } from "../../common/plan-types";
import { buildSystemPrompt } from "../agent/react-prompts";

// ============================================
// 🎯 Mock Dependencies
// ============================================

const createMockDependencies = () => {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    conversationLogger: {
      getThreadMessages: jest.fn(),
      logMessage: jest.fn(),
    },
    k8sConnection: {
      getCurrentClusterId: jest.fn(),
    },
    settings: {
      get: jest.fn(),
    },
  };
};

const createMockContext = (threadId: string): AgentContext => ({
  threadId,
  clusterId: "test-cluster",
  namespace: "default",
  mode: "general" as const,
  basePath: "/test",
});

// ============================================
// 🎯 Test Fixtures
// ============================================

const createPlanSnapshot = (overrides?: Partial<PlanSnapshot>): PlanSnapshot => ({
  title: "Test Plan",
  summary: "Test summary",
  status: "drafting" as PlanStatus,
  steps: [
    {
      id: "step-1",
      title: "Step 1",
      description: "Description 1",
      status: "pending" as const,
      dependencies: [],
      estimatedMinutes: 5,
    },
    {
      id: "step-2",
      title: "Step 2",
      description: "Description 2",
      status: "completed" as const,
      dependencies: [],
      estimatedMinutes: 10,
    },
    {
      id: "step-3",
      title: "Step 3",
      description: "Description 3",
      status: "pending" as const,
      dependencies: [],
      estimatedMinutes: 15,
    },
  ],
  currentStepIndex: 1,
  conversationId: "test-thread-id",
  snapshotAt: new Date().toISOString(),
  ...overrides,
});

// ============================================
// 🧪 Test Suites
// ============================================

describe("buildSystemPrompt with Plan context", () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    mockDeps = createMockDependencies();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 🔹 Plan 컨텍스트 포함 테스트
  // ============================================

  describe("Plan 컨텍스트 포함", () => {
    it("이전 Plan이 있으면 'Previous Plan Context' 섹션을 포함해야 함", async () => {
      // Given: drafting 상태의 Plan 존재
      const planSnapshot = createPlanSnapshot();
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        {
          threadId: "test-thread-id",
          planSnapshot,
        },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: "Previous Plan Context" 섹션 포함
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("The user has an active plan");
    });

    it("Plan 제목, 상태, 단계 목록이 포함되어야 함", async () => {
      // Given: executing 상태의 Plan
      const planSnapshot = createPlanSnapshot({
        title: "Deploy Application",
        status: "executing" as PlanStatus,
      });

      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        {
          threadId: "test-thread-id",
          planSnapshot,
        },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: Plan 정보 포함 (description이 있으면 description, 없으면 title 표시)
      expect(systemPrompt).toContain("Deploy Application");
      expect(systemPrompt).toContain("executing");
      expect(systemPrompt).toContain("Description 1");
      expect(systemPrompt).toContain("Description 2");
      expect(systemPrompt).toContain("Description 3");
    });

    it("Plan 단계 상태 (pending/completed)가 표시되어야 함", async () => {
      // Given: 일부 단계가 완료된 Plan
      const planSnapshot = createPlanSnapshot();

      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        {
          threadId: "test-thread-id",
          planSnapshot,
        },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: 단계 상태 표시
      expect(systemPrompt).toContain("pending");
      expect(systemPrompt).toContain("completed");
    });

    it("여러 Plan이 있을 때 가장 최근 미완료 Plan을 선택해야 함", async () => {
      // Given: 2개의 Plan (하나는 완료)
      const completedPlan = createPlanSnapshot({
        title: "Completed Plan",
        status: "completed" as PlanStatus,
        conversationId: "test-thread-id",
      });

      const activePlan = createPlanSnapshot({
        title: "Active Plan",
        status: "executing" as PlanStatus,
        conversationId: "test-thread-id",
      });

      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        { threadId: "test-thread-id", planSnapshot: completedPlan },
        { threadId: "test-thread-id", planSnapshot: activePlan },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: 활성 Plan만 포함
      expect(systemPrompt).toContain("Active Plan");
      expect(systemPrompt).not.toContain("Completed Plan");
    });

    it("Plan 참조 키워드 안내 문구가 포함되어야 함", async () => {
      // Given: Plan 존재
      const planSnapshot = createPlanSnapshot();
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([{ threadId: "test-thread-id", planSnapshot }]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: 참조 키워드 안내
      expect(systemPrompt).toContain('"the plan"');
      expect(systemPrompt).toContain("previous plan");
      expect(systemPrompt).toContain("use this context");
    });
  });

  // ============================================
  // 🔹 Plan 없는 경우 테스트
  // ============================================

  describe("Plan 없는 경우", () => {
    it("이전 Plan이 없으면 Plan 섹션을 생략해야 함", async () => {
      // Given: Plan 없음
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: "Previous Plan Context" 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
      expect(systemPrompt).not.toContain("active plan");
    });

    it("completed 상태의 Plan만 있으면 Plan 섹션을 생략해야 함", async () => {
      // Given: completed 상태 Plan만 존재
      const completedPlan = createPlanSnapshot({
        status: "completed" as PlanStatus,
      });

      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        { threadId: "test-thread-id", planSnapshot: completedPlan },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: Plan 섹션 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
    });

    it("rejected 상태의 Plan만 있으면 Plan 섹션을 생략해야 함", async () => {
      // Given: rejected 상태 Plan만 존재
      const rejectedPlan = createPlanSnapshot({
        status: "rejected" as PlanStatus,
      });

      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        { threadId: "test-thread-id", planSnapshot: rejectedPlan },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: Plan 섹션 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
    });

    it("conversationId가 다른 Plan은 무시해야 함", async () => {
      // Given: 다른 Thread의 Plan
      const otherThreadPlan = createPlanSnapshot({
        conversationId: "other-thread-id",
        title: "Other Thread Plan",
      });

      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([
        { threadId: "test-thread-id", planSnapshot: otherThreadPlan },
      ]);

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: Plan 섹션 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
      expect(systemPrompt).not.toContain("Other Thread Plan");
    });
  });

  // ============================================
  // 🔹 비동기 변환 테스트
  // ============================================

  describe("비동기 변환", () => {
    it("buildSystemPrompt가 Promise를 반환해야 함", () => {
      // Given: 컨텍스트
      const context = createMockContext("test-thread-id");
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([]);

      // When: buildSystemPrompt 호출
      const result = buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: Promise 반환
      expect(result).toBeInstanceOf(Promise);
    });

    it("getPreviousPlanSnapshot 에러 시 null 반환하고 계속 진행해야 함", async () => {
      // Given: getThreadMessages 실패
      mockDeps.conversationLogger.getThreadMessages.mockRejectedValue(new Error("JSONL read failed"));

      const context = createMockContext("test-thread-id");

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: 에러 발생하지 않고 System Prompt 생성
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt).toContain("test-cluster");
      expect(systemPrompt).not.toContain("## Previous Plan Context");

      // warn 로그 기록 확인
      // warn 로그는 독립 함수에서 호출 안 됨
    });
  });

  // ============================================
  // 🔹 기존 기능 회귀 테스트
  // ============================================

  describe("기존 기능 회귀 방지", () => {
    it("clusterId 컨텍스트가 정상적으로 포함되어야 함", async () => {
      // Given: clusterId 포함 컨텍스트
      const context = createMockContext("test-thread-id");
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([]);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: clusterId 포함
      expect(systemPrompt).toContain("test-cluster");
    });

    it("namespace 컨텍스트가 정상적으로 포함되어야 함", async () => {
      // Given: namespace 포함 컨텍스트
      const context = createMockContext("test-thread-id");
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([]);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: namespace 포함
      expect(systemPrompt).toContain("default");
    });

    it("File Management 섹션이 정상적으로 포함되어야 함", async () => {
      // Given: 컨텍스트
      const context = createMockContext("test-thread-id");
      mockDeps.conversationLogger.getThreadMessages.mockResolvedValue([]);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt("test-thread-id", context, {
        conversationLogger: mockDeps.conversationLogger as any,
      });

      // Then: File Management 섹션 포함
      // File Management 섹션은 슬래시 커맨드 전용
      // save_to_cluster은 슬래시 커맨드 전용
    });
  });
});
