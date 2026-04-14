/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { WorkloadEvents } from "../../../../initializers/workload-events";
import { workloadOverviewDetailInjectionToken } from "../workload-overview-detail-injection-token";

const workloadEventsInjectable = getInjectable({
  id: "workload-events",

  instantiate: () => ({
    Component: WorkloadEvents,
    enabled: computed(() => false), // 🎯 shadcn UI 이벤트 테이블로 대체
    orderNumber: 300,
  }),

  injectionToken: workloadOverviewDetailInjectionToken,
});

export default workloadEventsInjectable;
