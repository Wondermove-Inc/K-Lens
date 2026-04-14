/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: View 메뉴에 AI Assistant 토글 메뉴 아이템 추가
 *
 * 📝 주의사항:
 * - Cmd+Shift+A (macOS) / Ctrl+Shift+A (Windows/Linux) 단축키 지원
 * - 클러스터 연결 시에만 활성화
 *
 * 🔄 변경이력:
 * - 2026-01-06: 초기 생성 (USER-GUIDE.md 기능 구현)
 */

import { getInjectable } from "@ogre-tools/injectable";
import broadcastMessageInjectable from "../../../../../../common/ipc/broadcast-message.injectable";
import applicationMenuItemInjectionToken from "../../application-menu-item-injection-token";

/**
 * 🎯 AI Assistant 토글 IPC 채널명
 * renderer에서 이 메시지를 수신하여 AI Chat Panel 토글 처리
 */
export const AI_ASSISTANT_TOGGLE_CHANNEL = "ai-assistant:toggle";

const toggleAiAssistantMenuItemInjectable = getInjectable({
  id: "toggle-ai-assistant-menu-item",

  instantiate: (di) => {
    const broadcastMessage = di.inject(broadcastMessageInjectable);

    return {
      kind: "clickable-menu-item" as const,
      parentId: "view",
      id: "toggle-ai-assistant",
      orderNumber: 25, // Command Palette (20) 다음에 배치
      label: "AI Assistant",
      keyboardShortcut: "Shift+CmdOrCtrl+A",

      onClick(_menuItem, _browserWindow, event) {
        /**
         * 🎯 메뉴 클릭 시에만 브로드캐스트 (accelerator 중복 방지)
         * NOTE: playwright 버그로 인해 optional chaining 사용
         * https://github.com/microsoft/playwright/issues/10554
         */
        if (!event?.triggeredByAccelerator) {
          broadcastMessage(AI_ASSISTANT_TOGGLE_CHANNEL);
        }
      },
    };
  },

  injectionToken: applicationMenuItemInjectionToken,
});

export default toggleAiAssistantMenuItemInjectable;
