/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import createStorageInjectable from "../../../utils/create-storage/create-storage.injectable";

export type MetricType = "memory" | "cpu";
export type MetricNodeRole = "master" | "worker";

export interface ClusterOverviewStorageState {
  metricType: MetricType;
  metricNodeRole: MetricNodeRole;
  // 🆕 개별 노드 선택 및 실시간 데이터 수집 설정
  selectedNodeName?: string;
  collectionInterval: number; // milliseconds (기본: 60000 = 1분)
}

const clusterOverviewStorageInjectable = getInjectable({
  id: "cluster-overview-storage",
  instantiate: (di) => {
    const createStorage = di.inject(createStorageInjectable);

    return createStorage<ClusterOverviewStorageState>("cluster_overview", {
      metricType: "cpu", // setup defaults
      metricNodeRole: "master", // 🎯 기본값을 Master로 변경
      selectedNodeName: undefined, // 🎯 초기에는 노드 미선택 상태
      collectionInterval: 60000, // 🎯 기본 1분 간격으로 데이터 수집
    });
  },
});

export default clusterOverviewStorageInjectable;
