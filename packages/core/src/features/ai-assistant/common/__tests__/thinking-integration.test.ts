/**
 * 🎯 목적: AI Agent와 Thinking 상태 연결 테스트
 * 02: Agent Thinking 연결
 *
 * 📝 테스트 범위:
 * - AI 호출 시 thinkingState 시작
 * - 단계별 상태 업데이트
 * - 도구 호출 추적
 * - 완료 시 상태 정리
 * - 에러 처리
 *
 * @packageDocumentation
 */

import { createThinkingIntegration, ThinkingIntegration } from "../thinking-integration";
import { thinkingState } from "../thinking-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("ThinkingIntegration", () => {
  let integration: ThinkingIntegration;

  beforeEach(() => {
    thinkingState.reset();
    integration = createThinkingIntegration();
  });

  afterEach(() => {
    thinkingState.reset();
  });

  // ============================================
  // 🔹 AI 호출 시작/완료 테스트
  // ============================================

  describe("AI 호출 시작/완료", () => {
    it("startAICall()이 thinkingState.startThinking() 호출", () => {
      integration.startAICall();

      expect(thinkingState.isThinking).toBe(true);
      expect(thinkingState.currentStep).toBe("analyzing");
    });

    it("completeAICall()이 thinkingState.completeThinking() 호출", () => {
      integration.startAICall();
      integration.completeAICall();

      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.currentStep).toBe("complete");
    });

    it("중복 startAICall()은 기존 상태 리셋 후 시작", () => {
      integration.startAICall();
      integration.updateStep("observing");
      integration.addToolCall("tool1", {});

      // 새로운 AI 호출 시작
      integration.startAICall();

      // 상태가 리셋되고 새로 시작
      expect(thinkingState.currentStep).toBe("analyzing");
      expect(thinkingState.toolCalls.length).toBe(0);
      expect(thinkingState.steps.length).toBe(1);
    });
  });

  // ============================================
  // 🔹 단계 업데이트 테스트
  // ============================================

  describe("단계 업데이트", () => {
    beforeEach(() => {
      integration.startAICall();
    });

    it("updateStep()이 thinkingState.updateThinkingStep() 호출", () => {
      integration.updateStep("observing");

      expect(thinkingState.currentStep).toBe("observing");
    });

    it("상세 정보와 함께 단계 업데이트", () => {
      integration.updateStep("observing", "Pod 상태 확인 중");

      expect(thinkingState.currentStep).toBe("observing");
      expect(thinkingState.steps[1].details).toBe("Pod 상태 확인 중");
    });

    it("모든 단계 전환 지원", () => {
      const steps = ["observing", "hypothesizing", "validating", "mitigating"] as const;

      steps.forEach((step) => {
        integration.updateStep(step);
        expect(thinkingState.currentStep).toBe(step);
      });
    });
  });

  // ============================================
  // 🔹 도구 호출 추적 테스트
  // ============================================

  describe("도구 호출 추적", () => {
    beforeEach(() => {
      integration.startAICall();
    });

    it("addToolCall()이 도구 호출 추가", () => {
      const index = integration.addToolCall("kubectl_get", { resource: "pods" });

      expect(thinkingState.toolCalls.length).toBe(1);
      expect(thinkingState.toolCalls[0].name).toBe("kubectl_get");
      expect(index).toBe(0);
    });

    it("updateToolResult()가 결과 업데이트", () => {
      const index = integration.addToolCall("kubectl_get", {});
      integration.updateToolResult(index, { pods: ["pod1", "pod2"] });

      expect(thinkingState.toolCalls[0].result).toEqual({
        pods: ["pod1", "pod2"],
      });
    });

    it("여러 도구 호출 순서대로 추적", () => {
      integration.addToolCall("tool1", {});
      integration.addToolCall("tool2", {});
      integration.addToolCall("tool3", {});

      expect(thinkingState.toolCalls.length).toBe(3);
      expect(thinkingState.toolCalls.map((t) => t.name)).toEqual(["tool1", "tool2", "tool3"]);
    });
  });

  // ============================================
  // 🔹 에러 처리 테스트
  // ============================================

  describe("에러 처리", () => {
    beforeEach(() => {
      integration.startAICall();
    });

    it("handleError()가 에러 상태로 전환", () => {
      integration.handleError(new Error("Connection failed"));

      expect(thinkingState.isThinking).toBe(false);
    });

    it("handleError()가 에러 도구 호출 추가", () => {
      integration.handleError(new Error("Connection failed"));

      // 마지막 도구 호출이 에러
      const lastCall = thinkingState.toolCalls[thinkingState.toolCalls.length - 1];
      expect(lastCall?.name).toBe("error");
      expect((lastCall?.result as { error: boolean })?.error).toBe(true);
    });
  });

  // ============================================
  // 🔹 통합 시나리오 테스트
  // ============================================

  describe("통합 시나리오", () => {
    it("전체 AI 호출 플로우", () => {
      // 1. AI 호출 시작
      integration.startAICall();
      expect(thinkingState.isThinking).toBe(true);

      // 2. 관찰 단계
      integration.updateStep("observing", "클러스터 상태 수집");
      const tool1 = integration.addToolCall("kubectl_get", { resource: "pods" });
      integration.updateToolResult(tool1, { count: 5 });

      // 3. 가설 수립
      integration.updateStep("hypothesizing", "메모리 부족 가능성");

      // 4. 검증
      integration.updateStep("validating", "리소스 사용량 확인");
      const tool2 = integration.addToolCall("kubectl_top", {});
      integration.updateToolResult(tool2, { memory: "90%" });

      // 5. 조치 권고
      integration.updateStep("mitigating", "리소스 제한 조정 권고");

      // 6. 완료
      integration.completeAICall();

      // 검증
      expect(thinkingState.isThinking).toBe(false);
      expect(thinkingState.currentStep).toBe("complete");
      expect(thinkingState.steps.length).toBe(6); // analyzing + 4 steps + complete
      expect(thinkingState.toolCalls.length).toBe(2);
    });

    it("에러 발생 시 플로우", () => {
      integration.startAICall();
      integration.updateStep("observing");
      integration.addToolCall("kubectl_get", {});

      // 에러 발생
      integration.handleError(new Error("Network error"));

      // 상태 확인
      expect(thinkingState.isThinking).toBe(false);
    });
  });

  // ============================================
  // 🔹 헬퍼 함수 테스트
  // ============================================

  describe("헬퍼 함수", () => {
    it("isActive()가 현재 상태 반환", () => {
      expect(integration.isActive()).toBe(false);

      integration.startAICall();
      expect(integration.isActive()).toBe(true);

      integration.completeAICall();
      expect(integration.isActive()).toBe(false);
    });

    it("getCurrentStep()이 현재 단계 반환", () => {
      expect(integration.getCurrentStep()).toBe("idle");

      integration.startAICall();
      expect(integration.getCurrentStep()).toBe("analyzing");

      integration.updateStep("observing");
      expect(integration.getCurrentStep()).toBe("observing");
    });

    it("getToolCallCount()가 도구 호출 수 반환", () => {
      integration.startAICall();
      expect(integration.getToolCallCount()).toBe(0);

      integration.addToolCall("tool1", {});
      expect(integration.getToolCallCount()).toBe(1);

      integration.addToolCall("tool2", {});
      expect(integration.getToolCallCount()).toBe(2);
    });
  });
});
