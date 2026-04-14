/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Workloads Overview shadcn UI 이벤트 테이블 Injectable
 *
 * 📝 주의사항:
 * - 기존 workload-events.injectable.ts를 shadcn UI로 대체
 * - orderNumber 300으로 기존과 동일한 순서 유지
 * - enabled를 true로 설정하여 기본적으로 활성화
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (기존 Events 컴포넌트를 shadcn UI로 마이그레이션)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { WorkloadEventsShadcn } from "../../workload-events-shadcn";
import { workloadOverviewDetailInjectionToken } from "../workload-overview-detail-injection-token";

const workloadEventsShadcnInjectable = getInjectable({
  id: "workload-events-shadcn",

  instantiate: () => ({
    Component: WorkloadEventsShadcn,
    enabled: computed(() => true), // 🎯 shadcn UI 이벤트 테이블 활성화
    orderNumber: 300, // 🎯 기존 events와 동일한 순서 유지
  }),

  injectionToken: workloadOverviewDetailInjectionToken,
});

export default workloadEventsShadcnInjectable;
