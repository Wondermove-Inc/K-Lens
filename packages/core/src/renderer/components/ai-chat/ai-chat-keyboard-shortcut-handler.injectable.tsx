/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant 키보드 단축키 핸들러 (Root Frame)
 *
 * 📝 2026-01-17: Root Frame 마이그레이션
 * - ClusterFrame의 panel-sync-listener에서 Root Frame으로 이전
 * - Cmd+Shift+A (macOS) / Ctrl+Shift+A (Windows/Linux) 단축키 처리
 * - View 메뉴에서 broadcastMessage로 전송된 메시지 수신
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { rootFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed } from "mobx";
import { useEffect } from "react";
import { AI_ASSISTANT_TOGGLE_CHANNEL } from "../../../features/application-menu/main/menu-items/view/toggle-ai-assistant/toggle-ai-assistant-menu-item.injectable";
import legacyOnChannelListenInjectable from "../../ipc/legacy-channel-listen.injectable";
import aiChatPanelStoreInjectable from "./ai-chat-panel-store.injectable";

import type { AIChatPanelStore } from "./ai-chat-panel-store";

/**
 * 🎯 LegacyOnChannelListen 타입 정의
 * broadcast message 수신을 위한 함수 타입
 */
type LegacyOnChannelListen = (channel: string, listener: () => void) => () => void;

interface Dependencies {
  aiChatPanelStore: AIChatPanelStore;
  legacyOnChannelListen: LegacyOnChannelListen;
}

/**
 * 🎯 AI Assistant 키보드 단축키 핸들러 컴포넌트
 *
 * View 메뉴의 AI Assistant 단축키(Cmd+Shift+A)에서 전송된
 * broadcastMessage를 수신하여 AI Chat Panel을 토글합니다.
 */
const NonInjectedAIChatKeyboardShortcutHandler = ({ aiChatPanelStore, legacyOnChannelListen }: Dependencies) => {
  useEffect(() => {
    /**
     * 🎯 메뉴 단축키에서 오는 AI Assistant 토글 메시지 핸들러
     * View > AI Assistant 메뉴 클릭 또는 Cmd+Shift+A 단축키 입력 시 호출
     */
    const handleMenuToggleAiAssistant = () => {
      console.info("[AIChatKeyboardShortcut] Toggle AI Assistant via menu shortcut");
      aiChatPanelStore.toggle();
    };

    // 🎯 브로드캐스트 메시지 리스너 등록
    const disposeListener = legacyOnChannelListen(AI_ASSISTANT_TOGGLE_CHANNEL, handleMenuToggleAiAssistant);

    // 🎯 cleanup
    return disposeListener;
  }, [aiChatPanelStore, legacyOnChannelListen]);

  // 🎯 이 컴포넌트는 UI를 렌더링하지 않음 (키보드 단축키 핸들러만 담당)
  return null;
};

const AIChatKeyboardShortcutHandler = withInjectables<Dependencies>(NonInjectedAIChatKeyboardShortcutHandler, {
  getProps: (di) => ({
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
    legacyOnChannelListen: di.inject(legacyOnChannelListenInjectable),
  }),
});

/**
 * 🎯 Root Frame Child Component로 등록
 * Root Frame에서 항상 렌더링되어 키보드 단축키 처리
 */
const aiChatKeyboardShortcutHandlerInjectable = getInjectable({
  id: "ai-chat-keyboard-shortcut-handler",

  instantiate: () => ({
    id: "ai-chat-keyboard-shortcut-handler",
    shouldRender: computed(() => window.location.pathname !== "/log-window"),
    Component: AIChatKeyboardShortcutHandler,
  }),

  injectionToken: rootFrameChildComponentInjectionToken,
});

export default aiChatKeyboardShortcutHandlerInjectable;
