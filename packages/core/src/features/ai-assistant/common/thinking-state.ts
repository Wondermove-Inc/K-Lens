/**
 * 🎯 목적: ThinkingState MobX 상태 관리
 * 01: thinkingState 상태 및 액션 추가
 *
 * 📝 주요 기능:
 * - AI 추론 과정 상태 관리
 * - SRE 진단 루프 단계 추적 (Observe → Hypothesize → Validate → Mitigate)
 * - 도구 호출 추적
 * - 접기/펼치기 상태 관리
 *
 * @packageDocumentation
 */

import { action, computed, makeAutoObservable } from "mobx";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * Thinking 단계 타입
 *
 * 📝 SRE 진단 루프 기반 단계 정의
 * - idle: 대기 상태
 * - analyzing: 분석 시작
 * - observing: 관찰 단계 (데이터 수집)
 * - hypothesizing: 가설 수립 단계
 * - validating: 검증 단계
 * - mitigating: 조치 단계
 * - complete: 완료
 */
export type ThinkingStep =
  | "idle"
  | "analyzing"
  | "observing"
  | "hypothesizing"
  | "validating"
  | "mitigating"
  | "complete";

/**
 * 단계별 레이블 매핑
 */
const STEP_LABELS: Record<ThinkingStep, string> = {
  idle: "",
  analyzing: "분석 중...",
  observing: "👁️ 관찰 중...",
  hypothesizing: "💭 가설 수립 중...",
  validating: "✅ 검증 중...",
  mitigating: "🔧 조치 중...",
  complete: "✨ 완료",
};

/**
 * 단계 기록 인터페이스
 */
export interface ThinkingStepRecord {
  /** 단계 유형 */
  step: ThinkingStep;
  /** 사용자에게 표시할 레이블 */
  label: string;
  /** 기록 시간 */
  timestamp: Date;
  /** 추가 상세 정보 */
  details?: string;
}

/**
 * 도구 호출 기록 인터페이스
 */
export interface ToolCallRecord {
  /** 도구 이름 */
  name: string;
  /** 호출 인자 */
  args: Record<string, unknown>;
  /** 호출 결과 (완료 시 설정) */
  result?: unknown;
  /** 호출 시간 */
  timestamp: Date;
}

// ============================================
// 🎯 ThinkingState 클래스
// ============================================

/**
 * AI 추론 과정 상태 관리 클래스
 *
 * 📝 MobX observable 상태로 구현
 * - 진단 루프 단계 추적
 * - 도구 호출 추적
 * - UI 상태 (접기/펼치기)
 */
class ThinkingState {
  /** 추론 진행 중 여부 */
  isThinking = false;

  /** 현재 진행 중인 단계 */
  currentStep: ThinkingStep = "idle";

  /** 단계 기록 배열 */
  steps: ThinkingStepRecord[] = [];

  /** 도구 호출 기록 배열 */
  toolCalls: ToolCallRecord[] = [];

  /** 접기/펼치기 상태 (기본: 펼침) */
  isExpanded = true;

  constructor() {
    makeAutoObservable(this, {
      // Actions
      startThinking: action,
      updateThinkingStep: action,
      addToolCall: action,
      updateToolCallResult: action,
      completeThinking: action,
      toggleThinkingExpanded: action,
      reset: action,
      // Computed
      hasToolCalls: computed,
      toolCallCount: computed,
      currentStepLabel: computed,
      pendingToolCalls: computed,
    });
  }

  // ============================================
  // 🔹 Actions
  // ============================================

  /**
   * Thinking 시작
   *
   * 📝 새로운 추론 세션 시작
   */
  startThinking(): void {
    this.isThinking = true;
    this.currentStep = "analyzing";
    this.steps = [
      {
        step: "analyzing",
        label: STEP_LABELS.analyzing,
        timestamp: new Date(),
      },
    ];
    this.toolCalls = [];
    this.isExpanded = true;
  }

  /**
   * Thinking 단계 업데이트
   *
   * @param step - 새 단계
   * @param details - 추가 상세 정보 (선택)
   */
  updateThinkingStep(step: ThinkingStep, details?: string): void {
    this.currentStep = step;
    this.steps.push({
      step,
      label: STEP_LABELS[step],
      timestamp: new Date(),
      details,
    });
  }

  /**
   * 도구 호출 추가
   *
   * @param name - 도구 이름
   * @param args - 호출 인자
   * @returns 추가된 도구 호출의 인덱스
   */
  addToolCall(name: string, args: Record<string, unknown>): number {
    const newToolCall: ToolCallRecord = {
      name,
      args,
      timestamp: new Date(),
    };
    this.toolCalls.push(newToolCall);
    return this.toolCalls.length - 1;
  }

  /**
   * 도구 호출 결과 업데이트
   *
   * @param index - 도구 호출 인덱스
   * @param result - 호출 결과
   */
  updateToolCallResult(index: number, result: unknown): void {
    if (index >= 0 && index < this.toolCalls.length) {
      this.toolCalls[index].result = result;
    }
  }

  /**
   * Thinking 완료
   *
   * 📝 추론 세션 종료 (상태 보존)
   */
  completeThinking(): void {
    this.isThinking = false;
    this.currentStep = "complete";
    this.steps.push({
      step: "complete",
      label: "완료",
      timestamp: new Date(),
    });
  }

  /**
   * 접기/펼치기 토글
   */
  toggleThinkingExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * 상태 초기화
   */
  reset(): void {
    this.isThinking = false;
    this.currentStep = "idle";
    this.steps = [];
    this.toolCalls = [];
    this.isExpanded = true;
  }

  // ============================================
  // 🔹 Computed
  // ============================================

  /**
   * 도구 호출이 있는지 여부
   */
  get hasToolCalls(): boolean {
    return this.toolCalls.length > 0;
  }

  /**
   * 도구 호출 개수
   */
  get toolCallCount(): number {
    return this.toolCalls.length;
  }

  /**
   * 현재 단계 레이블
   */
  get currentStepLabel(): string {
    return STEP_LABELS[this.currentStep];
  }

  /**
   * 결과가 없는 (pending) 도구 호출 개수
   */
  get pendingToolCalls(): number {
    return this.toolCalls.filter((call) => call.result === undefined).length;
  }
}

// ============================================
// 🎯 싱글톤 인스턴스
// ============================================

/**
 * ThinkingState 싱글톤 인스턴스
 *
 * 📝 앱 전체에서 하나의 인스턴스 공유
 */
export const thinkingState = new ThinkingState();
