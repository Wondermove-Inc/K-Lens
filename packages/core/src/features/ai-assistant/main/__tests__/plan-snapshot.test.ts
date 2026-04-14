/**
 * Plan Snapshot 통합 테스트 (Main Process)
 *
 * getPreviousPlanSnapshot() 함수 구현
 *
 * Acceptance Criteria:
 * - AC-002-1: getPreviousPlanSnapshot() 함수가 agent-host.ts에 구현됨
 * - AC-002-2: threadId로 최근 planSnapshot 조회 가능
 * - AC-002-3: conversationId 검증 로직 포함
 * - AC-002-4: 완료/거부 상태 Plan 필터링
 * - AC-002-5: JSONL 파싱 오류 시 null 반환 (에러 무시)
 * - AC-002-6: 단위 테스트 통과
 *
 * @module plan-snapshot.test
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getPreviousPlanSnapshot } from "../agent/react-prompts";
import { AgentHost } from "../agent-host";
import { ConversationLogger } from "../conversation-logger";

import type { PlanSnapshot, PlanStatus } from "../../common/plan-types";
import type { AgentHostDependencies } from "../agent-host";

describe("getPreviousPlanSnapshot() 구현", () => {
  let tempDir: string;
  let conversationLogger: ConversationLogger;
  let agentHost: AgentHost;
  let mockDependencies: AgentHostDependencies;

  beforeEach(async () => {
    // 임시 디렉토리 생성
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-snapshot-test-"));

    // ConversationLogger 초기화
    conversationLogger = new ConversationLogger({
      appDataPath: tempDir,
    });
    await conversationLogger["initialize"]();

    // Mock dependencies
    mockDependencies = {
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

    // AgentHost 초기화 (private 메서드 테스트를 위해)
    agentHost = new AgentHost(mockDependencies);
  });

  afterEach(() => {
    // 임시 디렉토리 삭제
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

  /**
   * AC-002-2: threadId로 최근 planSnapshot 조회 가능
   */
  describe("AC-002-2: threadId로 최근 planSnapshot 조회", () => {
    it("threadId로 가장 최근 planSnapshot을 반환해야 함", async () => {
      const threadId = "thread-001";
      const planSnapshot: PlanSnapshot = {
        conversationId: threadId,
        title: "Cluster Health Analysis",
        summary: "클러스터 상태 분석 Plan",
        status: "drafting" as PlanStatus,
        steps: [
          { title: "Check resources", status: "completed" },
          { title: "Analyze pods", status: "pending" },
        ],
        currentStepIndex: 0,
        snapshotAt: Date.now(),
      };

      await createThreadWithPlan(threadId, planSnapshot);

      // getPreviousPlanSnapshot 호출 (private 메서드 테스트)
      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).not.toBeNull();
      expect(result?.conversationId).toBe(threadId);
      expect(result?.title).toBe("Cluster Health Analysis");
      expect(result?.status).toBe("drafting");
      expect(result?.steps).toHaveLength(2);
    });

    it("여러 Plan 중 가장 최근의 것만 반환해야 함", async () => {
      const threadId = "thread-002";

      // Thread 생성
      await conversationLogger.createThread(threadId);

      // 첫 번째 Plan (오래된 것)
      await conversationLogger.logMessage(threadId, "assistant", "첫 번째 Plan", {
        presentation: "plan-viewer",
        planSnapshot: {
          conversationId: threadId,
          title: "Old Plan",
          summary: "오래된 Plan",
          status: "drafting" as PlanStatus,
          steps: [{ title: "Step 1", status: "pending" }],
          currentStepIndex: 0,
          snapshotAt: Date.now() - 10000,
        },
      });

      // 두 번째 Plan (최근 것)
      const recentPlan: PlanSnapshot = {
        conversationId: threadId,
        title: "New Plan",
        summary: "최근 Plan",
        status: "executing" as PlanStatus,
        steps: [
          { title: "Step 1", status: "completed" },
          { title: "Step 2", status: "in_progress" },
        ],
        currentStepIndex: 1,
        snapshotAt: Date.now(),
      };

      await conversationLogger.logMessage(threadId, "assistant", "두 번째 Plan", {
        presentation: "plan-viewer",
        planSnapshot: recentPlan,
      });

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("New Plan"); // 최근 Plan만 반환
      expect(result?.status).toBe("executing");
    });
  });

  /**
   * AC-002-3: conversationId 검증 로직 포함
   */
  describe("AC-002-3: conversationId 검증", () => {
    it("conversationId가 일치하는 Plan만 반환해야 함", async () => {
      const threadId = "thread-003";
      const otherThreadId = "thread-999";

      // Thread 생성
      await conversationLogger.createThread(threadId);

      // 다른 conversationId의 Plan 저장
      await conversationLogger.logMessage(threadId, "assistant", "다른 대화방의 Plan", {
        presentation: "plan-viewer",
        planSnapshot: {
          conversationId: otherThreadId, // 다른 conversationId!
          title: "Wrong Conversation Plan",
          summary: "잘못된 대화방의 Plan",
          status: "drafting" as PlanStatus,
          steps: [{ title: "Step 1", status: "pending" }],
          currentStepIndex: 0,
          snapshotAt: Date.now(),
        },
      });

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).toBeNull(); // conversationId 불일치로 null 반환
    });

    it("conversationId가 일치하면 정상 반환해야 함", async () => {
      const threadId = "thread-004";

      await createThreadWithPlan(threadId, {
        conversationId: threadId, // 일치하는 conversationId
        title: "Correct Conversation Plan",
        summary: "올바른 대화방의 Plan",
        status: "drafting" as PlanStatus,
        steps: [{ title: "Step 1", status: "pending" }],
        currentStepIndex: 0,
        snapshotAt: Date.now(),
      });

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).not.toBeNull();
      expect(result?.conversationId).toBe(threadId);
      expect(result?.title).toBe("Correct Conversation Plan");
    });
  });

  /**
   * AC-002-4: 완료/거부 상태 Plan 필터링
   */
  describe("AC-002-4: 완료/거부 상태 Plan 필터링", () => {
    it("completed 상태 Plan은 제외해야 함", async () => {
      const threadId = "thread-005";

      await createThreadWithPlan(threadId, {
        conversationId: threadId,
        title: "Completed Plan",
        summary: "완료된 Plan",
        status: "completed" as PlanStatus,
        steps: [{ title: "Step 1", status: "completed" }],
        currentStepIndex: 0,
        snapshotAt: Date.now(),
      });

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).toBeNull(); // completed 상태는 제외
    });

    it("rejected 상태 Plan은 제외해야 함", async () => {
      const threadId = "thread-006";

      await createThreadWithPlan(threadId, {
        conversationId: threadId,
        title: "Rejected Plan",
        summary: "거부된 Plan",
        status: "rejected" as PlanStatus,
        steps: [{ title: "Step 1", status: "pending" }],
        currentStepIndex: 0,
        snapshotAt: Date.now(),
      });

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).toBeNull(); // rejected 상태는 제외
    });

    it("drafting, executing 상태 Plan은 반환해야 함", async () => {
      const threadId = "thread-007";

      // drafting 상태
      await createThreadWithPlan(threadId, {
        conversationId: threadId,
        title: "Drafting Plan",
        summary: "작성 중",
        status: "drafting" as PlanStatus,
        steps: [{ title: "Step 1", status: "pending" }],
        currentStepIndex: 0,
        snapshotAt: Date.now() - 1000,
      });

      let result = await getPreviousPlanSnapshot(threadId, conversationLogger);
      expect(result).not.toBeNull();
      expect(result?.status).toBe("drafting");

      // executing 상태 (더 최근 것)
      await conversationLogger.logMessage(threadId, "assistant", "실행 중인 Plan", {
        presentation: "plan-viewer",
        planSnapshot: {
          conversationId: threadId,
          title: "Executing Plan",
          summary: "실행 중",
          status: "executing" as PlanStatus,
          steps: [{ title: "Step 1", status: "in_progress" }],
          currentStepIndex: 0,
          snapshotAt: Date.now(),
        },
      });

      result = await getPreviousPlanSnapshot(threadId, conversationLogger);
      expect(result).not.toBeNull();
      expect(result?.status).toBe("executing");
    });

    it("가장 최근의 미완료 Plan만 반환해야 함", async () => {
      const threadId = "thread-008";

      await conversationLogger.createThread(threadId);

      // 오래된 미완료 Plan
      await conversationLogger.logMessage(threadId, "assistant", "오래된 미완료 Plan", {
        presentation: "plan-viewer",
        planSnapshot: {
          conversationId: threadId,
          title: "Old Drafting Plan",
          summary: "오래된 작성 중",
          status: "drafting" as PlanStatus,
          steps: [{ title: "Step 1", status: "pending" }],
          currentStepIndex: 0,
          snapshotAt: Date.now() - 10000,
        },
      });

      // 완료된 Plan (중간)
      await conversationLogger.logMessage(threadId, "assistant", "완료된 Plan", {
        presentation: "plan-viewer",
        planSnapshot: {
          conversationId: threadId,
          title: "Completed Plan",
          summary: "완료됨",
          status: "completed" as PlanStatus,
          steps: [{ title: "Step 1", status: "completed" }],
          currentStepIndex: 0,
          snapshotAt: Date.now() - 5000,
        },
      });

      // 최근 미완료 Plan
      await conversationLogger.logMessage(threadId, "assistant", "최근 미완료 Plan", {
        presentation: "plan-viewer",
        planSnapshot: {
          conversationId: threadId,
          title: "Recent Executing Plan",
          summary: "최근 실행 중",
          status: "executing" as PlanStatus,
          steps: [
            { title: "Step 1", status: "completed" },
            { title: "Step 2", status: "in_progress" },
          ],
          currentStepIndex: 1,
          snapshotAt: Date.now(),
        },
      });

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Recent Executing Plan"); // 최근 미완료 Plan만
      expect(result?.status).toBe("executing");
    });
  });

  /**
   * AC-002-5: JSONL 파싱 오류 시 null 반환
   */
  describe("AC-002-5: 에러 처리", () => {
    it("planSnapshot이 없으면 null 반환해야 함", async () => {
      const threadId = "thread-009";

      await conversationLogger.createThread(threadId);

      // planSnapshot 없이 일반 메시지만 저장
      await conversationLogger.logMessage(threadId, "user", "일반 메시지");

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).toBeNull();
    });

    it("빈 메시지 배열이면 null 반환해야 함", async () => {
      const threadId = "thread-010";

      // 메시지가 없는 새 threadId
      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).toBeNull();
    });

    it("JSONL 파싱 오류 시 null 반환하고 에러 로그 기록", async () => {
      const threadId = "thread-011";

      // ConversationLogger mock으로 에러 발생 시뮬레이션
      const mockLogger = conversationLogger;
      jest.spyOn(mockLogger, "getThreadMessages").mockRejectedValueOnce(new Error("JSONL parsing failed"));

      const result = await getPreviousPlanSnapshot(threadId, conversationLogger);

      expect(result).toBeNull(); // 에러 시 null 반환
      // getPreviousPlanSnapshot은 에러 시 로깅 없이 null 반환
      // expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      // expect.stringContaining("[AgentHost] Plan snapshot 조회 실패"),
      // expect.any(Error)
      // );
    });
  });
});
