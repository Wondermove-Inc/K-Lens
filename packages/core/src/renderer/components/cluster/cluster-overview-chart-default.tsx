/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Overview 전용 차트 컴포넌트 (원본 스토리북 템플릿 구조 100% 준수)
 *
 * 📝 주의사항:
 * - chart-data.tsx 템플릿과 동일한 UI 구조 사용
 * - NodeStore에서 실제 Kubernetes 메트릭 데이터 가져오기
 * - Item 컴포넌트 사용하여 범례 표시
 * - Warnings 테이블 포함
 *
 * 🔄 변경이력:
 * - 2025-11-05 - 기존 ChartData에서 분리
 * - 2025-11-05 - Store 직접 구독 방식으로 변경 (Wrapper 제거)
 * - 2025-11-05 - 원본 스토리북 템플릿 구조로 완전히 재작성
 * - 2025-11-05 - 실제 데이터 표시 및 Warnings 테이블 추가
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@skuberplus/storybook-shadcn/src/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@skuberplus/storybook-shadcn/src/components/ui/toggle-group";
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { AlertTriangle, Info } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ClusterMetadataKey } from "../../../common/cluster-types";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { cn } from "../../lib/utils";
import navigateInjectable from "../../navigation/navigate.injectable";
import nodeStoreInjectable from "../nodes/store.injectable";
import masterClusterMetricsInjectable from "./master-cluster-metrics.injectable";
import { globalMetricsCache } from "./metrics-cache";
import workerClusterMetricsInjectable from "./worker-cluster-metrics.injectable";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ClusterMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { Navigate } from "../../navigation/navigate.injectable";
import type { NodeStore } from "../nodes/store";

/**
 * 🎯 목적: 시간별 차트 데이터 포인트 타입
 */
interface HourlyDataPoint {
  hour: string;
  value: number;
}

/**
 * 🎯 목적: ClusterOverviewChartDefault Dependencies
 */
interface Dependencies {
  subscribeStores: SubscribeStores;
  nodeStore: NodeStore;
  masterMetrics: IAsyncComputed<ClusterMetricData | undefined>;
  workerMetrics: IAsyncComputed<ClusterMetricData | undefined>;
  hostedCluster: Cluster | undefined;
  navigate: Navigate;
  className?: string;
}

/**
 * 🎯 목적: 시간별 사용량 차트 설정 (CPU/Memory에 따라 다른 색상)
 * 📝 주의: 이 설정은 컴포넌트 내부에서 동적으로 생성됨 (selectedMetric 기반)
 */

/**
 * 🎯 목적: Cluster Overview 차트 메인 컴포넌트 (원본 스토리북 템플릿 구조)
 *
 * 📝 주의사항:
 * - NodeStore에서 실제 Kubernetes 메트릭 데이터 가져오기
 * - Master/Worker Nodes 토글로 전환
 * - CPU/Memory 토글로 차트 데이터 전환
 * - chart-data.tsx와 동일한 UI 구조 및 클래스 사용
 * - loadKubeMetrics() 호출하여 실제 메트릭 로드
 *
 * 🔄 변경이력:
 * - 2025-11-05 - 원본 스토리북 템플릿 구조로 완전히 재작성
 * - 2025-11-05 - 실제 데이터 표시 및 단위 변환 추가
 */
const NonInjectedClusterOverviewChartDefault = observer((props: Dependencies) => {
  const { className, subscribeStores, nodeStore, masterMetrics, workerMetrics, hostedCluster } = props;

  /**
   * 🎯 목적: 관리형 쿠버네티스 클러스터 여부 판단
   * 📝 판단 기준 (하이브리드 접근):
   * 1. 메타데이터 기반: hostedCluster.metadata.isManaged === true (즉시 판단)
   * 2. 런타임 기반: masterNodes가 0개인 경우 (Fallback)
   *
   * 🔄 변경이력: 2026-01-22 - 관리형 클러스터 UI 개선
   */
  const isManagedCluster = useMemo(() => {
    // 방법 1: 메타데이터 확인 (정확도 높음, 즉시 판단 가능)
    if (hostedCluster?.metadata?.[ClusterMetadataKey.IS_MANAGED] === true) {
      return true;
    }

    // 방법 2: 런타임 확인 - master 노드가 없으면 관리형으로 간주 (Fallback)
    if (nodeStore.isLoaded && nodeStore.masterNodes.length === 0) {
      return true;
    }

    return false;
  }, [hostedCluster?.metadata, nodeStore.isLoaded, nodeStore.masterNodes.length]);

  /**
   * 🎯 목적: 노드 타입 선택 상태 (깜빡임 방지를 위해 null로 초기화)
   * 📝 주의: nodeStore 로딩 완료 후 적절한 초기값 설정
   */
  const [selectedNode, setSelectedNode] = React.useState<"master" | "worker" | null>(null);
  const [selectedMetric, setSelectedMetric] = React.useState<"cpu" | "memory">("cpu");

  /**
   * 🎯 목적: 노드 타입 초기값 설정 (로딩 완료 후 1회만 실행)
   * 📝 로직:
   * - 메타데이터로 즉시 판단 가능하면 바로 설정
   * - nodeStore 로딩 완료 시 최종 판단
   */
  React.useEffect(() => {
    // 이미 초기화됐으면 스킵
    if (selectedNode !== null) return;

    // 메타데이터로 즉시 판단 가능한 경우
    if (hostedCluster?.metadata?.[ClusterMetadataKey.IS_MANAGED] === true) {
      setSelectedNode("worker");
      return;
    }

    // nodeStore 로딩 완료 후 판단
    if (nodeStore.isLoaded) {
      setSelectedNode(isManagedCluster ? "worker" : "master");
    }
  }, [hostedCluster?.metadata, nodeStore.isLoaded, isManagedCluster, selectedNode]);

  // 🎯 목적: 툴팁 상태 관리
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: { label: string; value: string; color: string }[];
  }>({
    visible: false,
    x: 0,
    y: 0,
    content: [],
  });

  // 🎯 목적: NodeStore 구독 (메트릭은 injectable에서 자동 로드)
  React.useEffect(() => {
    const disposer = subscribeStores([nodeStore], {});

    return () => {
      disposer();
    };
  }, [subscribeStores, nodeStore]);

  // 🎯 목적: Injectable에서 메트릭 데이터 가져오기
  const masterMetricData = masterMetrics.value.get();
  const workerMetricData = workerMetrics.value.get();

  // 🎯 목적: 메트릭 부재/오류 시 Empty 컴포넌트로 안내
  const hasMatrixData = (metric?: ClusterMetricData) =>
    Boolean(
      metric &&
        [
          metric.cpuUsage,
          metric.memoryUsage,
          metric.podUsage,
          metric.memoryAllocatableCapacity,
          metric.cpuAllocatableCapacity,
        ].some((entry) => entry?.status === "success" && entry.data?.result?.length),
    );

  const hasMetricsData = hasMatrixData(masterMetricData) || hasMatrixData(workerMetricData);
  const isMetricsLoading = masterMetrics.pending.get() || workerMetrics.pending.get();

  // 🎯 목적: 에러 상태 유지 (깜빡임 방지)
  // 📝 주의: 한 번 에러가 발생하면 로딩 중에도 에러 화면 유지, 정상 데이터 수신 시에만 해제
  const hasErrorRef = useRef(false);

  // 에러 상태 업데이트
  if (!isMetricsLoading && !hasMetricsData) {
    hasErrorRef.current = true;
  }
  // 정상 데이터 수신 시 에러 상태 해제
  if (hasMetricsData) {
    hasErrorRef.current = false;
  }

  // 🔄 메트릭 수집 interval/timeout 관리 (분 경계 정렬)
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 🔄 목적: Metrics Server 모드일 때만 메트릭 데이터를 globalMetricsCache에 축적
   * 📝 주의:
   * - Metrics Server: 현재 값 1개만 제공 → Frontend에서 시계열 축적
   * - Prometheus: 60+ 포인트 제공 → 캐시 사용 안 함 (Injectable 데이터 직접 사용)
   */
  /**
   * 🎯 목적: 단일 포인트 모드용 1분 버킷팅 유틸
   * 📝 규칙:
   * - 1분 단위로 반올림 (nearest minute)
   * - 같은 분이면 평균값으로 병합
   */
  const upsertMinuteBucketAverage = (
    dataPoints: { timestamp: number; value: number }[],
    timestamp: number,
    value: number,
  ) => {
    // 🎯 반올림: 1분 단위로 고정
    const roundedTimestamp = Math.round(timestamp / 60000) * 60000;
    const existingIndex = dataPoints.findIndex((point) => point.timestamp === roundedTimestamp);

    if (existingIndex === -1) {
      return [...dataPoints, { timestamp: roundedTimestamp, value }].slice(-60);
    }

    const existingPoint = dataPoints[existingIndex];
    const averagedValue = (existingPoint.value + value) / 2;

    const updatedPoints = [...dataPoints];
    updatedPoints[existingIndex] = { timestamp: roundedTimestamp, value: averagedValue };

    return updatedPoints.slice(-60);
  };

  const collectMetrics = useCallback(() => {
    const now = Date.now();

    // 🎯 데이터 포인트 개수로 판단 (auto-detect 모드 지원)
    // - 1개 포인트: Metrics Server → 캐시 축적
    // - 60+ 포인트: Prometheus → 캐시 사용 안 함

    // Master 노드 메트릭 수집
    if (masterMetricData) {
      const cpuValues = masterMetricData.cpuUsage?.data?.result?.[0]?.values;
      const memoryValues = masterMetricData.memoryUsage?.data?.result?.[0]?.values;

      // 🎯 단일 포인트 = Metrics Server 방식 → 캐시에 축적 (auto-detect 포함)
      if (cpuValues && cpuValues.length === 1 && memoryValues && memoryValues.length === 1) {
        // CPU 캐시 저장
        const latestCpu = cpuValues[0];
        const cpuValue = parseFloat(latestCpu[1]) || 0;

        const cpuCacheKey = "master-cpu";
        const cpuCache = globalMetricsCache.get(cpuCacheKey);
        const cpuCurrentData = cpuCache ? cpuCache.dataPoints : [];
        const cpuUpdatedData = upsertMinuteBucketAverage(cpuCurrentData, now, cpuValue);

        globalMetricsCache.set(cpuCacheKey, {
          dataPoints: cpuUpdatedData,
          lastCollectedTime: now,
        });

        // Memory 캐시 저장
        const latestMemory = memoryValues[0];
        const memoryValue = parseFloat(latestMemory[1]) / (1024 * 1024 * 1024); // GiB 변환

        const memoryCacheKey = "master-memory";
        const memoryCache = globalMetricsCache.get(memoryCacheKey);
        const memoryCurrentData = memoryCache ? memoryCache.dataPoints : [];
        const memoryUpdatedData = upsertMinuteBucketAverage(memoryCurrentData, now, memoryValue);

        globalMetricsCache.set(memoryCacheKey, {
          dataPoints: memoryUpdatedData,
          lastCollectedTime: now,
        });
      } else if (cpuValues && cpuValues.length > 1) {
      }
    }

    // Worker 노드 메트릭 수집
    if (workerMetricData) {
      const cpuValues = workerMetricData.cpuUsage?.data?.result?.[0]?.values;
      const memoryValues = workerMetricData.memoryUsage?.data?.result?.[0]?.values;

      // 🎯 단일 포인트 = Metrics Server 방식 → 캐시에 축적 (auto-detect 포함)
      if (cpuValues && cpuValues.length === 1 && memoryValues && memoryValues.length === 1) {
        // CPU 캐시 저장
        const latestCpu = cpuValues[0];
        const cpuValue = parseFloat(latestCpu[1]) || 0;

        const cpuCacheKey = "worker-cpu";
        const cpuCache = globalMetricsCache.get(cpuCacheKey);
        const cpuCurrentData = cpuCache ? cpuCache.dataPoints : [];
        const cpuUpdatedData = upsertMinuteBucketAverage(cpuCurrentData, now, cpuValue);

        globalMetricsCache.set(cpuCacheKey, {
          dataPoints: cpuUpdatedData,
          lastCollectedTime: now,
        });

        // Memory 캐시 저장
        const latestMemory = memoryValues[0];
        const memoryValue = parseFloat(latestMemory[1]) / (1024 * 1024 * 1024); // GiB 변환

        const memoryCacheKey = "worker-memory";
        const memoryCache = globalMetricsCache.get(memoryCacheKey);
        const memoryCurrentData = memoryCache ? memoryCache.dataPoints : [];
        const memoryUpdatedData = upsertMinuteBucketAverage(memoryCurrentData, now, memoryValue);

        globalMetricsCache.set(memoryCacheKey, {
          dataPoints: memoryUpdatedData,
          lastCollectedTime: now,
        });
      } else if (cpuValues && cpuValues.length > 1) {
      }
    }
  }, [masterMetricData, workerMetricData, hostedCluster]);

  // 컴포넌트 마운트 시 메트릭 수집 시작 (분 경계 정렬)
  React.useEffect(() => {
    const now = Date.now();
    const delayToNextMinute = 60000 - (now % 60000);

    collectMetrics(); // 🎯 즉시 1회 수집

    timeoutRef.current = setTimeout(() => {
      collectMetrics(); // 🎯 분 경계에서 1회 수집
      intervalRef.current = setInterval(collectMetrics, 60000); // 60초 간격 유지
    }, delayToNextMinute);

    return () => {
      // 🎯 수집만 중단, 데이터는 유지
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [collectMetrics]);

  // 🎯 목적: NodeStore 로드 완료 시 즉시 1회 수집 (첫 포인트 지연 최소화)
  React.useEffect(() => {
    if (!nodeStore.isLoaded) {
      return;
    }

    collectMetrics();
  }, [collectMetrics, nodeStore.isLoaded]);

  // 🎯 에러 상태면 로딩 중에도 에러 화면 유지 (깜빡임 방지)
  if (hasErrorRef.current) {
    return (
      <div className={`flex min-h-[400px] flex-1 items-center justify-center ${className || ""}`}>
        <Empty className="w-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Info className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Matrix error occurred</EmptyTitle>
            <EmptyDescription>Please check your cluster settings</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  /**
   * 🎯 목적: MetricData에서 최신 값을 추출
   * 📝 주의: values 배열의 마지막 요소가 최신 데이터
   * @param metricData - Prometheus MetricData
   * @returns 최신 값 (없으면 0)
   */
  const getLatestMetricValue = (metricData?: ClusterMetricData[keyof ClusterMetricData]): number => {
    if (!metricData?.data?.result?.[0]?.values) return 0;

    const values = metricData.data.result[0].values;
    if (values.length === 0) return 0;

    // 마지막 값(최신 데이터) 추출
    const lastValue = values[values.length - 1];
    return parseFloat(lastValue[1]) || 0;
  };

  /**
   * 🔄 목적: globalMetricsCache에서 시간별 차트 데이터 생성
   * 📝 주의: Metrics Server는 시계열을 제공하지 않으므로 Frontend에서 축적한 데이터 사용
   * @param cacheKey - 캐시 키 (예: "master-cpu", "worker-memory")
   * @returns 시간별 차트 데이터 배열
   */
  const getHourlyDataFromCache = (cacheKey: string): HourlyDataPoint[] => {
    const cache = globalMetricsCache.get(cacheKey);

    if (!cache || cache.dataPoints.length === 0) {
      // 🎯 Storybook no-data 패턴: 6개 시간대 모두 0 값으로 차트 렌더링
      // (1개 포인트 대신 6개로 변경하여 시간 흐름이 보이도록 개선)
      const now = new Date();
      return Array.from({ length: 6 }, (_, i) => {
        const time = new Date(now.getTime() - (5 - i) * 60 * 60 * 1000);
        const hour = `${time.getHours().toString().padStart(2, "0")}:00`;
        return { hour, value: 0 };
      });
    }

    return cache.dataPoints.map((point) => {
      const date = new Date(point.timestamp);
      const hour = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
      return { hour, value: point.value };
    });
  };

  /**
   * 🎯 목적: MetricData에서 시간별 차트 데이터 생성 (Prometheus용 - 호환성 유지)
   * 📝 주의: values 배열을 HourlyDataPoint 배열로 변환
   */
  const getHourlyDataFromMetric = (
    metricData?: ClusterMetricData[keyof ClusterMetricData],
    unitConversion?: (value: number) => number,
  ): HourlyDataPoint[] => {
    if (!metricData?.data?.result?.[0]?.values) return [];

    const values = metricData.data.result[0].values;

    return values.map(([timestamp, valueStr]) => {
      const value = parseFloat(valueStr) || 0;
      const date = new Date(timestamp * 1000);
      const hour = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

      return {
        hour,
        value: unitConversion ? unitConversion(value) : value,
      };
    });
  };

  /**
   * 🎯 목적: 시간별 CPU 데이터 생성
   * 📝 주의:
   * - Metrics Server 선택 시: Frontend 캐시 사용 (시계열 축적)
   * - Prometheus 선택 시: Injectable 데이터 직접 사용 (60+ 포인트)
   */
  const getHourlyCpuData = (nodeType: "master" | "worker"): HourlyDataPoint[] => {
    const metricData = nodeType === "master" ? masterMetricData : workerMetricData;
    if (!metricData) return [];

    // 🎯 데이터 포인트 개수로 판단 (auto-detect 모드 지원)
    const cpuValues = metricData.cpuUsage?.data?.result?.[0]?.values;

    if (cpuValues && cpuValues.length === 1) {
      // 🎯 단일 포인트 = Metrics Server 방식 → 캐시 사용
      const cacheKey = `${nodeType}-cpu`;
      return getHourlyDataFromCache(cacheKey);
    } else {
      // 🔥 다중 포인트 = Prometheus 방식 → 원본 데이터 직접 사용
      return getHourlyDataFromMetric(metricData.cpuUsage);
    }
  };

  /**
   * 🎯 목적: 시간별 Memory 데이터 생성
   * 📝 주의:
   * - Metrics Server 선택 시: Frontend 캐시 사용 (시계열 축적)
   * - Prometheus 선택 시: Injectable 데이터 직접 사용 (60+ 포인트)
   */
  const getHourlyMemoryData = (nodeType: "master" | "worker"): HourlyDataPoint[] => {
    const metricData = nodeType === "master" ? masterMetricData : workerMetricData;
    if (!metricData) return [];

    // 🎯 데이터 포인트 개수로 판단 (auto-detect 모드 지원)
    const memoryValues = metricData.memoryUsage?.data?.result?.[0]?.values;

    if (memoryValues && memoryValues.length === 1) {
      // 🎯 단일 포인트 = Metrics Server 방식 → 캐시 사용
      const cacheKey = `${nodeType}-memory`;
      return getHourlyDataFromCache(cacheKey);
    } else {
      // 🔥 다중 포인트 = Prometheus 방식 → 원본 데이터 직접 사용 (바이트 → GiB 변환)
      return getHourlyDataFromMetric(metricData.memoryUsage, (value) => value / (1024 * 1024 * 1024));
    }
  };

  /**
   * 🎯 목적: CPU 메트릭 데이터 생성 (Bullet Chart용)
   * 📝 주의:
   * - CPU 값은 이미 코어 단위로 제공됨 (Prometheus rate 계산 결과)
   * - Reserved = Capacity - Allocatable (kube-reserved + system-reserved)
   * - Available = Allocatable - Requests (실제 스케줄 가능한 양)
   */
  const getCpuData = (nodeType: "master" | "worker") => {
    const metricData = nodeType === "master" ? masterMetricData : workerMetricData;
    if (!metricData) {
      return [
        {
          name: "CPU",
          usage: 0,
          requests: 0,
          limits: 0,
          reserved: 0,
          available: 0,
          capacity: 0,
        },
      ];
    }

    // CPU 값은 이미 코어 단위로 제공됨 (Prometheus rate 계산 결과)
    const cpuUsage = getLatestMetricValue(metricData.cpuUsage);
    const cpuRequests = getLatestMetricValue(metricData.cpuRequests);
    const cpuLimits = getLatestMetricValue(metricData.cpuLimits);
    const cpuAllocatable = getLatestMetricValue(metricData.cpuAllocatableCapacity);
    const cpuCapacity = getLatestMetricValue(metricData.cpuCapacity);

    // 🎯 Reserved: 시스템 예약 영역 (Capacity - Allocatable)
    const cpuReserved = cpuCapacity - cpuAllocatable;

    // 🎯 Available: 실제 스케줄 가능한 양 (Allocatable - Requests)
    const cpuAvailable = Math.max(0, cpuAllocatable - cpuRequests);

    return [
      {
        name: "CPU",
        usage: cpuUsage,
        requests: cpuRequests,
        limits: cpuLimits,
        reserved: cpuReserved,
        available: cpuAvailable,
        capacity: cpuCapacity,
      },
    ];
  };

  /**
   * 🎯 목적: Memory 메트릭 데이터 생성 (Bullet Chart용)
   * 📝 주의:
   * - 바이트를 GiB 단위로 변환
   * - Reserved = Capacity - Allocatable (kube-reserved + system-reserved)
   * - Available = Allocatable - Requests (실제 스케줄 가능한 양)
   */
  const getMemoryData = (nodeType: "master" | "worker") => {
    const metricData = nodeType === "master" ? masterMetricData : workerMetricData;
    if (!metricData) {
      return [
        {
          name: "Memory",
          usage: 0,
          requests: 0,
          limits: 0,
          reserved: 0,
          available: 0,
          capacity: 0,
        },
      ];
    }

    // 바이트 → GiB 변환
    const memoryUsage = getLatestMetricValue(metricData.memoryUsage) / (1024 * 1024 * 1024);
    const memoryRequests = getLatestMetricValue(metricData.memoryRequests) / (1024 * 1024 * 1024);
    const memoryLimits = getLatestMetricValue(metricData.memoryLimits) / (1024 * 1024 * 1024);
    const memoryAllocatable = getLatestMetricValue(metricData.memoryAllocatableCapacity) / (1024 * 1024 * 1024);
    const memoryCapacity = getLatestMetricValue(metricData.memoryCapacity) / (1024 * 1024 * 1024);

    // 🎯 Reserved: 시스템 예약 영역 (Capacity - Allocatable)
    const memoryReserved = memoryCapacity - memoryAllocatable;

    // 🎯 Available: 실제 스케줄 가능한 양 (Allocatable - Requests)
    const memoryAvailable = Math.max(0, memoryAllocatable - memoryRequests);

    return [
      {
        name: "Memory",
        usage: memoryUsage,
        requests: memoryRequests,
        limits: memoryLimits,
        reserved: memoryReserved,
        available: memoryAvailable,
        capacity: memoryCapacity,
      },
    ];
  };

  /**
   * 🎯 목적: Pods 메트릭 데이터 생성 (Bullet Chart용)
   * 📝 주의:
   * - Pods는 Requests/Limits 개념 없음 (정수 카운트)
   * - Available = Allocatable - Usage (단순 계산)
   * - Reserved = Capacity - Allocatable (시스템 예약)
   */
  const getPodsData = (nodeType: "master" | "worker") => {
    const metricData = nodeType === "master" ? masterMetricData : workerMetricData;
    if (!metricData) {
      return [
        {
          name: "Pods",
          usage: 0,
          available: 0,
          reserved: 0,
          capacity: 0,
        },
      ];
    }

    const podUsage = getLatestMetricValue(metricData.podUsage);
    const podAllocatable = getLatestMetricValue(metricData.podAllocatableCapacity);
    const podCapacity = getLatestMetricValue(metricData.podCapacity);

    // 🎯 Available: 실제 스케줄 가능한 Pod 수 (Allocatable - Usage)
    const podAvailable = Math.max(0, podAllocatable - podUsage);

    // 🎯 Reserved: 시스템 예약 영역 (Capacity - Allocatable)
    const podReserved = podCapacity - podAllocatable;

    return [
      {
        name: "Pods",
        usage: podUsage,
        available: podAvailable,
        reserved: podReserved,
        capacity: podCapacity,
      },
    ];
  };

  // 🎯 데이터 가져오기
  const masterHourlyCpuData = getHourlyCpuData("master");
  const workerHourlyCpuData = getHourlyCpuData("worker");
  const masterHourlyMemoryData = getHourlyMemoryData("master");
  const workerHourlyMemoryData = getHourlyMemoryData("worker");

  const masterCpuData = getCpuData("master");
  const workerCpuData = getCpuData("worker");
  const masterMemoryData = getMemoryData("master");
  const workerMemoryData = getMemoryData("worker");
  const masterPodsData = getPodsData("master");
  const workerPodsData = getPodsData("worker");

  // 🎯 선택된 데이터 결정 (null이면 worker를 기본값으로 사용)
  const effectiveNodeType = selectedNode ?? "worker";

  const currentHourlyData =
    selectedMetric === "cpu"
      ? effectiveNodeType === "master"
        ? masterHourlyCpuData
        : workerHourlyCpuData
      : effectiveNodeType === "master"
        ? masterHourlyMemoryData
        : workerHourlyMemoryData;

  const currentCpuData = effectiveNodeType === "master" ? masterCpuData : workerCpuData;
  const currentMemoryData = effectiveNodeType === "master" ? masterMemoryData : workerMemoryData;
  const currentPodsData = effectiveNodeType === "master" ? masterPodsData : workerPodsData;

  // 🎯 목적: 현재 선택된 노드의 실제 데이터 값 추출 (Bullet Chart 데이터 구조)
  const cpuValues = {
    usage: currentCpuData[0]?.usage || 0,
    requests: currentCpuData[0]?.requests || 0,
    limits: currentCpuData[0]?.limits || 0,
    reserved: currentCpuData[0]?.reserved || 0,
    available: currentCpuData[0]?.available || 0,
    capacity: currentCpuData[0]?.capacity || 0,
  };

  const memoryValues = {
    usage: currentMemoryData[0]?.usage || 0,
    requests: currentMemoryData[0]?.requests || 0,
    limits: currentMemoryData[0]?.limits || 0,
    reserved: currentMemoryData[0]?.reserved || 0,
    available: currentMemoryData[0]?.available || 0,
    capacity: currentMemoryData[0]?.capacity || 0,
  };

  const podsValues = {
    usage: currentPodsData[0]?.usage || 0,
    available: currentPodsData[0]?.available || 0,
    reserved: currentPodsData[0]?.reserved || 0,
    capacity: currentPodsData[0]?.capacity || 0,
  };

  /**
   * 🎯 목적: 경고 상태 계산
   * 📝 경고 조건:
   * - 심각: Usage >= Limits의 90% (OOMKill/Throttling 위험)
   * - 경고: Usage > Requests (요청량 초과 사용)
   * - 주의: Available < 10% of Capacity (가용 용량 부족)
   */
  interface WarningState {
    isWarning: boolean;
    level: "normal" | "warning" | "critical";
    message: string;
  }

  const getWarningState = (usage: number, requests: number, limits: number, capacity: number): WarningState => {
    // Critical: Usage >= 90% of Limits
    if (limits > 0 && usage / limits >= 0.9) {
      const percent = ((usage / limits) * 100).toFixed(0);
      return {
        isWarning: true,
        level: "critical",
        message: `Usage reached ${percent}% of Limits. Risk of OOMKill/Throttling.`,
      };
    }

    // Warning: Usage > Requests
    if (requests > 0 && usage > requests) {
      return {
        isWarning: true,
        level: "warning",
        message: "Usage exceeds requested resources",
      };
    }

    // Caution: Available < 10% of Capacity
    const available = capacity - usage;
    if (capacity > 0 && available / capacity < 0.1) {
      return {
        isWarning: true,
        level: "warning",
        message: "Available capacity is less than 10%",
      };
    }

    return { isWarning: false, level: "normal", message: "" };
  };

  // 🎯 각 리소스의 경고 상태 계산
  const cpuWarningState = getWarningState(cpuValues.usage, cpuValues.requests, cpuValues.limits, cpuValues.capacity);

  const memoryWarningState = getWarningState(
    memoryValues.usage,
    memoryValues.requests,
    memoryValues.limits,
    memoryValues.capacity,
  );

  const podsWarningState = getWarningState(
    podsValues.usage,
    0, // Pods는 requests 없음
    podsValues.capacity,
    podsValues.capacity,
  );

  // 🎯 목적: 메모리 값을 적절한 단위로 포맷팅 (GiB 단위로 통일)
  const formatMemoryValue = (value: number) => {
    return `${value.toFixed(2)} GiB`;
  };

  // 🎯 목적: CPU 값 포맷팅 (cores)
  const formatCpuValue = (value: number) => {
    return `${value.toFixed(2)} cores`;
  };

  // 🎯 목적: 데이터 없음 상태 판단 (Storybook no-data 패턴 적용)
  // 📝 주의: masterMetricData와 workerMetricData가 모두 없으면 데이터 없음으로 간주
  const hasData = Boolean(masterMetricData || workerMetricData);

  // 🎯 목적: 범례 값 포맷팅 - 데이터 없으면 "--" 표시
  const formatLegendValue = (value: number, formatter: (v: number) => string) => {
    return hasData ? formatter(value) : "--";
  };

  /**
   * 🎯 목적: 차트 데이터 범위에 따른 Y축 domain 동적 계산
   * 📝 주의: 작은 값일 때 중복 tick 방지를 위해 세밀한 스케일 적용
   * @param data - 시간별 데이터 포인트 배열
   * @returns [min, max] Y축 범위
   */
  const calculateYAxisDomain = (data: HourlyDataPoint[]): [number, number] => {
    const values = data.map((d) => d.value).filter((v) => v > 0);
    if (values.length === 0) return [0, 1];

    const maxValue = Math.max(...values);

    // 작은 값일 때 더 세밀한 스케일 (0.1 단위 겹침 방지)
    if (maxValue < 1) {
      return [0, Math.ceil(maxValue * 10) / 10 + 0.1];
    }

    // 일반적인 경우 10% 여유 추가
    return [0, Math.ceil(maxValue * 1.1)];
  };

  /**
   * 🎯 목적: Y축과 툴팁에서 사용할 통일된 값 포맷팅 함수
   * 📝 주의: CPU/Memory에 따라 다른 단위 적용
   * @param value - 포맷팅할 숫자 값
   * @param metric - 메트릭 타입 ('cpu' | 'memory')
   * @returns 포맷팅된 문자열 (예: "0.5m", "1.2", "512MiB", "2.5GiB")
   */
  const formatChartValue = (value: number, metric: "cpu" | "memory"): string => {
    if (value === 0) return "0";

    if (metric === "cpu") {
      // CPU: 작은 값은 millicores(m), 큰 값은 cores
      if (value < 0.01) return `${(value * 1000).toFixed(1)} m`;
      if (value < 1) return `${(value * 1000).toFixed(0)} m`;
      return value.toFixed(2);
    } else {
      // Memory: 작은 값은 소수점 표시로 중복 방지, 큰 값은 GiB 변환
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)} GiB`;
      }
      if (value < 10) {
        // 10 MiB 미만: 소수점 1자리 (1.2MiB, 2.5MiB 등)
        return `${value.toFixed(1)} MiB`;
      }
      return `${value.toFixed(0)} MiB`;
    }
  };

  // 🎯 목적: 시간별 사용량 차트 설정 (selectedMetric에 따라 동적 색상)
  const hourlyChartConfig = {
    value: {
      label: "Hourly Usage",
      color: selectedMetric === "cpu" ? "var(--chart-1)" : "var(--chart-3)",
    },
  } satisfies ChartConfig;

  return (
    <div className={`${className} gap-3`}>
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-lg leading-none font-semibold">Cluster Overview</h1>

        {/* 🎯 노드 타입 토글: 로딩 중 / 관리형 / 자체 관리형 */}
        {selectedNode === null ? (
          // 로딩 중: 스켈레톤 상태
          <div className="flex h-9 w-[360px] items-center justify-center rounded-md border border-input bg-muted/50 text-sm text-muted-foreground animate-pulse">
            Loading...
          </div>
        ) : isManagedCluster ? (
          // 관리형 클러스터: Worker Nodes만 표시 (ToggleGroup 스타일 유지)
          <ToggleGroup type="single" value="worker" variant="outline" size="default" className="w-[180px]">
            <ToggleGroupItem value="worker" aria-label="Worker Nodes" className="flex-1">
              Worker Nodes
            </ToggleGroupItem>
          </ToggleGroup>
        ) : (
          // 자체 관리형: Master/Worker 토글
          <ToggleGroup
            type="single"
            value={selectedNode}
            onValueChange={(value) => value && setSelectedNode(value as "master" | "worker")}
            variant="outline"
            size="default"
            className="w-[360px]"
          >
            <ToggleGroupItem value="master" aria-label="Master Nodes" className="flex-1">
              Master Nodes
            </ToggleGroupItem>
            <ToggleGroupItem value="worker" aria-label="Worker Nodes" className="flex-1">
              Worker Nodes
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {/* 차트 영역 - 반응형 레이아웃 (1280px 이하에서 세로 정렬) */}
      <div className="flex flex-col rounded-md xl:flex-row border">
        {/* 왼쪽: 시간별 사용량 차트 */}
        <div className="border-input flex min-w-0 flex-1 flex-col items-start gap-4 border-b bg-transparent p-4 xl:border-r xl:border-b-0">
          {/* 제목과 토글 영역 */}
          <div className="flex items-center justify-between gap-5 self-stretch">
            <h3 className="text-foreground text-sm leading-none font-medium">
              Hourly {selectedMetric === "cpu" ? "CPU" : "Memory"} usage
            </h3>

            {/* CPU/Memory 토글 - shadcn/ui ToggleGroup */}
            <ToggleGroup
              type="single"
              value={selectedMetric}
              onValueChange={(value) => value && setSelectedMetric(value as "cpu" | "memory")}
              variant="outline"
              size="sm"
              className="w-[160px]"
            >
              <ToggleGroupItem value="cpu" aria-label="CPU" className="flex-1">
                CPU
              </ToggleGroupItem>
              <ToggleGroupItem value="memory" aria-label="Memory" className="flex-1">
                Memory
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* 차트 래퍼 */}
          <div className="flex flex-grow flex-col items-start gap-2.5 self-stretch">
            <ChartContainer config={hourlyChartConfig} className="h-[340px] w-full">
              <AreaChart
                accessibilityLayer
                data={currentHourlyData}
                margin={{
                  left: 6,
                  right: 12,
                  bottom: 24,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={calculateYAxisDomain(currentHourlyData)}
                  tickCount={6}
                  tickFormatter={(value) => formatChartValue(value, selectedMetric)}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <>
                          {/* 🎨 Indicator dot - ChartStyle이 생성한 CSS 변수 사용 */}
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: `var(--color-${name})`,
                            }}
                          />
                          {/* 📝 Label + Formatted Value */}
                          <div className="flex flex-1 justify-between leading-none items-center gap-2">
                            <span className="text-muted-foreground">Hourly Usage</span>
                            <span className="font-mono font-medium tabular-nums !text-foreground">
                              {formatChartValue(Number(value), selectedMetric)}
                            </span>
                          </div>
                        </>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="value"
                  name="value"
                  type="monotone"
                  fill={selectedMetric === "cpu" ? "var(--chart-1)" : "var(--chart-3)"}
                  fillOpacity={0.4}
                  stroke={selectedMetric === "cpu" ? "var(--chart-1)" : "var(--chart-3)"}
                  isAnimationActive={false}
                />
                <Legend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        {/* 오른쪽: Stacked Horizontal Bar */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-6 self-stretch p-4">
          {/* CPU 섹션 */}
          <div className="w-full">
            {/* 헤더: 제목 + 경고 아이콘 + 퍼센트/용량 */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">CPU</span>
                {cpuWarningState.isWarning && (
                  <TooltipProvider>
                    <ShadcnTooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className={cn("h-4 w-4 cursor-help", "text-status-warning")} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{cpuWarningState.message}</p>
                      </TooltipContent>
                    </ShadcnTooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">{cpuValues.usage.toFixed(2)}</span>
                <span className="text-muted-foreground ml-1">/ {cpuValues.capacity.toFixed(2)} Cores</span>
              </div>
            </div>

            {/* 바 차트 + 단위 */}
            <div className="flex items-center gap-4">
              <div
                className="relative h-5 flex-1 cursor-pointer overflow-hidden rounded-[2px]"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    content: [
                      { label: "Usage", value: formatCpuValue(cpuValues.usage), color: "var(--chart-blue-600)" },
                      { label: "Requests", value: formatCpuValue(cpuValues.requests), color: "var(--chart-blue-300)" },
                      { label: "Limit", value: formatCpuValue(cpuValues.limits), color: "var(--chart-gray-400)" },
                      {
                        label: "Available",
                        value: formatCpuValue(cpuValues.available),
                        color: "var(--chart-gray-200)",
                      },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip((prev) => ({
                    ...prev,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  }));
                }}
                onMouseLeave={() => {
                  setTooltip((prev) => ({ ...prev, visible: false }));
                }}
              >
                {/* 스택 바 차트 (Memory와 동일한 스타일) */}
                <div className="flex h-full w-full">
                  {/* Usage - THEME-021: CSS 변수 사용 */}
                  <div
                    className="h-full transition-all"
                    style={{
                      backgroundColor: "var(--cluster-bar-usage)",
                      width: `${cpuValues.capacity > 0 ? (cpuValues.usage / cpuValues.capacity) * 100 : 0}%`,
                    }}
                  />
                  {/* Requests (Usage 이후) */}
                  <div
                    className="h-full transition-all"
                    style={{
                      backgroundColor: "var(--cluster-bar-request)",
                      width: `${cpuValues.capacity > 0 ? Math.max(0, (cpuValues.requests - cpuValues.usage) / cpuValues.capacity) * 100 : 0}%`,
                    }}
                  />
                  {/* Available (나머지 전체) */}
                  <div
                    className="h-full transition-all flex-1"
                    style={{ backgroundColor: "var(--cluster-bar-available)" }}
                  />
                </div>
              </div>
            </div>

            {/* 눈금 */}
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{(cpuValues.capacity / 4).toFixed(1)}</span>
              <span>{(cpuValues.capacity / 2).toFixed(1)}</span>
              <span>{((cpuValues.capacity * 3) / 4).toFixed(1)}</span>
              <span>{Math.ceil(cpuValues.capacity)} cores</span>
            </div>

            {/* 레전드 (4개 컬럼, 바 아래) */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-usage)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">USAGE</div>
                  <div className="font-semibold">{formatLegendValue(cpuValues.usage, (v) => v.toFixed(2))} cores</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-request)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">REQUEST</div>
                  <div className="font-semibold">
                    {formatLegendValue(cpuValues.requests, (v) => v.toFixed(2))} cores
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-limit)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">LIMIT</div>
                  <div className="font-semibold">{formatLegendValue(cpuValues.limits, (v) => v.toFixed(2))} cores</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-available)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">AVAILABLE</div>
                  <div className="font-semibold">
                    {formatLegendValue(cpuValues.available, (v) => v.toFixed(2))} cores
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory 섹션 */}
          <div className="w-full">
            {/* 헤더: 제목 + 경고 아이콘 + 퍼센트/용량 */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Memory</span>
                {memoryWarningState.isWarning && (
                  <TooltipProvider>
                    <ShadcnTooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className={cn("h-4 w-4 cursor-help", "text-status-warning")} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{memoryWarningState.message}</p>
                      </TooltipContent>
                    </ShadcnTooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">{memoryValues.usage.toFixed(2)}</span>
                <span className="text-muted-foreground ml-1">/ {memoryValues.capacity.toFixed(2)} GiB</span>
              </div>
            </div>

            {/* 스택 바 차트 (일반 바 차트 스타일) */}
            <div className="flex items-center gap-4">
              <div
                className="relative h-5 flex-1 cursor-pointer overflow-hidden rounded-[2px]"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    content: [
                      { label: "Usage", value: formatMemoryValue(memoryValues.usage), color: "var(--chart-blue-600)" },
                      {
                        label: "Requests",
                        value: formatMemoryValue(memoryValues.requests),
                        color: "var(--chart-blue-300)",
                      },
                      { label: "Limit", value: formatMemoryValue(memoryValues.limits), color: "var(--chart-gray-400)" },
                      {
                        label: "Available",
                        value: formatMemoryValue(memoryValues.available),
                        color: "var(--chart-gray-200)",
                      },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip((prev) => ({
                    ...prev,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  }));
                }}
                onMouseLeave={() => {
                  setTooltip((prev) => ({ ...prev, visible: false }));
                }}
              >
                {/* 스택 바 차트 (CPU/Pods와 동일한 스타일) - THEME-021 */}
                <div className="flex h-full w-full">
                  {/* Usage */}
                  <div
                    className="h-full transition-all"
                    style={{
                      backgroundColor: "var(--cluster-bar-usage)",
                      width: `${memoryValues.capacity > 0 ? (memoryValues.usage / memoryValues.capacity) * 100 : 0}%`,
                    }}
                  />
                  {/* Requests (Usage 이후) */}
                  <div
                    className="h-full transition-all"
                    style={{
                      backgroundColor: "var(--cluster-bar-request)",
                      width: `${memoryValues.capacity > 0 ? Math.max(0, (memoryValues.requests - memoryValues.usage) / memoryValues.capacity) * 100 : 0}%`,
                    }}
                  />
                  {/* Available (나머지 전체) */}
                  <div
                    className="h-full transition-all flex-1"
                    style={{ backgroundColor: "var(--cluster-bar-available)" }}
                  />
                </div>
              </div>
            </div>

            {/* 눈금 */}
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{(memoryValues.capacity / 4).toFixed(0)}</span>
              <span>{(memoryValues.capacity / 2).toFixed(0)}</span>
              <span>{((memoryValues.capacity * 3) / 4).toFixed(0)}</span>
              <span>{Math.ceil(memoryValues.capacity)} GiB</span>
            </div>

            {/* 레전드 (4개 컬럼, 바 아래) */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-usage)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">USAGE</div>
                  <div className="font-semibold">{formatLegendValue(memoryValues.usage, (v) => v.toFixed(2))} GiB</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-request)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">REQUEST</div>
                  <div className="font-semibold">
                    {formatLegendValue(memoryValues.requests, (v) => v.toFixed(2))} GiB
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-limit)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">LIMIT</div>
                  <div className="font-semibold">{formatLegendValue(memoryValues.limits, (v) => v.toFixed(2))} GiB</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-available)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">AVAILABLE</div>
                  <div className="font-semibold">
                    {formatLegendValue(memoryValues.available, (v) => v.toFixed(2))} GiB
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pods 섹션 */}
          <div className="w-full">
            {/* 헤더: 제목 + 경고 아이콘 + 퍼센트/용량 */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Pods</span>
                {podsWarningState.isWarning && (
                  <TooltipProvider>
                    <ShadcnTooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className={cn("h-4 w-4 cursor-help", "text-status-warning")} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{podsWarningState.message}</p>
                      </TooltipContent>
                    </ShadcnTooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">{podsValues.usage}</span>
                <span className="text-muted-foreground ml-1">/ {podsValues.capacity} Pods</span>
              </div>
            </div>

            {/* 바 차트 + 단위 */}
            <div className="flex items-center gap-4">
              <div
                className="relative h-5 flex-1 cursor-pointer overflow-hidden rounded-[2px]"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    content: [
                      { label: "Usage", value: podsValues.usage.toString(), color: "var(--chart-blue-600)" },
                      { label: "Available", value: podsValues.available.toString(), color: "var(--chart-gray-200)" },
                    ],
                  });
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip((prev) => ({
                    ...prev,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  }));
                }}
                onMouseLeave={() => {
                  setTooltip((prev) => ({ ...prev, visible: false }));
                }}
              >
                {/* 스택 바 차트 (Usage + Available 2색) - THEME-021 */}
                <div className="flex h-full w-full">
                  {/* Usage */}
                  <div
                    className="h-full transition-all"
                    style={{
                      backgroundColor: "var(--cluster-bar-usage)",
                      width: `${podsValues.capacity > 0 ? (podsValues.usage / podsValues.capacity) * 100 : 0}%`,
                    }}
                  />
                  {/* Available (나머지 전체) */}
                  <div
                    className="h-full transition-all flex-1"
                    style={{ backgroundColor: "var(--cluster-bar-available)" }}
                  />
                </div>
              </div>
            </div>

            {/* 눈금 */}
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{Math.round(podsValues.capacity / 4)}</span>
              <span>{Math.round(podsValues.capacity / 2)}</span>
              <span>{Math.round((podsValues.capacity * 3) / 4)}</span>
              <span>{podsValues.capacity} pods</span>
            </div>

            {/* 레전드 (CPU/Memory와 동일한 4컬럼 그리드, USAGE/AVAILABLE 나란히) */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-usage)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">USAGE</div>
                  <div className="font-semibold">{formatLegendValue(podsValues.usage, (v) => v.toFixed(0))} pods</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: "var(--cluster-bar-available)" }} />
                <div>
                  <div className="text-xs text-muted-foreground">AVAILABLE</div>
                  <div className="font-semibold">
                    {formatLegendValue(podsValues.available, (v) => v.toFixed(0))} pods
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 10}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
          }}
        >
          {tooltip.content.map((item, index) => (
            <div key={index} className="flex items-center gap-2 py-0.5">
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              <div className="flex flex-1 justify-between leading-none items-center gap-2">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono font-medium tabular-nums" style={{ color: "var(--foreground)" }}>
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * 🎯 목적: ClusterOverviewChartDefault export with DI
 */
export const ClusterOverviewChartDefault = withInjectables<Dependencies, { className?: string }>(
  NonInjectedClusterOverviewChartDefault,
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      nodeStore: di.inject(nodeStoreInjectable),
      masterMetrics: di.inject(masterClusterMetricsInjectable),
      workerMetrics: di.inject(workerClusterMetricsInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
      navigate: di.inject(navigateInjectable),
    }),
  },
);
