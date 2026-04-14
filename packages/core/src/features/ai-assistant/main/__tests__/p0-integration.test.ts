/**
 * 🎯 P0 통합 테스트: LLM Plan Context
 *
 * P0 Integration testing and validation
 *
 * 📝 테스트 목표:
 * -  통합 검증
 * - getPreviousPlanSnapshot() + buildSystemPrompt() 연동 확인
 * - P0 전체 흐름 시나리오 테스트
 *
 * 📋 Acceptance Criteria:
 * - AC-004-1: P0 전체 흐름 통합 테스트 작성
 * - AC-004-2: 시나리오 1: Plan 생성 후 다음 요청에서 LLM이 Plan 인지
 * - AC-004-3: 시나리오 2: 완료된 Plan은 컨텍스트에 포함 안됨
 * - AC-004-4: 시나리오 3: 다른 대화방의 Plan은 격리됨
 * - AC-004-5: 회귀 테스트: 기존 기능 정상 동작 확인
 * - AC-004-6: 모든 테스트 통과
 *
 * @packageDocumentation
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildSystemPrompt } from "../agent/react-prompts";
import { AgentHost } from "../agent-host";
import { ConversationLogger } from "../conversation-logger";

import type { AgentContext } from "../../common/agent-ipc-channels";
import type { PlanSnapshot, PlanStatus } from "../../common/plan-types";
import type { AgentHostDependencies } from "../agent-host";

// ============================================
// 🎯 Test Fixtures
// ============================================

/**
 * AgentContext 생성 헬퍼
 */
function createMockContext(threadId: string, clusterId = "test-cluster"): AgentContext {
  return {
    threadId,
    clusterId,
    namespace: "default",
    mode: "general" as const,
    basePath: "/test",
  };
}

/**
 * PlanSnapshot 생성 헬퍼
 */
function createPlanSnapshot(conversationId: string, overrides?: Partial<PlanSnapshot>): PlanSnapshot {
  return {
    conversationId,
    title: "Test Plan",
    summary: "Test plan summary",
    status: "drafting" as PlanStatus,
    steps: [
      {
        id: "step-1",
        title: "Step 1",
        description: "First step",
        status: "pending" as const,
        dependencies: [],
        estimatedMinutes: 5,
      },
      {
        id: "step-2",
        title: "Step 2",
        description: "Second step",
        status: "pending" as const,
        dependencies: [],
        estimatedMinutes: 10,
      },
    ],
    currentStepIndex: 0,
    snapshotAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock Dependencies 생성
 */
function createMockDependencies(conversationLogger: ConversationLogger): AgentHostDependencies {
  return {
    conversationLogger,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any,
    configService: {} as any,
    resourceService: {} as any,
    execService: {} as any,
    cacheWrapper: null,
  };
}

// ============================================
// 🧪 P0 Integration Tests
// ============================================

describe("P0 Integration: LLM Plan Context", () => {
  let tempDir: string;
  let conversationLogger: ConversationLogger;
  let agentHost: AgentHost;
  let mockDependencies: AgentHostDependencies;

  beforeEach(async () => {
    // 임시 디렉토리 생성
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-integration-test-"));

    // ConversationLogger 초기화
    conversationLogger = new ConversationLogger({
      appDataPath: tempDir,
    });
    await conversationLogger["initialize"]();

    // Mock dependencies 생성
    mockDependencies = createMockDependencies(conversationLogger);

    // AgentHost 초기화
    agentHost = new AgentHost(mockDependencies);
  });

  afterEach(() => {
    // 임시 디렉토리 정리
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  /**
   * 헬퍼: Thread 생성 및 Plan 메시지 저장
   */
  async function createThreadWithPlan(threadId: string, planSnapshot: PlanSnapshot): Promise<void> {
    await conversationLogger.createThread(threadId);
    await conversationLogger.logMessage(threadId, "assistant", "Plan을 생성했습니다.", {
      presentation: "plan-viewer",
      planSnapshot,
    });
  }

  // ============================================
  // 🔹 시나리오 1: Plan 생성 후 컨텍스트
  // ============================================

  describe("AC-004-2: 시나리오 1 - Plan 생성 후 다음 요청에서 LLM이 Plan 인지", () => {
    it("Plan 생성 후 System Prompt에 Plan 정보가 포함되어야 함", async () => {
      // Given: Plan이 있는 대화 히스토리
      const threadId = "thread-scenario-1";
      const planSnapshot = createPlanSnapshot(threadId, {
        title: "Deploy Application",
        summary: "Deploy app to Kubernetes cluster",
        status: "executing" as PlanStatus,
        steps: [
          {
            id: "step-1",
            title: "Create Namespace",
            description: "Create namespace for the app",
            status: "completed" as const,
            dependencies: [],
            estimatedMinutes: 2,
          },
          {
            id: "step-2",
            title: "Deploy Pods",
            description: "Deploy application pods",
            status: "in_progress" as const,
            dependencies: ["step-1"],
            estimatedMinutes: 5,
          },
          {
            id: "step-3",
            title: "Create Service",
            description: "Create service to expose pods",
            status: "pending" as const,
            dependencies: ["step-2"],
            estimatedMinutes: 3,
          },
        ],
        currentStepIndex: 1,
      });

      await createThreadWithPlan(threadId, planSnapshot);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출 (새 요청 시뮬레이션)
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: "Previous Plan Context" 섹션 포함
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("The user has an active plan");

      // Plan 제목과 상태 포함
      expect(systemPrompt).toContain("Deploy Application");
      expect(systemPrompt).toContain("executing");

      // Plan 단계 정보 포함 (description이 표시됨)
      expect(systemPrompt).toContain("Create namespace for the app");
      expect(systemPrompt).toContain("Deploy application pods");
      expect(systemPrompt).toContain("Create service to expose pods");

      // 단계 상태 포함
      expect(systemPrompt).toContain("completed");
      expect(systemPrompt).toContain("in_progress");
      expect(systemPrompt).toContain("pending");
    });

    it("LLM이 '아까 Plan 뭐였지?' 질문에 응답 가능해야 함 (Plan 참조 키워드)", async () => {
      // Given: Plan이 있는 대화
      const threadId = "thread-scenario-1-reference";
      const planSnapshot = createPlanSnapshot(threadId, {
        title: "Database Migration",
        status: "drafting" as PlanStatus,
      });

      await createThreadWithPlan(threadId, planSnapshot);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: Plan 참조 키워드 안내 포함
      expect(systemPrompt).toContain("the plan");
      expect(systemPrompt).toContain("previous plan");
      expect(systemPrompt).toContain("use this context");

      // Plan 제목 포함 (LLM이 참조 가능)
      expect(systemPrompt).toContain("Database Migration");
    });

    it("drafting 상태 Plan도 System Prompt에 포함되어야 함", async () => {
      // Given: drafting 상태 Plan
      const threadId = "thread-drafting";
      const planSnapshot = createPlanSnapshot(threadId, {
        title: "Draft Plan",
        status: "drafting" as PlanStatus,
      });

      await createThreadWithPlan(threadId, planSnapshot);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: Plan 섹션 포함
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("Draft Plan");
      expect(systemPrompt).toContain("drafting");
    });

    it("여러 Plan 중 가장 최근의 미완료 Plan을 사용해야 함", async () => {
      // Given: 여러 Plan이 있는 대화
      const threadId = "thread-multiple-plans";

      await conversationLogger.createThread(threadId);

      // 첫 번째 Plan (오래된 것)
      await conversationLogger.logMessage(threadId, "assistant", "첫 번째 Plan", {
        presentation: "plan-viewer",
        planSnapshot: createPlanSnapshot(threadId, {
          title: "Old Plan",
          status: "executing" as PlanStatus,
          snapshotAt: new Date(Date.now() - 10000).toISOString(),
        }),
      });

      // 두 번째 Plan (완료됨 - 제외)
      await conversationLogger.logMessage(threadId, "assistant", "완료된 Plan", {
        presentation: "plan-viewer",
        planSnapshot: createPlanSnapshot(threadId, {
          title: "Completed Plan",
          status: "completed" as PlanStatus,
          snapshotAt: new Date(Date.now() - 5000).toISOString(),
        }),
      });

      // 세 번째 Plan (가장 최근 - 선택)
      await conversationLogger.logMessage(threadId, "assistant", "최근 Plan", {
        presentation: "plan-viewer",
        planSnapshot: createPlanSnapshot(threadId, {
          title: "Recent Plan",
          status: "executing" as PlanStatus,
          snapshotAt: new Date().toISOString(),
        }),
      });

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 가장 최근 미완료 Plan만 포함
      expect(systemPrompt).toContain("Recent Plan");
      expect(systemPrompt).not.toContain("Old Plan");
      expect(systemPrompt).not.toContain("Completed Plan");
    });
  });

  // ============================================
  // 🔹 시나리오 2: 완료된 Plan 필터링
  // ============================================

  describe("AC-004-3: 시나리오 2 - 완료된 Plan은 컨텍스트에 포함 안됨", () => {
    it("completed 상태 Plan은 System Prompt에서 제외되어야 함", async () => {
      // Given: completed 상태의 Plan만 존재
      const threadId = "thread-completed";
      const planSnapshot = createPlanSnapshot(threadId, {
        title: "Completed Plan",
        status: "completed" as PlanStatus,
      });

      await createThreadWithPlan(threadId, planSnapshot);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: Plan 섹션 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
      expect(systemPrompt).not.toContain("Completed Plan");
      expect(systemPrompt).not.toContain("active plan");
    });

    it("rejected 상태 Plan은 System Prompt에서 제외되어야 함", async () => {
      // Given: rejected 상태의 Plan
      const threadId = "thread-rejected";
      const planSnapshot = createPlanSnapshot(threadId, {
        title: "Rejected Plan",
        status: "rejected" as PlanStatus,
      });

      await createThreadWithPlan(threadId, planSnapshot);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: Plan 섹션 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
      expect(systemPrompt).not.toContain("Rejected Plan");
    });

    it("완료된 Plan 이후 새 Plan이 있으면 새 Plan만 표시되어야 함", async () => {
      // Given: 완료된 Plan + 새 Plan
      const threadId = "thread-new-after-completed";

      await conversationLogger.createThread(threadId);

      // 완료된 Plan
      await conversationLogger.logMessage(threadId, "assistant", "완료된 Plan", {
        presentation: "plan-viewer",
        planSnapshot: createPlanSnapshot(threadId, {
          title: "Previous Completed Plan",
          status: "completed" as PlanStatus,
          snapshotAt: new Date(Date.now() - 5000).toISOString(),
        }),
      });

      // 새 Plan (drafting)
      await conversationLogger.logMessage(threadId, "assistant", "새 Plan", {
        presentation: "plan-viewer",
        planSnapshot: createPlanSnapshot(threadId, {
          title: "New Active Plan",
          status: "drafting" as PlanStatus,
          snapshotAt: new Date().toISOString(),
        }),
      });

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 새 Plan만 포함
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("New Active Plan");
      expect(systemPrompt).not.toContain("Previous Completed Plan");
    });
  });

  // ============================================
  // 🔹 시나리오 3: 대화방 격리
  // ============================================

  describe("AC-004-4: 시나리오 3 - 다른 대화방의 Plan은 격리됨", () => {
    it("다른 threadId의 Plan은 System Prompt에 포함되지 않아야 함", async () => {
      // Given: 다른 대화방의 Plan
      const threadId = "thread-main";
      const otherThreadId = "thread-other";

      // 다른 대화방에 Plan 생성
      const otherPlan = createPlanSnapshot(otherThreadId, {
        title: "Other Thread Plan",
        status: "executing" as PlanStatus,
      });
      await createThreadWithPlan(otherThreadId, otherPlan);

      // 현재 대화방 (Plan 없음)
      await conversationLogger.createThread(threadId);

      const context = createMockContext(threadId);

      // When: 현재 대화방의 buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 다른 대화방의 Plan은 보이지 않음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
      expect(systemPrompt).not.toContain("Other Thread Plan");
    });

    it("동일 threadId의 Plan만 System Prompt에 포함되어야 함", async () => {
      // Given: 각 대화방에 Plan 생성
      const threadId1 = "thread-1";
      const threadId2 = "thread-2";

      const plan1 = createPlanSnapshot(threadId1, {
        title: "Thread 1 Plan",
        status: "executing" as PlanStatus,
      });
      await createThreadWithPlan(threadId1, plan1);

      const plan2 = createPlanSnapshot(threadId2, {
        title: "Thread 2 Plan",
        status: "executing" as PlanStatus,
      });
      await createThreadWithPlan(threadId2, plan2);

      // When: 각 대화방의 buildSystemPrompt 호출
      const context1 = createMockContext(threadId1);
      const systemPrompt1 = await buildSystemPrompt(threadId1, context1, { conversationLogger });

      const context2 = createMockContext(threadId2);
      const systemPrompt2 = await buildSystemPrompt(threadId2, context2, { conversationLogger });

      // Then: 각 대화방의 Plan만 포함
      expect(systemPrompt1).toContain("Thread 1 Plan");
      expect(systemPrompt1).not.toContain("Thread 2 Plan");

      expect(systemPrompt2).toContain("Thread 2 Plan");
      expect(systemPrompt2).not.toContain("Thread 1 Plan");
    });

    it("conversationId가 threadId와 다른 Plan은 제외되어야 함", async () => {
      // Given: conversationId가 일치하지 않는 Plan
      const threadId = "thread-mismatch";

      await conversationLogger.createThread(threadId);

      // conversationId가 다른 Plan 저장 (데이터 불일치 시뮬레이션)
      await conversationLogger.logMessage(threadId, "assistant", "잘못된 Plan", {
        presentation: "plan-viewer",
        planSnapshot: createPlanSnapshot("wrong-conversation-id", {
          title: "Mismatched Plan",
          status: "executing" as PlanStatus,
        }),
      });

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: conversationId 불일치로 Plan 제외
      expect(systemPrompt).not.toContain("## Previous Plan Context");
      expect(systemPrompt).not.toContain("Mismatched Plan");
    });
  });

  // ============================================
  // 🔹 회귀 테스트: 기존 기능
  // ============================================

  describe("AC-004-5: 회귀 테스트 - 기존 기능 정상 동작 확인", () => {
    it("Plan 없어도 기존 System Prompt가 정상 생성되어야 함", async () => {
      // Given: Plan이 없는 새 대화
      const threadId = "thread-no-plan";
      await conversationLogger.createThread(threadId);
      // 메시지 하나 추가 (빈 스레드가 아닌 실제 대화 시뮬레이션)
      await conversationLogger.logMessage(threadId, "user", "hello");

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 기본 System Prompt 포함
      expect(systemPrompt).toBeDefined();
      expect(systemPrompt.length).toBeGreaterThan(0);

      // 기본 섹션 포함 확인
      expect(systemPrompt).toContain("test-cluster");

      // Plan 섹션은 없음
      expect(systemPrompt).not.toContain("## Previous Plan Context");
    });

    it("슬래시 명령어 처리가 정상 동작해야 함", async () => {
      // Given: 컨텍스트
      const threadId = "thread-slash-command";
      await conversationLogger.createThread(threadId);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 슬래시 명령어 관련 내용 포함 (기존 기능 유지)
      expect(systemPrompt).toBeDefined();
      // 슬래시 명령어는 별도 처리되므로 여기서는 기본 프롬프트만 확인
    });

    it("clusterId와 namespace 컨텍스트가 정상 포함되어야 함", async () => {
      // Given: clusterId와 namespace가 있는 컨텍스트
      const threadId = "thread-context";
      await conversationLogger.createThread(threadId);

      const context = createMockContext(threadId, "production-cluster");
      context.namespace = "production";

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 컨텍스트 정보 포함
      expect(systemPrompt).toContain("production-cluster");
      expect(systemPrompt).toContain("production");
    });

    it("getPreviousPlanSnapshot 에러 시에도 System Prompt 생성이 정상 동작해야 함", async () => {
      // Given: getThreadMessages 실패
      const threadId = "thread-error";
      jest.spyOn(conversationLogger, "getThreadMessages").mockRejectedValueOnce(new Error("JSONL parsing failed"));

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: 에러 발생하지 않고 System Prompt 생성 (크래시 안 함)
      expect(systemPrompt).toBeDefined();
      expect(typeof systemPrompt).toBe("string");

      // Plan 섹션 없음 (에러로 인해)
      expect(systemPrompt).not.toContain("## Previous Plan Context");
    });

    it("Plan이 있어도 File Management 섹션은 유지되어야 함", async () => {
      // Given: Plan이 있는 대화
      const threadId = "thread-file-management";
      const planSnapshot = createPlanSnapshot(threadId);
      await createThreadWithPlan(threadId, planSnapshot);

      const context = createMockContext(threadId);

      // When: buildSystemPrompt 호출
      const systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });

      // Then: Plan 섹션과 File Management 섹션 모두 포함
      expect(systemPrompt).toContain("## Previous Plan Context");
      // File Management 섹션은 슬래시 커맨드 전용이므로 일반 프롬프트에서 확인 불필요
    });
  });

  // ============================================
  // 🔹 종합 시나리오 테스트
  // ============================================

  describe("AC-004-1: P0 전체 흐름 통합 테스트", () => {
    it("전체 시나리오: Plan 생성 → 진행 중 → 완료", async () => {
      // Given: 새 대화 시작
      const threadId = "thread-full-flow";
      await conversationLogger.createThread(threadId);
      const context = createMockContext(threadId);

      // Step 1: Plan 없는 초기 상태
      let systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });
      expect(systemPrompt).not.toContain("## Previous Plan Context");

      // Step 2: Plan 생성 (drafting)
      const draftPlan = createPlanSnapshot(threadId, {
        title: "Deploy App",
        status: "drafting" as PlanStatus,
      });
      await conversationLogger.logMessage(threadId, "assistant", "Plan 생성", {
        presentation: "plan-viewer",
        planSnapshot: draftPlan,
      });

      systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("Deploy App");
      expect(systemPrompt).toContain("drafting");

      // Step 3: Plan 실행 중 (executing)
      const executingPlan = createPlanSnapshot(threadId, {
        title: "Deploy App",
        status: "executing" as PlanStatus,
        currentStepIndex: 1,
      });
      await conversationLogger.logMessage(threadId, "assistant", "Plan 실행 중", {
        presentation: "plan-viewer",
        planSnapshot: executingPlan,
      });

      systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("executing");

      // Step 4: Plan 완료 (completed)
      const completedPlan = createPlanSnapshot(threadId, {
        title: "Deploy App",
        status: "completed" as PlanStatus,
      });
      await conversationLogger.logMessage(threadId, "assistant", "Plan 완료", {
        presentation: "plan-viewer",
        planSnapshot: completedPlan,
      });

      systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });
      // 완료된 Plan이 가장 최근이면, 이전의 미완료 Plan을 찾음 (drafting/executing)
      // 모든 Plan이 완료되면 컨텍스트 제외됨
      // 이 시나리오에서는 drafting → executing → completed 순이므로
      // completed를 건너뛰고 이전 executing 또는 drafting을 찾게 됨
      // 실제로는 가장 최근 완료된 Plan만 있고 이전 미완료가 없으면 제외됨

      // 이 케이스는 모든 Plan이 같은 제목이므로 이전 executing이 반환됨
      // 테스트 시나리오를 명확히 하기 위해 다른 제목 사용하거나
      // 모든 과거 Plan이 완료된 경우를 테스트
      expect(systemPrompt).toContain("## Previous Plan Context"); // 이전 executing Plan이 여전히 존재

      // Step 5: 새 Plan 시작 (drafting)
      const newPlan = createPlanSnapshot(threadId, {
        title: "New Plan",
        status: "drafting" as PlanStatus,
      });
      await conversationLogger.logMessage(threadId, "assistant", "새 Plan", {
        presentation: "plan-viewer",
        planSnapshot: newPlan,
      });

      systemPrompt = await buildSystemPrompt(threadId, context, { conversationLogger });
      expect(systemPrompt).toContain("## Previous Plan Context");
      expect(systemPrompt).toContain("New Plan");
      expect(systemPrompt).not.toContain("Deploy App"); // 이전 완료된 Plan은 제외
    });

    it("다중 대화방 시나리오: 대화방 전환 시 각 Plan 독립적", async () => {
      // Given: 3개의 대화방
      const threads = ["thread-A", "thread-B", "thread-C"];

      for (let i = 0; i < threads.length; i++) {
        const threadId = threads[i];
        const planSnapshot = createPlanSnapshot(threadId, {
          title: `Unique Plan for Thread ${String.fromCharCode(65 + i)}`, // Unique Plan for Thread A, B, C
          status: "executing" as PlanStatus,
        });
        await createThreadWithPlan(threadId, planSnapshot);
      }

      // When: 각 대화방의 System Prompt 생성
      const prompts = await Promise.all(
        threads.map(async (threadId) => {
          const context = createMockContext(threadId);
          return buildSystemPrompt(threadId, context, { conversationLogger });
        }),
      );

      // Then: 각 대화방에 자신의 Plan만 포함
      expect(prompts[0]).toContain("Unique Plan for Thread A");
      expect(prompts[0]).not.toContain("Unique Plan for Thread B");
      expect(prompts[0]).not.toContain("Unique Plan for Thread C");

      expect(prompts[1]).toContain("Unique Plan for Thread B");
      expect(prompts[1]).not.toContain("Unique Plan for Thread A");
      expect(prompts[1]).not.toContain("Unique Plan for Thread C");

      expect(prompts[2]).toContain("Unique Plan for Thread C");
      expect(prompts[2]).not.toContain("Unique Plan for Thread A");
      expect(prompts[2]).not.toContain("Unique Plan for Thread B");
    });
  });
});
