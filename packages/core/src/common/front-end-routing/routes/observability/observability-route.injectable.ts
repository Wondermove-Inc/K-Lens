/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Skuber+ Observability 화면 라우트 정의
 *
 * 📝 주의사항:
 * - clusterFrame: false (클러스터 독립적인 화면)
 * - path: "/observability"
 * - isEnabled: computed(() => true) (MobX computed 사용)
 *
 * 🔄 변경이력:
 * - 2025-12-02: 초기 생성 (Skuber+ Observability 화면)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { frontEndRouteInjectionToken } from "../../front-end-route-injection-token";

const observabilityRouteInjectable = getInjectable({
  id: "observability-route",

  instantiate: () => ({
    path: "/observability",
    clusterFrame: false,
    isEnabled: computed(() => true),
  }),

  injectionToken: frontEndRouteInjectionToken,
});

export default observabilityRouteInjectable;
