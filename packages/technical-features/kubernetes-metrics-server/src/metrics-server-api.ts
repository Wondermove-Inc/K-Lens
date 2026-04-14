/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { NodeMetrics, PodMetrics } from "@skuberplus/kube-object";
import { isRequestError } from "@skuberplus/utilities";

import type { NodeMetricsData, PodMetricsData } from "@skuberplus/kube-object";
import type { CoreV1Api } from "@skuberplus/kubernetes-client-node";

/**
 * API wrapper for Kubernetes Metrics Server
 * Provides typed access to node and pod metrics from metrics.k8s.io API
 */
export class MetricsServerApi {
  constructor(private readonly client: CoreV1Api) {}

  /**
   * Make a request to the metrics server API - DEPRECATED, use real PodMetricsApi instead
   */
  private async makeMetricsRequest(path: string): Promise<any> {
    console.warn(`makeMetricsRequest is deprecated - use real PodMetricsApi instead: ${path}`);
    throw new Error("This method is deprecated - MetricsAdapter should use real PodMetricsApi");
  }

  /**
   * Get metrics for all nodes in the cluster
   */
  async getNodeMetrics(): Promise<NodeMetrics[]> {
    try {
      const response = await this.makeMetricsRequest("/apis/metrics.k8s.io/v1beta1/nodes");

      if (!response || !response.items) {
        throw new Error("Invalid response from Metrics Server API");
      }

      return response.items.map((item: NodeMetricsData) => new NodeMetrics(item));
    } catch (error) {
      if (isRequestError(error)) {
        const statusCode = error.response?.statusCode;
        const message = error.response?.body?.message || error.message;

        if (statusCode === 404) {
          throw new Error("Metrics Server API not found. Please ensure metrics-server is installed in your cluster.");
        } else if (statusCode === 403) {
          throw new Error("Access denied to Metrics Server API. Check your cluster permissions.");
        } else {
          throw new Error(`Metrics Server API error (${statusCode}): ${message}`);
        }
      }

      throw new Error(`Failed to get node metrics: ${String(error)}`);
    }
  }

  /**
   * Get metrics for a specific node
   */
  async getNodeMetric(nodeName: string): Promise<NodeMetrics> {
    const allMetrics = await this.getNodeMetrics();
    const nodeMetric = allMetrics.find((metric) => metric.getName() === nodeName);

    if (!nodeMetric) {
      throw new Error(`Node "${nodeName}" not found`);
    }

    return nodeMetric;
  }

  /**
   * Get metrics for all pods in all namespaces
   */
  async getPodMetrics(): Promise<PodMetrics[]> {
    try {
      const response = await this.makeMetricsRequest("/apis/metrics.k8s.io/v1beta1/pods");

      if (!response || !response.items) {
        throw new Error("Invalid response from Metrics Server API");
      }

      return response.items.map((item: PodMetricsData) => new PodMetrics(item));
    } catch (error) {
      if (isRequestError(error)) {
        const statusCode = error.response?.statusCode;
        const message = error.response?.body?.message || error.message;

        if (statusCode === 404) {
          throw new Error("Metrics Server API not found. Please ensure metrics-server is installed in your cluster.");
        } else if (statusCode === 403) {
          throw new Error("Access denied to Metrics Server API. Check your cluster permissions.");
        } else {
          throw new Error(`Metrics Server API error (${statusCode}): ${message}`);
        }
      }

      throw new Error(`Failed to get pod metrics: ${String(error)}`);
    }
  }

  /**
   * Get metrics for pods in a specific namespace
   */
  async getPodMetricsInNamespace(namespace: string): Promise<PodMetrics[]> {
    try {
      const response = await this.makeMetricsRequest(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods`);

      if (!response || !response.items) {
        throw new Error("Invalid response from Metrics Server API");
      }

      return response.items.map((item: PodMetricsData) => new PodMetrics(item));
    } catch (error) {
      if (isRequestError(error)) {
        const statusCode = error.response?.statusCode;
        const message = error.response?.body?.message || error.message;

        if (statusCode === 404) {
          throw new Error(`Namespace "${namespace}" not found or Metrics Server API not available.`);
        } else if (statusCode === 403) {
          throw new Error(`Access denied to metrics for namespace "${namespace}". Check your cluster permissions.`);
        } else {
          throw new Error(`Metrics Server API error (${statusCode}): ${message}`);
        }
      }

      throw new Error(`Failed to get pod metrics for namespace "${namespace}": ${String(error)}`);
    }
  }

  /**
   * Get metrics for a specific pod
   */
  async getPodMetric(namespace: string, podName: string): Promise<PodMetrics> {
    try {
      const response = await this.makeMetricsRequest(
        `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${podName}`,
      );

      if (!response) {
        throw new Error("Invalid response from Metrics Server API");
      }

      return new PodMetrics(response as PodMetricsData);
    } catch (error) {
      if (isRequestError(error)) {
        const statusCode = error.response?.statusCode;
        const message = error.response?.body?.message || error.message;

        if (statusCode === 404) {
          throw new Error(
            `Pod "${podName}" not found in namespace "${namespace}" or Metrics Server API not available.`,
          );
        } else if (statusCode === 403) {
          throw new Error(
            `Access denied to metrics for pod "${podName}" in namespace "${namespace}". Check your cluster permissions.`,
          );
        } else {
          throw new Error(`Metrics Server API error (${statusCode}): ${message}`);
        }
      }

      throw new Error(`Failed to get metrics for pod "${podName}" in namespace "${namespace}": ${String(error)}`);
    }
  }

  /**
   * Check if the Metrics Server API is healthy and responsive
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Use the detection logic to check if metrics server is available
      const detection = await import("./metrics-server-detection").then((m) => m.detectMetricsServer(this.client));
      return detection.isAvailable;
    } catch {
      return false;
    }
  }
}
