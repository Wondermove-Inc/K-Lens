/**
 * 🎯 목적: AI Chat Panel의 상태를 localStorage에 영속화하는 Storage Injectable
 *
 * 저장되는 상태:
 * - isOpen: 패널 열림/닫힘 상태
 * - width: 패널 너비 (리사이즈 가능)
 */

import { getInjectable } from "@ogre-tools/injectable";
import createStorageInjectable from "../../utils/create-storage/create-storage.injectable";

import type { AIChatPanelStorageState } from "./ai-chat-panel-store";

const aiChatPanelStorageInjectable = getInjectable({
  id: "ai-chat-panel-storage",

  instantiate: (di) => {
    const createStorage = di.inject(createStorageInjectable);

    // 🎯 목적: AI Chat Panel 상태 초기값 설정
    return createStorage<AIChatPanelStorageState>("ai-chat-panel", {
      isOpen: false, // 기본값: 패널 닫힘
      width: 400, // 기본값: 400px 너비
    });
  },
});

export default aiChatPanelStorageInjectable;
