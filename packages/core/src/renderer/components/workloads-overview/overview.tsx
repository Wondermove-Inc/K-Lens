/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@skuberplus/storybook-shadcn/src/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Pie, PieChart, Tooltip } from "recharts";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { WORKLOAD_CHART_CONFIG } from "../../utils/chart-colors";
import { ResourceNames } from "../../utils/rbac";
import eventStoreInjectable from "../events/store.injectable";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import namespaceStoreInjectable from "../namespaces/store.injectable";
import cronJobStoreInjectable from "../workloads-cronjobs/store.injectable";
import daemonSetStoreInjectable from "../workloads-daemonsets/store.injectable";
import deploymentStoreInjectable from "../workloads-deployments/store.injectable";
import jobStoreInjectable from "../workloads-jobs/store.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";
import replicaSetStoreInjectable from "../workloads-replicasets/store.injectable";
import statefulSetStoreInjectable from "../workloads-statefulsets/store.injectable";
import workloadOverviewDetailsInjectable from "./workload-overview-details/workload-overview-details.injectable";
import workloadsInjectable from "./workloads/workloads.injectable";

import type { IComputedValue } from "mobx";

import type { ClusterContext } from "../../cluster-frame-context/cluster-frame-context";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { EventStore } from "../events/store";
import type { NamespaceStore } from "../namespaces/store";
import type { CronJobStore } from "../workloads-cronjobs/store";
import type { DaemonSetStore } from "../workloads-daemonsets/store";
import type { DeploymentStore } from "../workloads-deployments/store";
import type { JobStore } from "../workloads-jobs/store";
import type { PodStore } from "../workloads-pods/store";
import type { ReplicaSetStore } from "../workloads-replicasets/store";
import type { StatefulSetStore } from "../workloads-statefulsets/store";
import type { Workload } from "./workloads/workload-injection-token";

/**
 * 🎯 목적: WorkloadsOverview 컴포넌트 Dependencies
 */
interface Dependencies {
  detailComponents: IComputedValue<React.ElementType<{}>[]>;
  clusterFrameContext: ClusterContext;
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  daemonSetStore: DaemonSetStore;
  replicaSetStore: ReplicaSetStore;
  deploymentStore: DeploymentStore;
  jobStore: JobStore;
  cronJobStore: CronJobStore;
  statefulSetStore: StatefulSetStore;
  eventStore: EventStore;
  workloads: IComputedValue<Workload[]>;
  namespaceStore: NamespaceStore;
}

/**
 * 🎯 THEME-020: 중앙 집중식 Workload 차트 설정 사용
 * 📝 WORKLOAD_CHART_CONFIG는 CSS 변수 참조를 직접 사용
 * ChartStyle이 자동으로 --color-succeeded: var(--workload-succeeded); 등을 생성
 * 브라우저가 테마에 맞는 실제 색상을 렌더링 시 해석
 */
const overviewChartConfig = WORKLOAD_CHART_CONFIG satisfies ChartConfig;

/**
 * 🎯 목적: Overview 범례 컴포넌트 (Container Query 반응형, Grid 고정)
 *
 * @param data - 차트 데이터 (metric, value, fill)
 *
 * 📝 레이아웃 (Grid 기반, 2가지만 허용):
 *
 * 1. 넓을 때 (>= 300px): 2x2 그리드
 *   ┌─────────────┬─────────────┐
 *   │ Succeeded   │ Running     │
 *   │ Pending     │ Failed      │
 *   └─────────────┴─────────────┘
 *
 * 2. 좁을 때 (< 300px): 4x1 세로 배치
 *   ┌─────────────┐
 *   │ Succeeded   │
 *   │ Running     │
 *   │ Pending     │
 *   │ Failed      │
 *   └─────────────┘
 *
 * 📝 설계 원칙:
 * - 카드 그리드 최소 너비: 200px (다음 줄로 이동 기준)
 * - 범례 전환 기준: 260px (2x2 ↔ 4x1)
 * - 범례 전체는 중앙 배치, 내부 항목은 왼쪽 정렬 (시작 위치 통일)
 * - flex-wrap 대신 grid 사용으로 3:1 같은 불규칙 배치 방지
 */
function OverviewLegend({ data }: { data: { metric: string; value: number; fill: string }[] }) {
  // 2x2 그리드 순서: Succeeded, Running, Pending, Failed (좌→우, 상→하)
  const orderedData = [
    data.find((d) => d.metric === "succeeded"),
    data.find((d) => d.metric === "running"),
    data.find((d) => d.metric === "pending"),
    data.find((d) => d.metric === "failed"),
  ].filter(Boolean) as typeof data;

  const renderLegendItem = (item: { metric: string; value: number; fill: string }) => {
    const hasValue = item.value > 0;
    return (
      <div
        key={item.metric}
        // whitespace-nowrap: 개별 범례 아이템 내 줄바꿈 절대 방지
        className={`flex items-center gap-1.5 px-0.5 whitespace-nowrap ${!hasValue ? "opacity-40" : ""}`}
      >
        <div className="h-2 w-2 shrink-0" style={{ backgroundColor: item.fill }} />
        <span
          className={`text-sm leading-normal ${hasValue ? "text-foreground font-medium" : "text-muted-foreground font-normal"}`}
        >
          {item.metric.charAt(0).toUpperCase() + item.metric.slice(1)}: {item.value}
        </span>
      </div>
    );
  };

  return (
    <div className="flex justify-center w-full">
      <div
        className="
          grid grid-cols-1 gap-x-2 gap-y-0.5
          @[260px]/overview-card:grid-cols-2
        "
      >
        {orderedData.map(renderLegendItem)}
      </div>
    </div>
  );
}

/**
 * 🎯 목적: Workloads Overview 메인 컴포넌트 (shadcn UI 기반)
 *
 * 📝 주의사항:
 * - shadcn chart-data.tsx 템플릿 복사 후 커스터마이징
 * - vendor/shadcn 업데이트 시 수동 병합 필요
 * - 클릭 이벤트: workload.open() 사용해서 리소스 페이지 이동
 * - 네임스페이스 필터링: namespaceStore.contextNamespaces 사용
 *
 * 🔄 변경이력:
 * - 2025-11-04: shadcn UI 마이그레이션
 * - 2025-11-04: 클릭 이벤트 및 네임스페이스 필터링 추가
 */
const NonInjectedWorkloadsOverview = observer((props: Dependencies) => {
  const {
    podStore,
    deploymentStore,
    daemonSetStore,
    statefulSetStore,
    replicaSetStore,
    jobStore,
    cronJobStore,
    eventStore,
    subscribeStores,
    detailComponents,
    workloads: workloadsComputed,
    namespaceStore,
  } = props;

  // 🎯 목적: Store 구독 설정
  React.useEffect(() => {
    const disposer = subscribeStores(
      [
        podStore,
        deploymentStore,
        daemonSetStore,
        statefulSetStore,
        replicaSetStore,
        jobStore,
        cronJobStore,
        eventStore,
      ],
      {},
    );

    return () => disposer();
  }, [
    subscribeStores,
    podStore,
    deploymentStore,
    daemonSetStore,
    statefulSetStore,
    replicaSetStore,
    jobStore,
    cronJobStore,
    eventStore,
  ]);

  // 🎯 목적: workloads 배열 가져오기
  const workloads = workloadsComputed.get();

  // 🎯 목적: 각 워크로드별 open 함수와 데이터 매핑
  const workloadMap = new Map(workloads.map((w) => [w.title, w]));

  // 🎯 목적: 네임스페이스 필터링된 아이템 가져오기
  const getFilteredItems = (store: any) => {
    const contextNamespaces = namespaceStore.contextNamespaces;
    return store.getAllByNs(contextNamespaces);
  };

  // 🎯 목적: 각 워크로드 리소스의 상태별 데이터 수집 (Succeeded/Running/Pending/Failed)
  const getWorkloadStatusData = (items: any[], getStatus: (item: any) => string) => {
    const succeeded = items.filter((item) => {
      const status = getStatus(item);
      return status === "Succeeded" || status === "Complete";
    }).length;

    const running = items.filter((item) => {
      const status = getStatus(item);
      return status === "Running" || status === "Active";
    }).length;

    const pending = items.filter((item) => {
      const status = getStatus(item);
      return status === "Pending" || status === "Waiting";
    }).length;

    // 신규: Failed 상태 추가 (Pod Failed, Evicted, Error, Unknown 등)
    const failed = items.filter((item) => {
      const status = getStatus(item);
      return (
        status === "Failed" ||
        status === "Evicted" ||
        status === "Error" ||
        status === "Unknown" ||
        status === "CrashLoopBackOff"
      );
    }).length;

    // 🎯 THEME-020: CSS 변수 참조 사용
    // ChartContainer가 --color-succeeded: var(--workload-succeeded); 등을 생성
    return [
      { metric: "succeeded", value: succeeded, fill: "var(--color-succeeded)" },
      { metric: "running", value: running, fill: "var(--color-running)" },
      { metric: "pending", value: pending, fill: "var(--color-pending)" },
      { metric: "failed", value: failed, fill: "var(--color-failed)" },
    ];
  };

  // 🎯 목적: 네임스페이스 필터링된 워크로드 리소스 데이터

  // Pod: getStatusMessage()가 더 정확한 상태 반환 (Evicted, Terminating, CrashLoopBackOff 등 포함)
  const podsData = getWorkloadStatusData(getFilteredItems(podStore), (pod) => pod.getStatusMessage());

  // Deployment: unavailableReplicas 체크 추가
  const deploymentsData = getWorkloadStatusData(getFilteredItems(deploymentStore), (deployment) => {
    const conditions = deployment.getConditions();
    const status = deployment.status;

    // 불가용 Replica가 있으면 Failed
    if (status?.unavailableReplicas && status.unavailableReplicas > 0) return "Failed";
    // Available 조건 True면 Running
    if (conditions.some((c: any) => c.type === "Available" && c.status === "True")) return "Running";
    // Progressing 조건 True면 Pending
    if (conditions.some((c: any) => c.type === "Progressing" && c.status === "True")) return "Pending";
    return "Pending";
  });

  // DaemonSet: 실제 상태 계산 (하드코딩 제거)
  // 📝 색상 비교: Failed에 red-400 (#F87171) 적용 - Jobs와 동일
  const daemonSetsData = getWorkloadStatusData(getFilteredItems(daemonSetStore), (ds) => {
    const status = ds.status;
    const desired = status?.desiredNumberScheduled ?? 0;
    const available = status?.numberAvailable ?? 0;
    const unavailable = status?.numberUnavailable ?? 0;

    // 불가용 노드가 있으면 Failed
    if (unavailable > 0) return "Failed";
    // 모든 노드에서 실행 중이면 Running
    if (available === desired && desired > 0) return "Running";
    // 아직 스케줄 중이면 Pending
    return "Pending";
  }).map((item) => (item.metric === "failed" ? { ...item, fill: "var(--color-failed)" } : item));

  // StatefulSet: 실제 상태 계산 (하드코딩 제거)
  const statefulSetsData = getWorkloadStatusData(getFilteredItems(statefulSetStore), (sts) => {
    const status = sts.status;
    const desired = sts.spec?.replicas ?? 0;
    const ready = status?.readyReplicas ?? 0;

    // 모든 Replica가 Ready면 Running
    if (ready === desired && desired > 0) return "Running";
    // Ready가 0이고 desired가 있으면 Pending
    if (ready === 0 && desired > 0) return "Pending";
    // 일부만 Ready면 Pending (롤아웃 중)
    return "Pending";
  });

  // ReplicaSet: 실제 상태 계산 (하드코딩 제거)
  const replicaSetsData = getWorkloadStatusData(getFilteredItems(replicaSetStore), (rs) => {
    const status = rs.status;
    const desired = rs.spec?.replicas ?? 0;
    const available = status?.availableReplicas ?? 0;

    // 모든 Replica가 Available이면 Running
    if (available === desired && desired > 0) return "Running";
    // 일부만 Available이면 Pending
    return "Pending";
  });

  // Job: Failed 조건을 Failed로 변경 (기존: Pending으로 잘못 처리됨)
  // 📝 색상 비교: Failed에 red-400 (#F87171) 적용 - 기본값과 동일하지만 명시적으로 표시
  const jobsData = getWorkloadStatusData(getFilteredItems(jobStore), (job) => {
    const conditions = job.getConditions();
    // Complete 조건이면 Succeeded
    if (conditions.some((c: any) => c.type === "Complete" && c.status === "True")) return "Succeeded";
    // Failed 조건이면 Failed
    if (conditions.some((c: any) => c.type === "Failed" && c.status === "True")) return "Failed";
    // 활성 Pod가 있으면 Running
    if (job.status?.active && job.status.active > 0) return "Running";
    return "Pending";
  });

  // CronJob: 실제 상태 계산 (하드코딩 제거)
  const cronJobsData = getWorkloadStatusData(getFilteredItems(cronJobStore), (cj) => {
    // Suspend 상태면 Pending
    if (cj.isSuspend()) return "Pending";
    // 활성 Job이 있으면 Running
    if (cj.status?.active && cj.status.active.length > 0) return "Running";
    // 스케줄 대기 중 = Idle 상태 (마지막 실행 성공)
    return "Succeeded";
  });

  // 🎯 목적: 워크로드 리소스 총 개수
  const getTotalCount = (data: { value: number }[]) => {
    return data.reduce((sum, item) => sum + item.value, 0);
  };

  // 🎯 목적: 네임스페이스 선택 상태 및 목록
  const selectedNamespaceNames = namespaceStore.selectedNames;
  // ⚠️ 중요: 네임스페이스 필터 실제 값과 UI 라벨이 어긋나지 않도록 store 상태를 직접 사용
  const selectedNamespace =
    namespaceStore.areAllSelectedImplicitly || selectedNamespaceNames.size === 0
      ? "all"
      : Array.from(selectedNamespaceNames).join(", ");
  const allNamespaces = namespaceStore.items.map((ns) => ns.getName());
  const namespaces = ["all", ...allNamespaces];

  // 🎯 목적: 네임스페이스 선택 시 contextNamespaces 업데이트
  const handleNamespaceChange = (ns: string) => {
    if (ns === "all") {
      namespaceStore.selectNamespaces([]);
    } else {
      namespaceStore.selectNamespaces([ns]);
    }
  };

  // 🎯 목적: 카드 제목 클릭 핸들러
  const handleCardClick = (title: string) => {
    const workload = workloadMap.get(title);
    if (workload) {
      workload.open();
    }
  };

  return (
    <SiblingsInTabLayout scrollable>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex w-full flex-col gap-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h1 className="text-foreground text-lg font-semibold">Overview</h1>

            {/* Namespace 드롭다운 필터 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[180px] justify-between">
                  <span>Namespace: {selectedNamespace}</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Select Namespace</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {namespaces.map((ns) => (
                  <DropdownMenuCheckboxItem
                    key={ns}
                    checked={ns === "all" ? namespaceStore.areAllSelectedImplicitly : selectedNamespaceNames.has(ns)}
                    onCheckedChange={() => handleNamespaceChange(ns)}
                  >
                    {ns}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 워크로드 리소스 카드 그리드 */}
          {/* 📝 minmax 200px: 카드 최소 너비, 260px 미만 시 범례 4x1 배치 */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
            {/* Pods Card */}
            {getTotalCount(podsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.pods)}
                  >
                    Pods ({getTotalCount(podsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={podsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={podsData} />
                </CardFooter>
              </Card>
            )}

            {/* Deployments Card */}
            {getTotalCount(deploymentsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.deployments)}
                  >
                    Deployments ({getTotalCount(deploymentsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={deploymentsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={deploymentsData} />
                </CardFooter>
              </Card>
            )}

            {/* DaemonSets Card */}
            {getTotalCount(daemonSetsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.daemonsets)}
                  >
                    DaemonSets ({getTotalCount(daemonSetsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={daemonSetsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={daemonSetsData} />
                </CardFooter>
              </Card>
            )}

            {/* StatefulSets Card */}
            {getTotalCount(statefulSetsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.statefulsets)}
                  >
                    StatefulSets ({getTotalCount(statefulSetsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={statefulSetsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={statefulSetsData} />
                </CardFooter>
              </Card>
            )}

            {/* ReplicaSets Card */}
            {getTotalCount(replicaSetsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.replicasets)}
                  >
                    ReplicaSets ({getTotalCount(replicaSetsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={replicaSetsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={replicaSetsData} />
                </CardFooter>
              </Card>
            )}

            {/* Jobs Card */}
            {getTotalCount(jobsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.jobs)}
                  >
                    Jobs ({getTotalCount(jobsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={jobsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={jobsData} />
                </CardFooter>
              </Card>
            )}

            {/* CronJobs Card */}
            {getTotalCount(cronJobsData) > 0 && (
              <Card className="@container/overview-card bg-background flex flex-col gap-1 rounded-md p-3">
                <CardHeader className="items-center gap-0 p-0">
                  <CardTitle
                    className="text-base font-semibold cursor-pointer hover:text-status-info hover:underline transition-colors"
                    onClick={() => handleCardClick(ResourceNames.cronjobs)}
                  >
                    CronJobs ({getTotalCount(cronJobsData)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 pb-2">
                  <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                      <Pie data={cronJobsData} dataKey="value" nameKey="metric" innerRadius={28} outerRadius={55} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="p-0">
                  <OverviewLegend data={cronJobsData} />
                </CardFooter>
              </Card>
            )}
          </div>

          {/* Detail Components (기존 DI 패턴 유지) */}
          {detailComponents.get().map((Details, index) => (
            <Details key={`workload-overview-${index}`} />
          ))}
        </div>
      </div>
    </SiblingsInTabLayout>
  );
});

/**
 * 🎯 목적: WorkloadsOverview with DI
 */
export const WorkloadsOverview = withInjectables<Dependencies>(NonInjectedWorkloadsOverview, {
  getProps: (di) => ({
    detailComponents: di.inject(workloadOverviewDetailsInjectable),
    clusterFrameContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    podStore: di.inject(podStoreInjectable),
    daemonSetStore: di.inject(daemonSetStoreInjectable),
    replicaSetStore: di.inject(replicaSetStoreInjectable),
    deploymentStore: di.inject(deploymentStoreInjectable),
    jobStore: di.inject(jobStoreInjectable),
    cronJobStore: di.inject(cronJobStoreInjectable),
    statefulSetStore: di.inject(statefulSetStoreInjectable),
    eventStore: di.inject(eventStoreInjectable),
    workloads: di.inject(workloadsInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
  }),
});
