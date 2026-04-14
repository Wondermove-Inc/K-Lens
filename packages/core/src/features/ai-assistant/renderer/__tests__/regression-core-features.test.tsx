/**
 * 🎯 목적: 기존 기능 회귀 테스트 - 핵심 기능들
 * 01: 기존 기능 회귀 테스트
 *
 * 📝 테스트 범위:
 * - StreamingState: 스트리밍 응답 상태 관리
 * - ThinkingState: AI 추론 과정 상태 관리
 * - PlanState: 계획 모드 상태 관리
 * - ContextStore: 컨텍스트 첨부 상태 관리
 *
 * ⚠️ 회귀 테스트 목적:
 * 기존에 구현된 기능들이 새로운 변경사항에 의해
 * 깨지지 않았는지 상세하게 검증
 *
 * @packageDocumentation
 */

import { act } from "@testing-library/react";
import { autorun, runInAction } from "mobx";
import { ContextType } from "../../common/context-types";
import { createPlanStep, planState, StepStatus } from "../../common/plan-state";
import { StreamingState } from "../../common/streaming-state";
import { ThinkingStep, thinkingState } from "../../common/thinking-state";
import { createContextStore, getContextStore, resetContextStore } from "../store/context-store";

import type { ContextItem } from "../../common/context-types";

// ============================================
// 📦 테스트 유틸리티
// ============================================

/** 테스트용 컨텍스트 아이템 생성 */
function createTestContextItem(id: string, name = `Test Context ${id}`, type = ContextType.POD): ContextItem {
  return {
    id,
    type,
    name,
    namespace: "default",
    createdAt: new Date(),
  };
}

// ============================================
// 🔹 StreamingState 회귀 테스트
// ============================================

describe("StreamingState 회귀 테스트", () => {
  let streamingState: StreamingState;

  beforeEach(() => {
    streamingState = new StreamingState();
  });

  describe("AC1: 초기 상태 검증", () => {
    it("모든 초기값이 올바르게 설정되어야 함", () => {
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.currentMessageId).toBeNull();
      expect(streamingState.streamingContent).toBe("");
      expect(streamingState.abortController).toBeNull();
      expect(streamingState.startTime).toBeNull();
      expect(streamingState.firstTokenTime).toBeNull();
      expect(streamingState.error).toBeNull();
      expect(streamingState.isCancelled).toBe(false);
      expect(streamingState.tokenCount).toBe(0);
      expect(streamingState.hasError).toBe(false);
      expect(streamingState.elapsedTime).toBe(0);
      expect(streamingState.canCancel).toBe(false);
    });
  });

  describe("AC2: startStreaming 동작 검증", () => {
    it("스트리밍 시작 시 상태가 올바르게 설정되어야 함", () => {
      const messageId = "msg-001";
      streamingState.startStreaming(messageId);

      expect(streamingState.isStreaming).toBe(true);
      expect(streamingState.currentMessageId).toBe(messageId);
      expect(streamingState.streamingContent).toBe("");
      expect(streamingState.abortController).toBeInstanceOf(AbortController);
      expect(streamingState.startTime).not.toBeNull();
      expect(streamingState.error).toBeNull();
      expect(streamingState.isCancelled).toBe(false);
      expect(streamingState.canCancel).toBe(true);
    });

    it("중복 startStreaming 호출 시 이전 AbortController가 abort 되어야 함", () => {
      streamingState.startStreaming("msg-001");
      const firstController = streamingState.abortController;
      const abortSpy = jest.spyOn(firstController!, "abort");

      streamingState.startStreaming("msg-002");

      expect(abortSpy).toHaveBeenCalled();
      expect(streamingState.currentMessageId).toBe("msg-002");
    });
  });

  describe("AC3: appendStreamingToken 동작 검증", () => {
    it("토큰이 콘텐츠에 누적되어야 함", () => {
      streamingState.startStreaming("msg-001");

      streamingState.appendStreamingToken("Hello");
      expect(streamingState.streamingContent).toBe("Hello");

      streamingState.appendStreamingToken(" World");
      expect(streamingState.streamingContent).toBe("Hello World");

      streamingState.appendStreamingToken("!");
      expect(streamingState.streamingContent).toBe("Hello World!");
    });

    it("첫 토큰 수신 시 firstTokenTime이 설정되어야 함", () => {
      streamingState.startStreaming("msg-001");
      expect(streamingState.firstTokenTime).toBeNull();

      streamingState.appendStreamingToken("First");
      expect(streamingState.firstTokenTime).not.toBeNull();

      const firstTime = streamingState.firstTokenTime;
      streamingState.appendStreamingToken("Second");
      expect(streamingState.firstTokenTime).toBe(firstTime); // 변경되지 않아야 함
    });

    it("스트리밍 중이 아닐 때 appendStreamingToken은 무시되어야 함", () => {
      streamingState.appendStreamingToken("Ignored");
      expect(streamingState.streamingContent).toBe("");
    });

    it("빈 토큰은 firstTokenTime을 설정하지 않아야 함", () => {
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("");
      expect(streamingState.firstTokenTime).toBeNull();
    });
  });

  describe("AC4: tokenCount computed 속성 검증", () => {
    it("토큰 수가 공백 기준으로 정확히 계산되어야 함", () => {
      streamingState.startStreaming("msg-001");

      streamingState.appendStreamingToken("one two three");
      expect(streamingState.tokenCount).toBe(3);

      streamingState.appendStreamingToken(" four five");
      expect(streamingState.tokenCount).toBe(5);
    });

    it("빈 콘텐츠는 0을 반환해야 함", () => {
      expect(streamingState.tokenCount).toBe(0);

      streamingState.startStreaming("msg-001");
      expect(streamingState.tokenCount).toBe(0);

      streamingState.appendStreamingToken("   ");
      expect(streamingState.tokenCount).toBe(0);
    });
  });

  describe("AC5: cancelStreaming 동작 검증", () => {
    it("스트리밍 취소 시 상태가 올바르게 설정되어야 함", () => {
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("Partial content");
      const controller = streamingState.abortController;
      const abortSpy = jest.spyOn(controller!, "abort");

      streamingState.cancelStreaming();

      expect(abortSpy).toHaveBeenCalled();
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.isCancelled).toBe(true);
      expect(streamingState.abortController).toBeNull();
      expect(streamingState.streamingContent).toContain("[응답이 취소되었습니다]");
    });

    it("스트리밍 중이 아닐 때 cancelStreaming은 무시되어야 함", () => {
      streamingState.cancelStreaming();
      expect(streamingState.isCancelled).toBe(false);
    });
  });

  describe("AC6: finalizeStreaming 동작 검증", () => {
    it("스트리밍 완료 시 최종 콘텐츠를 반환해야 함", () => {
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("Final content");

      const result = streamingState.finalizeStreaming();

      expect(result).toBe("Final content");
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.abortController).toBeNull();
      // 콘텐츠는 유지됨
      expect(streamingState.streamingContent).toBe("Final content");
    });
  });

  describe("AC7: handleStreamingError 동작 검증", () => {
    it("에러 발생 시 에러 상태가 설정되어야 함", () => {
      streamingState.startStreaming("msg-001");
      const testError = new Error("Test error");

      streamingState.handleStreamingError(testError);

      expect(streamingState.error).toBe(testError);
      expect(streamingState.hasError).toBe(true);
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.abortController).toBeNull();
    });
  });

  describe("AC8: reset 동작 검증", () => {
    it("reset 시 모든 상태가 초기화되어야 함", () => {
      // 상태 설정
      streamingState.startStreaming("msg-001");
      streamingState.appendStreamingToken("Some content");
      streamingState.handleStreamingError(new Error("Error"));

      // reset 호출
      streamingState.reset();

      // 검증
      expect(streamingState.isStreaming).toBe(false);
      expect(streamingState.currentMessageId).toBeNull();
      expect(streamingState.streamingContent).toBe("");
      expect(streamingState.error).toBeNull();
      expect(streamingState.isCancelled).toBe(false);
    });

    it("reset 시 진행 중인 AbortController가 abort 되어야 함", () => {
      streamingState.startStreaming("msg-001");
      const controller = streamingState.abortController;
      const abortSpy = jest.spyOn(controller!, "abort");

      streamingState.reset();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe("AC9: MobX 반응성 검증", () => {
    it("observable 속성 변경 시 autorun이 트리거되어야 함", () => {
      const reactions: string[] = [];
      const dispose = autorun(() => {
        reactions.push(`isStreaming: ${streamingState.isStreaming}`);
      });

      streamingState.startStreaming("msg-001");
      streamingState.finalizeStreaming();

      expect(reactions).toEqual(["isStreaming: false", "isStreaming: true", "isStreaming: false"]);

      dispose();
    });

    it("computed 속성이 의존성 변경 시 재계산되어야 함", () => {
      // 먼저 스트리밍 시작
      streamingState.startStreaming("msg-001");

      const tokenCounts: number[] = [];
      const dispose = autorun(() => {
        tokenCounts.push(streamingState.tokenCount);
      });

      streamingState.appendStreamingToken("one");
      streamingState.appendStreamingToken(" two");
      streamingState.appendStreamingToken(" three");

      // autorun 시작 시 0, 이후 1, 2, 3
      expect(tokenCounts).toEqual([0, 1, 2, 3]);

      dispose();
    });
  });
});

// ============================================
// 🔹 ThinkingState 회귀 테스트
// ============================================

describe("ThinkingState 회귀 테스트", () => {
  beforeEach(() => {
    thinkingState.reset();
  });

  describe("AC10: 초기 상태 검증", () => {
    it("모든 초기값이 올바르게 설정되어야 함", () => {
      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.currentStep).toBe("idle");
      expect(thinkingState.steps).toEqual([]);
      expect(thinkingState.toolCalls).toEqual([]);
      expect(thinkingState.isExpanded).toBe(true);
      expect(thinkingState.hasToolCalls).toBe(false);
      expect(thinkingState.toolCallCount).toBe(0);
    });
  });

  describe("AC11: startThinking 동작 검증", () => {
    it("Thinking 시작 시 상태가 올바르게 설정되어야 함", () => {
      thinkingState.startThinking();

      expect(thinkingState.isThinking).toBe(true);
      expect(thinkingState.currentStep).toBe("analyzing");
      expect(thinkingState.steps).toHaveLength(1);
      expect(thinkingState.steps[0].step).toBe("analyzing");
      expect(thinkingState.toolCalls).toEqual([]);
      expect(thinkingState.isExpanded).toBe(true);
    });
  });

  describe("AC12: updateThinkingStep 동작 검증", () => {
    it("SRE 진단 루프 단계가 순서대로 기록되어야 함", () => {
      thinkingState.startThinking();

      const steps: ThinkingStep[] = ["observing", "hypothesizing", "validating", "mitigating", "complete"];

      steps.forEach((step, index) => {
        thinkingState.updateThinkingStep(step, `Details for ${step}`);
        expect(thinkingState.currentStep).toBe(step);
        expect(thinkingState.steps).toHaveLength(index + 2); // initial + updates
      });

      expect(thinkingState.steps.map((s) => s.step)).toEqual([
        "analyzing",
        "observing",
        "hypothesizing",
        "validating",
        "mitigating",
        "complete",
      ]);
    });

    it("각 단계에 details가 정확히 저장되어야 함", () => {
      thinkingState.startThinking();
      thinkingState.updateThinkingStep("observing", "Collecting pod metrics");

      const lastStep = thinkingState.steps[thinkingState.steps.length - 1];
      expect(lastStep.details).toBe("Collecting pod metrics");
    });
  });

  describe("AC13: 도구 호출 추적 검증", () => {
    it("도구 호출이 정확히 기록되어야 함", () => {
      thinkingState.startThinking();

      const index1 = thinkingState.addToolCall("kubectl", { command: "get pods" });
      const index2 = thinkingState.addToolCall("describe", { resource: "pod/nginx" });

      expect(thinkingState.hasToolCalls).toBe(true);
      expect(thinkingState.toolCallCount).toBe(2);
      expect(index1).toBe(0);
      expect(index2).toBe(1);
    });

    it("도구 호출 결과가 정확히 업데이트되어야 함", () => {
      thinkingState.startThinking();
      const index = thinkingState.addToolCall("kubectl", { command: "get pods" });

      thinkingState.updateToolCallResult(index, { pods: ["nginx", "redis"] });

      expect(thinkingState.toolCalls[index].result).toEqual({ pods: ["nginx", "redis"] });
      expect(thinkingState.pendingToolCalls).toBe(0);
    });

    it("pendingToolCalls가 결과 없는 호출 수를 반환해야 함", () => {
      thinkingState.startThinking();
      thinkingState.addToolCall("tool1", {});
      thinkingState.addToolCall("tool2", {});
      thinkingState.addToolCall("tool3", {});

      expect(thinkingState.pendingToolCalls).toBe(3);

      thinkingState.updateToolCallResult(0, "result1");
      expect(thinkingState.pendingToolCalls).toBe(2);

      thinkingState.updateToolCallResult(1, "result2");
      thinkingState.updateToolCallResult(2, "result3");
      expect(thinkingState.pendingToolCalls).toBe(0);
    });
  });

  describe("AC14: completeThinking 동작 검증", () => {
    it("Thinking 완료 시 상태가 올바르게 설정되어야 함", () => {
      thinkingState.startThinking();
      thinkingState.updateThinkingStep("observing");
      thinkingState.completeThinking();

      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.currentStep).toBe("complete");
      expect(thinkingState.steps[thinkingState.steps.length - 1].step).toBe("complete");
    });
  });

  describe("AC15: toggleThinkingExpanded 동작 검증", () => {
    it("접기/펼치기 토글이 정상 동작해야 함", () => {
      expect(thinkingState.isExpanded).toBe(true);

      thinkingState.toggleThinkingExpanded();
      expect(thinkingState.isExpanded).toBe(false);

      thinkingState.toggleThinkingExpanded();
      expect(thinkingState.isExpanded).toBe(true);
    });
  });

  describe("AC16: currentStepLabel computed 검증", () => {
    it("각 단계별 레이블이 정확히 반환되어야 함", () => {
      expect(thinkingState.currentStepLabel).toBe("");

      thinkingState.startThinking();
      expect(thinkingState.currentStepLabel).toBe("분석 중...");

      thinkingState.updateThinkingStep("observing");
      expect(thinkingState.currentStepLabel).toBe("👁️ 관찰 중...");

      thinkingState.updateThinkingStep("hypothesizing");
      expect(thinkingState.currentStepLabel).toBe("💭 가설 수립 중...");

      thinkingState.updateThinkingStep("validating");
      expect(thinkingState.currentStepLabel).toBe("✅ 검증 중...");

      thinkingState.updateThinkingStep("mitigating");
      expect(thinkingState.currentStepLabel).toBe("🔧 조치 중...");

      thinkingState.completeThinking();
      expect(thinkingState.currentStepLabel).toBe("✨ 완료");
    });
  });
});

// ============================================
// 🔹 PlanState 회귀 테스트
// ============================================

describe("PlanState 회귀 테스트", () => {
  beforeEach(() => {
    planState.reset();
  });

  describe("AC17: 초기 상태 검증", () => {
    it("모든 초기값이 올바르게 설정되어야 함", () => {
      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
      expect(planState.title).toBe("");
      expect(planState.steps).toEqual([]);
      expect(planState.currentStepIndex).toBe(-1);
      expect(planState.totalSteps).toBe(0);
      expect(planState.completedSteps).toBe(0);
      expect(planState.progressPercentage).toBe(0);
      expect(planState.hasSteps).toBe(false);
      expect(planState.canApprove).toBe(false);
      expect(planState.isExecuting).toBe(false);
    });
  });

  describe("AC18: Plan Mode 라이프사이클 검증", () => {
    it("startPlanMode로 Plan Mode가 시작되어야 함", () => {
      planState.startPlanMode("Pod 복구 계획");

      expect(planState.isActive).toBe(true);
      expect(planState.status).toBe("drafting");
      expect(planState.title).toBe("Pod 복구 계획");
      expect(planState.steps).toEqual([]);
    });

    it("endPlanMode로 Plan Mode가 종료되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));
      planState.endPlanMode();

      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
      expect(planState.steps).toEqual([]);
    });
  });

  describe("AC19: 단계 CRUD 검증", () => {
    it("addStep으로 단계가 추가되어야 함", () => {
      planState.startPlanMode("Test Plan");

      planState.addStep(createPlanStep("First Step", "cmd1"));
      planState.addStep(createPlanStep("Second Step", "cmd2"));
      planState.addStep(createPlanStep("Third Step", "cmd3"));

      expect(planState.steps).toHaveLength(3);
      expect(planState.totalSteps).toBe(3);
      expect(planState.hasSteps).toBe(true);
      expect(planState.canApprove).toBe(true);
    });

    it("updateStep으로 단계가 업데이트되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Original Title", "cmd1"));

      planState.updateStep(0, { title: "Updated Title", description: "New desc" });

      expect(planState.steps[0].title).toBe("Updated Title");
      expect(planState.steps[0].description).toBe("New desc");
    });

    it("removeStep으로 단계가 삭제되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));
      planState.addStep(createPlanStep("Step 2", "cmd2"));

      planState.removeStep(0);

      expect(planState.steps).toHaveLength(1);
      expect(planState.steps[0].title).toBe("Step 2");
    });

    it("유효하지 않은 인덱스로 updateStep/removeStep 시 무시되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));

      planState.updateStep(-1, { title: "Invalid" });
      planState.updateStep(100, { title: "Invalid" });
      planState.removeStep(-1);
      planState.removeStep(100);

      expect(planState.steps).toHaveLength(1);
      expect(planState.steps[0].title).toBe("Step 1");
    });
  });

  describe("AC20: 계획 승인/거부 검증", () => {
    it("approvePlan으로 실행 상태로 전환되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));
      planState.addStep(createPlanStep("Step 2", "cmd2"));

      planState.approvePlan();

      expect(planState.status).toBe("executing");
      expect(planState.currentStepIndex).toBe(0);
      expect(planState.isExecuting).toBe(true);
    });

    it("단계가 없으면 approvePlan이 무시되어야 함", () => {
      planState.startPlanMode("Test Plan");

      planState.approvePlan();

      expect(planState.status).toBe("drafting");
      expect(planState.currentStepIndex).toBe(-1);
    });

    it("rejectPlan으로 거부 상태로 전환되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));

      planState.rejectPlan();

      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });
  });

  describe("AC21: 실행 상태 추적 검증", () => {
    beforeEach(() => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));
      planState.addStep(createPlanStep("Step 2", "cmd2"));
      planState.addStep(createPlanStep("Step 3", "cmd3"));
      planState.approvePlan();
    });

    it("startStep으로 단계가 진행 중 상태가 되어야 함", () => {
      planState.startStep(0);

      expect(planState.steps[0].status).toBe("in_progress");
      expect(planState.currentStepIndex).toBe(0);
    });

    it("completeStep으로 단계가 완료 상태가 되어야 함", () => {
      planState.startStep(0);
      planState.completeStep(0, "Success result");

      expect(planState.steps[0].status).toBe("completed");
      expect(planState.steps[0].result).toBe("Success result");
      expect(planState.completedSteps).toBe(1);
    });

    it("skipStep으로 단계가 건너뛰기 상태가 되어야 함", () => {
      planState.skipStep(1, "Not needed");

      expect(planState.steps[1].status).toBe("skipped");
      expect(planState.steps[1].result).toBe("Not needed");
    });

    it("failStep으로 단계가 실패 상태가 되어야 함", () => {
      planState.startStep(0);
      planState.failStep(0, "Timeout error");

      expect(planState.steps[0].status).toBe("failed");
      expect(planState.steps[0].error).toBe("Timeout error");
      expect(planState.status).toBe("failed");
    });

    it("nextStep으로 다음 단계로 이동해야 함", () => {
      planState.completeStep(0);
      planState.nextStep();

      expect(planState.currentStepIndex).toBe(1);

      planState.completeStep(1);
      planState.nextStep();

      expect(planState.currentStepIndex).toBe(2);
    });

    it("마지막 단계에서 nextStep 시 completed 상태가 되어야 함", () => {
      planState.completeStep(0);
      planState.nextStep();
      planState.completeStep(1);
      planState.nextStep();
      planState.completeStep(2);
      planState.nextStep();

      expect(planState.status).toBe("completed");
    });
  });

  describe("AC22: progressPercentage computed 검증", () => {
    it("진행률이 정확히 계산되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("Step 1", "cmd1"));
      planState.addStep(createPlanStep("Step 2", "cmd2"));
      planState.addStep(createPlanStep("Step 3", "cmd3"));
      planState.addStep(createPlanStep("Step 4", "cmd4"));
      planState.approvePlan();

      expect(planState.progressPercentage).toBe(0);

      planState.completeStep(0);
      expect(planState.progressPercentage).toBe(25);

      planState.completeStep(1);
      expect(planState.progressPercentage).toBe(50);

      planState.completeStep(2);
      expect(planState.progressPercentage).toBe(75);

      planState.completeStep(3);
      expect(planState.progressPercentage).toBe(100);
    });
  });

  describe("AC23: currentStep computed 검증", () => {
    it("currentStepIndex에 따라 올바른 단계가 반환되어야 함", () => {
      planState.startPlanMode("Test Plan");
      planState.addStep(createPlanStep("First", "cmd1"));
      planState.addStep(createPlanStep("Second", "cmd2"));
      planState.approvePlan();

      expect(planState.currentStep?.title).toBe("First");

      planState.nextStep();
      expect(planState.currentStep?.title).toBe("Second");
    });

    it("currentStepIndex가 -1이면 undefined를 반환해야 함", () => {
      planState.startPlanMode("Test Plan");
      expect(planState.currentStep).toBeUndefined();
    });
  });
});

// ============================================
// 🔹 ContextStore 회귀 테스트
// ============================================

describe("ContextStore 회귀 테스트", () => {
  beforeEach(() => {
    resetContextStore();
  });

  describe("AC24: 팩토리 함수 검증", () => {
    it("createContextStore로 새 인스턴스가 생성되어야 함", () => {
      const store1 = createContextStore();
      const store2 = createContextStore();

      expect(store1).not.toBe(store2);
    });

    it("getContextStore가 싱글톤을 반환해야 함", () => {
      const store1 = getContextStore();
      const store2 = getContextStore();

      expect(store1).toBe(store2);
    });

    it("resetContextStore가 싱글톤을 초기화해야 함", () => {
      const store1 = getContextStore();
      store1.addContext(createTestContextItem("ctx-1"));

      resetContextStore();
      const store2 = getContextStore();

      expect(store2).not.toBe(store1);
      expect(store2.hasContexts).toBe(false);
    });
  });

  describe("AC25: 초기 상태 검증", () => {
    it("모든 초기값이 올바르게 설정되어야 함", () => {
      const store = createContextStore();

      expect(store.attachedContexts).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.maxContexts).toBe(10);
      expect(store.hasContexts).toBe(false);
      expect(store.contextCount).toBe(0);
      expect(store.isMaxReached).toBe(false);
    });
  });

  describe("AC26: addContext 동작 검증", () => {
    it("컨텍스트가 정상적으로 추가되어야 함", () => {
      const store = createContextStore();
      const item = createTestContextItem("ctx-1");

      store.addContext(item);

      expect(store.attachedContexts).toHaveLength(1);
      expect(store.hasContexts).toBe(true);
      expect(store.contextCount).toBe(1);
    });

    it("중복 ID 컨텍스트는 무시되어야 함", () => {
      const store = createContextStore();
      const item1 = createTestContextItem("ctx-1", "First");
      const item2 = createTestContextItem("ctx-1", "Second");

      store.addContext(item1);
      store.addContext(item2);

      expect(store.contextCount).toBe(1);
      expect(store.attachedContexts[0].name).toBe("First");
    });

    it("maxContexts 초과 시 가장 오래된 항목이 제거되어야 함", () => {
      const store = createContextStore();
      store.setMaxContexts(3);

      store.addContext(createTestContextItem("ctx-1"));
      store.addContext(createTestContextItem("ctx-2"));
      store.addContext(createTestContextItem("ctx-3"));
      store.addContext(createTestContextItem("ctx-4"));

      expect(store.contextCount).toBe(3);
      expect(store.attachedContexts.map((c) => c.id)).toEqual(["ctx-2", "ctx-3", "ctx-4"]);
    });
  });

  describe("AC27: addContexts 동작 검증", () => {
    it("여러 컨텍스트가 일괄 추가되어야 함", () => {
      const store = createContextStore();
      const items = [createTestContextItem("ctx-1"), createTestContextItem("ctx-2"), createTestContextItem("ctx-3")];

      store.addContexts(items);

      expect(store.contextCount).toBe(3);
    });
  });

  describe("AC28: removeContext 동작 검증", () => {
    it("컨텍스트가 정상적으로 삭제되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1"));
      store.addContext(createTestContextItem("ctx-2"));
      store.addContext(createTestContextItem("ctx-3"));

      store.removeContext("ctx-2");

      expect(store.contextCount).toBe(2);
      expect(store.attachedContexts.map((c) => c.id)).toEqual(["ctx-1", "ctx-3"]);
    });

    it("존재하지 않는 ID로 removeContext 시 무시되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1"));

      store.removeContext("non-existent");

      expect(store.contextCount).toBe(1);
    });
  });

  describe("AC29: clearContexts 동작 검증", () => {
    it("모든 컨텍스트가 삭제되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1"));
      store.addContext(createTestContextItem("ctx-2"));

      store.clearContexts();

      expect(store.hasContexts).toBe(false);
      expect(store.contextCount).toBe(0);
    });
  });

  describe("AC30: updateContext 동작 검증", () => {
    it("컨텍스트가 정상적으로 업데이트되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1", "Original"));

      store.updateContext("ctx-1", { name: "Updated" });

      expect(store.attachedContexts[0].name).toBe("Updated");
      expect(store.attachedContexts[0].id).toBe("ctx-1"); // ID는 유지
    });

    it("존재하지 않는 ID로 updateContext 시 무시되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1", "Original"));

      store.updateContext("non-existent", { name: "Updated" });

      expect(store.attachedContexts[0].name).toBe("Original");
    });
  });

  describe("AC31: moveContext 동작 검증", () => {
    it("컨텍스트 순서가 변경되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1"));
      store.addContext(createTestContextItem("ctx-2"));
      store.addContext(createTestContextItem("ctx-3"));

      store.moveContext("ctx-3", 0);

      expect(store.attachedContexts.map((c) => c.id)).toEqual(["ctx-3", "ctx-1", "ctx-2"]);
    });

    it("유효하지 않은 인덱스로 moveContext 시 무시되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1"));
      store.addContext(createTestContextItem("ctx-2"));

      store.moveContext("ctx-1", -1);
      store.moveContext("ctx-1", 100);

      expect(store.attachedContexts.map((c) => c.id)).toEqual(["ctx-1", "ctx-2"]);
    });
  });

  describe("AC32: replaceContexts 동작 검증", () => {
    it("전체 컨텍스트 목록이 교체되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("old-1"));
      store.addContext(createTestContextItem("old-2"));

      store.replaceContexts([
        createTestContextItem("new-1"),
        createTestContextItem("new-2"),
        createTestContextItem("new-3"),
      ]);

      expect(store.contextCount).toBe(3);
      expect(store.attachedContexts.map((c) => c.id)).toEqual(["new-1", "new-2", "new-3"]);
    });

    it("maxContexts 초과 시 마지막 항목들만 유지되어야 함", () => {
      const store = createContextStore();
      store.setMaxContexts(2);

      store.replaceContexts([
        createTestContextItem("ctx-1"),
        createTestContextItem("ctx-2"),
        createTestContextItem("ctx-3"),
        createTestContextItem("ctx-4"),
      ]);

      expect(store.contextCount).toBe(2);
      expect(store.attachedContexts.map((c) => c.id)).toEqual(["ctx-3", "ctx-4"]);
    });
  });

  describe("AC33: setMaxContexts 동작 검증", () => {
    it("최대 컨텍스트 개수가 설정되어야 함", () => {
      const store = createContextStore();

      store.setMaxContexts(5);

      expect(store.maxContexts).toBe(5);
    });

    it("최소 1 이상이어야 함", () => {
      const store = createContextStore();

      store.setMaxContexts(0);
      expect(store.maxContexts).toBe(1);

      store.setMaxContexts(-5);
      expect(store.maxContexts).toBe(1);
    });

    it("기존 컨텍스트가 초과 시 오래된 것부터 삭제되어야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1"));
      store.addContext(createTestContextItem("ctx-2"));
      store.addContext(createTestContextItem("ctx-3"));
      store.addContext(createTestContextItem("ctx-4"));

      store.setMaxContexts(2);

      expect(store.contextCount).toBe(2);
      expect(store.attachedContexts.map((c) => c.id)).toEqual(["ctx-3", "ctx-4"]);
    });
  });

  describe("AC34: 조회 메서드 검증", () => {
    it("getContextById가 올바른 컨텍스트를 반환해야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1", "First"));
      store.addContext(createTestContextItem("ctx-2", "Second"));

      expect(store.getContextById("ctx-1")?.name).toBe("First");
      expect(store.getContextById("ctx-2")?.name).toBe("Second");
      expect(store.getContextById("non-existent")).toBeUndefined();
    });

    it("getContextsByType이 올바른 컨텍스트들을 반환해야 함", () => {
      const store = createContextStore();
      store.addContext(createTestContextItem("ctx-1", "Pod 1", ContextType.POD));
      store.addContext(createTestContextItem("ctx-2", "Service 1", ContextType.SERVICE));
      store.addContext(createTestContextItem("ctx-3", "Pod 2", ContextType.POD));

      const pods = store.getContextsByType(ContextType.POD);
      const services = store.getContextsByType(ContextType.SERVICE);

      expect(pods).toHaveLength(2);
      expect(services).toHaveLength(1);
    });
  });

  describe("AC35: isMaxReached computed 검증", () => {
    it("최대 개수 도달 시 true를 반환해야 함", () => {
      const store = createContextStore();
      store.setMaxContexts(3);

      store.addContext(createTestContextItem("ctx-1"));
      expect(store.isMaxReached).toBe(false);

      store.addContext(createTestContextItem("ctx-2"));
      expect(store.isMaxReached).toBe(false);

      store.addContext(createTestContextItem("ctx-3"));
      expect(store.isMaxReached).toBe(true);
    });
  });
});
