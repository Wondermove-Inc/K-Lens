/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { nodeMetricsApiInjectable } from "@skuberplus/kube-api-specifics";
import { action, computed, observable } from "mobx";
import nodeStoreInjectable from "../../nodes/store.injectable";
import clusterOverviewStorageInjectable from "./storage.injectable";

import type { Node } from "@skuberplus/kube-object";

import type { MetricNodeRole } from "./storage.injectable";

export type SelectedNodeRoleForMetrics = ReturnType<(typeof selectedNodeRoleForMetricsInjectable)["instantiate"]>;

const selectedNodeRoleForMetricsInjectable = getInjectable({
  id: "selected-node-role-for-metrics",
  instantiate: (di) => {
    const storage = di.inject(clusterOverviewStorageInjectable);
    const nodeStore = di.inject(nodeStoreInjectable);
    const nodeMetricsApi = di.inject(nodeMetricsApiInjectable);

    // 🔄 실시간 데이터 수집용 메모리 캐시 - MetricData 형식으로 변환
    const nodeMetricsCache = observable.map<string, { cpuUsage: any; memoryUsage: any }>();
    let dataCollectionTimer: NodeJS.Timeout | null = null;

    // 🎯 목적: 기존 Master/Worker 선택 로직 (호환성 유지)
    const value = computed(() => {
      const { masterNodes, workerNodes } = nodeStore;
      const rawValue = storage.get().metricNodeRole;

      const hasMasterNodes = masterNodes.length > 0;
      const hasWorkerNodes = workerNodes.length > 0;

      if (hasMasterNodes && !hasWorkerNodes && rawValue === "worker") {
        return "master";
      }

      if (!hasMasterNodes && hasWorkerNodes && rawValue === "master") {
        return "worker";
      }

      return rawValue;
    });

    const nodes = computed(() => {
      const { masterNodes, workerNodes } = nodeStore;
      const role = value.get();

      if (role === "master") {
        return masterNodes.slice();
      }

      return workerNodes.slice();
    });

    // 🆕 새로운 개별 노드 선택 기능
    const selectedNode = computed(() => {
      const selectedNodeName = storage.get().selectedNodeName;
      if (!selectedNodeName) return undefined;

      return nodeStore.items.find((node) => node.getName() === selectedNodeName);
    });

    const collectionInterval = computed(() => storage.get().collectionInterval);

    const hasMasterNodes = computed(() => nodeStore.masterNodes.length > 0);
    const hasWorkerNodes = computed(() => nodeStore.workerNodes.length > 0);

    // 🛡️ 타이머 정리 함수 (메모리 누수 방지)
    const clearDataCollectionTimer = () => {
      if (dataCollectionTimer) {
        clearInterval(dataCollectionTimer);
        dataCollectionTimer = null;
      }
    };

    // 🔄 실시간 데이터 수집 함수 (Pod 간단보기 방식과 동일한 패턴 적용)
    const startDataCollection = (node: Node, interval: number) => {
      clearDataCollectionTimer(); // 🚨 기존 타이머 정리 중요!

      const collectData = async () => {
        try {
          // 🔥 SIMPLE: Pod 간단보기와 동일한 패턴으로 직접 NodeMetrics API 사용 + MetricData 형식 생성
          const nodeName = node.getName();
          const timestamp = Date.now() / 1000; // Unix timestamp in seconds

          let cache = nodeMetricsCache.get(nodeName);
          if (!cache) {
            // 🎯 Pod와 동일한 MetricData 구조로 초기화
            cache = {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { node: nodeName },
                      values: [],
                    },
                  ],
                },
              },
              memoryUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { node: nodeName },
                      values: [],
                    },
                  ],
                },
              },
            };
            nodeMetricsCache.set(nodeName, cache);
          }

          try {
            // 🎯 실제 NodeMetrics API로 직접 데이터 가져오기 (Pod 방식과 동일)
            const singleNodeMetrics = await nodeMetricsApi.get({ name: nodeName });

            if (singleNodeMetrics?.usage) {
              // 📊 메트릭 데이터 변환 (NodeStore와 동일한 방식)
              const cpuValue = parseFloat(singleNodeMetrics.usage.cpu?.replace(/[^\d.]/g, "")) || 0;
              const memoryValue = parseFloat(singleNodeMetrics.usage.memory?.replace("Ki", "")) * 1024 || 0;

              // 📈 Pod와 동일한 MetricData 형식으로 데이터 추가
              if (cpuValue > 0) {
                cache.cpuUsage.data.result[0].values.push([timestamp, cpuValue.toString()]);
                if (cache.cpuUsage.data.result[0].values.length > 100) {
                  cache.cpuUsage.data.result[0].values.shift();
                }
              }

              if (memoryValue > 0) {
                cache.memoryUsage.data.result[0].values.push([timestamp, memoryValue.toString()]);
                if (cache.memoryUsage.data.result[0].values.length > 100) {
                  cache.memoryUsage.data.result[0].values.shift();
                }
              }

              // 🎯 성공적으로 데이터를 수집했으면 return
              return;
            }
          } catch (directApiError) {
            console.warn(`⚠️ 직접 NodeMetrics API 호출 실패, Fallback 시도:`, directApiError);
          }

          // 🔄 Fallback: 기존 NodeStore 방식 (loadKubeMetrics -> getNodeKubeMetrics)
          await nodeStore.loadKubeMetrics();
          const kubeMetrics = nodeStore.getNodeKubeMetrics(node);

          if (!isNaN(kubeMetrics.cpu) && kubeMetrics.cpu > 0) {
            cache.cpuUsage.data.result[0].values.push([timestamp, kubeMetrics.cpu.toString()]);
            if (cache.cpuUsage.data.result[0].values.length > 100) {
              cache.cpuUsage.data.result[0].values.shift();
            }
          }

          if (!isNaN(kubeMetrics.memory) && kubeMetrics.memory > 0) {
            cache.memoryUsage.data.result[0].values.push([timestamp, kubeMetrics.memory.toString()]);
            if (cache.memoryUsage.data.result[0].values.length > 100) {
              cache.memoryUsage.data.result[0].values.shift();
            }
          }
        } catch (error) {
          console.warn(`❌ 노드 ${node.getName()} 최종 메트릭 수집 실패:`, error);
        }
      };

      // 🎯 즉시 첫 데이터 수집
      collectData();

      // ⏰ 주기적 데이터 수집 시작
      dataCollectionTimer = setInterval(collectData, interval);
    };

    return {
      // 기존 호환성 유지
      value,
      nodes,
      hasMasterNodes,
      hasWorkerNodes,
      set: action((value: MetricNodeRole) => {
        storage.merge({ metricNodeRole: value });
      }),

      // 🆕 새로운 개별 노드 선택 기능
      selectedNode,
      collectionInterval,
      nodeMetricsCache: nodeMetricsCache as any, // MobX Map 타입 이슈 해결

      setSelectedNode: action((node: Node | undefined) => {
        const nodeName = node?.getName();
        storage.merge({ selectedNodeName: nodeName });

        // 🔄 노드 변경 시 실시간 수집 재시작
        if (node) {
          startDataCollection(node, collectionInterval.get());
        } else {
          clearDataCollectionTimer(); // 노드 미선택 시 수집 중단
        }
      }),

      setCollectionInterval: action((interval: number) => {
        storage.merge({ collectionInterval: interval });

        // 🔄 간격 변경 시 수집 재시작 (선택된 노드가 있을 때만)
        const node = selectedNode.get();
        if (node) {
          startDataCollection(node, interval);
        }
      }),

      // 🧹 정리 함수 (컴포넌트 언마운트 시 사용)
      cleanup: () => {
        clearDataCollectionTimer();
        nodeMetricsCache.clear();
      },
    };
  },
});

export default selectedNodeRoleForMetricsInjectable;
