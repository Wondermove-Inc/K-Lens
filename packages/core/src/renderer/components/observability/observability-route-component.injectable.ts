/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability 라우트와 컴포넌트 연결
 *
 * 📝 주의사항:
 * - observabilityRouteInjectable과 Observability 컴포넌트를 연결
 * - routeSpecificComponentInjectionToken으로 라우팅 시스템에 등록
 *
 * 🔄 변경이력:
 * - 2025-12-02: 초기 생성
 */

import { getInjectable } from "@ogre-tools/injectable";
import observabilityRouteInjectable from "../../../common/front-end-routing/routes/observability/observability-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { Observability } from "./observability";

const observabilityRouteComponentInjectable = getInjectable({
  id: "observability-route-component",

  instantiate: (di) => ({
    route: di.inject(observabilityRouteInjectable),
    Component: Observability,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default observabilityRouteComponentInjectable;
