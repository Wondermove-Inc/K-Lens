/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./cluster-view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { computed, makeObservable, observable, reaction, when } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import navigateToCatalogInjectable from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import requestClusterActivationInjectable from "../../../features/cluster/activation/renderer/request-activation.injectable";
import getClusterByIdInjectable from "../../../features/cluster/storage/common/get-by-id.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import { LoadingOverlay } from "../shadcn-ui/loading-overlay";
import { Welcome } from "../welcome/welcome";
import clusterFrameHandlerInjectable from "./cluster-frame-handler.injectable";
import { ClusterStatus } from "./cluster-status";
import clusterViewRouteParametersInjectable from "./cluster-view-route-parameters.injectable";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { IComputedValue } from "mobx";

import type { Cluster } from "../../../common/cluster/cluster";
import type { NavigateToCatalog } from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import type { RequestClusterActivation } from "../../../features/cluster/activation/common/request-token";
import type { GetClusterById } from "../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { ClusterFrameHandler } from "./cluster-frame-handler";

interface Dependencies {
  clusterId: IComputedValue<string>;
  clusterFrames: ClusterFrameHandler;
  navigateToCatalog: NavigateToCatalog;
  entityRegistry: CatalogEntityRegistry;
  getClusterById: GetClusterById;
  requestClusterActivation: RequestClusterActivation;
}

export class NonInjectedClusterView extends Component<Dependencies> {
  /**
   * 🎯 목적: catalog 엔티티 로딩을 기다릴 최대 시간(ms)
   */
  private static readonly entityWaitTimeoutMs = 5000;

  private activationSequence = 0;

  @observable.ref private waitingClusterId: string | undefined;
  private visibilityDisposer?: () => void;

  constructor(props: Dependencies) {
    super(props);
    makeObservable(this);
  }

  get clusterId() {
    return this.props.clusterId.get();
  }

  @computed get cluster(): Cluster | undefined {
    return this.props.getClusterById(this.clusterId);
  }

  private readonly isViewLoaded = computed(() => this.props.clusterFrames.hasLoadedView(this.clusterId), {
    keepAlive: true,
    requiresReaction: true,
  });

  @computed get isReady(): boolean {
    const { cluster } = this;

    if (!cluster) {
      return false;
    }

    return cluster.ready.get() && cluster.available.get() && this.isViewLoaded.get();
  }

  componentDidMount() {
    this.bindEvents();
  }

  componentWillUnmount() {
    this.visibilityDisposer?.();
    this.props.clusterFrames.clearVisibleCluster();
    this.props.entityRegistry.activeEntity = undefined;
  }

  bindEvents() {
    disposeOnUnmount(this, [
      reaction(
        () => this.clusterId,
        (clusterId) => {
          void this.handleClusterChange(clusterId);
        },
        {
          fireImmediately: true,
        },
      ),
      /**
       * 🎯 목적: 클러스터 삭제 감지 및 자동 네비게이션
       * 📝 이유: 클러스터가 삭제되면 (storage에서 제거) 더 이상 현재 뷰에 머물 수 없으므로
       *         카탈로그로 자동 이동. 이는 삭제 다이얼로그의 네비게이션과 별개로
       *         클러스터 상태 변화를 직접 감시하여 더 안정적으로 처리함.
       * 🔄 변경이력: 2026-01-04 - 해결
       */
      reaction(
        () => this.cluster,
        (cluster) => {
          // 클러스터 라우트에 있는데 클러스터가 없는 경우 → 삭제된 것으로 간주
          if (!cluster && this.clusterId) {
            this.waitingClusterId = undefined;
            this.props.clusterFrames.clearVisibleCluster();
            this.props.entityRegistry.activeEntity = undefined;
            this.props.navigateToCatalog();
          }
        },
      ),
    ]);
  }

  /**
   * 🎯 목적: 클러스터 라우트 변경 시 엔티티 준비를 기다린 뒤 프레임을 초기화한다.
   */
  private async handleClusterChange(clusterId: string) {
    const activationId = ++this.activationSequence;

    this.visibilityDisposer?.();
    this.visibilityDisposer = undefined;

    if (!clusterId) {
      this.props.clusterFrames.clearVisibleCluster();
      this.props.entityRegistry.activeEntity = undefined;
      this.waitingClusterId = undefined;

      return;
    }

    this.props.entityRegistry.activeEntity = undefined;
    this.waitingClusterId = clusterId;

    const entityIsReady = await this.waitForCatalogEntity(clusterId);

    if (activationId !== this.activationSequence) {
      return;
    }

    if (!entityIsReady) {
      this.waitingClusterId = undefined;
      this.props.navigateToCatalog();

      return;
    }

    this.props.clusterFrames.initView(clusterId);
    this.props.requestClusterActivation({ clusterId });

    this.visibilityDisposer = when(
      () => activationId === this.activationSequence && this.isReady,
      () => {
        this.props.clusterFrames.setVisibleCluster(clusterId);
        this.props.entityRegistry.activeEntity = clusterId;
        this.waitingClusterId = undefined;
      },
    );
  }

  /**
   * 🎯 목적: catalog에 대상 클러스터 엔티티가 등록될 때까지 대기한다.
   */
  private async waitForCatalogEntity(clusterId: string): Promise<boolean> {
    if (this.props.entityRegistry.getById(clusterId)) {
      return true;
    }

    try {
      await when(() => Boolean(this.props.entityRegistry.getById(clusterId)), {
        timeout: NonInjectedClusterView.entityWaitTimeoutMs,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🎯 목적: 클러스터 엔티티 로딩 대기 UI 표시
   * 📝 주의: 클러스터가 삭제된 경우 bindEvents()의 reaction이 자동으로 카탈로그로 이동시킴
   * 🔄 변경이력: 2026-01-04 - 한글 → 영문 메시지 변경
   */
  private renderWaiting(): StrictReactNode {
    if (this.waitingClusterId && !this.cluster) {
      return (
        <LoadingOverlay
          isVisible={true}
          title="Preparing cluster information..."
          message="Loading cluster entity data..."
          anchor="parent"
          dimmed={false}
        />
      );
    }

    return null;
  }

  private renderPlaceholder(): StrictReactNode {
    if (!this.isReady && !this.props.clusterFrames.hasVisibleView()) {
      // 🎯 목적: 실제로 노출된 클러스터 화면이 없을 때만 웰컴을 배경으로 사용
      // ⚠️ 이유: 로드되었지만 hidden 상태인 iframe만 있을 경우 빈 배경이 되지 않도록 대비
      return (
        <div className="ClusterView__placeholder">
          <Welcome showTabs={false} />
        </div>
      );
    }

    return null;
  }

  renderStatus(): StrictReactNode {
    const { cluster, isReady } = this;

    if (cluster && !isReady) {
      return <ClusterStatus cluster={cluster} className="box center" />;
    }

    return null;
  }

  render() {
    return (
      <div className="ClusterView flex column align-center">
        {this.renderPlaceholder()}
        {this.renderWaiting()}
        {this.renderStatus()}
      </div>
    );
  }
}

export const ClusterView = withInjectables<Dependencies>(observer(NonInjectedClusterView), {
  getProps: (di) => ({
    ...di.inject(clusterViewRouteParametersInjectable),
    navigateToCatalog: di.inject(navigateToCatalogInjectable),
    clusterFrames: di.inject(clusterFrameHandlerInjectable),
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    getClusterById: di.inject(getClusterByIdInjectable),
    requestClusterActivation: di.inject(requestClusterActivationInjectable),
  }),
});
