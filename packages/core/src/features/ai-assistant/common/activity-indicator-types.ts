/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Activity Indicator 타입 정의
 *
 * 📝 2026-01-29: AI Activity Indicator 개선
 * - Nielsen Norman Group UX 가이드라인 (100ms 내 피드백)
 * - FSM (Finite State Machine) 패턴으로 상태 전환 관리
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 Activity Phase 타입
// ============================================

/**
 * Activity Phase - AI 활동 단계
 *
 * - idle: 대기 상태 (입력 가능)
 * - preparing: 요청 준비 중 (IPC 전송 전)
 * - processing: 처리 중 (첫 tool-execution 또는 message-chunk 수신 후)
 *
 * 📝 상태 전환:
 * - sendMessage() 호출 → "preparing"
 * - 첫 tool-execution/message-chunk 이벤트 수신 → "processing"
 * - complete/error 이벤트 수신 → "idle"
 */
export type ActivityPhase = "idle" | "preparing" | "processing";

// ============================================
// 🎯 Activity Action 타입 (FSM 패턴)
// ============================================

/**
 * Activity Action - 상태 전환 액션
 *
 * FSM 패턴에서 상태 전환을 트리거하는 액션 타입입니다.
 */
export type ActivityAction =
  | { type: "SEND_MESSAGE" }
  | { type: "NODE_PROGRESS_STARTED" }
  | { type: "COMPLETE" }
  | { type: "ERROR"; error?: string }
  | { type: "RESET" };

// ============================================
// 🎯 Activity State 인터페이스
// ============================================

/**
 * Activity State - FSM 전체 상태
 *
 * 현재 phase와 메타데이터를 포함합니다.
 */
export interface ActivityState {
  /** 현재 활동 단계 */
  phase: ActivityPhase;
  /** 에러 메시지 (phase가 idle이고 이전에 에러가 발생한 경우) */
  lastError?: string;
  /** 마지막 상태 전환 시간 */
  lastTransitionAt: number;
}

// ============================================
// 🎯 Activity Reducer 함수 타입
// ============================================

/**
 * Activity Reducer - 상태 전환 로직
 *
 * @param state - 현재 상태
 * @param action - 전환 액션
 * @returns 새로운 상태
 */
export type ActivityReducer = (state: ActivityState, action: ActivityAction) => ActivityState;

// ============================================
// 🎯 초기 상태 및 Reducer 구현
// ============================================

/**
 * 초기 Activity 상태
 */
export const initialActivityState: ActivityState = {
  phase: "idle",
  lastTransitionAt: 0,
};

/**
 * Activity Reducer 구현
 *
 * FSM 상태 전환 로직:
 * - idle + SEND_MESSAGE → preparing
 * - preparing + NODE_PROGRESS_STARTED → processing
 * - preparing/processing + COMPLETE → idle
 * - preparing/processing + ERROR → idle (with lastError)
 * - any + RESET → idle
 *
 * @param state - 현재 상태
 * @param action - 전환 액션
 * @returns 새로운 상태
 */
export function activityReducer(state: ActivityState, action: ActivityAction): ActivityState {
  const now = Date.now();

  switch (action.type) {
    case "SEND_MESSAGE":
      if (state.phase === "idle") {
        return { phase: "preparing", lastTransitionAt: now };
      }
      return state;

    case "NODE_PROGRESS_STARTED":
      if (state.phase === "preparing") {
        return { phase: "processing", lastTransitionAt: now };
      }
      return state;

    case "COMPLETE":
      if (state.phase !== "idle") {
        return { phase: "idle", lastTransitionAt: now };
      }
      return state;

    case "ERROR":
      if (state.phase !== "idle") {
        return { phase: "idle", lastError: action.error, lastTransitionAt: now };
      }
      return state;

    case "RESET":
      return { phase: "idle", lastTransitionAt: now };

    default:
      return state;
  }
}
