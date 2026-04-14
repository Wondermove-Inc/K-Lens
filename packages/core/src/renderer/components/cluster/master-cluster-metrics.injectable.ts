/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { cpuUnitsToNumber, unitsToBytes } from "@skuberplus/utilities";
import { now } from "mobx-utils";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import requestClusterMetricsByNodeNamesInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import nodeStoreInjectable from "../nodes/store.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";

import type { ClusterMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";

const everyMinute = 60 * 1000;

/**
 * 🎯 목적: Master 노드들의 클러스터 메트릭 데이터 수집
 *
 * ✅ 주요 기능:
 * - Metrics Server 선택 시: NodeStore에서 메트릭 수집 후 Prometheus 형식으로 변환
 * - Prometheus 선택 시: 기존 방식대로 Prometheus API 호출
 * - asyncComputed로 1분마다 자동 갱신
 * - Master 노드만 필터링 (node-role.kubernetes.io/control-plane 또는 master 레이블)
 *
 * 🔄 변경이력:
 * - 2025-11-06: Metrics Server 지원 추가
 */
const masterClusterMetricsInjectable = getInjectable({
  id: "master-cluster-metrics",
  instantiate: (di) => {
    const requestClusterMetricsByNodeNames = di.inject(requestClusterMetricsByNodeNamesInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const nodeStore = di.inject(nodeStoreInjectable);
    const podStore = di.inject(podStoreInjectable);

    return asyncComputed<ClusterMetricData | undefined>({
      getValueFromObservedPromise: async () => {
        // 🔄 1분마다 자동 갱신
        now(everyMinute);

        // 🎯 핵심 수정: nodeStore가 아직 로드되지 않았으면 재실행 대기
        // 📝 주의: isLoaded 접근으로 MobX 의존성 추적 활성화
        if (!nodeStore.isLoaded) {
          return undefined;
        }

        // 🎯 Master 노드만 필터링
        const masterNodes = nodeStore.items.filter((node) => {
          const labels = node.metadata.labels || {};
          return (
            labels["node-role.kubernetes.io/control-plane"] === "" || labels["node-role.kubernetes.io/master"] === ""
          );
        });

        if (masterNodes.length === 0) {
          return undefined;
        }

        const nodeNames = masterNodes.map((node) => node.getName());

        // 🎯 사용자가 선택한 메트릭 소스 확인
        // 🔄 변경: 새로운 metricsSource 필드 사용 (구식 prometheusProvider.type 대신)
        const preferences = hostedCluster?.preferences;
        const metricsSource = getMetricsSource(preferences);
        const isMetricsServerSelected = metricsSource === "metrics-server";

        if (isMetricsServerSelected) {
          // Metrics Server 모드: NodeStore에서 메트릭 수집
          await nodeStore.loadKubeMetrics();

          // 모든 Master 노드의 메트릭 합산
          let totalCpu = 0;
          let totalMemory = 0;
          let totalCpuRequests = 0;
          let totalCpuLimits = 0;
          let totalMemoryRequests = 0;
          let totalMemoryLimits = 0;
          let totalCpuAllocatable = 0;
          let totalCpuCapacity = 0;
          let totalMemoryAllocatable = 0;
          let totalMemoryCapacity = 0;
          let totalPodUsage = 0;
          let totalPodAllocatable = 0;
          let totalPodCapacity = 0;

          // 🎯 Master 노드에서 실행 중인 모든 Pod 가져오기
          const masterPods = podStore.items.filter((pod) => nodeNames.includes(pod.spec?.nodeName || ""));

          // 🎯 실제 사용 중인 Pod 수 = 해당 노드에서 실행 중인 Pod 개수
          totalPodUsage = masterPods.length;

          // 🎯 각 Pod의 Container resources 합산 (Requests/Limits)
          masterPods.forEach((pod) => {
            pod.getContainers().forEach((container) => {
              const resources = container.resources;

              // CPU Requests/Limits
              if (resources?.requests?.cpu) {
                totalCpuRequests += cpuUnitsToNumber(resources.requests.cpu) ?? 0;
              }
              if (resources?.limits?.cpu) {
                totalCpuLimits += cpuUnitsToNumber(resources.limits.cpu) ?? 0;
              }

              // Memory Requests/Limits
              if (resources?.requests?.memory) {
                totalMemoryRequests += unitsToBytes(resources.requests.memory);
              }
              if (resources?.limits?.memory) {
                totalMemoryLimits += unitsToBytes(resources.limits.memory);
              }
            });
          });

          masterNodes.forEach((node, index) => {
            const metrics = nodeStore.getNodeKubeMetrics(node);

            totalCpu += metrics.cpu || 0;
            totalMemory += metrics.memory || 0;

            // 🎯 Capacity/Allocatable는 Node 객체에서 직접 가져옴
            totalCpuCapacity += node.getCpuCapacity() || 0;
            totalMemoryCapacity += node.getMemoryCapacity() || 0;

            // Allocatable: Node status에서 직접 가져옴
            // 🔧 버그 수정: parseFloat() → cpuUnitsToNumber() (밀리코어 단위 변환 지원)
            if (node.status?.allocatable?.cpu) {
              totalCpuAllocatable += cpuUnitsToNumber(node.status.allocatable.cpu) ?? 0;
            }
            if (node.status?.allocatable?.memory) {
              // Memory는 바이트 단위를 변환해야 함
              const memoryStr = node.status.allocatable.memory;
              const memoryBytes = parseFloat(memoryStr.replace(/[a-zA-Z]/g, "")) || 0;
              totalMemoryAllocatable += memoryStr.endsWith("Ki")
                ? memoryBytes * 1024
                : memoryStr.endsWith("Mi")
                  ? memoryBytes * 1024 * 1024
                  : memoryStr.endsWith("Gi")
                    ? memoryBytes * 1024 * 1024 * 1024
                    : memoryBytes;
            }

            // 🎯 Pod Allocatable/Capacity (Node 속성에서 수집)
            // 📝 주의: totalPodUsage는 위에서 masterPods.length로 이미 설정됨
            totalPodAllocatable += node.status?.allocatable?.pods ? parseInt(node.status.allocatable.pods, 10) : 0;
            totalPodCapacity += node.status?.capacity?.pods ? parseInt(node.status.capacity.pods, 10) : 0;
          });

          // Prometheus 호환 형식으로 변환 (단일 데이터 포인트)
          const timestamp = Math.floor(Date.now() / 1000);

          return {
            cpuUsage: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalCpu.toString()]] }],
              },
            },
            memoryUsage: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalMemory.toString()]] }],
              },
            },
            cpuRequests: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalCpuRequests.toString()]] }],
              },
            },
            cpuLimits: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalCpuLimits.toString()]] }],
              },
            },
            memoryRequests: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalMemoryRequests.toString()]] }],
              },
            },
            memoryLimits: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalMemoryLimits.toString()]] }],
              },
            },
            cpuAllocatableCapacity: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalCpuAllocatable.toString()]] }],
              },
            },
            cpuCapacity: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalCpuCapacity.toString()]] }],
              },
            },
            memoryAllocatableCapacity: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalMemoryAllocatable.toString()]] }],
              },
            },
            memoryCapacity: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalMemoryCapacity.toString()]] }],
              },
            },
            podUsage: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalPodUsage.toString()]] }],
              },
            },
            podAllocatableCapacity: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalPodAllocatable.toString()]] }],
              },
            },
            podCapacity: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, totalPodCapacity.toString()]] }],
              },
            },
            fsSize: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            fsUsage: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            diskReadOps: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            diskWriteOps: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            diskReadLatency: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            diskWriteLatency: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            // 🎯 Network BPS/PPS 메트릭 (Metrics Server에서는 미지원)
            networkReceiveBps: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            networkTransmitBps: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            networkReceivePps: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
            networkTransmitPps: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: {}, values: [[timestamp, "0"]] }],
              },
            },
          };
        }

        // Prometheus 모드: 기존 API 호출
        return requestClusterMetricsByNodeNames(nodeNames);
      },
      betweenUpdates: "show-latest-value", // 🎯 이전 값 유지 (데이터 깜빡임 방지)
    });
  },
});

export default masterClusterMetricsInjectable;
