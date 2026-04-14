/**
 * 🎯 목적: WSL 설정 Preference Item 등록
 * 📝 기능: Terminal 탭에 WSL 설정 섹션 등록
 * 🔄 변경이력:
 *   - 2026-02-03: WSL UX 개선 - 초기 구현
 * @module features/preferences/renderer/preference-items/terminal/wsl-settings
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { WslSettings } from "./wsl-settings";

const wslSettingsPreferenceItemInjectable = getInjectable({
  id: "wsl-settings-preference-item",

  instantiate: () => ({
    kind: "block" as const,
    id: "wsl-settings",
    parentId: "terminal-page",
    // Shell Path 바로 아래에 위치 (Shell Path: 10)
    orderNumber: 15,
    Component: WslSettings,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default wslSettingsPreferenceItemInjectable;
