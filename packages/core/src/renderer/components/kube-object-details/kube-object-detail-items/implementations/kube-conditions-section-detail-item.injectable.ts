/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Warning 디테일 패널에서 Conditions 섹션을 두 번째로 표시하는 detail-item
 *
 * 📝 주의사항:
 *   - orderNumber: -5 설정으로 Events 다음에 표시됨
 *   - KubeObjectConditionsDrawer 컴포넌트 재사용
 *   - Conditions가 있는 KubeObject에만 표시
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { KubeObject, KubeObjectMetadata, KubeObjectStatus } from "@skuberplus/kube-object";
import { computed } from "mobx";
import { KubeObjectConditionsDrawer } from "../../../kube-object-conditions/kube-object-conditions-drawer";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";

/**
 * 🎯 KubeObject가 Conditions를 가지고 있는지 확인
 */
const hasConditions = (obj: KubeObject | undefined | null): boolean => {
  if (!obj || !(obj instanceof KubeObject)) return false;

  const status = (obj as KubeObject<KubeObjectMetadata, KubeObjectStatus>).status;

  return Boolean(status?.conditions?.length);
};

/**
 * 🎯 Conditions 섹션 detail-item
 * - orderNumber: -5로 Events 다음에 표시
 * - Conditions가 있는 KubeObject에만 활성화
 */
const kubeConditionsSectionDetailItemInjectable = getInjectable({
  id: "kube-conditions-section-detail-item",

  instantiate: (di) => {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: KubeObjectConditionsDrawer,
      // Conditions가 있는 KubeObject에만 활성화
      enabled: computed(() => {
        const obj = kubeObject.value.get()?.object;

        return hasConditions(obj);
      }),
      // orderNumber: -5로 Events(-10) 다음에 표시
      orderNumber: -5,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default kubeConditionsSectionDetailItemInjectable;
