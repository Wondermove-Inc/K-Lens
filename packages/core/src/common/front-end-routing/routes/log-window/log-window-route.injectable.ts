/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { frontEndRouteInjectionToken } from "../../front-end-route-injection-token";

import type { Route } from "../../front-end-route-injection-token";

export interface LogWindowPathParameters {
  windowId?: string;
}

/**
 * 🎯 목적: 독립 로그 창을 위한 라우트 정의
 *
 * 📝 사용:
 * - /log-window?windowId=xxx URL로 접근
 * - clusterFrame: false (RootFrame에서 렌더링)
 * - 클러스터 서브도메인 없이 로드됨 (clusterFrames Map 충돌 방지)
 * - API 호출은 standalone-log-view-model에서 클러스터 서브도메인으로 직접 fetch
 */
const logWindowRouteInjectable = getInjectable({
  id: "log-window-route",

  instantiate: (): Route<LogWindowPathParameters> => ({
    path: "/log-window",
    clusterFrame: false,
    isEnabled: computed(() => true),
  }),

  injectionToken: frontEndRouteInjectionToken,
});

export default logWindowRouteInjectable;
