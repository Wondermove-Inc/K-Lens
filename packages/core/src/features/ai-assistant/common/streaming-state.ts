/**
 * 🎯 목적: StreamingState MobX 상태 관리
 * 01: streamingState 상태 및 액션 추가
 *
 * 📝 주요 기능:
 * - LLM 스트리밍 응답 상태 관리
 * - 토큰 누적 및 완료 처리
 * - 취소 (AbortController) 지원
 * - 에러 핸들링
 * - 성능 메트릭 (첫 토큰 시간, 경과 시간)
 *
 * @packageDocumentation
 */

import { action, makeAutoObservable } from "mobx";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * StreamingState 인터페이스
 */
export interface IStreamingState {
  /** 스트리밍 진행 중 여부 */
  isStreaming: boolean;
  /** 현재 스트리밍 중인 메시지 ID */
  currentMessageId: string | null;
  /** 스트리밍 중인 콘텐츠 */
  streamingContent: string;
  /** 요청 취소용 AbortController */
  abortController: AbortController | null;
  /** 스트리밍 시작 시간 (timestamp) */
  startTime: number | null;
  /** 첫 토큰 수신 시간 (timestamp) */
  firstTokenTime: number | null;
  /** 에러 객체 */
  error: Error | null;
  /** 취소 여부 */
  isCancelled: boolean;
  /** 토큰 수 (computed) */
  tokenCount: number;
  /** 에러 발생 여부 (computed) */
  hasError: boolean;
  /** 경과 시간 (computed) */
  elapsedTime: number;
  /** 취소 가능 여부 (computed) */
  canCancel: boolean;
}

// ============================================
// 🎯 MobX 상태 클래스
// ============================================

/**
 * StreamingState 클래스
 *
 * 📝 기능:
 * - LLM 스트리밍 응답 상태 관리
 * - 실시간 토큰 수신 및 UI 업데이트
 * - 취소 및 에러 처리
 * - 성능 메트릭 수집
 */
export class StreamingState implements IStreamingState {
  // ============================================
  // 🔹 Observable 상태
  // ============================================

  /** 스트리밍 진행 중 여부 */
  isStreaming = false;

  /** 현재 스트리밍 중인 메시지 ID */
  currentMessageId: string | null = null;

  /** 스트리밍 중인 콘텐츠 (토큰 누적) */
  streamingContent = "";

  /** 요청 취소용 AbortController */
  abortController: AbortController | null = null;

  /** 스트리밍 시작 시간 (timestamp) */
  startTime: number | null = null;

  /** 첫 토큰 수신 시간 (timestamp) */
  firstTokenTime: number | null = null;

  /** 에러 객체 */
  error: Error | null = null;

  /** 취소 여부 */
  isCancelled = false;

  // ============================================
  // 🔹 생성자
  // ============================================

  constructor() {
    makeAutoObservable(this, {
      startStreaming: action,
      appendStreamingToken: action,
      finalizeStreaming: action,
      cancelStreaming: action,
      handleStreamingError: action,
      reset: action,
    });
  }

  // ============================================
  // 🔹 Computed 속성
  // ============================================

  /**
   * 토큰 수 계산 (공백 기준 단어 수)
   *
   * @returns 토큰 수
   */
  get tokenCount(): number {
    if (!this.streamingContent.trim()) {
      return 0;
    }

    return this.streamingContent.trim().split(/\s+/).length;
  }

  /**
   * 에러 발생 여부
   *
   * @returns 에러 있으면 true
   */
  get hasError(): boolean {
    return this.error !== null;
  }

  /**
   * 스트리밍 경과 시간 (ms)
   *
   * @returns 경과 시간 (ms), 시작 전이면 0
   */
  get elapsedTime(): number {
    if (!this.startTime) {
      return 0;
    }

    return Date.now() - this.startTime;
  }

  /**
   * 취소 가능 여부
   *
   * @returns 스트리밍 중이고 AbortController가 있으면 true
   */
  get canCancel(): boolean {
    return this.isStreaming && this.abortController !== null;
  }

  // ============================================
  // 🔹 Actions
  // ============================================

  /**
   * 스트리밍 시작
   *
   * @param messageId - 스트리밍할 메시지 ID
   *
   * 📝 AC2: AbortController 생성, isStreaming=true
   */
  startStreaming(messageId: string): void {
    // 이전 스트리밍이 진행 중이면 abort
    if (this.isStreaming && this.abortController) {
      this.abortController.abort();
    }

    // 상태 초기화 및 설정
    this.isStreaming = true;
    this.currentMessageId = messageId;
    this.streamingContent = "";
    this.abortController = new AbortController();
    this.startTime = Date.now();
    this.firstTokenTime = null;
    this.error = null;
    this.isCancelled = false;
  }

  /**
   * 스트리밍 토큰 추가
   *
   * @param token - 수신된 토큰
   *
   * 📝 AC3: content 누적
   */
  appendStreamingToken(token: string): void {
    // 스트리밍 중이 아니면 무시
    if (!this.isStreaming) {
      return;
    }

    // 첫 토큰 시간 기록
    if (this.firstTokenTime === null && token.length > 0) {
      this.firstTokenTime = Date.now();
    }

    // 토큰 누적
    this.streamingContent += token;
  }

  /**
   * 스트리밍 완료
   *
   * @returns 최종 콘텐츠
   *
   * 📝 AC4: 메시지 완료 처리
   */
  finalizeStreaming(): string {
    const finalContent = this.streamingContent;

    this.isStreaming = false;
    this.abortController = null;

    return finalContent;
  }

  /**
   * 스트리밍 취소
   *
   * 📝 AC5: abort 호출 및 상태 정리
   */
  cancelStreaming(): void {
    // 스트리밍 중이 아니면 무시
    if (!this.isStreaming) {
      return;
    }

    // AbortController abort 호출
    if (this.abortController) {
      this.abortController.abort();
    }

    // 상태 업데이트
    this.isStreaming = false;
    this.isCancelled = true;
    this.abortController = null;

    // 취소 메시지 추가
    this.streamingContent += "\n\n[응답이 취소되었습니다]";
  }

  /**
   * 스트리밍 에러 핸들링
   *
   * @param error - 발생한 에러
   */
  handleStreamingError(error: Error): void {
    this.error = error;
    this.isStreaming = false;
    this.abortController = null;
  }

  /**
   * 상태 초기화
   *
   * 📝 모든 상태를 초기값으로 복원
   */
  reset(): void {
    // 진행 중인 요청 abort
    if (this.abortController) {
      this.abortController.abort();
    }

    // 상태 초기화
    this.isStreaming = false;
    this.currentMessageId = null;
    this.streamingContent = "";
    this.abortController = null;
    this.startTime = null;
    this.firstTokenTime = null;
    this.error = null;
    this.isCancelled = false;
  }
}

// ============================================
// 🎯 싱글톤 인스턴스
// ============================================

/**
 * 전역 StreamingState 인스턴스
 *
 * 📝 사용법:
 * ```typescript
 * import { streamingState } from "./streaming-state";
 *
 * // 스트리밍 시작
 * streamingState.startStreaming("msg-001");
 *
 * // 토큰 수신
 * streamingState.appendStreamingToken("Hello");
 *
 * // 스트리밍 완료
 * const content = streamingState.finalizeStreaming();
 *
 * // 취소
 * streamingState.cancelStreaming();
 * ```
 */
export const streamingState = new StreamingState();
