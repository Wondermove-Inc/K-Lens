/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { isRequestError } from "@skuberplus/utilities";

import type { CoreV1Api } from "@skuberplus/kubernetes-client-node";

export interface MetricsServerDetectionResult {
  isAvailable: boolean;
  error?: string;
}

/**
 * Detects if Kubernetes Metrics Server is available in the cluster
 * For now, this is a simplified implementation that checks for metrics-server deployment
 */
export async function detectMetricsServer(client: CoreV1Api): Promise<MetricsServerDetectionResult> {
  try {
    // Check if metrics-server service exists in kube-system namespace
    // This is a more reliable way to detect if metrics server is available
    const service = await client.readNamespacedService({
      name: "metrics-server",
      namespace: "kube-system",
    });

    if (service.metadata?.name) {
      return {
        isAvailable: true,
      };
    }

    return {
      isAvailable: false,
      error: "Metrics server service not found",
    };
  } catch (error) {
    const errorMessage = isRequestError(error) ? error.response?.body?.message || error.message : String(error);

    // Check if it's a 404 (service not found) vs other errors
    const isNotFound = isRequestError(error) && error.response?.statusCode === 404;

    return {
      isAvailable: false,
      error: isNotFound
        ? "Kubernetes Metrics Server is not installed or not available"
        : `Failed to access Metrics Server: ${errorMessage}`,
    };
  }
}

/**
 * Checks if the metrics server provides both node and pod metrics
 * For now, this is a simplified implementation that assumes both are available if the service exists
 */
export async function validateMetricsServerCapabilities(client: CoreV1Api): Promise<{
  nodeMetrics: boolean;
  podMetrics: boolean;
}> {
  const detection = await detectMetricsServer(client);

  // If metrics server is available, assume both node and pod metrics are supported
  if (detection.isAvailable) {
    return {
      nodeMetrics: true,
      podMetrics: true,
    };
  }

  return {
    nodeMetrics: false,
    podMetrics: false,
  };
}
