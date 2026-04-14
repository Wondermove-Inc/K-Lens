/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { object } from "@skuberplus/utilities";
import k8sRequestInjectable from "./k8s-request.injectable";

import type { Cluster } from "../common/cluster/cluster";
import type { RequestMetricsParams } from "../common/k8s-api/endpoints/metrics.api/request-metrics.injectable";

export type GetMetrics = (
  cluster: Cluster,
  prometheusPath: string,
  queryParams: RequestMetricsParams & { query: string },
) => Promise<unknown>;

const getMetricsInjectable = getInjectable({
  id: "get-metrics",

  instantiate: (di): GetMetrics => {
    const k8sRequest = di.inject(k8sRequestInjectable);

    return async (cluster, prometheusPath, queryParams) => {
      const prometheusPrefix = cluster.preferences.prometheus?.prefix || "";

      // 🔧 수정: start/end/step 파라미터가 없으면 instant query 사용 (테이블용 - 훨씬 빠름)
      const hasTimeRange = "start" in queryParams && "end" in queryParams;
      const apiEndpoint = hasTimeRange ? "query_range" : "query";
      const metricsPath = `/api/v1/namespaces/${prometheusPath}/proxy${prometheusPrefix}/api/v1/${apiEndpoint}`;

      const body = new URLSearchParams();

      for (const [key, value] of object.entries(queryParams)) {
        body.append(key, value.toString());
      }

      return k8sRequest(cluster, metricsPath, {
        timeout: 0,
        method: "POST",
        body,
      });
    };
  },
});

export default getMetricsInjectable;
