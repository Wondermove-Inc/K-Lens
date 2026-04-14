/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterSelector 컴포넌트에 DI 의존성 주입
 *
 * 📝 주요 기능:
 * - AIChatPanelStore에서 클러스터 상태 주입
 * - Store의 action 메서드를 콜백으로 연결
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import aiChatPanelStoreInjectable from "../ai-chat-panel-store.injectable";
import { ClusterSelector } from "./cluster-selector";

import type { AIChatPanelStore } from "../ai-chat-panel-store";

/**
 * 🎯 DI 의존성 타입
 */
interface Dependencies {
  aiChatPanelStore: AIChatPanelStore;
}

/**
 * 🎯 Props (외부에서 전달받는 값)
 */
interface ExternalProps {
  compact?: boolean;
  className?: string;
}

/**
 * 🎯 DI 래퍼 컴포넌트 (내부용)
 * Store에서 필요한 상태와 액션을 추출하여 ClusterSelector에 전달
 */
const NonInjectedClusterSelector = observer((props: ExternalProps & Dependencies) => {
  const { aiChatPanelStore, compact, className } = props;

  // 📝 2026-01-18: Issue 4 - maxClusters 제거
  // cluster-selector.tsx에서 connectedClusters.length 기반으로 동적 처리
  return (
    <ClusterSelector
      connectedClusters={aiChatPanelStore.connectedClusters}
      selectedClusterIds={aiChatPanelStore.selectedClusterIds}
      onToggleCluster={(id) => aiChatPanelStore.toggleClusterSelection(id)}
      onSelectSingle={(id) => aiChatPanelStore.selectSingleCluster(id)}
      compact={compact}
      className={className}
    />
  );
});

/**
 * 🎯 DI 래퍼 컴포넌트
 */
const InjectedClusterSelector = withInjectables<Dependencies, ExternalProps>(NonInjectedClusterSelector, {
  getProps: (di, props) => ({
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
    ...props,
  }),
});

/**
 * 🎯 Injectable 정의
 * ClusterSelector 컴포넌트를 DI 컨테이너에 등록
 */
const clusterSelectorComponentInjectable = getInjectable({
  id: "cluster-selector-component",
  instantiate: () => InjectedClusterSelector,
});

export { clusterSelectorComponentInjectable, InjectedClusterSelector };
export default clusterSelectorComponentInjectable;
