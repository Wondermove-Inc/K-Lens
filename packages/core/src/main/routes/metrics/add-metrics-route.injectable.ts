/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getUnifiedQuery } from "@skuberplus/prometheus";
import { isRequestError, object } from "@skuberplus/utilities";
import { isObject } from "lodash";
import { runInAction } from "mobx";
import { ClusterMetadataKey, initialFilesystemMountpoints } from "../../../common/cluster-types";
import { apiPrefix } from "../../../common/vars";
import loadProxyKubeconfigInjectable from "../../cluster/load-proxy-kubeconfig.injectable";
import prometheusHandlerInjectable from "../../cluster/prometheus-handler/prometheus-handler.injectable";
import getMetricsInjectable from "../../get-metrics.injectable";
import { clusterRoute } from "../../router/route";
import { getRouteInjectable } from "../../router/router.injectable";

import type { QueryCategory } from "@skuberplus/prometheus";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ClusterPrometheusMetadata } from "../../../common/cluster-types";
import type { GetMetrics } from "../../get-metrics.injectable";

// This is used for backoff retry tracking.
const ATTEMPTS = [false, false, false, false, true];

const loadMetricsFor =
  (getMetrics: GetMetrics) =>
  async (
    promQueries: string[],
    cluster: Cluster,
    prometheusPath: string,
    queryParams: Partial<Record<string, string>>,
  ): Promise<any[]> => {
    const queries = promQueries.map((p) => p.trim());
    const loaders = new Map<string, Promise<any>>();

    async function loadMetric(query: string): Promise<any> {
      async function loadMetricHelper(): Promise<any> {
        for (const [attempt, lastAttempt] of ATTEMPTS.entries()) {
          // retry
          try {
            return await getMetrics(cluster, prometheusPath, { query, ...queryParams });
          } catch (error) {
            if (
              !isRequestError(error) ||
              lastAttempt ||
              (!lastAttempt &&
                typeof error.statusCode === "number" &&
                400 <= error.statusCode &&
                error.statusCode < 500)
            ) {
              throw new Error("Metrics not available", { cause: error });
            }

            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000)); // add delay before repeating request
          }
        }
      }

      return loaders.get(query) ?? loaders.set(query, loadMetricHelper()).get(query);
    }

    return Promise.all(queries.map(loadMetric));
  };

const addMetricsRouteInjectable = getRouteInjectable({
  id: "add-metrics-route",

  instantiate: (di) => {
    const getMetrics = di.inject(getMetricsInjectable);
    const loadMetrics = loadMetricsFor(getMetrics);
    const logger = di.inject(loggerInjectionToken);

    return clusterRoute({
      method: "post",
      path: `${apiPrefix}/metrics`,
    })(async ({ cluster, payload, query }) => {
      const queryParams: Partial<Record<string, string>> = Object.fromEntries(query.entries());
      const prometheusMetadata: ClusterPrometheusMetadata = {};
      const prometheusHandler = di.inject(prometheusHandlerInjectable, cluster);
      const mountpoints = cluster.preferences.filesystemMountpoints || initialFilesystemMountpoints;

      try {
        const { prometheusPath } = await prometheusHandler.getPrometheusDetails();
        const metricsSource = cluster.preferences.metricsSource ?? "metrics-server";

        prometheusMetadata.provider = metricsSource;
        prometheusMetadata.autoDetected = false; // Auto-detect 제거됨

        if (metricsSource === "prometheus" && !prometheusPath) {
          prometheusMetadata.success = false;

          return { response: {} };
        }

        // Special handling for Kubernetes Metrics Server
        if (metricsSource === "metrics-server") {
          if (isObject(payload)) {
            const data = payload as Record<string, Record<string, string>>;
            // Import MetricsAdapter dynamically to avoid circular dependencies
            const { MetricsAdapter } = await import("@skuberplus/kubernetes-metrics-server");
            const proxyConfig = await di.inject(loadProxyKubeconfigInjectable, cluster)();
            const { CoreV1Api, CustomObjectsApi } = await import("@skuberplus/kubernetes-client-node");
            const apiClient = proxyConfig.makeApiClient(CoreV1Api);

            // Create CustomObjectsApi for real metrics API calls
            const customObjectsApi = proxyConfig.makeApiClient(CustomObjectsApi);
            const metricsAdapter = new MetricsAdapter(apiClient, customObjectsApi);

            const response: Record<string, any> = {};

            // Process each metric query using MetricsAdapter
            for (const [metricName, queryOpts] of object.entries(data)) {
              try {
                const result = await metricsAdapter.executeQuery(metricName, queryOpts);
                // Convert to Prometheus format
                // 🎯 Auto-Detect 모드에서 그래프 표시를 위해 metric, resultType 필드 추가
                response[metricName] = {
                  status: "success",
                  data: {
                    resultType: "matrix",
                    result: [
                      {
                        metric: {},
                        values: result,
                      },
                    ],
                  },
                };
              } catch (error) {
                logger.warn(`[METRICS-ROUTE]: Failed to get metric ${metricName}: ${error}`);
                // Return empty result for failed metrics
                response[metricName] = {
                  status: "success",
                  data: { result: [] },
                };
              }
            }

            prometheusMetadata.success = true;
            return { response };
          }

          // For non-object payloads, fall back to empty response
          return { response: {} };
        }

        // Standard Prometheus handling for other providers
        // return data in same structure as query
        if (typeof payload === "string") {
          const [data] = await loadMetrics([payload], cluster, prometheusPath, queryParams);

          return { response: data };
        }

        if (Array.isArray(payload)) {
          const data = await loadMetrics(payload, cluster, prometheusPath, queryParams);

          return { response: data };
        }

        if (isObject(payload)) {
          const data = payload as Record<string, Record<string, string>>;

          // 🎯 통합 쿼리 사용 (Provider 제거됨)
          const queries = object.entries(data).map(([queryName, queryOpts]) => {
            // queryOpts.category가 있으면 사용, 없으면 "cluster" 기본값
            const category = (queryOpts.category as QueryCategory) || "cluster";
            const query = getUnifiedQuery(category, queryName, { ...queryOpts, mountpoints });
            return query;
          });

          const result = await loadMetrics(queries, cluster, prometheusPath, queryParams);
          const response = object.fromEntries(object.keys(data).map((metricName, i) => [metricName, result[i]]));

          prometheusMetadata.success = true;

          return { response };
        }

        return { response: {} };
      } catch (error) {
        prometheusMetadata.success = false;

        logger.warn(`[METRICS-ROUTE]: failed to get metrics for clusterId=${cluster.id}: ${error}`);

        return { response: {} };
      } finally {
        runInAction(() => {
          cluster.metadata[ClusterMetadataKey.PROMETHEUS] = prometheusMetadata;
        });
      }
    });
  },
});

export default addMetricsRouteInjectable;
