/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectionToken } from "@ogre-tools/injectable";

import type { LensWindow } from "../application-window/create-lens-window.injectable";

/**
 * 🎯 목적: 로그 창 인스턴스들을 추적하기 위한 injection token
 *
 * 📝 사용:
 * - 동적으로 생성된 로그 창들을 injectMany로 조회 가능
 * - 최대 창 개수 제한, 창 관리 등에 활용
 */
export const logWindowInjectionToken = getInjectionToken<LensWindow>({
  id: "log-window",
});
