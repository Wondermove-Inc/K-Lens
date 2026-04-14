/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Deployment, DaemonSet 등 상세 페이지 내 Pod 목록 테이블
 *
 * @remarks
 * - KubeDataTable 기반 구현 (shadcn + TanStack Table)
 * - 조건부 Node 컬럼 (owner.kind === "Node"일 때 숨김)
 * - CPU/Memory 메트릭 자동 갱신 (120초 간격)
 * - 행 클릭 시 Pod 상세 페이지 표시
 *
 * 🔄 변경이력:
 * - 2025-11-12: 레거시 Table → KubeDataTable 마이그레이션
 */

import "./pod-details-list.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { interval } from "@skuberplus/utilities";
import { reaction } from "mobx";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { PodDetailPanel } from "./pod-detail-panel";
import { getPodDetailsListColumns, type PodDetailsWithMetrics } from "./pod-details-list-columns";
import podStoreInjectable from "./store.injectable";

import type { KubeObject, Pod } from "@skuberplus/kube-object";

import type { PodStore } from "./store";

/**
 * 🎯 목적: PodDetailsList Props 인터페이스
 */
export interface PodDetailsListProps {
  /**
   * 표시할 Pod 목록
   */
  pods: Pod[];

  /**
   * Pod를 소유한 리소스 (Deployment, DaemonSet, Node 등)
   */
  owner: KubeObject;

  /**
   * CPU 최대값 (LineProgress 표시용, 선택적)
   */
  maxCpu?: number;

  /**
   * Memory 최대값 (LineProgress 표시용, 선택적)
   */
  maxMemory?: number;
}

/**
 * 🎯 목적: Injectable Dependencies
 */
interface Dependencies {
  podStore: PodStore;
}

/**
 * 🎯 목적: Pod Details List 테이블 컴포넌트 (함수형)
 */
const NonInjectedPodDetailsList = observer(
  ({ pods, owner, maxCpu, maxMemory, podStore }: PodDetailsListProps & Dependencies) => {
    // 🎯 로컬 state (Pod Detail Panel 제어)
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedPod, setSelectedPod] = useState<Pod | undefined>();

    // 🎯 메트릭 자동 갱신 (120초 간격)
    useEffect(() => {
      const metricsWatcher = interval(120, () => {
        podStore.loadKubeMetrics(owner.getNs());
      });

      metricsWatcher.start(true);

      const disposer = reaction(
        () => owner,
        () => metricsWatcher.restart(true),
      );

      return () => {
        metricsWatcher.stop();
        disposer();
      };
    }, [owner, podStore]);

    // 🎯 조건부 컬럼 설정
    const hideNode = owner.kind === "Node";
    const linkToPod = owner.kind !== "Pod";

    // 🎯 메트릭 데이터 전처리 (PodDetailsWithMetrics 변환)
    // 📝 kubeMetrics를 의존성에 추가하여 메트릭 업데이트 시 재계산
    // 📝 스냅샷 사용으로 Race Condition 방지
    const podsWithMetrics = useMemo<PodDetailsWithMetrics[]>(() => {
      const metricsSnapshot = podStore.kubeMetrics.slice();
      return pods.map(
        (pod) =>
          ({
            ...pod,
            metrics: podStore.getPodKubeMetrics(pod, metricsSnapshot),
          }) as PodDetailsWithMetrics,
      );
    }, [pods, podStore, podStore.kubeMetrics]);

    // 🎯 컬럼 정의
    const columns = useMemo(
      () => getPodDetailsListColumns(hideNode, linkToPod, maxCpu, maxMemory),
      [hideNode, linkToPod, maxCpu, maxMemory],
    );

    // 🎯 로딩 상태
    if (!podStore.isLoaded) {
      return (
        <div className="PodDetailsList flex justify-center">
          <Spinner />
        </div>
      );
    }

    // 🎯 빈 목록
    if (!pods.length) {
      return null;
    }

    // 🎯 행 클릭 핸들러 (Pod Detail Panel 열기)
    const handleRowClick = (pod: PodDetailsWithMetrics) => {
      setSelectedPod(pod);
      setIsPanelOpen(true);
    };

    return (
      <>
        <div className="PodDetailsList flex column">
          <DetailPanelSection title="Pods">
            <KubeDataTable
              data={podsWithMetrics}
              columns={columns}
              enableColumnResizing={true}
              emptyMessage="No pods found"
              onRowClick={handleRowClick}
              className="box grow"
            />
          </DetailPanelSection>
        </div>

        {/* 🎯 Pod Detail Panel (우측 슬라이드 패널) */}
        <PodDetailPanel isOpen={isPanelOpen} pod={selectedPod} onClose={() => setIsPanelOpen(false)} />
      </>
    );
  },
);

/**
 * 🎯 목적: DI 패턴 적용된 PodDetailsList 컴포넌트
 */
export const PodDetailsList = withInjectables<Dependencies, PodDetailsListProps>(NonInjectedPodDetailsList, {
  getProps: (di, props) => ({
    ...props,
    podStore: di.inject(podStoreInjectable),
  }),
});
