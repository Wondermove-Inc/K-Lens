/**
 * 🎯 목적: loadThread() Plan 복원 로직 테스트
 * Plan 영속성 개선 - loadThread()에 Plan 복원 추가
 *
 * 📝 2026-02-03: PHASE 2 - P1
 * - 대화방 전환 시 해당 대화방의 Plan 자동 복원
 * - JSONL에서 로드된 planSnapshot으로 planState 초기화
 *
 * @packageDocumentation
 */

import { planState } from "../../common/plan-state";
import { AgentIPCClient } from "../agent-ipc-client";

import type { ThreadLoadResponse, ThreadMessage } from "../../common/agent-ipc-channels";
import type { PlanSnapshot } from "../../common/plan-types";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("loadThread() Plan Restoration", () => {
  let client: AgentIPCClient;
  let mockLoadThread: jest.Mock;

  beforeEach(() => {
    // planState 초기화
    planState.reset();

    // Mock dependencies
    mockLoadThread = jest.fn();

    client = new AgentIPCClient({
      agentRequest: jest.fn(),
      agentStreamSubscribe: jest.fn(() => () => {}),
      setHitlLevel: jest.fn(),
      listThreads: jest.fn(),
      loadThread: mockLoadThread,
      deleteThread: jest.fn(),
      logUIMessage: jest.fn(),
    });
  });

  afterEach(() => {
    planState.reset();
    client.dispose();
  });

  // ============================================
  // 🔹 헬퍼 함수
  // ============================================

  /**
   * Plan 스냅샷을 포함한 메시지 생성 헬퍼
   */
  function createPlanMessage(
    snapshot: Partial<PlanSnapshot>,
    timestamp: string = new Date().toISOString(),
  ): ThreadMessage {
    return {
      role: "assistant",
      content: "Plan generated",
      timestamp,
      presentation: "plan-viewer",
      planSnapshot: {
        title: snapshot.title ?? "Test Plan",
        summary: snapshot.summary ?? "Test summary",
        status: snapshot.status ?? "drafting",
        steps: snapshot.steps ?? [],
        currentStepIndex: snapshot.currentStepIndex ?? -1,
        conversationId: snapshot.conversationId ?? "thread-1",
        snapshotAt: snapshot.snapshotAt ?? Date.now(),
      },
    };
  }

  /**
   * 일반 메시지 생성 헬퍼
   */
  function createChatMessage(content: string): ThreadMessage {
    return {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      presentation: "chat",
    };
  }

  // ============================================
  // 🔹 Plan 복원 테스트
  // ============================================

  describe("Plan 복원", () => {
    it("가장 최근 미완료 planSnapshot으로 Plan 복원", async () => {
      // Given: messages에 drafting 상태 planSnapshot 있음
      const planSnapshot: PlanSnapshot = {
        title: "Deploy App",
        summary: "Deploy application to cluster",
        status: "drafting",
        steps: [
          { title: "Step 1", status: "pending" },
          { title: "Step 2", status: "pending" },
        ],
        currentStepIndex: -1,
        conversationId: "thread-1",
        snapshotAt: Date.now(),
      };

      const messages: ThreadMessage[] = [
        createChatMessage("Hi"),
        createPlanMessage(planSnapshot),
        createChatMessage("Another message"),
      ];

      mockLoadThread.mockResolvedValue({
        success: true,
        messages,
      } as ThreadLoadResponse);

      // When: loadThread 호출
      const result = await client.loadThread("thread-1");

      // Then: planState가 복원됨
      expect(result.success).toBe(true);
      expect(planState.isActive).toBe(true);
      expect(planState.title).toBe("Deploy App");
      expect(planState.summary).toBe("Deploy application to cluster");
      expect(planState.status).toBe("drafting");
      expect(planState.steps).toHaveLength(2);
      expect(planState.currentConversationId).toBe("thread-1");
    });

    it("executing 상태 Plan도 복원", async () => {
      // Given: executing 상태 Plan
      const planSnapshot: PlanSnapshot = {
        title: "Running Plan",
        summary: "Plan in execution",
        status: "executing",
        steps: [
          { title: "Step 1", status: "completed", result: "Done" },
          { title: "Step 2", status: "in_progress" },
        ],
        currentStepIndex: 1,
        conversationId: "thread-1",
        snapshotAt: Date.now(),
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [createPlanMessage(planSnapshot)],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: executing 상태로 복원됨
      expect(planState.status).toBe("executing");
      expect(planState.currentStepIndex).toBe(1);
      expect(planState.steps[0].status).toBe("completed");
      expect(planState.steps[1].status).toBe("in_progress");
    });

    it("여러 Plan 중 가장 최근 것만 복원", async () => {
      // Given: 시간순으로 여러 Plan 있음
      const oldPlan = createPlanMessage(
        { title: "Old Plan", conversationId: "thread-1", status: "drafting" },
        "2026-02-01T00:00:00Z",
      );

      const newPlan = createPlanMessage(
        { title: "New Plan", conversationId: "thread-1", status: "drafting" },
        "2026-02-03T00:00:00Z",
      );

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [oldPlan, newPlan],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: 가장 최근 Plan만 복원됨
      expect(planState.title).toBe("New Plan");
    });
  });

  // ============================================
  // 🔹 필터링 테스트
  // ============================================

  describe("필터링", () => {
    it("completed 상태 Plan은 복원 안함", async () => {
      // Given: completed 상태 planSnapshot만 있음
      const planSnapshot: PlanSnapshot = {
        title: "Completed Plan",
        summary: "This is done",
        status: "completed",
        steps: [],
        currentStepIndex: -1,
        conversationId: "thread-1",
        snapshotAt: Date.now(),
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [createPlanMessage(planSnapshot)],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: planState는 리셋 상태 유지
      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
    });

    it("rejected 상태 Plan은 복원 안함", async () => {
      // Given: rejected 상태 Plan
      const planSnapshot: PlanSnapshot = {
        title: "Rejected Plan",
        summary: "User rejected this",
        status: "rejected",
        steps: [],
        currentStepIndex: -1,
        conversationId: "thread-1",
        snapshotAt: Date.now(),
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [createPlanMessage(planSnapshot)],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: 복원 안됨
      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
    });

    it("conversationId 불일치하면 복원 안함", async () => {
      // Given: conversationId가 다른 Plan
      const planSnapshot: PlanSnapshot = {
        title: "Other Thread Plan",
        summary: "From another thread",
        status: "drafting",
        steps: [],
        currentStepIndex: -1,
        conversationId: "thread-2", // 다른 ID
        snapshotAt: Date.now(),
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [createPlanMessage(planSnapshot)],
      } as ThreadLoadResponse);

      // When: thread-1 로드하지만 snapshot은 thread-2
      await client.loadThread("thread-1");

      // Then: 복원 안됨
      expect(planState.isActive).toBe(false);
      expect(planState.currentConversationId).toBe("");
    });

    it("완료된 Plan과 진행 중 Plan이 섞여있으면 진행 중 Plan만 복원", async () => {
      // Given: completed와 drafting Plan 섞여있음
      const completedPlan = createPlanMessage(
        { title: "Done", status: "completed", conversationId: "thread-1" },
        "2026-02-01T00:00:00Z",
      );

      const draftingPlan = createPlanMessage(
        { title: "In Progress", status: "drafting", conversationId: "thread-1" },
        "2026-02-03T00:00:00Z",
      );

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [completedPlan, draftingPlan],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: drafting Plan만 복원됨
      expect(planState.title).toBe("In Progress");
      expect(planState.status).toBe("drafting");
    });
  });

  // ============================================
  // 🔹 Plan 없는 경우 테스트
  // ============================================

  describe("Plan 없는 경우", () => {
    it("planSnapshot 없으면 아무것도 안함", async () => {
      // Given: planSnapshot 없는 일반 메시지만
      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [createChatMessage("Hello"), createChatMessage("How are you?")],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: planState는 리셋 상태 유지
      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
    });

    it("빈 messages 배열이면 아무것도 안함", async () => {
      // Given: 빈 메시지 배열
      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: planState는 리셋 상태 유지
      expect(planState.isActive).toBe(false);
    });

    it("loadThread 실패 시 planState 영향 없음", async () => {
      // Given: 기존 Plan이 활성화되어 있음
      planState.startPlanMode("Existing Plan");

      // loadThread 실패
      mockLoadThread.mockResolvedValue({
        success: false,
        messages: [],
        error: "Thread not found",
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: 기존 planState 유지됨
      expect(planState.isActive).toBe(true);
      expect(planState.title).toBe("Existing Plan");
    });
  });

  // ============================================
  // 🔹 엣지 케이스 테스트
  // ============================================

  describe("엣지 케이스", () => {
    it("planSnapshot이 null이면 무시", async () => {
      // Given: planSnapshot이 null인 메시지
      const messageWithNullSnapshot: ThreadMessage = {
        role: "assistant",
        content: "No plan",
        timestamp: new Date().toISOString(),
        presentation: "plan-viewer",
        planSnapshot: null as any,
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [messageWithNullSnapshot],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: 에러 없이 무시됨
      expect(planState.isActive).toBe(false);
    });

    it("planSnapshot이 undefined이면 무시", async () => {
      // Given: planSnapshot이 undefined인 메시지
      const messageWithoutSnapshot: ThreadMessage = {
        role: "assistant",
        content: "No plan",
        timestamp: new Date().toISOString(),
        presentation: "plan-viewer",
        // planSnapshot 없음
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [messageWithoutSnapshot],
      } as ThreadLoadResponse);

      // When: loadThread 호출
      await client.loadThread("thread-1");

      // Then: 에러 없이 무시됨
      expect(planState.isActive).toBe(false);
    });

    it("대화방 전환 시 이전 Plan 제거하고 새 Plan 표시", async () => {
      // Given: thread-1의 Plan이 활성화되어 있음
      planState.startPlanMode("Thread 1 Plan");
      planState.addStep({ title: "Step 1", status: "pending" });

      // thread-2로 전환
      const thread2Plan: PlanSnapshot = {
        title: "Thread 2 Plan",
        summary: "Different thread",
        status: "executing",
        steps: [{ title: "Different Step", status: "in_progress" }],
        currentStepIndex: 0,
        conversationId: "thread-2",
        snapshotAt: Date.now(),
      };

      mockLoadThread.mockResolvedValue({
        success: true,
        messages: [createPlanMessage(thread2Plan)],
      } as ThreadLoadResponse);

      // When: thread-2 로드
      await client.loadThread("thread-2");

      // Then: thread-2 Plan으로 완전히 교체됨
      expect(planState.title).toBe("Thread 2 Plan");
      expect(planState.status).toBe("executing");
      expect(planState.steps).toHaveLength(1);
      expect(planState.steps[0].title).toBe("Different Step");
      expect(planState.currentConversationId).toBe("thread-2");
    });
  });
});
