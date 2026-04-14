/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Kubernetes 리소스 디테일 패널 공통 컴포넌트
 *
 * @remarks
 * - shadcn DetailPanel로 마이그레이션 완료
 * - 레거시 Drawer → DetailPanel wrapper 사용
 * - 모든 Kubernetes 리소스 (Pod, Deployment, Service 등)에 공통 적용
 * - 액션 핸들러 리졸버로 리소스별 액션 메뉴(⋮) 지원
 *
 * 🔄 변경이력:
 * - 2025-11-12: 레거시 Drawer → shadcn DetailPanel 마이그레이션
 * - 2026-01-06: 액션 핸들러 리졸버 통합 (클러스터 오버뷰 Warning 패널 개선)
 */

import "./kube-object-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
import { DetailPanel } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel";
import { observer } from "mobx-react";
import React from "react";
import hideDetailsInjectable from "../kube-detail-params/hide-details.injectable";
import currentKubeObjectInDetailsInjectable from "./current-kube-object-in-details.injectable";
import kubeObjectActionHandlerResolverInjectable from "./kube-object-action-handlers/kube-object-action-handler-resolver.injectable";
import kubeObjectDetailItemsInjectable from "./kube-object-detail-items/kube-object-detail-items.injectable";

import type { KubeObject } from "@skuberplus/kube-object";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";
import type { IComputedValue } from "mobx";

import type { HideDetails } from "../kube-detail-params/hide-details.injectable";
import type { CurrentKubeObject } from "./current-kube-object-in-details.injectable";
import type { KubeObjectActionHandlerResolver } from "./kube-object-action-handlers/kube-object-action-handler-resolver.injectable";

export interface KubeObjectDetailsProps<Kube extends KubeObject = KubeObject> {
  className?: string;
  object: Kube;
}

interface Dependencies {
  detailComponents: IComputedValue<React.ElementType[]>;
  kubeObject: IAsyncComputed<CurrentKubeObject>;
  hideDetails: HideDetails;
  actionHandlerResolver: KubeObjectActionHandlerResolver;
}

/**
 * 🎯 목적: Kubernetes 리소스 디테일 패널 렌더링
 */
const NonInjectedKubeObjectDetails = observer((props: Dependencies) => {
  const { detailComponents, hideDetails, kubeObject, actionHandlerResolver } = props;

  const currentKubeObject = kubeObject.value.get();
  const isLoading = kubeObject.pending.get();

  // 🎯 패널이 닫혀있으면 렌더링하지 않음
  if (!isLoading && !currentKubeObject) {
    return null;
  }

  // 🎯 액션 핸들러 리졸버로 리소스별 액션 핸들러 획득
  const handlers = actionHandlerResolver.resolve(currentKubeObject?.object, hideDetails);

  return (
    <DetailPanel
      isOpen={Boolean(isLoading || currentKubeObject)}
      onClose={hideDetails}
      title={currentKubeObject?.object?.getName() || "Loading..."}
      subtitle={currentKubeObject?.object?.kind}
      object={currentKubeObject?.object}
      className="KubeObjectDetails"
      // 🎯 리소스별 액션 핸들러 전달 (액션 메뉴 ⋮ 활성화)
      onEdit={handlers.onEdit}
      onDelete={handlers.onDelete}
      onForceDelete={handlers.onForceDelete}
      onForceFinalize={handlers.onForceFinalize}
      onRestart={handlers.onRestart}
      onScale={handlers.onScale}
      onShell={handlers.onShell}
      onLogs={handlers.onLogs}
      onLogsNewWindow={handlers.onLogsNewWindow}
      onAttach={handlers.onAttach}
      onCordon={handlers.onCordon}
      onUncordon={handlers.onUncordon}
      onDrain={handlers.onDrain}
      onSuspend={handlers.onSuspend}
      onTrigger={handlers.onTrigger}
    >
      {/* 🔄 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Spinner center />
        </div>
      )}

      {/* ⚠️ 에러 상태 */}
      {currentKubeObject?.error && (
        <div className="box center p-4 text-center">
          <div>Resource loading has failed:</div>
          <b className="text-destructive">{currentKubeObject.error}</b>
        </div>
      )}

      {/* 📋 리소스 디테일 컴포넌트들 */}
      {currentKubeObject?.object && (
        <div className="space-y-4">
          {detailComponents.get().map((Component, index) => (
            <Component key={index} object={currentKubeObject.object} />
          ))}
        </div>
      )}
    </DetailPanel>
  );
});

export const KubeObjectDetails = withInjectables<Dependencies>(NonInjectedKubeObjectDetails, {
  getProps: (di, props) => ({
    ...props,
    hideDetails: di.inject(hideDetailsInjectable),
    detailComponents: di.inject(kubeObjectDetailItemsInjectable),
    kubeObject: di.inject(currentKubeObjectInDetailsInjectable),
    actionHandlerResolver: di.inject(kubeObjectActionHandlerResolverInjectable),
  }),
});
