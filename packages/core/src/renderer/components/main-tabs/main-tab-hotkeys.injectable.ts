/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
/**
 * 🎯 목적: Split 관련 키보드 단축키 등록
 *
 * @description
 * - Cmd/Ctrl + \: Split Right
 * - Cmd/Ctrl + W: Close Split (split 활성 시) 또는 Close Tab
 * - Cmd/Ctrl + K, Cmd/Ctrl + ←: Focus Left Group
 * - Cmd/Ctrl + K, Cmd/Ctrl + →: Focus Right Group
 *
 * 📝 주의사항:
 * - beforeFrameStartsSecondInjectionToken으로 앱 시작 시 자동 등록
 * - window.addEventListener를 사용하여 전역 키보드 이벤트 감지
 *
 * 🔄 변경이력:
 * - 2025-10-29: 초기 생성 (Level 5 Split 단축키 구현)
 * - 2025-10-29: injection token 수정 (renderer용 토큰 사용)
 */
import { beforeFrameStartsSecondInjectionToken } from "../../before-frame-starts/tokens";
import navigateInjectable from "../../navigation/navigate.injectable";
import mainTabStoreInjectable from "./main-tab-store.injectable";
import splitActionsInjectable from "./split-actions.injectable";

const mainTabHotkeysInjectable = getInjectable({
  id: "main-tab-hotkeys",
  instantiate: (di) => ({
    run: () => {
      const mainTabStore = di.inject(mainTabStoreInjectable);
      const navigate = di.inject(navigateInjectable);
      const splitActions = di.inject(splitActionsInjectable);

      /**
       * 🎯 목적: Cmd/Ctrl + \ - Split Right
       */
      window.addEventListener("keydown", (e) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          (e.key === "\\" || ["Backslash", "IntlBackslash", "IntlYen"].includes(e.code))
        ) {
          e.preventDefault();
          splitActions.splitTabRight();
        }
      });

      /**
       * 🎯 목적: Cmd/Ctrl + W - Close Split (split 활성 시) 또는 Close Tab
       *
       * 📝 주의사항:
       * - Split 활성 시: Split 닫기
       * - Split 비활성 시: 현재 활성 탭 닫기
       */
      window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "w") {
          e.preventDefault();

          if (mainTabStore.isSplitActive) {
            // Split 활성 시: Split 닫기
            splitActions.closeSplit();
          } else if (mainTabStore.activeTabId) {
            // Split 비활성 시: 현재 활성 탭 닫기 (dirty 확인 포함)
            const result = mainTabStore.requestCloseTab(mainTabStore.activeTabId);

            if (result.closed && result.wasActive && result.nextActiveTab) {
              navigate(result.nextActiveTab.route);
            }
          }
        }
      });

      /**
       * 🎯 목적: Cmd/Ctrl + K, Cmd/Ctrl + ← - Focus Left Group
       * 🎯 목적: Cmd/Ctrl + K, Cmd/Ctrl + → - Focus Right Group
       *
       * 📝 구현 방식:
       * - Cmd/Ctrl + K 입력 후 1초 이내에 화살표 키 입력 시 동작
       * - cmdKPressed 플래그로 Cmd/Ctrl + K 상태 추적
       */
      let cmdKPressed = false;

      window.addEventListener("keydown", (e) => {
        // Cmd/Ctrl + K 감지
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          cmdKPressed = true;

          // 1초 후 플래그 초기화
          setTimeout(() => {
            cmdKPressed = false;
          }, 1000);
        }

        // Cmd/Ctrl + K 상태에서 Cmd/Ctrl + ← 입력
        if (cmdKPressed && (e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") {
          e.preventDefault();
          splitActions.focusLeftGroup();
        }

        // Cmd/Ctrl + K 상태에서 Cmd/Ctrl + → 입력
        if (cmdKPressed && (e.metaKey || e.ctrlKey) && e.key === "ArrowRight") {
          e.preventDefault();
          splitActions.focusRightGroup();
        }

        // Cmd/Ctrl + K 상태에서 Cmd/Ctrl + \ 입력 (수직 Split)
        if (
          cmdKPressed &&
          (e.metaKey || e.ctrlKey) &&
          (e.key === "\\" || ["Backslash", "IntlBackslash", "IntlYen"].includes(e.code))
        ) {
          e.preventDefault();
          splitActions.splitTabDown();
          cmdKPressed = false;
        }
      });
    },
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default mainTabHotkeysInjectable;
