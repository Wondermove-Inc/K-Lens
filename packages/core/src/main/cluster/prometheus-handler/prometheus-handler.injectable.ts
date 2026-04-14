/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { createClusterPrometheusHandler } from "./prometheus-handler";

import type { Cluster } from "../../../common/cluster/cluster";

/**
 * 🎯 목적: Prometheus 핸들러 Injectable
 *
 * 📝 주의사항:
 * - 클러스터별로 싱글톤으로 관리됨
 * - metricsSource 설정에 따라 Metrics Server 또는 Prometheus 사용
 * - Provider 의존성 완전 제거됨
 *
 * 🔄 변경이력: 2026-01-09 - Provider 의존성 제거, 단순화
 */
const prometheusHandlerInjectable = getInjectable({
  id: "prometheus-handler",

  instantiate: (di, cluster) =>
    createClusterPrometheusHandler(
      {
        logger: di.inject(loggerInjectionToken),
      },
      cluster,
    ),
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, cluster: Cluster) => cluster.id,
  }),
});

export default prometheusHandlerInjectable;
