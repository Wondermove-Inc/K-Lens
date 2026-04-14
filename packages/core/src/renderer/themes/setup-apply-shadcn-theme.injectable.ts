/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: userPreferencesState.shadcnTheme 변경을 MobX reaction으로 감시하여 자동 적용
 *
 * 📝 주의사항:
 * - 앱 시작 시 즉시 실행 (fireImmediately: true)
 * - 설정 변경 시 자동 감지 및 적용
 * - 클러스터 전환 시에도 자동으로 테마 재적용
 *
 * 🔄 변경이력: 2025-11-07 - 초기 생성 (테마 색상 초기화 문제 해결)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import initUserStoreInjectable from "../../features/user-preferences/renderer/load-storage.injectable";
import { beforeFrameStartsSecondInjectionToken } from "../before-frame-starts/tokens";
import applyShadcnThemeInjectable from "./apply-shadcn-theme.injectable";

const setupApplyShadcnThemeInjectable = getInjectable({
  id: "setup-apply-shadcn-theme",
  instantiate: (di) => ({
    run: () => {
      const userPreferencesState = di.inject(userPreferencesStateInjectable);
      const applyShadcnTheme = di.inject(applyShadcnThemeInjectable);

      // 🎯 핵심: MobX reaction으로 shadcnTheme 변경 자동 감시
      // - 앱 시작 시 즉시 적용 (fireImmediately: true)
      // - 설정 변경 시 자동 감지하여 테마 적용
      // - 클러스터 전환 후 state 재로드 시에도 자동 적용
      reaction(
        () => userPreferencesState.shadcnTheme,
        (themeId) => {
          applyShadcnTheme(themeId);
        },
        { fireImmediately: true },
      );
    },
    runAfter: [initUserStoreInjectable],
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default setupApplyShadcnThemeInjectable;
