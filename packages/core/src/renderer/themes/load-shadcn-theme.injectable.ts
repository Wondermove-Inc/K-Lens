/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import { DEFAULT_SHADCN_THEME_ID, SHADCN_THEMES } from "./shadcn-theme-types";

import type { ShadcnThemeId } from "./shadcn-theme-types";

/**
 * 🎯 목적: User preferences state에서 저장된 shadcn 테마를 로드하는 함수 타입
 * 📝 기능: 저장된 테마가 없거나 유효하지 않으면 기본 테마 반환
 */
export type LoadShadcnTheme = () => ShadcnThemeId;

/**
 * 🎯 목적: shadcn 테마 로드 Injectable 서비스
 * 📝 기능:
 *   - User preferences state에서 저장된 테마 ID 읽기
 *   - 유효성 검증 (SHADCN_THEMES에 존재하는지 확인)
 *   - 유효하지 않으면 기본 테마 반환
 */
const loadShadcnThemeInjectable = getInjectable({
  id: "load-shadcn-theme",
  instantiate: (di): LoadShadcnTheme => {
    const logger = di.inject(loggerInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);

    return () => {
      try {
        // User preferences state에서 저장된 테마 ID 읽기
        const savedThemeId = state.shadcnTheme;

        if (!savedThemeId) {
          logger.debug("[SHADCN-THEME] No saved theme found, using default");

          return DEFAULT_SHADCN_THEME_ID;
        }

        // 유효한 테마 ID인지 확인
        const isValid = SHADCN_THEMES.some((theme) => theme.id === savedThemeId);

        if (!isValid) {
          logger.warn(`[SHADCN-THEME] Invalid saved theme ID: ${savedThemeId}, using default`);

          return DEFAULT_SHADCN_THEME_ID;
        }

        logger.info(`[SHADCN-THEME] Loaded saved theme: ${savedThemeId}`);

        return savedThemeId as ShadcnThemeId;
      } catch (error) {
        logger.error("[SHADCN-THEME] Failed to load theme from state", error);

        return DEFAULT_SHADCN_THEME_ID;
      }
    };
  },
});

export default loadShadcnThemeInjectable;
