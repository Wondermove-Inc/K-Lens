/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { EditorGroupId } from "./main-tab.model";

/**
 * 🎯 목적: Split layout 상태 표현
 *
 * @description
 * - Split 기능 활성화 여부 및 레이아웃 설정 관리
 * - 좌우 pane 비율 및 현재 활성 그룹 추적
 *
 * 📝 주의사항:
 * - leftRatio는 0.3 ~ 0.7 범위로 제한 (최소 30%, 최대 70%)
 * - enabled가 false일 때는 activeGroupId가 항상 "left"여야 함
 *
 * 🔄 변경이력: 2025-10-29 - Split 기능 추가를 위한 layout 상태 타입 정의
 */
export interface SplitLayout {
  /** ✅ Split 활성화 여부 (true일 때만 2-pane 표시) */
  enabled: boolean;

  /** 📏 주요 pane 비율 (orientation에 따라 좌측 또는 상단, 0.3 ~ 0.7) */
  leftRatio: number;

  /** 🎯 현재 활성 그룹 ID (포커스된 pane) */
  activeGroupId?: EditorGroupId;

  /** ↕️ Split 방향 (horizontal: 좌/우, vertical: 상/하) */
  orientation: SplitDirection;
}

/**
 * 🎯 목적: Split 방향 타입 (Phase 3 준비)
 *
 * @description
 * - Phase 2에서는 horizontal만 사용
 * - Phase 3에서 vertical 추가 예정 (상하 분할)
 *
 * 🔄 변경이력: 2025-10-29 - 초기 생성 (Phase 3 대비)
 */
export type SplitDirection = "horizontal" | "vertical";

/**
 * 🎯 목적: Split 위치 타입
 *
 * @description
 * - 새 그룹을 어디에 생성할지 지정
 * - Phase 2에서는 "left", "right"만 사용
 * - Phase 3에서 "top", "bottom" 추가 예정
 *
 * 📝 주의사항:
 * - createGroup() 호출 시 position 파라미터로 사용
 * - "left"는 항상 기본 그룹으로 존재해야 함
 *
 * 🔄 변경이력: 2025-10-29 - 초기 생성
 */
export type SplitPosition = "left" | "right" | "top" | "bottom";

/**
 * 🎯 목적: Split 기본 설정 상수
 *
 * @description
 * - Split layout의 기본값 및 제약 조건 정의
 * - 모든 Split 관련 로직에서 이 상수들을 참조해야 함
 *
 * 🔄 변경이력: 2025-10-29 - 초기 생성
 */
export const SPLIT_CONSTANTS = {
  /** 📏 기본 좌측 pane 비율 (50:50 분할) */
  DEFAULT_LEFT_RATIO: 0.5,

  /** 📏 최소 좌측 pane 비율 (30%) */
  MIN_LEFT_RATIO: 0.3,

  /** 📏 최대 좌측 pane 비율 (70%) */
  MAX_LEFT_RATIO: 0.7,

  /** 🔢 최대 그룹 개수 (Phase 2: 2개) */
  MAX_GROUPS: 2,

  /** ↕️ 기본 Split 방향 */
  DEFAULT_ORIENTATION: "horizontal" as SplitDirection,
} as const;
