/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterSelectionPrompt 컴포넌트에 DI 의존성 주입
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
import { ClusterSelectionPrompt } from "./cluster-selection-prompt";

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
  className?: string;
}

/**
 * 🎯 DI 래퍼 컴포넌트 (내부용)
 */
const NonInjectedClusterSelectionPrompt = observer((props: ExternalProps & Dependencies) => {
  const { aiChatPanelStore, className } = props;

  return (
    <ClusterSelectionPrompt
      connectedClusters={aiChatPanelStore.connectedClusters}
      selectedClusterIds={aiChatPanelStore.selectedClusterIds}
      onToggleCluster={(id) => aiChatPanelStore.toggleClusterSelection(id)}
      onSelectSingle={(id) => aiChatPanelStore.selectSingleCluster(id)}
      className={className}
    />
  );
});

/**
 * 🎯 DI 래퍼 컴포넌트
 */
const InjectedClusterSelectionPrompt = withInjectables<Dependencies, ExternalProps>(NonInjectedClusterSelectionPrompt, {
  getProps: (di, props) => ({
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
    ...props,
  }),
});

/**
 * 🎯 Injectable 정의
 */
const clusterSelectionPromptComponentInjectable = getInjectable({
  id: "cluster-selection-prompt-component",
  instantiate: () => InjectedClusterSelectionPrompt,
});

export { clusterSelectionPromptComponentInjectable, InjectedClusterSelectionPrompt };
export default clusterSelectionPromptComponentInjectable;
