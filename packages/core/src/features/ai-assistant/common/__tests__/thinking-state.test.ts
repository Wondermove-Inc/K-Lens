/**
 * 🎯 목적: ThinkingState MobX 상태 테스트
 * 01: thinkingState 상태 및 액션 추가
 *
 * 📝 테스트 범위:
 * - ThinkingState 초기 상태
 * - startThinking/completeThinking 액션
 * - updateThinkingStep 액션
 * - addToolCall/updateToolCallResult 액션
 * - toggleThinkingExpanded 액션
 * - 시나리오 테스트
 *
 * @packageDocumentation
 */

import { ThinkingStep, thinkingState } from "../thinking-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("ThinkingState MobX 상태", () => {
  beforeEach(() => {
    thinkingState.reset();
  });

  afterEach(() => {
    thinkingState.reset();
  });

  // ============================================
  // 🔹 초기 상태 테스트
  // ============================================

  describe("초기 상태", () => {
    it("isThinking은 false여야 함", () => {
      expect(thinkingState.isThinking).toBe(false);
    });

    it("currentStep은 'idle'이어야 함", () => {
      expect(thinkingState.currentStep).toBe("idle");
    });

    it("steps는 빈 배열이어야 함", () => {
      expect(thinkingState.steps).toEqual([]);
    });

    it("toolCalls는 빈 배열이어야 함", () => {
      expect(thinkingState.toolCalls).toEqual([]);
    });

    it("isExpanded는 true여야 함 (기본 펼침)", () => {
      expect(thinkingState.isExpanded).toBe(true);
    });
  });

  // ============================================
  // 🔹 startThinking 테스트
  // ============================================

  describe("startThinking", () => {
    it("AC1: isThinking을 true로 설정", () => {
      thinkingState.startThinking();

      expect(thinkingState.isThinking).toBe(true);
    });

    it("AC2: currentStep을 'analyzing'으로 설정", () => {
      thinkingState.startThinking();

      expect(thinkingState.currentStep).toBe("analyzing");
    });

    it("AC3: steps 배열 초기화 및 첫 단계 기록", () => {
      thinkingState.startThinking();

      expect(thinkingState.steps.length).toBe(1);
      expect(thinkingState.steps[0].step).toBe("analyzing");
      expect(thinkingState.steps[0].label).toBe("분석 중...");
    });

    it("AC4: toolCalls 배열 초기화", () => {
      // 먼저 도구 호출 추가
      thinkingState.startThinking();
      thinkingState.addToolCall("test-tool", {});

      // 새로운 thinking 시작
      thinkingState.startThinking();

      expect(thinkingState.toolCalls).toEqual([]);
    });

    it("AC5: isExpanded는 true 유지", () => {
      thinkingState.isExpanded = false;
      thinkingState.startThinking();

      expect(thinkingState.isExpanded).toBe(true);
    });
  });

  // ============================================
  // 🔹 updateThinkingStep 테스트
  // ============================================

  describe("updateThinkingStep", () => {
    beforeEach(() => {
      thinkingState.startThinking();
    });

    it("AC1: currentStep 업데이트", () => {
      thinkingState.updateThinkingStep("observing");

      expect(thinkingState.currentStep).toBe("observing");
    });

    it("AC2: steps 배열에 새 단계 추가", () => {
      thinkingState.updateThinkingStep("observing", "클러스터 상태 수집 중");

      expect(thinkingState.steps.length).toBe(2);
      expect(thinkingState.steps[1].step).toBe("observing");
      expect(thinkingState.steps[1].details).toBe("클러스터 상태 수집 중");
    });

    it("AC3: timestamp가 기록되어야 함", () => {
      const before = Date.now();
      thinkingState.updateThinkingStep("hypothesizing");
      const after = Date.now();

      const timestamp = thinkingState.steps[1].timestamp.getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("모든 ThinkingStep 타입이 허용되어야 함", () => {
      const steps: ThinkingStep[] = ["observing", "hypothesizing", "validating", "mitigating", "complete"];

      steps.forEach((step, index) => {
        thinkingState.updateThinkingStep(step);
        expect(thinkingState.currentStep).toBe(step);
        expect(thinkingState.steps[index + 1].step).toBe(step);
      });
    });
  });

  // ============================================
  // 🔹 addToolCall 테스트
  // ============================================

  describe("addToolCall", () => {
    beforeEach(() => {
      thinkingState.startThinking();
    });

    it("AC1: toolCalls 배열에 도구 호출 추가", () => {
      thinkingState.addToolCall("kubectl_get", { resource: "pods" });

      expect(thinkingState.toolCalls.length).toBe(1);
      expect(thinkingState.toolCalls[0].name).toBe("kubectl_get");
    });

    it("AC2: args가 정확히 저장되어야 함", () => {
      const args = { resource: "pods", namespace: "default" };
      thinkingState.addToolCall("kubectl_get", args);

      expect(thinkingState.toolCalls[0].args).toEqual(args);
    });

    it("AC3: result는 undefined로 초기화", () => {
      thinkingState.addToolCall("kubectl_get", {});

      expect(thinkingState.toolCalls[0].result).toBeUndefined();
    });

    it("AC4: timestamp가 기록되어야 함", () => {
      const before = Date.now();
      thinkingState.addToolCall("test", {});
      const after = Date.now();

      const timestamp = thinkingState.toolCalls[0].timestamp.getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("AC5: 여러 도구 호출이 순서대로 저장", () => {
      thinkingState.addToolCall("tool1", { a: 1 });
      thinkingState.addToolCall("tool2", { b: 2 });
      thinkingState.addToolCall("tool3", { c: 3 });

      expect(thinkingState.toolCalls.length).toBe(3);
      expect(thinkingState.toolCalls[0].name).toBe("tool1");
      expect(thinkingState.toolCalls[1].name).toBe("tool2");
      expect(thinkingState.toolCalls[2].name).toBe("tool3");
    });

    it("AC6: 호출된 도구의 인덱스를 반환", () => {
      const index1 = thinkingState.addToolCall("tool1", {});
      const index2 = thinkingState.addToolCall("tool2", {});

      expect(index1).toBe(0);
      expect(index2).toBe(1);
    });
  });

  // ============================================
  // 🔹 updateToolCallResult 테스트
  // ============================================

  describe("updateToolCallResult", () => {
    beforeEach(() => {
      thinkingState.startThinking();
      thinkingState.addToolCall("kubectl_get", { resource: "pods" });
    });

    it("AC1: result 업데이트", () => {
      const result = { pods: ["nginx-xxx", "redis-xxx"] };
      thinkingState.updateToolCallResult(0, result);

      expect(thinkingState.toolCalls[0].result).toEqual(result);
    });

    it("AC2: 잘못된 인덱스는 무시", () => {
      expect(() => {
        thinkingState.updateToolCallResult(999, "test");
      }).not.toThrow();
    });

    it("AC3: 다른 도구 호출에 영향 없음", () => {
      thinkingState.addToolCall("tool2", {});
      thinkingState.updateToolCallResult(0, "result1");

      expect(thinkingState.toolCalls[1].result).toBeUndefined();
    });
  });

  // ============================================
  // 🔹 completeThinking 테스트
  // ============================================

  describe("completeThinking", () => {
    beforeEach(() => {
      thinkingState.startThinking();
      thinkingState.updateThinkingStep("observing");
    });

    it("AC1: isThinking을 false로 설정", () => {
      thinkingState.completeThinking();

      expect(thinkingState.isThinking).toBe(false);
    });

    it("AC2: currentStep을 'complete'로 설정", () => {
      thinkingState.completeThinking();

      expect(thinkingState.currentStep).toBe("complete");
    });

    it("AC3: steps 배열에 complete 단계 추가", () => {
      thinkingState.completeThinking();

      const lastStep = thinkingState.steps[thinkingState.steps.length - 1];
      expect(lastStep.step).toBe("complete");
      expect(lastStep.label).toBe("완료");
    });

    it("AC4: 기존 steps와 toolCalls는 보존", () => {
      thinkingState.addToolCall("test-tool", {});
      const stepsCount = thinkingState.steps.length;
      const toolCallsCount = thinkingState.toolCalls.length;

      thinkingState.completeThinking();

      // steps에 complete 추가되므로 +1
      expect(thinkingState.steps.length).toBe(stepsCount + 1);
      expect(thinkingState.toolCalls.length).toBe(toolCallsCount);
    });
  });

  // ============================================
  // 🔹 toggleThinkingExpanded 테스트
  // ============================================

  describe("toggleThinkingExpanded", () => {
    it("AC1: isExpanded 토글", () => {
      expect(thinkingState.isExpanded).toBe(true);

      thinkingState.toggleThinkingExpanded();
      expect(thinkingState.isExpanded).toBe(false);

      thinkingState.toggleThinkingExpanded();
      expect(thinkingState.isExpanded).toBe(true);
    });
  });

  // ============================================
  // 🔹 reset 테스트
  // ============================================

  describe("reset", () => {
    it("모든 상태를 초기값으로 리셋", () => {
      thinkingState.startThinking();
      thinkingState.updateThinkingStep("observing");
      thinkingState.addToolCall("test", {});
      thinkingState.isExpanded = false;

      thinkingState.reset();

      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.currentStep).toBe("idle");
      expect(thinkingState.steps).toEqual([]);
      expect(thinkingState.toolCalls).toEqual([]);
      expect(thinkingState.isExpanded).toBe(true);
    });
  });

  // ============================================
  // 🔹 computed 속성 테스트
  // ============================================

  describe("computed 속성", () => {
    describe("hasToolCalls", () => {
      it("toolCalls가 없으면 false", () => {
        expect(thinkingState.hasToolCalls).toBe(false);
      });

      it("toolCalls가 있으면 true", () => {
        thinkingState.startThinking();
        thinkingState.addToolCall("test", {});

        expect(thinkingState.hasToolCalls).toBe(true);
      });
    });

    describe("toolCallCount", () => {
      it("도구 호출 개수 반환", () => {
        thinkingState.startThinking();

        expect(thinkingState.toolCallCount).toBe(0);

        thinkingState.addToolCall("tool1", {});
        expect(thinkingState.toolCallCount).toBe(1);

        thinkingState.addToolCall("tool2", {});
        expect(thinkingState.toolCallCount).toBe(2);
      });
    });

    describe("currentStepLabel", () => {
      it("현재 단계에 맞는 레이블 반환", () => {
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

    describe("pendingToolCalls", () => {
      it("결과가 없는 도구 호출 개수 반환", () => {
        thinkingState.startThinking();
        thinkingState.addToolCall("tool1", {});
        thinkingState.addToolCall("tool2", {});

        expect(thinkingState.pendingToolCalls).toBe(2);

        thinkingState.updateToolCallResult(0, "done");
        expect(thinkingState.pendingToolCalls).toBe(1);
      });
    });
  });

  // ============================================
  // 🔹 시나리오 테스트
  // ============================================

  describe("시나리오 테스트", () => {
    it("전체 진단 플로우: 시작 → 관찰 → 가설 → 검증 → 조치 → 완료", () => {
      // 시작
      thinkingState.startThinking();
      expect(thinkingState.isThinking).toBe(true);
      expect(thinkingState.currentStep).toBe("analyzing");

      // 관찰
      thinkingState.updateThinkingStep("observing", "클러스터 상태 수집");
      const toolIdx1 = thinkingState.addToolCall("kubectl_get", { resource: "pods" });
      thinkingState.updateToolCallResult(toolIdx1, { pods: 10 });

      expect(thinkingState.currentStep).toBe("observing");
      expect(thinkingState.toolCalls.length).toBe(1);

      // 가설
      thinkingState.updateThinkingStep("hypothesizing", "메모리 부족 가능성");
      expect(thinkingState.currentStep).toBe("hypothesizing");

      // 검증
      thinkingState.updateThinkingStep("validating", "리소스 사용량 확인");
      const toolIdx2 = thinkingState.addToolCall("kubectl_top", { pods: true });
      thinkingState.updateToolCallResult(toolIdx2, { memory: "90%" });

      expect(thinkingState.currentStep).toBe("validating");

      // 조치
      thinkingState.updateThinkingStep("mitigating", "리소스 제한 조정 권고");
      expect(thinkingState.currentStep).toBe("mitigating");

      // 완료
      thinkingState.completeThinking();
      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.currentStep).toBe("complete");

      // 최종 검증
      expect(thinkingState.steps.length).toBe(6); // analyzing, observing, hypothesizing, validating, mitigating, complete
      expect(thinkingState.toolCalls.length).toBe(2);
    });

    it("에러 발생 시에도 상태가 일관성 유지", () => {
      thinkingState.startThinking();
      thinkingState.updateThinkingStep("observing");
      thinkingState.addToolCall("failing_tool", {});

      // 에러 상황 시뮬레이션 - 중간에 reset
      thinkingState.reset();

      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.steps).toEqual([]);
      expect(thinkingState.toolCalls).toEqual([]);
    });

    it("접기/펼치기가 완료 후에도 동작", () => {
      thinkingState.startThinking();
      thinkingState.completeThinking();

      // 완료 후 접기
      thinkingState.toggleThinkingExpanded();
      expect(thinkingState.isExpanded).toBe(false);

      // 다시 펼치기
      thinkingState.toggleThinkingExpanded();
      expect(thinkingState.isExpanded).toBe(true);

      // steps와 toolCalls는 보존
      expect(thinkingState.steps.length).toBeGreaterThan(0);
    });
  });
});
