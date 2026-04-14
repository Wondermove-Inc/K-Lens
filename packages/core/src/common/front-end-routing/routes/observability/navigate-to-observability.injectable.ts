/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Skuber+ Observability 화면으로 이동하는 함수
 *
 * 📝 사용 예시:
 * - Welcome 화면의 Hotbar에서 skuber-observability 버튼 클릭 시
 *
 * 🔄 변경이력:
 * - 2025-12-02: 초기 생성
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../navigate-to-route-injection-token";
import observabilityRouteInjectable from "./observability-route.injectable";

const navigateToObservabilityInjectable = getInjectable({
  id: "navigate-to-observability",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(observabilityRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToObservabilityInjectable;
