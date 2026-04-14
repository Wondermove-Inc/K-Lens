/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import podStoreInjectable from "../../workloads-pods/store.injectable";
import { COLUMN_PRIORITY } from "./column-priority";

const columnId = "cpu-usage";

export const podsUsedCpuColumnInjectable = getInjectable({
  id: "pods-cpu-usage-column",
  instantiate: (di) => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.CPU_USAGE,
    content: (pod) => {
      const podStore = di.inject(podStoreInjectable);
      const metrics = podStore.getPodKubeMetrics(pod);
      const cpuUsage = metrics.cpu;

      // 🎯 data-column-id 속성 추가로 헤더와 데이터 행 동기화
      return <span data-column-id={columnId}>{isNaN(cpuUsage) ? "N/A" : cpuUsage.toFixed(3)}</span>;
    },
    header: {
      title: "CPU",
      className: "cpu-usage",
      sortBy: columnId,
      id: columnId,
      "data-column-id": columnId,
    },
    sortingCallBack: (pod) => {
      const podStore = di.inject(podStoreInjectable);
      const metrics = podStore.getPodKubeMetrics(pod);

      return isNaN(metrics.cpu) ? 0 : metrics.cpu;
    },
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
