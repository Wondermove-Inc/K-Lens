/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Node 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Nodes {count} items, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable nodeStore 연동
 * - Injectable DI 패턴 유지
 * - 메트릭 데이터 전처리 (30초 갱신)
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → nodeStore.items.slice() 변환
 * - 컬럼 정의는 nodes-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 메트릭은 requestAllNodeMetrics()로 가져와서 전처리
 * - 30초마다 자동 갱신
 *
 * 🔄 변경이력:
 * - 2025-11-04: 초기 생성 (Pod 및 Namespace 패턴 참고)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { bytesToUnits, interval } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import requestAllNodeMetricsInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-metrics-for-all-nodes.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../common/resource-context-menu";
import { ResourceTableLayout } from "../common/resource-table-layout";
import dockStoreInjectable from "../dock/dock/store.injectable";
import eventStoreInjectable from "../events/store.injectable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../shadcn-ui/alert-dialog";
import { NodeDetailPanel } from "./node-detail-panel";
import { type NodeWithMetrics, nodeColumns } from "./nodes-columns";
import nodeStoreInjectable from "./store.injectable";

import type {
  NodeMetricData,
  RequestAllNodeMetrics,
} from "../../../common/k8s-api/endpoints/metrics.api/request-metrics-for-all-nodes.injectable";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { EventStore } from "../events/store";
import type { NodeStore } from "./store";

/**
 * 🎯 목적: NodeCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  nodeStore: NodeStore;
  eventStore: EventStore;
  dockStore: DockStore;
  requestAllNodeMetrics: RequestAllNodeMetrics;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  menuBar: 65, // 상단 메뉴 (제목, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.menuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: bytes를 정렬된 단위로 변환 (Ki, Mi, Gi)
 *
 * @param bytes - 변환할 바이트 수
 * @returns 정렬된 단위 문자열 (예: "1.5Gi")
 */
function bytesToUnitsAligned(bytes: number): string {
  if (bytes < 1024) {
    return `${(bytes / 1024).toFixed(1)}Ki`;
  }
  return bytesToUnits(bytes, { precision: 1 }).replace(/B$/, "");
}

/**
 * 🎯 목적: CPU cores를 사람이 읽기 쉬운 형태로 변환
 *
 * @param cores - CPU 사용량 (cores 단위, 예: 0.5 = 500m)
 * @returns 포맷된 문자열 (예: "500m" 또는 "2.5 cores")
 *
 * 📝 주의사항:
 * - 1 core 미만: millicores로 표시 (예: 0.5 → "500m")
 * - 1 core 이상: cores로 표시 (예: 2.5 → "2.5 cores")
 *
 * 🔄 변경이력: 2026-01-12 - 신규 생성 (CPU 단위 포맷팅용)
 */
function cpuToUnitsAligned(cores: number): string {
  if (isNaN(cores) || cores === 0) {
    return "0m";
  }
  if (cores < 1) {
    return `${Math.round(cores * 1000)}m`;
  }
  return `${cores.toFixed(2)} cores`;
}

/**
 * 🎯 목적: Node 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (nodeStore, eventStore, dockStore, requestAllNodeMetrics, className)
 * @returns KubeDataTable 기반 Node 목록 테이블
 */
const NonInjectedNodeCommonTable = observer(
  ({ nodeStore, eventStore, dockStore, requestAllNodeMetrics, subscribeStores, className }: Dependencies) => {
    // nodeStore.items는 MobX observable 배열
    const nodes = nodeStore.items;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [metrics, setMetrics] = useState<NodeMetricData | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<NodeWithMetrics | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof nodes)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Node Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - KubeWatchApi.subscribeStores()를 통한 중앙 집중식 구독 관리
     * - 컴포넌트 마운트 시 store.loadAll() → store.subscribe() 자동 실행
     * - 언마운트 시 구독 자동 해제로 메모리 누수 방지
     * - Node 추가/삭제/상태 변경이 실시간으로 반영됨
     *
     * 🔄 변경이력:
     * - 2026-01-07: Store 구독 로직 추가 (실시간 업데이트 미반영 버그 수정, #21)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([nodeStore], {
        onLoadFailure: (error) => {
          console.error("[Nodes] Failed to load nodes:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [nodeStore, subscribeStores]);

    /**
     * 🎯 목적: 메트릭 데이터 갱신 (30초마다)
     *
     * @remarks
     * - nodeStore.loadKubeMetrics() - Kubernetes Metrics Server 데이터 로드
     * - requestAllNodeMetrics() - Prometheus 메트릭 데이터 로드
     */
    useEffect(() => {
      const metricsWatcher = interval(30, () => {
        void (async () => {
          await nodeStore.loadKubeMetrics();
          const metricsData = await requestAllNodeMetrics();
          setMetrics(metricsData);
        })();
      });

      metricsWatcher.start(true); // 🔥 즉시 실행

      return () => {
        metricsWatcher.stop();
      };
    }, [nodeStore, requestAllNodeMetrics]);

    /**
     * 🎯 목적: 노드별 메트릭 값 타입 (타입 안전성 강화)
     */
    type NodeMetricsValues = Partial<Record<keyof NodeMetricData, number>>;

    /**
     * 🎯 목적: 메트릭 데이터를 노드별 Map으로 인덱싱
     *
     * @remarks
     * - 메트릭 데이터를 한 번 순회하여 Map으로 변환
     * - 이후 노드별 메트릭 조회가 O(1)로 수행됨
     * - metrics 변경 시에만 재인덱싱
     * - ⚠️ 동일 키에 여러 결과가 있으면 "첫 번째"만 사용 (기존 .find() 동작 유지)
     *
     * 🔄 변경이력: 2026-01-26 - 성능 최적화 (O(n*m) → O(1))
     */
    const metricsMap = useMemo(() => {
      if (!metrics) return null;

      // nodeKey → { cpuUsage: 값, memoryUsage: 값, ... } 형태
      const map = new Map<string, NodeMetricsValues>();

      // 모든 메트릭 종류 순회
      (Object.entries(metrics) as [keyof NodeMetricData, NodeMetricData[keyof NodeMetricData]][]).forEach(
        ([metricName, data]) => {
          if (!data?.data?.result) return;

          // 각 메트릭 결과 순회
          data.data.result.forEach((result) => {
            // ✅ 안전한 값 추출: result.values가 비어있거나 undefined일 때 보호
            const values = result.values;
            if (!values || values.length === 0) return;

            const lastValue = values[values.length - 1];
            if (!lastValue || lastValue.length < 2) return;

            const value = parseFloat(lastValue[1]);
            if (isNaN(value)) return;

            const { node, instance, kubernetes_node } = result.metric;
            const instanceHost = instance?.split(":")[0];

            // 가능한 모든 키로 인덱싱 (node, instance, instanceHost, kubernetes_node)
            const keys = [node, instance, instanceHost, kubernetes_node].filter(Boolean) as string[];

            keys.forEach((key) => {
              if (!map.has(key)) {
                map.set(key, {});
              }
              // ✅ 기존 .find() 동작 유지: 첫 번째 매칭만 사용 (이미 값이 있으면 덮어쓰지 않음)
              const existing = map.get(key)!;
              if (existing[metricName] === undefined) {
                existing[metricName] = value;
              }
            });
          });
        },
      );

      return map;
    }, [metrics]);

    /**
     * 🎯 목적: 노드별 메트릭 값 조회 (O(1))
     *
     * @remarks
     * - nodeName과 nodeInternalIP **양쪽**에서 메트릭을 조회하여 **병합**
     * - CPU/Memory는 nodeName(node 라벨)으로, Disk는 nodeInternalIP(instance 라벨)로 저장될 수 있음
     * - 병합 시 nodeName 결과 우선 (이미 있는 값은 덮어쓰지 않음)
     *
     * 🔄 변경이력: 2026-01-26 - 메트릭 병합 로직 추가 (Disk 메트릭 누락 버그 수정)
     */
    const getNodeMetrics = (nodeName: string, nodeInternalIP?: string): NodeMetricsValues => {
      if (!metricsMap) return {};

      const nodeNameMetrics = metricsMap.get(nodeName) || {};
      const internalIPMetrics = nodeInternalIP ? metricsMap.get(nodeInternalIP) || {} : {};

      // ✅ 두 결과 병합: nodeNameMetrics 우선, 없는 필드는 internalIPMetrics에서 가져옴
      return { ...internalIPMetrics, ...nodeNameMetrics };
    };

    /**
     * 🎯 목적: Node에 메트릭 데이터 추가 (NodeWithMetrics 타입으로 변환)
     *
     * @remarks
     * - CPU/Memory/Disk 사용량 및 용량 데이터 전처리
     * - useMemo로 최적화 (메트릭 또는 노드 목록 변경 시에만 재계산)
     * - nodeStore는 Injectable로 안정적인 참조 유지됨 (DI 컨테이너에서 싱글턴)
     *
     * 📝 의존성 설명:
     * - nodes: Watch API 변경 시 업데이트
     * - metricsMap: 30초마다 Polling 후 재인덱싱
     * - nodeStore: 싱글턴 참조 (객체 재생성 없음)
     *
     * 🔄 변경이력: 2026-01-26 - Map 기반 O(1) 조회로 성능 최적화
     */
    const nodesWithMetrics = useMemo(() => {
      return nodes.map((node): NodeWithMetrics => {
        const nodeName = node.getName();
        const nodeInternalIP = node.getInternalIP();

        // ✅ Map에서 O(1) 조회
        const nodeMetrics = getNodeMetrics(nodeName, nodeInternalIP);

        // Prometheus 메트릭 (타입 안전하게 접근)
        let cpuUsage = nodeMetrics.cpuUsage ?? 0;
        let cpuCapacity = nodeMetrics.cpuCapacity ?? 0;
        let memoryUsage = nodeMetrics.workloadMemoryUsage ?? 0;
        let memoryCapacity = nodeMetrics.memoryAllocatableCapacity ?? 0;
        const diskUsage = nodeMetrics.fsUsage ?? 0;
        const diskCapacity = nodeMetrics.fsSize ?? 0;

        // 🎯 Kubernetes Metrics Server 데이터 가져오기 (CPU/Memory 사용량 텍스트)
        // 📝 주의: kubeMetrics.cpu는 cores 단위, kubeMetrics.memory는 bytes 단위
        const kubeMetrics = nodeStore.getNodeKubeMetrics(node);
        const cpuUsageText = cpuToUnitsAligned(kubeMetrics.cpu);
        const memoryUsageText = bytesToUnitsAligned(kubeMetrics.memory);

        // 🔥 Prometheus 메트릭이 없으면 Metrics Server 값으로 폴백
        if (cpuUsage === 0 && cpuCapacity === 0 && kubeMetrics.cpu > 0) {
          cpuUsage = kubeMetrics.cpu;
          cpuCapacity = node.getCpuCapacity() || 0;
        }
        if (memoryUsage === 0 && memoryCapacity === 0 && kubeMetrics.memory > 0) {
          memoryUsage = kubeMetrics.memory;
          memoryCapacity = node.getMemoryCapacity() || 0;
        }

        return Object.assign(node, {
          metrics: {
            cpuUsage,
            cpuCapacity,
            memoryUsage,
            memoryCapacity,
            diskUsage,
            diskCapacity,
            cpuUsageText,
            memoryUsageText,
          },
        });
      });
    }, [nodes, metricsMap, nodeStore]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - getSearchFields(), getRoleLabels(), getKubeletVersion() 등 기준 검색
     */
    const filteredNodes = useMemo(() => {
      let filtered = nodesWithMetrics;

      // 검색 필터
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (node) =>
            node.getSearchFields().some((field) => field && field.toLowerCase().includes(search)) ||
            node.getRoleLabels().toLowerCase().includes(search) ||
            node.getKubeletVersion().toLowerCase().includes(search) ||
            node.getNodeConditionText().toLowerCase().includes(search) ||
            node.getInternalIP()?.toLowerCase().includes(search) ||
            node.getExternalIP()?.toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [nodesWithMetrics, searchValue]);

    /**
     * 🎯 목적: Node 행 클릭 핸들러 (Detail Panel 토글)
     * @param node - 클릭된 Node 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (node: NodeWithMetrics) => {
      if (selectedNode?.getId() === node.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedNode(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedNode(node);
        setIsPanelOpen(true);
      }
    };

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Node 배열
     */
    const handleSelectionChange = (selectedItems: (typeof nodes)[number][]) => {
      setSelectedRows(selectedItems);
    };

    /**
     * 🎯 목적: Delete 확인 후 실제 삭제 실행
     */
    const handleDeleteConfirm = async () => {
      try {
        await Promise.all(
          selectedRows.map(async (item) => {
            await nodeStore.remove(item);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Node] Failed to delete:", error);
      }
    };

    return (
      <div className={`flex h-full w-full flex-col ${className || ""}`}>
        <ResourceTableLayout
          title="Nodes"
          itemCount={filteredNodes.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search nodes..."
          showNamespaceFilter={false}
          headerActions={null}
        >
          <div className="flex-1">
            <KubeDataTable
              data={filteredNodes}
              columns={nodeColumns}
              enableColumnResizing={true}
              enableRowSelection={true}
              enablePagination={true}
              defaultPageSize={40}
              getRowId={(item) => item.getId()}
              dockHeight={dockStore.isOpen ? dockStore.height : 0}
              tableOffset={TOTAL_TABLE_OFFSET}
              onRowClick={handleRowClick}
              onSelectionChange={handleSelectionChange}
              emptyMessage="No Nodes found"
              className="h-full"
              selectedItem={isPanelOpen ? selectedNode : undefined}
              renderContextMenu={(item) => <ResourceContextMenu object={item} />}
            />
          </div>
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Node Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <NodeDetailPanel isOpen={isPanelOpen} node={selectedNode} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Nodes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Node(s)?
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 NodeCommonTable 컴포넌트
 */
export const NodeCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "nodeStore" | "eventStore" | "dockStore" | "requestAllNodeMetrics" | "subscribeStores">
>(NonInjectedNodeCommonTable, {
  getProps: (di, props) => ({
    nodeStore: di.inject(nodeStoreInjectable),
    eventStore: di.inject(eventStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    requestAllNodeMetrics: di.inject(requestAllNodeMetricsInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
