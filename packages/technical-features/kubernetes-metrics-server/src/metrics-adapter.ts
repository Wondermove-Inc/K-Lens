/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { MetricsServerApi } from "./metrics-server-api";

import type { CoreV1Api } from "@skuberplus/kubernetes-client-node";

/**
 * Converts Kubernetes Metrics Server data to Prometheus-compatible format
 */
export class MetricsAdapter {
  private readonly api: MetricsServerApi;
  private readonly customObjectsApi?: any; // Real CustomObjectsApi for metrics.k8s.io API

  constructor(client: CoreV1Api, customObjectsApi?: any) {
    this.api = new MetricsServerApi(client);
    this.customObjectsApi = customObjectsApi;
  }

  /**
   * Convert CPU usage from Kubernetes format (e.g., "250m") to cores (e.g., 0.25)
   */
  private convertCpuToCore(cpu: string): number {
    if (cpu.endsWith("m")) {
      return parseFloat(cpu.slice(0, -1)) / 1000;
    }
    if (cpu.endsWith("n")) {
      return parseFloat(cpu.slice(0, -1)) / 1000000000;
    }
    return parseFloat(cpu);
  }

  /**
   * Convert memory usage from Kubernetes format (e.g., "128Mi", "1Gi") to bytes
   */
  private convertMemoryToBytes(memory: string): number {
    const units = {
      Ki: 1024,
      Mi: 1024 * 1024,
      Gi: 1024 * 1024 * 1024,
      Ti: 1024 * 1024 * 1024 * 1024,
      k: 1000,
      M: 1000 * 1000,
      G: 1000 * 1000 * 1000,
      T: 1000 * 1000 * 1000 * 1000,
    };

    for (const [suffix, multiplier] of Object.entries(units)) {
      if (memory.endsWith(suffix)) {
        return parseFloat(memory.slice(0, -suffix.length)) * multiplier;
      }
    }

    // If no unit, assume bytes
    return parseFloat(memory);
  }

  /**
   * Generate current timestamp in Prometheus format
   */
  private getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 🎯 Prometheus POSIX 정규식을 JS 정규식으로 변환
   * - [[:alnum:]] → [0-9A-Za-z]
   * - [[:digit:]] → [0-9]
   */
  private normalizePrometheusRegex(pattern: string): string {
    return pattern.replace(/\[\[:alnum:\]\]/g, "[0-9A-Za-z]").replace(/\[\[:digit:\]\]/g, "[0-9]");
  }

  /**
   * 🎯 Pod 셀렉터 매칭 (POSIX regex 호환)
   */
  private matchesPodSelector(podName: string, selector: string): boolean {
    const normalized = this.normalizePrometheusRegex(selector);

    try {
      const regex = new RegExp(normalized);
      return regex.test(podName);
    } catch (error) {
      console.warn(`⚠️  Invalid pod selector regex "${selector}", falling back to substring match: ${error}`);
      return podName.includes(selector);
    }
  }

  /**
   * Get cluster-wide metrics for nodes
   */
  async getClusterMetrics(opts: Record<string, string>): Promise<{ [key: string]: Array<[number, string]> }> {
    try {
      const nodeMetrics = await this.api.getNodeMetrics();
      const nodeNames = opts.nodes.split("|").filter((name) => name.length > 0);
      const timestamp = this.getCurrentTimestamp();

      // Filter nodes if specified
      const filteredMetrics =
        nodeNames.length > 0 ? nodeMetrics.filter((metric) => nodeNames.includes(metric.getName())) : nodeMetrics;

      const result: { [key: string]: Array<[number, string]> } = {};

      // Calculate total CPU usage
      const totalCpuCores = filteredMetrics.reduce((sum, metric) => {
        return sum + this.convertCpuToCore(metric.usage.cpu);
      }, 0);

      // Calculate total memory usage
      const totalMemoryBytes = filteredMetrics.reduce((sum, metric) => {
        return sum + this.convertMemoryToBytes(metric.usage.memory);
      }, 0);

      result.cpuUsage = [[timestamp, totalCpuCores.toString()]];
      result.memoryUsage = [[timestamp, totalMemoryBytes.toString()]];

      return result;
    } catch (error) {
      console.warn(`Failed to get cluster metrics: ${error}`);
      const timestamp = this.getCurrentTimestamp();
      return {
        cpuUsage: [[timestamp, "0"]],
        memoryUsage: [[timestamp, "0"]],
      };
    }
  }

  /**
   * Get workload memory usage (pod memory usage aggregate)
   */
  async getWorkloadMemoryUsage(opts: Record<string, string>): Promise<Array<[number, string]>> {
    try {
      const podMetrics = await this.api.getPodMetrics();
      const timestamp = this.getCurrentTimestamp();

      // Calculate total workload memory from all pods
      const totalWorkloadMemoryBytes = podMetrics.reduce((sum, metric) => {
        // Sum memory usage from all containers in the pod
        const podMemoryBytes = metric.containers.reduce((podSum, container) => {
          return podSum + this.convertMemoryToBytes(container.usage.memory);
        }, 0);

        return sum + podMemoryBytes;
      }, 0);

      return [[timestamp, totalWorkloadMemoryBytes.toString()]];
    } catch (error) {
      console.warn(`Failed to get workload memory usage: ${error}`);
      const timestamp = this.getCurrentTimestamp();
      return [[timestamp, "0"]];
    }
  }

  /**
   * Get individual node metrics
   */
  async getNodeMetrics(): Promise<{ [key: string]: Array<[number, string]> }> {
    try {
      const nodeMetrics = await this.api.getNodeMetrics();
      const timestamp = this.getCurrentTimestamp();
      const result: { [key: string]: Array<[number, string]> } = {};

      nodeMetrics.forEach((metric) => {
        const nodeName = metric.getName();
        const cpuCores = this.convertCpuToCore(metric.usage.cpu);
        const memoryBytes = this.convertMemoryToBytes(metric.usage.memory);

        // Create separate entries for each node
        result[`${nodeName}_cpu`] = [[timestamp, cpuCores.toString()]];
        result[`${nodeName}_memory`] = [[timestamp, memoryBytes.toString()]];
      });

      return result;
    } catch (error) {
      console.warn(`Failed to get node metrics: ${error}`);
      return {};
    }
  }

  /**
   * Get pod metrics for specific namespace and pods
   */
  async getPodMetrics(opts: {
    namespace: string;
    pods: string;
    selector: string;
  }): Promise<{ [key: string]: Array<[number, string]> }> {
    try {
      const podMetrics = await this.api.getPodMetricsInNamespace(opts.namespace);
      const podNames = opts.pods.split("|").filter((name) => name.length > 0);
      const timestamp = this.getCurrentTimestamp();

      // Filter pods if specified
      const filteredMetrics =
        podNames.length > 0
          ? podMetrics.filter((metric) => podNames.some((name) => this.matchesPodSelector(metric.getName(), name)))
          : podMetrics;

      const result: { [key: string]: Array<[number, string]> } = {};

      filteredMetrics.forEach((metric) => {
        const podName = metric.getName();

        // Calculate total CPU and memory for all containers in the pod
        const totalCpuCores = metric.containers.reduce((sum, container) => {
          return sum + this.convertCpuToCore(container.usage.cpu);
        }, 0);

        const totalMemoryBytes = metric.containers.reduce((sum, container) => {
          return sum + this.convertMemoryToBytes(container.usage.memory);
        }, 0);

        result[`${podName}_cpu`] = [[timestamp, totalCpuCores.toString()]];
        result[`${podName}_memory`] = [[timestamp, totalMemoryBytes.toString()]];
      });

      return result;
    } catch (error) {
      console.warn(`Failed to get pod metrics: ${error}`);
      return {};
    }
  }

  /**
   * 🔥 SIMPLE: Get single-point Pod metrics for detail view
   * Just call /apis/metrics.k8s.io/v1beta1/pods and return current CPU/Memory as single point
   */
  async getSimplePodMetrics(
    podName: string,
    namespace: string,
  ): Promise<{
    cpuUsage: Array<[number, string]>;
    memoryUsage: Array<[number, string]>;
  }> {
    try {
      console.log(`🔥 SIMPLE POD METRICS: Getting metrics for pod ${podName} in namespace ${namespace}`);

      // Use real CustomObjectsApi if available, otherwise fall back to mock API
      let podMetrics;
      if (this.customObjectsApi) {
        console.log(`🔥 Using REAL CustomObjectsApi for simple pod metrics`);
        const response = await this.customObjectsApi.listNamespacedCustomObject(
          "metrics.k8s.io",
          "v1beta1",
          namespace,
          "pods",
        );
        const { PodMetrics } = await import("@skuberplus/kube-object");
        podMetrics = response.body.items.map((item: any) => new PodMetrics(item));
      } else {
        console.log(`⚠️  Using fallback mock API for simple pod metrics`);
        podMetrics = await this.api.getPodMetricsInNamespace(namespace);
      }

      // Find the specific pod
      const targetPodMetric = podMetrics.find((metric: any) => metric.getName() === podName);

      if (!targetPodMetric) {
        console.warn(`🔥 No metrics found for pod ${podName}`);
        const timestamp = this.getCurrentTimestamp();
        return {
          cpuUsage: [[timestamp, "0"]],
          memoryUsage: [[timestamp, "0"]],
        };
      }

      const timestamp = this.getCurrentTimestamp();

      // Calculate total CPU and Memory from all containers
      let totalCpuCores = 0;
      let totalMemoryBytes = 0;

      for (const container of targetPodMetric.containers) {
        const cpuValue = container.usage.cpu || "0";
        const memoryValue = container.usage.memory || "0";
        totalCpuCores += this.convertCpuToCore(cpuValue);
        totalMemoryBytes += this.convertMemoryToBytes(memoryValue);
      }

      console.log(
        `🔥 SIMPLE POD METRICS: Pod ${podName} - CPU: ${totalCpuCores} cores, Memory: ${totalMemoryBytes} bytes`,
      );

      return {
        cpuUsage: [[timestamp, totalCpuCores.toString()]],
        memoryUsage: [[timestamp, totalMemoryBytes.toString()]],
      };
    } catch (error) {
      console.warn(`Failed to get simple pod metrics: ${error}`);
      const timestamp = this.getCurrentTimestamp();
      return {
        cpuUsage: [[timestamp, "0"]],
        memoryUsage: [[timestamp, "0"]],
      };
    }
  }

  /**
   * Simulate Prometheus query response format
   * This is a simplified version that only supports current metrics (no historical data)
   */
  async executeQuery(queryName: string, opts: Record<string, string>): Promise<Array<[number, string]>> {
    switch (opts.category) {
      case "cluster": {
        // Real metrics that should fail properly if Metrics Server is down
        if (queryName === "cpuUsage" || queryName === "memoryUsage") {
          const clusterMetrics = await this.getClusterMetrics(opts);
          return clusterMetrics[queryName] || [];
        }

        if (queryName === "workloadMemoryUsage") {
          // Real metric - let it fail if Metrics Server is down
          return await this.getWorkloadMemoryUsage(opts);
        }

        // Metrics not implementable with Metrics Server - return empty to hide from UI
        if (
          queryName === "memoryCapacity" ||
          queryName === "cpuCapacity" ||
          queryName === "memoryAllocatableCapacity" ||
          queryName === "cpuAllocatableCapacity" ||
          queryName === "podCapacity" ||
          queryName === "podAllocatableCapacity" ||
          queryName === "podUsage" ||
          queryName === "cpuRequests" ||
          queryName === "cpuLimits" ||
          queryName === "memoryRequests" ||
          queryName === "memoryLimits"
        ) {
          console.warn(`[METRICS-SERVER] Metric ${queryName} not available - hiding from UI`);
          const timestamp = this.getCurrentTimestamp();
          return [[timestamp, "0"]];
        }

        // Other unsupported queries - return empty to hide from UI
        console.warn(`[METRICS-SERVER] Unsupported cluster metric ${queryName} - hiding from UI`);
        const timestamp = this.getCurrentTimestamp();
        return [[timestamp, "0"]];
      }

      case "nodes": {
        // Real metrics that should fail properly
        if (queryName === "cpuUsage" || queryName === "memoryUsage") {
          const nodeMetrics = await this.getNodeMetrics();
          return nodeMetrics[queryName] || [];
        }

        // Metrics not implementable with Metrics Server - return empty to hide from UI
        if (
          queryName === "workloadMemoryUsage" ||
          queryName === "memoryCapacity" ||
          queryName === "cpuCapacity" ||
          queryName === "memoryAllocatableCapacity" ||
          queryName === "cpuAllocatableCapacity" ||
          queryName === "podCapacity" ||
          queryName === "podAllocatableCapacity" ||
          queryName === "podUsage" ||
          queryName === "cpuRequests" ||
          queryName === "cpuLimits" ||
          queryName === "memoryRequests" ||
          queryName === "memoryLimits"
        ) {
          console.warn(`[METRICS-SERVER] Node metric ${queryName} not available - hiding from UI`);
          const timestamp = this.getCurrentTimestamp();
          return [[timestamp, "0"]];
        }

        // Other unsupported queries - return empty to hide from UI
        console.warn(`[METRICS-SERVER] Unsupported node metric ${queryName} - hiding from UI`);
        const timestamp = this.getCurrentTimestamp();
        return [[timestamp, "0"]];
      }

      case "pods": {
        // METHOD 1: CPU uses PodStore-compatible calculation
        if (queryName === "cpuUsage") {
          console.log("🔥 [METHOD 1] Using PodStore-compatible CPU calculation");
          return await this.getCpuUsageFromPodStoreMethod(opts);
        }

        // METHOD 1: Memory uses PodStore-compatible calculation
        if (queryName === "memoryUsage") {
          console.log("🔥 [METHOD 1] Using PodStore-compatible Memory calculation");
          return await this.getMemoryUsageFromPodStoreMethod(opts);
        }

        // All other pod metrics are not available in Metrics Server - return empty to hide from UI
        console.warn(`[METRICS-SERVER] Unsupported pod metric ${queryName} - hiding from UI`);
        const timestamp = this.getCurrentTimestamp();
        return [[timestamp, "0"]];
      }

      default: {
        console.warn(`[METRICS-SERVER] Unsupported category: ${opts.category} - hiding from UI`);
        const timestamp = this.getCurrentTimestamp();
        return [[timestamp, "0"]];
      }
    }
  }

  /**
   * METHOD 1: Get CPU usage same as PodStore.getPodKubeMetrics()
   */
  private async getCpuUsageFromPodStoreMethod(opts: Record<string, string>): Promise<Array<[number, string]>> {
    console.log(`🔥 [METHOD 1] Using REAL Kubernetes Metrics API for CPU calculation`);

    try {
      const timestamp = this.getCurrentTimestamp();

      // Use real CustomObjectsApi if available, otherwise fall back to mock API
      let podMetrics;
      if (this.customObjectsApi) {
        console.log(
          `🔥 Using REAL CustomObjectsApi for metrics.k8s.io API - namespace: ${opts.namespace || "default"}`,
        );
        // Call real Kubernetes API: /apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods
        const response = await this.customObjectsApi.listNamespacedCustomObject(
          "metrics.k8s.io",
          "v1beta1",
          opts.namespace || "default",
          "pods",
        );
        // Convert response to PodMetrics objects
        const { PodMetrics } = await import("@skuberplus/kube-object");
        podMetrics = response.body.items.map((item: any) => new PodMetrics(item));
      } else {
        console.log(`⚠️  Using fallback mock API`);
        podMetrics = await this.api.getPodMetricsInNamespace(opts.namespace || "default");
      }

      // Find the specific pod (similar to PodStore.getPodKubeMetrics logic)
      const podNames = opts.pods ? opts.pods.split("|").filter((name) => name.length > 0) : [];
      const targetPodMetrics =
        podNames.length > 0
          ? podMetrics.filter((metric: any) => podNames.some((name) => this.matchesPodSelector(metric.getName(), name)))
          : podMetrics;

      if (targetPodMetrics.length === 0) {
        console.log(`🔥 No pod metrics found for namespace: ${opts.namespace}`);
        return [[timestamp, "0"]];
      }

      // Aggregate CPU from all containers (same logic as PodStore)
      let totalCpuCores = 0;
      for (const metric of targetPodMetrics) {
        for (const container of metric.containers) {
          const cpuValue = container.usage.cpu || "0";
          totalCpuCores += this.convertCpuToCore(cpuValue);
        }
      }

      console.log(
        `🔥 [METHOD 1] REAL Kubernetes API CPU: ${totalCpuCores} cores (from ${targetPodMetrics.length} pods)`,
      );
      return [[timestamp, totalCpuCores.toString()]];
    } catch (error) {
      console.warn(`Failed to get CPU using REAL Kubernetes API: ${error}`);
      const timestamp = this.getCurrentTimestamp();
      return [[timestamp, "0"]];
    }
  }

  /**
   * METHOD 1: Get Memory usage same as PodStore.getPodKubeMetrics()
   */
  private async getMemoryUsageFromPodStoreMethod(opts: Record<string, string>): Promise<Array<[number, string]>> {
    console.log(`🔥 [METHOD 1] Using REAL Kubernetes Metrics API for Memory calculation`);

    try {
      const timestamp = this.getCurrentTimestamp();

      // Use real CustomObjectsApi if available, otherwise fall back to mock API
      let podMetrics;
      if (this.customObjectsApi) {
        console.log(
          `🔥 Using REAL CustomObjectsApi for metrics.k8s.io API - namespace: ${opts.namespace || "default"}`,
        );
        // Call real Kubernetes API: /apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods
        const response = await this.customObjectsApi.listNamespacedCustomObject(
          "metrics.k8s.io",
          "v1beta1",
          opts.namespace || "default",
          "pods",
        );
        // Convert response to PodMetrics objects
        const { PodMetrics } = await import("@skuberplus/kube-object");
        podMetrics = response.body.items.map((item: any) => new PodMetrics(item));
      } else {
        console.log(`⚠️  Using fallback mock API`);
        podMetrics = await this.api.getPodMetricsInNamespace(opts.namespace || "default");
      }

      // Find the specific pod (similar to PodStore.getPodKubeMetrics logic)
      const podNames = opts.pods ? opts.pods.split("|").filter((name) => name.length > 0) : [];
      const targetPodMetrics =
        podNames.length > 0
          ? podMetrics.filter((metric: any) => podNames.some((name) => this.matchesPodSelector(metric.getName(), name)))
          : podMetrics;

      if (targetPodMetrics.length === 0) {
        console.log(`🔥 No pod metrics found for namespace: ${opts.namespace}`);
        return [[timestamp, "0"]];
      }

      // Aggregate Memory from all containers (same logic as PodStore)
      let totalMemoryBytes = 0;
      for (const metric of targetPodMetrics) {
        for (const container of metric.containers) {
          const memoryValue = container.usage.memory || "0";
          totalMemoryBytes += this.convertMemoryToBytes(memoryValue);
        }
      }

      console.log(
        `🔥 [METHOD 1] REAL Kubernetes API Memory: ${totalMemoryBytes} bytes (from ${targetPodMetrics.length} pods)`,
      );
      return [[timestamp, totalMemoryBytes.toString()]];
    } catch (error) {
      console.warn(`Failed to get Memory using REAL Kubernetes API: ${error}`);
      const timestamp = this.getCurrentTimestamp();
      return [[timestamp, "0"]];
    }
  }

  /**
   * Check if the adapter can provide the requested metrics
   */
  async isAvailable(): Promise<boolean> {
    return await this.api.healthCheck();
  }
}
