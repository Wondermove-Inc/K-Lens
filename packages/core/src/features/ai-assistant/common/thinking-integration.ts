/**
 * 🎯 목적: AI Agent와 Thinking 상태 연결
 * 02: Agent Thinking 연결
 *
 * 📝 주요 기능:
 * - AI 호출 시 thinkingState와 연동
 * - 단계별 상태 업데이트 관리
 * - 도구 호출 추적
 * - 에러 처리
 *
 * @packageDocumentation
 */

import { ThinkingStep, thinkingState } from "./thinking-state";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * ThinkingIntegration 인터페이스
 *
 * 📝 AI Agent에서 사용하는 thinking 상태 관리 API
 */
export interface ThinkingIntegration {
  /**
   * AI 호출 시작
   *
   * 📝 새로운 추론 세션 시작
   */
  startAICall(): void;

  /**
   * AI 호출 완료
   *
   * 📝 추론 세션 종료
   */
  completeAICall(): void;

  /**
   * 단계 업데이트
   *
   * @param step - 새 단계
   * @param details - 상세 정보 (선택)
   */
  updateStep(step: ThinkingStep, details?: string): void;

  /**
   * 도구 호출 추가
   *
   * @param name - 도구 이름
   * @param args - 호출 인자
   * @returns 추가된 도구 호출 인덱스
   */
  addToolCall(name: string, args: Record<string, unknown>): number;

  /**
   * 도구 호출 결과 업데이트
   *
   * @param index - 도구 호출 인덱스
   * @param result - 결과
   */
  updateToolResult(index: number, result: unknown): void;

  /**
   * 에러 처리
   *
   * @param error - 발생한 에러
   */
  handleError(error: Error): void;

  /**
   * 현재 활성 상태 여부
   *
   * @returns isThinking 상태
   */
  isActive(): boolean;

  /**
   * 현재 단계 조회
   *
   * @returns 현재 ThinkingStep
   */
  getCurrentStep(): ThinkingStep;

  /**
   * 도구 호출 개수 조회
   *
   * @returns 도구 호출 수
   */
  getToolCallCount(): number;
}

// ============================================
// 🎯 ThinkingIntegration 구현
// ============================================

/**
 * ThinkingIntegration 클래스
 *
 * 📝 thinkingState 싱글톤과 연동하는 래퍼
 */
class ThinkingIntegrationImpl implements ThinkingIntegration {
  /**
   * AI 호출 시작
   *
   * 📝 기존 상태가 있으면 리셋 후 새로 시작
   */
  startAICall(): void {
    // 이미 진행 중이면 리셋 후 시작
    if (thinkingState.isThinking) {
      thinkingState.reset();
    }
    thinkingState.startThinking();
  }

  /**
   * AI 호출 완료
   */
  completeAICall(): void {
    thinkingState.completeThinking();
  }

  /**
   * 단계 업데이트
   *
   * @param step - 새 단계
   * @param details - 상세 정보
   */
  updateStep(step: ThinkingStep, details?: string): void {
    thinkingState.updateThinkingStep(step, details);
  }

  /**
   * 도구 호출 추가
   *
   * @param name - 도구 이름
   * @param args - 호출 인자
   * @returns 인덱스
   */
  addToolCall(name: string, args: Record<string, unknown>): number {
    return thinkingState.addToolCall(name, args);
  }

  /**
   * 도구 호출 결과 업데이트
   *
   * @param index - 인덱스
   * @param result - 결과
   */
  updateToolResult(index: number, result: unknown): void {
    thinkingState.updateToolCallResult(index, result);
  }

  /**
   * 에러 처리
   *
   * 📝 에러 발생 시:
   * 1. 에러 도구 호출 추가
   * 2. thinking 상태 종료
   *
   * @param error - 발생한 에러
   */
  handleError(error: Error): void {
    // 에러 도구 호출 추가
    thinkingState.addToolCall("error", {
      message: error.message,
    });

    // 마지막 도구 호출에 에러 결과 설정
    const lastIndex = thinkingState.toolCalls.length - 1;
    thinkingState.updateToolCallResult(lastIndex, {
      error: true,
      message: error.message,
    });

    // thinking 종료
    thinkingState.completeThinking();
  }

  /**
   * 현재 활성 상태 여부
   *
   * @returns isThinking
   */
  isActive(): boolean {
    return thinkingState.isThinking;
  }

  /**
   * 현재 단계 조회
   *
   * @returns currentStep
   */
  getCurrentStep(): ThinkingStep {
    return thinkingState.currentStep;
  }

  /**
   * 도구 호출 개수 조회
   *
   * @returns toolCallCount
   */
  getToolCallCount(): number {
    return thinkingState.toolCallCount;
  }
}

// ============================================
// 🎯 팩토리 함수
// ============================================

/**
 * ThinkingIntegration 인스턴스 생성
 *
 * 📝 싱글톤 thinkingState와 연결된 integration 객체 생성
 *
 * @returns ThinkingIntegration 인스턴스
 */
export function createThinkingIntegration(): ThinkingIntegration {
  return new ThinkingIntegrationImpl();
}

/**
 * 기본 ThinkingIntegration 싱글톤
 *
 * 📝 앱 전체에서 공유하는 기본 인스턴스
 */
export const defaultThinkingIntegration = createThinkingIntegration();
