/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ChatHeader 컴포넌트에 DI 의존성 주입
 *
 * 📝 주요 기능:
 * - AIChatPanelStore에서 클러스터/채팅 상태 주입
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
import { ChatHeader } from "./chat-header";

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
  /** Settings 버튼 클릭 콜백 */
  onOpenSettings: () => void;
  /** Close 버튼 클릭 콜백 (애니메이션 포함) */
  onClose: () => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 🎯 DI 래퍼 컴포넌트 (내부용)
 */
const NonInjectedChatHeader = observer((props: ExternalProps & Dependencies) => {
  const { aiChatPanelStore, onOpenSettings, onClose, className } = props;

  // 📝 2026-01-18: Issue 4 - maxClusters 제거
  // cluster-selector.tsx에서 connectedClusters.length 기반으로 동적 처리
  return (
    <ChatHeader
      connectedClusters={aiChatPanelStore.connectedClusters}
      selectedClusterIds={aiChatPanelStore.selectedClusterIds}
      onToggleCluster={(id) => aiChatPanelStore.toggleClusterSelection(id)}
      onSelectSingle={(id) => aiChatPanelStore.selectSingleCluster(id)}
      pastChats={aiChatPanelStore.pastChats}
      isPastChatsLoading={aiChatPanelStore.isPastChatsLoading}
      onLoadPastChats={() => aiChatPanelStore.loadPastChats()}
      onSelectPastChat={(threadId) => aiChatPanelStore.selectPastChat(threadId)}
      onNewChat={() => aiChatPanelStore.startNewChat()}
      onOpenSettings={onOpenSettings}
      onClose={onClose}
      className={className}
    />
  );
});

/**
 * 🎯 DI 래퍼 컴포넌트
 */
const InjectedChatHeader = withInjectables<Dependencies, ExternalProps>(NonInjectedChatHeader, {
  getProps: (di, props) => ({
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
    ...props,
  }),
});

/**
 * 🎯 Injectable 정의
 */
const chatHeaderComponentInjectable = getInjectable({
  id: "chat-header-component",
  instantiate: () => InjectedChatHeader,
});

export { chatHeaderComponentInjectable, InjectedChatHeader };
export default chatHeaderComponentInjectable;
