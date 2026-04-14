/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 목적: /cluster/:id/security 라우트 정의
 * /cluster/:id/security 라우트 추가
 * SECURITY_SCAN_PANEL Feature Flag 연동
 *
 * 패턴: cluster-overview-route.injectable.ts와 동일한 구조.
 * SECURITY_SCAN_PANEL Feature Flag로 활성화를 제어합니다.
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { isSecurityFeatureEnabled } from "../../../../../features/security/common/feature-flags";
import { frontEndRouteInjectionToken } from "../../../front-end-route-injection-token";

const securityRouteInjectable = getInjectable({
  id: "security-route",

  instantiate: () => ({
    path: "/security",
    clusterFrame: true,
    // SECURITY_SCAN_PANEL Feature Flag로 활성화 제어
    // false 시 사이드바 메뉴 및 라우트 비활성화
    isEnabled: computed(() => isSecurityFeatureEnabled("SECURITY_SCAN_PANEL")),
  }),

  injectionToken: frontEndRouteInjectionToken,
});

export default securityRouteInjectable;
