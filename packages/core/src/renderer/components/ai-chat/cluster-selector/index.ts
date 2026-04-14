/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterSelector 모듈 진입점
 *
 * 📝 주요 내용:
 * - ClusterSelector: 클러스터 선택 UI 컴포넌트
 * - ClusterSelectionPrompt: 클러스터 미선택 시 안내 프롬프트
 * - Injectable 버전: DI 컨테이너와 통합
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 */

// ClusterSelectionPrompt 컴포넌트
export { ClusterSelectionPrompt } from "./cluster-selection-prompt";
export {
  clusterSelectionPromptComponentInjectable,
  InjectedClusterSelectionPrompt,
} from "./cluster-selection-prompt.injectable";
// ClusterSelector 컴포넌트
export { ClusterSelector } from "./cluster-selector";
export {
  clusterSelectorComponentInjectable,
  InjectedClusterSelector,
} from "./cluster-selector.injectable";

export type { ClusterSelectionPromptProps } from "./cluster-selection-prompt";
export type { ClusterSelectorProps } from "./cluster-selector";
