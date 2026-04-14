/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { KubeEventDetails } from "../../../events/kube-event-details";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";

/**
 * 🎯 목적: 개별 Event 상세 정보 표시
 * - orderNumber: -8로 Events 테이블(-10) 다음, Conditions(-5) 이전에 표시
 * 🔄 변경이력:
 *   - 2026-01-06: orderNumber Infinity → -8 변경 (Warning 패널 UI 개선)
 */
const kubeEventDetailItemInjectable = getInjectable({
  id: "kube-event-detail-item",

  instantiate: () => ({
    Component: KubeEventDetails,
    enabled: computed(() => true),
    // 🎯 orderNumber: -8로 Events 테이블(-10) 다음, Conditions(-5) 이전에 표시
    orderNumber: -8,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default kubeEventDetailItemInjectable;
