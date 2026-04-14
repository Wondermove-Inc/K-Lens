/**
 * 🎯 목적: AI Chat Panel을 Root Frame Child Component로 등록
 *
 * 📝 2026-01-17: DAIVE Root Frame Migration
 * - ClusterFrame에서 Root Frame으로 AI Chat Panel 이동
 * - 클러스터 연결 상태와 무관하게 항상 토글 가능
 * - Root Frame 레벨에서 렌더링 (전역 상태 유지)
 *
 * 변경 이력:
 * - AS-IS: ClusterFrame 내부에서 렌더링 (클러스터 연결 필요)
 * - TO-BE: Root Frame 레벨에서 렌더링 (항상 접근 가능)
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import { rootFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed } from "mobx";
import { AIChatPanelForClusterFrame } from "./ai-chat-panel";
import aiChatPanelStoreInjectable from "./ai-chat-panel-store.injectable";

/**
 * 🎯 AI Chat Panel을 Root Frame에 등록
 *
 * - shouldRender: store.isOpen에 따라 조건부 렌더링
 * - orderNumber: 다른 컴포넌트와 충돌 방지 (100)
 * - Component: 기존 AIChatPanelForClusterFrame 재사용
 */
const aiChatPanelRootFrameChildComponentInjectable = getInjectable({
  id: "ai-chat-panel-root-frame-child-component",

  instantiate: (di) => {
    const store = di.inject(aiChatPanelStoreInjectable);

    console.info("[AIChatPanel][root-frame] instantiated", { isOpen: store.isOpen });

    // 🎯 "Generate with AI" 버튼에서 AI 채팅 패널 열기 이벤트 수신
    // 패널이 닫혀있으면 컴포넌트가 unmount되어 리스너 등록 불가하므로
    // 항상 살아있는 injectable에서 이벤트 리스너 등록
    window.addEventListener("daive:open-chat", () => {
      if (!store.isOpen) {
        store.open();
      }
    });

    return {
      id: "ai-chat-panel",

      /**
       * 🎯 Panel 열림 상태에 따라 렌더링 여부 결정
       * computed()로 MobX 반응성 확보
       */
      shouldRender: computed(() => store.isOpen && window.location.pathname !== "/log-window"),

      /**
       * 🎯 AI Chat Panel 컴포넌트
       * 기존 AIChatPanelForClusterFrame 재사용 (DI 주입 포함)
       */
      Component: AIChatPanelForClusterFrame,
    };
  },

  /**
   * 🎯 Root Frame Child Component 토큰으로 등록
   * 이 토큰에 등록된 컴포넌트는 Root Frame에서 자동으로 렌더링됨
   */
  injectionToken: rootFrameChildComponentInjectionToken,
});

export default aiChatPanelRootFrameChildComponentInjectable;
