/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { createPrometheusProvider, prometheusProviderInjectionToken } from "@skuberplus/prometheus";
import { detectMetricsServer } from "./metrics-server-detection";

import type { CoreV1Api } from "@skuberplus/kubernetes-client-node";
import type { PrometheusProvider, PrometheusServiceInfo } from "@skuberplus/prometheus";

/**
 * Query handler for Kubernetes Metrics Server
 * Supports basic CPU and Memory queries compatible with existing UI components
 */
const getMetricsServerQueryFor = (): PrometheusProvider["getQuery"] => (opts, queryName) => {
  // We return a placeholder query string since the actual data fetching
  // is handled by the MetricsAdapter in getPrometheusService
  // The query names are used to identify what metrics to return
  switch (opts.category) {
    case "cluster":
      switch (queryName) {
        case "memoryUsage":
        case "cpuUsage":
        case "workloadMemoryUsage": // Pod memory usage aggregate
        case "memoryCapacity": // Node memory capacity
        case "cpuCapacity": // Node CPU capacity
        case "memoryAllocatableCapacity": // Node allocatable memory
        case "cpuAllocatableCapacity": // Node allocatable CPU
          return queryName; // Return the query name as identifier

        // Mock data for unsupported queries (requires kube-state-metrics)
        case "memoryRequests":
        case "memoryLimits":
        case "cpuRequests":
        case "cpuLimits":
        case "podUsage":
        case "podCapacity":
        case "podAllocatableCapacity":
          return `mock_${queryName}`; // Mark as mock data

        // Mock data for filesystem queries (requires node-exporter)
        case "fsSize":
        case "fsUsage":
          return `mock_${queryName}`; // Mark as mock data

        default:
          // Return mock for any unknown query instead of throwing error
          return `mock_unknown_${queryName}`;
      }
    case "nodes":
      switch (queryName) {
        case "memoryUsage":
        case "cpuUsage":
        case "workloadMemoryUsage": // Container memory usage per node
        case "memoryCapacity": // Node memory capacity
        case "cpuCapacity": // Node CPU capacity
        case "memoryAllocatableCapacity": // Node allocatable memory
        case "cpuAllocatableCapacity": // Node allocatable CPU
          return queryName; // Return the query name as identifier

        // Mock data for filesystem queries (requires node-exporter)
        case "fsSize":
        case "fsUsage":
          return `mock_${queryName}`; // Mark as mock data

        default:
          // Return mock for any unknown query instead of throwing error
          return `mock_unknown_${queryName}`;
      }
    case "pods":
      switch (queryName) {
        case "cpuUsage":
        case "memoryUsage":
          return queryName; // Return the query name as identifier

        // Mock data for resource queries (requires kube-state-metrics)
        case "cpuRequests":
        case "cpuLimits":
        case "memoryRequests":
        case "memoryLimits":
          return `mock_${queryName}`; // Mark as mock data

        // Mock data for filesystem queries (requires node-exporter)
        case "fsUsage":
        case "fsWrites":
        case "fsReads":
          return `mock_${queryName}`; // Mark as mock data

        // Mock data for network queries (requires node-exporter)
        case "networkReceive":
        case "networkTransmit":
          return `mock_${queryName}`; // Mark as mock data

        default:
          // Return mock for any unknown query instead of throwing error
          return `mock_unknown_${queryName}`;
      }
    default:
      throw new Error(`Unsupported category: ${opts.category} for Kubernetes Metrics Server`);
  }
};

/**
 * Service discovery for Kubernetes Metrics Server
 * Returns service info with kind identifier for routing
 */
const getMetricsServerService = async (client: CoreV1Api): Promise<PrometheusServiceInfo & { kind: string }> => {
  // Check if Metrics Server is available
  const detection = await detectMetricsServer(client);

  if (!detection.isAvailable) {
    throw new Error(detection.error || "Kubernetes Metrics Server is not available");
  }

  // Return service info with kind identifier
  // The actual metrics fetching will be handled by MetricsAdapter
  return {
    kind: "metrics-server",
    namespace: "kube-system",
    service: "metrics-server",
    port: 443, // Default HTTPS port for metrics-server
  };
};

/**
 * Injectable for Kubernetes Metrics Server provider
 * Integrates with the existing Prometheus provider system
 */
const metricsServerProviderInjectable = getInjectable({
  id: "kubernetes-metrics-server-provider",
  instantiate: () =>
    createPrometheusProvider({
      kind: "metrics-server",
      name: "Kubernetes Metrics Server",
      isConfigurable: false,
      showInUI: true,
      getQuery: getMetricsServerQueryFor(),
      getService: getMetricsServerService,
    }),
  injectionToken: prometheusProviderInjectionToken,
});

export default metricsServerProviderInjectable;
