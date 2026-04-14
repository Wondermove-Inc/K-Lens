/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Warning 디테일 패널에서 Events 섹션을 가장 먼저 표시하는 detail-item
 *
 * 📝 주의사항:
 *   - orderNumber: -10 설정으로 가장 먼저 표시됨
 *   - KubeEventDetailsSection 컴포넌트 재사용
 *   - 모든 KubeObject에 대해 항상 활성화
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { KubeObject } from "@skuberplus/kube-object";
import { computed } from "mobx";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { KubeEventDetailsSection } from "../../kube-event-details-section";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";

/**
 * 🎯 Events 섹션 detail-item
 * - orderNumber: -10으로 가장 먼저 표시
 * - 모든 KubeObject에 대해 활성화 (KubeObject 인스턴스인지만 확인)
 */
const kubeEventsSectionDetailItemInjectable = getInjectable({
  id: "kube-events-section-detail-item",

  instantiate: (di) => {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: KubeEventDetailsSection,
      // 모든 KubeObject에 대해 활성화
      enabled: computed(() => {
        const obj = kubeObject.value.get()?.object;

        return obj instanceof KubeObject;
      }),
      // orderNumber: -10으로 가장 먼저 표시 (Warning Events 우선)
      orderNumber: -10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default kubeEventsSectionDetailItemInjectable;
