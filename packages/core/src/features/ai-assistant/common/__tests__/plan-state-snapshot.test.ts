/**
 * 🎯 목적: PlanState.initializeFromSnapshot() 테스트
 * PlanSnapshot에서 상태 복원 기능
 *
 * 📝 테스트 범위:
 * - PlanSnapshot에서 모든 필드 복원
 * - 이전 상태 초기화
 * - 에러 케이스 처리 (null/undefined)
 * - MobX 반응성
 *
 * @packageDocumentation
 */

import { planState } from "../plan-state";

import type { PlanSnapshot } from "../plan-types";

describe("PlanState.initializeFromSnapshot", () => {
  beforeEach(() => {
    planState.reset();
  });

  afterEach(() => {
    planState.reset();
  });

  // ============================================
  // 🔹 정상 케이스
  // ============================================

  describe("정상 케이스", () => {
    it("PlanSnapshot에서 모든 필드를 복원해야 함", () => {
      // Given: 완전한 PlanSnapshot
      const snapshot: PlanSnapshot = {
        title: "클러스터 분석",
        summary: "클러스터 상태 점검",
        status: "executing",
        steps: [
          { title: "Step 1", description: "분석", status: "completed" },
          { title: "Step 2", description: "결과", status: "pending" },
        ],
        currentStepIndex: 1,
        conversationId: "conv-123",
        snapshotAt: Date.now(),
      };

      // When: 스냅샷에서 복원
      planState.initializeFromSnapshot(snapshot);

      // Then: 모든 필드가 복원되어야 함
      expect(planState.title).toBe("클러스터 분석");
      expect(planState.summary).toBe("클러스터 상태 점검");
      expect(planState.status).toBe("executing");
      expect(planState.steps).toHaveLength(2);
      expect(planState.currentStepIndex).toBe(1);
      expect(planState.currentConversationId).toBe("conv-123");
      expect(planState.isActive).toBe(true);
    });

    it("steps 배열을 올바르게 복원해야 함", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "Test",
        summary: "Summary",
        status: "drafting",
        steps: [
          {
            title: "Build",
            description: "Build the project",
            command: "npm run build",
            status: "completed",
            result: "Success",
          },
          {
            title: "Test",
            description: "Run tests",
            status: "in_progress",
          },
          {
            title: "Deploy",
            status: "pending",
          },
        ],
        currentStepIndex: 1,
        conversationId: "conv-456",
        snapshotAt: Date.now(),
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then: steps가 정확히 복원
      expect(planState.steps).toHaveLength(3);
      expect(planState.steps[0].title).toBe("Build");
      expect(planState.steps[0].description).toBe("Build the project");
      expect(planState.steps[0].command).toBe("npm run build");
      expect(planState.steps[0].status).toBe("completed");
      expect(planState.steps[0].result).toBe("Success");
      expect(planState.steps[1].title).toBe("Test");
      expect(planState.steps[1].status).toBe("in_progress");
      expect(planState.steps[2].title).toBe("Deploy");
      expect(planState.steps[2].status).toBe("pending");
    });

    it("이전 상태를 초기화 후 복원해야 함", () => {
      // Given: 이전 Plan 상태 존재
      planState.startPlanMode("이전 Plan");
      planState.addStep({ title: "Old Step 1", status: "pending" });
      planState.addStep({ title: "Old Step 2", status: "pending" });
      planState.setSummary("이전 요약");

      const oldTitle = planState.title;
      const oldFirstStepTitle = planState.steps[0].title;

      const newSnapshot: PlanSnapshot = {
        title: "새 Plan",
        summary: "새 요약",
        status: "drafting",
        steps: [{ title: "New Step", description: "", status: "pending" }],
        currentStepIndex: 0,
        conversationId: "new-conv",
        snapshotAt: Date.now(),
      };

      // When: 새 스냅샷으로 복원
      planState.initializeFromSnapshot(newSnapshot);

      // Then: 이전 상태는 완전히 사라지고 새 상태로 교체
      expect(planState.title).not.toBe(oldTitle);
      expect(planState.title).toBe("새 Plan");
      expect(planState.summary).toBe("새 요약");
      expect(planState.steps).toHaveLength(1);
      expect(planState.steps[0].title).not.toBe(oldFirstStepTitle);
      expect(planState.steps[0].title).toBe("New Step");
    });

    it("status가 drafting이면 isActive true", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "Test",
        summary: "",
        status: "drafting",
        steps: [],
        currentStepIndex: -1,
        conversationId: "c1",
        snapshotAt: 0,
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then
      expect(planState.status).toBe("drafting");
      expect(planState.isActive).toBe(true);
    });

    it("status가 executing이면 isActive true", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "Test",
        summary: "",
        status: "executing",
        steps: [],
        currentStepIndex: 0,
        conversationId: "c1",
        snapshotAt: 0,
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then
      expect(planState.status).toBe("executing");
      expect(planState.isActive).toBe(true);
    });

    it("status가 completed이면 isActive true (output 확인용)", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "Test",
        summary: "",
        status: "completed",
        steps: [{ title: "Done", status: "completed" }],
        currentStepIndex: 0,
        conversationId: "c1",
        snapshotAt: 0,
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then: 완료된 Plan도 UI에 표시 (output 확인용)
      expect(planState.status).toBe("completed");
      expect(planState.isActive).toBe(true);
    });

    it("빈 steps 배열도 복원 가능", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "Empty Plan",
        summary: "No steps",
        status: "drafting",
        steps: [],
        currentStepIndex: -1,
        conversationId: "empty",
        snapshotAt: Date.now(),
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then
      expect(planState.title).toBe("Empty Plan");
      expect(planState.steps).toHaveLength(0);
      expect(planState.totalSteps).toBe(0);
    });
  });

  // ============================================
  // 🔹 에러 케이스
  // ============================================

  describe("에러 케이스", () => {
    it("null snapshot은 무시해야 함", () => {
      // Given: 기존 Plan 존재
      planState.startPlanMode("기존 Plan");
      const existingTitle = planState.title;

      // When: null 전달
      // @ts-expect-error - null 테스트
      planState.initializeFromSnapshot(null);

      // Then: 상태 유지
      expect(planState.title).toBe(existingTitle);
      expect(planState.isActive).toBe(true);
    });

    it("undefined snapshot은 무시해야 함", () => {
      // Given: 기존 Plan 존재
      planState.startPlanMode("기존 Plan");
      planState.setSummary("기존 요약");
      const existingTitle = planState.title;
      const existingSummary = planState.summary;

      // When: undefined 전달
      // @ts-expect-error - undefined 테스트
      planState.initializeFromSnapshot(undefined);

      // Then: 상태 유지
      expect(planState.title).toBe(existingTitle);
      expect(planState.summary).toBe(existingSummary);
      expect(planState.isActive).toBe(true);
    });

    it("null 또는 undefined 시 기존 상태를 초기화하지 않음", () => {
      // Given
      planState.startPlanMode("기존 Plan");
      planState.addStep({ title: "Step 1", status: "pending" });
      planState.addStep({ title: "Step 2", status: "completed" });

      const originalStepsCount = planState.steps.length;

      // When: null 시도
      // @ts-expect-error - null 테스트
      planState.initializeFromSnapshot(null);

      // Then: steps 유지
      expect(planState.steps).toHaveLength(originalStepsCount);

      // When: undefined 시도
      // @ts-expect-error - undefined 테스트
      planState.initializeFromSnapshot(undefined);

      // Then: 여전히 steps 유지
      expect(planState.steps).toHaveLength(originalStepsCount);
    });
  });

  // ============================================
  // 🔹 대화방 전환 시나리오
  // ============================================

  describe("대화방 전환 시나리오", () => {
    it("대화방 A의 Plan 스냅샷을 로드하여 UI에 표시", () => {
      // Given: 대화방 A의 저장된 Plan 스냅샷
      const conversationA_Snapshot: PlanSnapshot = {
        title: "대화방 A의 Plan",
        summary: "A 작업 내용",
        status: "completed",
        steps: [
          { title: "A Step 1", status: "completed", result: "Done" },
          { title: "A Step 2", status: "completed", result: "Done" },
        ],
        currentStepIndex: 1,
        conversationId: "conversation-A",
        snapshotAt: 1234567890,
      };

      // When: 대화방 A로 전환하여 스냅샷 로드
      planState.initializeFromSnapshot(conversationA_Snapshot);

      // Then: 대화방 A의 Plan이 정확히 표시
      expect(planState.title).toBe("대화방 A의 Plan");
      expect(planState.summary).toBe("A 작업 내용");
      expect(planState.status).toBe("completed");
      expect(planState.steps).toHaveLength(2);
      expect(planState.currentConversationId).toBe("conversation-A");
    });

    it("대화방 B로 전환 시 대화방 A의 상태를 완전히 교체", () => {
      // Given: 대화방 A의 Plan이 활성화된 상태
      const conversationA_Snapshot: PlanSnapshot = {
        title: "대화방 A의 Plan",
        summary: "A 작업",
        status: "executing",
        steps: [{ title: "A Step", status: "in_progress" }],
        currentStepIndex: 0,
        conversationId: "conversation-A",
        snapshotAt: 1000,
      };
      planState.initializeFromSnapshot(conversationA_Snapshot);

      // When: 대화방 B로 전환
      const conversationB_Snapshot: PlanSnapshot = {
        title: "대화방 B의 Plan",
        summary: "B 작업",
        status: "drafting",
        steps: [
          { title: "B Step 1", status: "pending" },
          { title: "B Step 2", status: "pending" },
        ],
        currentStepIndex: -1,
        conversationId: "conversation-B",
        snapshotAt: 2000,
      };
      planState.initializeFromSnapshot(conversationB_Snapshot);

      // Then: 대화방 B의 상태로 완전히 교체
      expect(planState.title).toBe("대화방 B의 Plan");
      expect(planState.summary).toBe("B 작업");
      expect(planState.status).toBe("drafting");
      expect(planState.steps).toHaveLength(2);
      expect(planState.steps[0].title).toBe("B Step 1");
      expect(planState.currentConversationId).toBe("conversation-B");

      // 대화방 A의 데이터는 없음
      expect(planState.title).not.toContain("대화방 A");
    });

    it("Plan이 없는 대화방으로 전환 시 planState는 이전 상태 유지", () => {
      // Given: 대화방 A의 Plan이 활성화된 상태
      planState.startPlanMode("대화방 A의 Plan");
      planState.addStep({ title: "A Step", status: "pending" });

      // When: Plan이 없는 대화방 C로 전환 (null 스냅샷)
      // @ts-expect-error - null 테스트
      planState.initializeFromSnapshot(null);

      // Then: 이전 상태 유지 (reset하지 않음)
      expect(planState.title).toBe("대화방 A의 Plan");
      expect(planState.steps).toHaveLength(1);
    });
  });

  // ============================================
  // 🔹 MobX 반응성 테스트
  // ============================================

  describe("MobX 반응성", () => {
    it("initializeFromSnapshot 호출 시 @action 데코레이터가 적용되어야 함", () => {
      // Given: makeAutoObservable로 생성된 planState
      const snapshot: PlanSnapshot = {
        title: "Reactive Test",
        summary: "Test reactivity",
        status: "drafting",
        steps: [],
        currentStepIndex: -1,
        conversationId: "reactive",
        snapshotAt: Date.now(),
      };

      // When: action 실행
      expect(() => {
        planState.initializeFromSnapshot(snapshot);
      }).not.toThrow();

      // Then: 상태가 변경됨 (MobX가 정상 동작)
      expect(planState.title).toBe("Reactive Test");
    });

    it("복원된 steps는 computed 속성에서 정상 작동", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "Computed Test",
        summary: "Test computed properties",
        status: "executing",
        steps: [
          { title: "Step 1", status: "completed" },
          { title: "Step 2", status: "completed" },
          { title: "Step 3", status: "pending" },
        ],
        currentStepIndex: 2,
        conversationId: "computed",
        snapshotAt: Date.now(),
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then: computed 속성이 정상 계산됨
      expect(planState.totalSteps).toBe(3);
      expect(planState.completedSteps).toBe(2);
      expect(planState.progressPercentage).toBeCloseTo(66.67, 1);
      expect(planState.hasSteps).toBe(true);
      expect(planState.currentStep?.title).toBe("Step 3");
    });
  });

  // ============================================
  // 🔹 엣지 케이스
  // ============================================

  describe("엣지 케이스", () => {
    it("steps에 선택적 필드(command, description, result 등)가 없어도 복원 가능", () => {
      // Given: 최소한의 필드만 있는 steps
      const snapshot: PlanSnapshot = {
        title: "Minimal",
        summary: "Minimal snapshot",
        status: "drafting",
        steps: [
          { title: "Step 1", status: "pending" },
          { title: "Step 2", status: "completed" },
        ],
        currentStepIndex: 0,
        conversationId: "minimal",
        snapshotAt: Date.now(),
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then: 정상 복원
      expect(planState.steps).toHaveLength(2);
      expect(planState.steps[0].command).toBeUndefined();
      expect(planState.steps[0].description).toBeUndefined();
      expect(planState.steps[1].result).toBeUndefined();
    });

    it("currentStepIndex가 -1이어도 복원 가능", () => {
      // Given
      const snapshot: PlanSnapshot = {
        title: "No current step",
        summary: "",
        status: "drafting",
        steps: [{ title: "Future step", status: "pending" }],
        currentStepIndex: -1,
        conversationId: "no-current",
        snapshotAt: Date.now(),
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then
      expect(planState.currentStepIndex).toBe(-1);
      expect(planState.currentStep).toBeUndefined();
    });

    it("매우 많은 steps(100개)도 복원 가능", () => {
      // Given
      const manySteps = Array.from({ length: 100 }, (_, i) => ({
        title: `Step ${i + 1}`,
        status: (i % 4 === 0 ? "completed" : "pending") as const,
      }));

      const snapshot: PlanSnapshot = {
        title: "Many steps",
        summary: "Performance test",
        status: "executing",
        steps: manySteps,
        currentStepIndex: 50,
        conversationId: "many",
        snapshotAt: Date.now(),
      };

      // When
      planState.initializeFromSnapshot(snapshot);

      // Then
      expect(planState.steps).toHaveLength(100);
      expect(planState.currentStepIndex).toBe(50);
      expect(planState.currentStep?.title).toBe("Step 51");
    });
  });
});
