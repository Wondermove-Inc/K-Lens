/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: KubeObject 액션 핸들러 DI Injection Token
 *
 * 📝 주의사항:
 *   - KubeObjectDetails 패널의 액션 메뉴(⋮)에서 사용
 *   - kind별로 다른 액션 핸들러를 등록 가능
 *   - DetailPanelActionsMenu의 props와 호환되는 인터페이스
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectionToken } from "@ogre-tools/injectable";

import type { KubeObject } from "@skuberplus/kube-object";

/**
 * 🎯 액션 핸들러들의 모음 인터페이스
 * - DetailPanelActionsMenu props와 호환
 */
export interface KubeObjectActionHandlers {
  onEdit?: () => void;
  onDelete?: () => void;
  onForceDelete?: () => void;
  onForceFinalize?: () => void;
  onRestart?: () => void;
  onScale?: () => void;
  onShell?: () => void;
  onLogs?: () => void;
  onLogsNewWindow?: () => void;
  onAttach?: () => void;
  onCordon?: () => void;
  onUncordon?: () => void;
  onDrain?: () => void;
  onTrigger?: () => void;
  onSuspend?: () => void;
  onUpgrade?: () => void;
  onRollback?: () => void;
}

/**
 * 🎯 KubeObject 액션 핸들러 인터페이스
 * - 특정 kind/apiVersion에 대한 액션 핸들러를 제공
 */
export interface KubeObjectActionHandler {
  /**
   * 지원하는 Kubernetes 리소스 kind
   */
  kind: string;

  /**
   * 지원하는 API 버전 목록 (빈 배열이면 모든 버전)
   */
  apiVersions: string[];

  /**
   * 주어진 KubeObject에 대한 액션 핸들러들을 반환
   *
   * @param object - Kubernetes 리소스 객체
   * @param onClose - 패널 닫기 콜백 (선택적)
   * @returns 액션 핸들러 객체
   */
  getHandlers: (object: KubeObject, onClose?: () => void) => KubeObjectActionHandlers;
}

/**
 * 🎯 KubeObject 액션 핸들러 Injection Token
 */
export const kubeObjectActionHandlerInjectionToken = getInjectionToken<KubeObjectActionHandler>({
  id: "kube-object-action-handler-injection-token",
});
