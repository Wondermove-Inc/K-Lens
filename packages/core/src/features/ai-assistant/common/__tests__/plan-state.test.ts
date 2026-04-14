/**
 * 🎯 목적: PlanState MobX 상태 테스트
 * 01: planState 상태 및 액션 추가
 *
 * 📝 테스트 범위:
 * - 초기 상태
 * - Plan Mode 시작/종료
 * - 단계 추가/업데이트
 * - 실행 상태 추적
 * - 계획 승인/거부
 *
 * @packageDocumentation
 */

import { createPlanStep, PlanStatus, PlanStep, planState } from "../plan-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("PlanState MobX 상태", () => {
  beforeEach(() => {
    planState.reset();
  });

  afterEach(() => {
    planState.reset();
  });

  // ============================================
  // 🔹 초기 상태 테스트
  // ============================================

  describe("초기 상태", () => {
    it("isActive는 false여야 함", () => {
      expect(planState.isActive).toBe(false);
    });

    it("status는 'idle'이어야 함", () => {
      expect(planState.status).toBe("idle");
    });

    it("steps는 빈 배열이어야 함", () => {
      expect(planState.steps).toEqual([]);
    });

    it("currentStepIndex는 -1이어야 함", () => {
      expect(planState.currentStepIndex).toBe(-1);
    });

    it("title은 빈 문자열이어야 함", () => {
      expect(planState.title).toBe("");
    });
  });

  // ============================================
  // 🔹 Plan Mode 시작/종료 테스트
  // ============================================

  describe("Plan Mode 시작/종료", () => {
    it("startPlanMode()가 상태를 활성화", () => {
      planState.startPlanMode("테스트 계획");

      expect(planState.isActive).toBe(true);
      expect(planState.status).toBe("drafting");
      expect(planState.title).toBe("테스트 계획");
    });

    it("endPlanMode()가 상태 초기화", () => {
      planState.startPlanMode("테스트 계획");
      planState.addStep(createPlanStep("단계 1"));
      planState.endPlanMode();

      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
      expect(planState.steps).toEqual([]);
    });

    it("중복 startPlanMode()는 기존 상태 리셋 후 시작", () => {
      planState.startPlanMode("첫 번째 계획");
      planState.addStep(createPlanStep("단계 1"));

      planState.startPlanMode("두 번째 계획");

      expect(planState.title).toBe("두 번째 계획");
      expect(planState.steps).toEqual([]);
    });
  });

  // ============================================
  // 🔹 단계 추가/업데이트 테스트
  // ============================================

  describe("단계 관리", () => {
    beforeEach(() => {
      planState.startPlanMode("테스트 계획");
    });

    it("addStep()이 단계 추가", () => {
      const step = createPlanStep("테스트 단계");
      planState.addStep(step);

      expect(planState.steps.length).toBe(1);
      expect(planState.steps[0].title).toBe("테스트 단계");
    });

    it("addStep()이 순서대로 추가", () => {
      planState.addStep(createPlanStep("단계 1"));
      planState.addStep(createPlanStep("단계 2"));
      planState.addStep(createPlanStep("단계 3"));

      expect(planState.steps.length).toBe(3);
      expect(planState.steps.map((s) => s.title)).toEqual(["단계 1", "단계 2", "단계 3"]);
    });

    it("updateStep()이 단계 업데이트", () => {
      planState.addStep(createPlanStep("원본 단계"));
      planState.updateStep(0, { title: "수정된 단계" });

      expect(planState.steps[0].title).toBe("수정된 단계");
    });

    it("updateStep()이 상태만 업데이트 가능", () => {
      planState.addStep(createPlanStep("단계"));
      planState.updateStep(0, { status: "completed" });

      expect(planState.steps[0].status).toBe("completed");
    });

    it("removeStep()이 단계 제거", () => {
      planState.addStep(createPlanStep("단계 1"));
      planState.addStep(createPlanStep("단계 2"));
      planState.removeStep(0);

      expect(planState.steps.length).toBe(1);
      expect(planState.steps[0].title).toBe("단계 2");
    });

    it("잘못된 인덱스는 무시", () => {
      planState.addStep(createPlanStep("단계"));

      expect(() => {
        planState.updateStep(999, { title: "변경" });
      }).not.toThrow();

      expect(() => {
        planState.removeStep(999);
      }).not.toThrow();
    });
  });

  // ============================================
  // 🔹 계획 승인/거부 테스트
  // ============================================

  describe("계획 승인/거부", () => {
    beforeEach(() => {
      planState.startPlanMode("테스트 계획");
      planState.addStep(createPlanStep("단계 1"));
      planState.addStep(createPlanStep("단계 2"));
    });

    it("approvePlan()이 상태를 executing으로 변경", () => {
      planState.approvePlan();

      expect(planState.status).toBe("executing");
      expect(planState.currentStepIndex).toBe(0);
    });

    it("rejectPlan()이 계획 초기화", () => {
      planState.rejectPlan();

      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });

    it("빈 계획은 승인 불가", () => {
      planState.reset();
      planState.startPlanMode("빈 계획");

      expect(() => planState.approvePlan()).not.toThrow();
      // 단계가 없으면 승인되지 않음
      expect(planState.status).toBe("drafting");
    });
  });

  // ============================================
  // 🔹 실행 상태 추적 테스트
  // ============================================

  describe("실행 상태 추적", () => {
    beforeEach(() => {
      planState.startPlanMode("테스트 계획");
      planState.addStep(createPlanStep("단계 1"));
      planState.addStep(createPlanStep("단계 2"));
      planState.addStep(createPlanStep("단계 3"));
      planState.approvePlan();
    });

    it("startStep()이 현재 단계 시작", () => {
      planState.startStep(0);

      expect(planState.steps[0].status).toBe("in_progress");
      expect(planState.currentStepIndex).toBe(0);
    });

    it("completeStep()이 단계 완료", () => {
      planState.startStep(0);
      planState.completeStep(0, "성공적으로 완료");

      expect(planState.steps[0].status).toBe("completed");
      expect(planState.steps[0].result).toBe("성공적으로 완료");
    });

    it("skipStep()이 단계 건너뛰기", () => {
      planState.skipStep(0, "필요 없음");

      expect(planState.steps[0].status).toBe("skipped");
      expect(planState.steps[0].result).toBe("필요 없음");
    });

    it("failStep()이 단계 실패 표시", () => {
      planState.startStep(0);
      planState.failStep(0, "오류 발생");

      expect(planState.steps[0].status).toBe("failed");
      expect(planState.steps[0].error).toBe("오류 발생");
    });

    it("nextStep()이 다음 단계로 이동", () => {
      planState.startStep(0);
      planState.completeStep(0);
      planState.nextStep();

      expect(planState.currentStepIndex).toBe(1);
    });

    it("모든 단계 완료 시 status가 completed", () => {
      planState.startStep(0);
      planState.completeStep(0);
      planState.nextStep();

      planState.startStep(1);
      planState.completeStep(1);
      planState.nextStep();

      planState.startStep(2);
      planState.completeStep(2);
      planState.nextStep();

      expect(planState.status).toBe("completed");
    });
  });

  // ============================================
  // 🔹 computed 속성 테스트
  // ============================================

  describe("computed 속성", () => {
    beforeEach(() => {
      planState.startPlanMode("테스트 계획");
      planState.addStep(createPlanStep("단계 1"));
      planState.addStep(createPlanStep("단계 2"));
      planState.addStep(createPlanStep("단계 3"));
    });

    it("totalSteps가 전체 단계 수 반환", () => {
      expect(planState.totalSteps).toBe(3);
    });

    it("completedSteps가 완료된 단계 수 반환", () => {
      planState.approvePlan();
      planState.startStep(0);
      planState.completeStep(0);
      planState.nextStep();
      planState.startStep(1);
      planState.completeStep(1);

      expect(planState.completedSteps).toBe(2);
    });

    it("progressPercentage가 진행률 반환", () => {
      planState.approvePlan();
      planState.startStep(0);
      planState.completeStep(0);

      // 1/3 완료 = 33.33%
      expect(planState.progressPercentage).toBeCloseTo(33.33, 1);
    });

    it("currentStep이 현재 단계 반환", () => {
      planState.approvePlan();

      expect(planState.currentStep).toEqual(planState.steps[0]);

      planState.startStep(0);
      planState.completeStep(0);
      planState.nextStep();

      expect(planState.currentStep).toEqual(planState.steps[1]);
    });

    it("hasSteps가 단계 존재 여부 반환", () => {
      expect(planState.hasSteps).toBe(true);

      planState.reset();
      planState.startPlanMode("빈 계획");
      expect(planState.hasSteps).toBe(false);
    });

    it("canApprove가 승인 가능 여부 반환", () => {
      expect(planState.canApprove).toBe(true);

      planState.reset();
      planState.startPlanMode("빈 계획");
      expect(planState.canApprove).toBe(false);
    });

    it("isExecuting이 실행 중 여부 반환", () => {
      expect(planState.isExecuting).toBe(false);

      planState.approvePlan();
      expect(planState.isExecuting).toBe(true);

      planState.startStep(0);
      planState.completeStep(0);
      planState.nextStep();
      planState.startStep(1);
      planState.completeStep(1);
      planState.nextStep();
      planState.startStep(2);
      planState.completeStep(2);
      planState.nextStep();

      expect(planState.isExecuting).toBe(false);
    });
  });

  // ============================================
  // 🔹 시나리오 테스트
  // ============================================

  describe("시나리오 테스트", () => {
    it("전체 플로우: 계획 작성 → 승인 → 실행 → 완료", () => {
      // 1. 계획 작성 시작
      planState.startPlanMode("Kubernetes 리소스 정리");
      expect(planState.status).toBe("drafting");

      // 2. 단계 추가
      planState.addStep(createPlanStep("Unused ConfigMap 확인", "kubectl get cm"));
      planState.addStep(createPlanStep("삭제 대상 선정"));
      planState.addStep(createPlanStep("ConfigMap 삭제", "kubectl delete cm unused-1"));

      expect(planState.totalSteps).toBe(3);

      // 3. 사용자 승인
      planState.approvePlan();
      expect(planState.status).toBe("executing");
      expect(planState.currentStepIndex).toBe(0);

      // 4. 첫 번째 단계 실행
      planState.startStep(0);
      expect(planState.steps[0].status).toBe("in_progress");
      planState.completeStep(0, "ConfigMap 5개 발견");
      planState.nextStep();

      // 5. 두 번째 단계 실행
      planState.startStep(1);
      planState.completeStep(1, "unused-1, unused-2 선정");
      planState.nextStep();

      // 6. 세 번째 단계 실행
      planState.startStep(2);
      planState.completeStep(2, "삭제 완료");
      planState.nextStep();

      // 7. 완료 확인
      expect(planState.status).toBe("completed");
      expect(planState.completedSteps).toBe(3);
      expect(planState.progressPercentage).toBe(100);
    });

    it("계획 거부 시나리오", () => {
      planState.startPlanMode("위험한 작업");
      planState.addStep(createPlanStep("모든 Pod 삭제"));

      planState.rejectPlan();

      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });

    it("단계 실패 시나리오", () => {
      planState.startPlanMode("배포");
      planState.addStep(createPlanStep("빌드"));
      planState.addStep(createPlanStep("테스트"));
      planState.addStep(createPlanStep("배포"));
      planState.approvePlan();

      // 첫 번째 성공
      planState.startStep(0);
      planState.completeStep(0);
      planState.nextStep();

      // 두 번째 실패
      planState.startStep(1);
      planState.failStep(1, "테스트 실패: 3개 케이스 오류");

      expect(planState.steps[1].status).toBe("failed");
      expect(planState.steps[1].error).toBe("테스트 실패: 3개 케이스 오류");
      expect(planState.status).toBe("failed");
    });
  });
});

// ============================================
// 🔹 createPlanStep 헬퍼 테스트
// ============================================

describe("createPlanStep 헬퍼", () => {
  it("기본 단계 생성", () => {
    const step = createPlanStep("테스트 단계");

    expect(step.title).toBe("테스트 단계");
    expect(step.status).toBe("pending");
    expect(step.command).toBeUndefined();
  });

  it("커맨드와 함께 단계 생성", () => {
    const step = createPlanStep("kubectl 실행", "kubectl get pods");

    expect(step.title).toBe("kubectl 실행");
    expect(step.command).toBe("kubectl get pods");
  });

  it("상세 설명과 함께 단계 생성", () => {
    const step = createPlanStep("확인", undefined, "Pod 상태를 확인합니다");

    expect(step.description).toBe("Pod 상태를 확인합니다");
  });
});

// ============================================
// 🔹 Auto Plan Tracker 기능 테스트 (2026-01-12)
// ============================================

describe("Auto Plan Tracker 액션", () => {
  beforeEach(() => {
    planState.reset();
  });

  afterEach(() => {
    planState.reset();
  });

  // ============================================
  // 🔹 setStatus 액션 테스트
  // ============================================

  describe("setStatus 액션", () => {
    it("drafting 상태로 설정 시 isActive가 true", () => {
      planState.setStatus("drafting");

      expect(planState.status).toBe("drafting");
      expect(planState.isActive).toBe(true);
    });

    it("executing 상태로 설정 시 isActive가 true", () => {
      planState.setStatus("executing");

      expect(planState.status).toBe("executing");
      expect(planState.isActive).toBe(true);
    });

    it("completed 상태로 설정 시 isActive가 true 유지 (결과 표시용)", () => {
      planState.startPlanMode("테스트");
      planState.setStatus("completed");

      expect(planState.status).toBe("completed");
      expect(planState.isActive).toBe(true);
    });

    it("rejected 상태로 설정 시 isActive가 false", () => {
      planState.startPlanMode("테스트");
      planState.setStatus("rejected");

      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });

    it("failed 상태로 설정 시 isActive가 true 유지 (에러 표시용)", () => {
      planState.startPlanMode("테스트");
      planState.setStatus("failed");

      expect(planState.status).toBe("failed");
      expect(planState.isActive).toBe(true);
    });

    it("idle 상태로 설정 시 isActive가 false", () => {
      planState.startPlanMode("테스트");
      planState.setStatus("idle");

      expect(planState.status).toBe("idle");
      expect(planState.isActive).toBe(false);
    });
  });

  // ============================================
  // 🔹 setSummary 액션 테스트
  // ============================================

  describe("setSummary 액션", () => {
    it("summary를 설정", () => {
      const summary = "이 계획은 클러스터의 미사용 리소스를 정리합니다.";
      planState.setSummary(summary);

      expect(planState.summary).toBe(summary);
    });

    it("빈 summary 설정 가능", () => {
      planState.setSummary("초기 요약");
      planState.setSummary("");

      expect(planState.summary).toBe("");
    });
  });

  // ============================================
  // 🔹 initializeFromPlanEvent 액션 테스트
  // ============================================

  describe("initializeFromPlanEvent 액션", () => {
    it("IPC 이벤트로부터 Plan 상태 초기화", () => {
      const title = "Kubernetes 리소스 정리";
      const summary = "미사용 ConfigMap과 Secret을 정리합니다.";
      const steps = [
        { title: "ConfigMap 조회", description: "미사용 ConfigMap 목록 조회", command: "kubectl get cm" },
        { title: "Secret 조회", description: "미사용 Secret 목록 조회", command: "kubectl get secret" },
        { title: "리소스 삭제", description: "선택된 리소스 삭제" },
      ];

      planState.initializeFromPlanEvent(title, summary, steps);

      expect(planState.isActive).toBe(true);
      expect(planState.status).toBe("drafting");
      expect(planState.title).toBe(title);
      expect(planState.summary).toBe(summary);
      expect(planState.totalSteps).toBe(3);
      expect(planState.steps[0].title).toBe("ConfigMap 조회");
      expect(planState.steps[0].command).toBe("kubectl get cm");
      expect(planState.steps[1].title).toBe("Secret 조회");
      expect(planState.steps[2].description).toBe("선택된 리소스 삭제");
    });

    it("기존 상태를 리셋하고 새로 초기화", () => {
      // 기존 Plan 설정
      planState.startPlanMode("이전 계획");
      planState.addStep(createPlanStep("이전 단계"));
      planState.setSummary("이전 요약");

      // 새 Plan으로 초기화
      planState.initializeFromPlanEvent("새 계획", "새 요약", [{ title: "새 단계 1" }, { title: "새 단계 2" }]);

      expect(planState.title).toBe("새 계획");
      expect(planState.summary).toBe("새 요약");
      expect(planState.totalSteps).toBe(2);
      expect(planState.steps[0].title).toBe("새 단계 1");
    });

    it("빈 단계 배열로도 초기화 가능", () => {
      planState.initializeFromPlanEvent("빈 계획", "요약", []);

      expect(planState.isActive).toBe(true);
      expect(planState.totalSteps).toBe(0);
      expect(planState.hasSteps).toBe(false);
    });

    it("command와 description이 없는 단계도 처리", () => {
      planState.initializeFromPlanEvent("테스트", "요약", [{ title: "단순 단계" }]);

      expect(planState.steps[0].title).toBe("단순 단계");
      expect(planState.steps[0].command).toBeUndefined();
      expect(planState.steps[0].description).toBeUndefined();
    });
  });

  // ============================================
  // 🔹 Auto Plan Tracker 시나리오 테스트
  // ============================================

  describe("Auto Plan Tracker 시나리오", () => {
    it("IPC 기반 전체 플로우: 이벤트 수신 → 승인 → 실행 → 완료", () => {
      // 1. plan-generated 이벤트 시뮬레이션
      planState.initializeFromPlanEvent("미사용 리소스 정리", "클러스터의 미사용 ConfigMap과 Secret을 정리합니다.", [
        { title: "리소스 분석", command: "kubectl get all" },
        { title: "대상 선정" },
        { title: "삭제 실행", command: "kubectl delete cm unused-1" },
      ]);

      expect(planState.isActive).toBe(true);
      expect(planState.status).toBe("drafting");
      expect(planState.totalSteps).toBe(3);

      // 2. 사용자 승인 (plan-status 이벤트: executing)
      planState.setStatus("executing");
      expect(planState.status).toBe("executing");

      // 3. 첫 번째 단계 실행 (plan-step-update 이벤트: in_progress → completed)
      planState.startStep(0);
      expect(planState.steps[0].status).toBe("in_progress");
      expect(planState.currentStepIndex).toBe(0);

      planState.completeStep(0, "분석 완료: 5개 미사용 리소스 발견");
      expect(planState.steps[0].status).toBe("completed");
      expect(planState.steps[0].result).toBe("분석 완료: 5개 미사용 리소스 발견");

      // 4. 두 번째 단계 실행
      planState.startStep(1);
      planState.completeStep(1, "3개 리소스 선정");

      // 5. 세 번째 단계 실행
      planState.startStep(2);
      planState.completeStep(2, "삭제 완료");

      // 6. 완료 (plan-status 이벤트: completed)
      planState.setStatus("completed");

      expect(planState.status).toBe("completed");
      expect(planState.isActive).toBe(true);
      expect(planState.completedSteps).toBe(3);
    });

    it("IPC 기반 거부 플로우: 이벤트 수신 → 거부", () => {
      // 1. plan-generated 이벤트
      planState.initializeFromPlanEvent("위험한 작업", "모든 리소스를 삭제합니다.", [
        { title: "전체 삭제", command: "kubectl delete all --all" },
      ]);

      expect(planState.isActive).toBe(true);

      // 2. 사용자 거부 (plan-status 이벤트: rejected)
      planState.setStatus("rejected");

      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });

    it("IPC 기반 실패 플로우: 이벤트 수신 → 승인 → 실행 중 실패", () => {
      // 1. plan-generated 이벤트
      planState.initializeFromPlanEvent("배포", "새 버전을 배포합니다.", [
        { title: "빌드" },
        { title: "테스트" },
        { title: "배포" },
      ]);

      // 2. 승인
      planState.setStatus("executing");

      // 3. 첫 번째 단계 성공
      planState.startStep(0);
      planState.completeStep(0);

      // 4. 두 번째 단계 실패 (plan-step-update 이벤트: failed)
      planState.startStep(1);
      planState.failStep(1, "테스트 실패: 5개 케이스 오류");

      expect(planState.steps[1].status).toBe("failed");
      expect(planState.steps[1].error).toBe("테스트 실패: 5개 케이스 오류");
      // failStep은 status를 "failed"로 변경 (내부 동작)
      expect(planState.status).toBe("failed");
      // 📝 실제 IPC 플로우에서는 plan-status 이벤트로 setStatus("failed")가 호출되어 isActive가 false가 됨
      // failStep 자체는 isActive를 변경하지 않음 - setStatus를 통해 별도로 처리
      planState.setStatus("failed"); // Main Process에서 전송하는 plan-status 이벤트 시뮬레이션
      expect(planState.isActive).toBe(true); // completed/failed에서도 isActive 유지 (결과 표시용)
    });
  });
});
