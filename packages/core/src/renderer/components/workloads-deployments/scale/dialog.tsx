/**
 * 🎯 목적: Deployment Scale Dialog 컴포넌트
 *
 * @remarks
 * - shadcn/ui 기반 공통 ScaleDialog 사용
 * - MobX observable 상태 관리
 * - @ogre-tools/injectable DI 패턴
 *
 * 📝 주의사항:
 * - Dialog 상태는 MobX observable box로 관리
 * - API 호출은 deploymentApi.scale() 사용
 *
 * 🔄 변경이력:
 * - 2025-11-17: shadcn 기반 공통 ScaleDialog 컴포넌트로 마이그레이션
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { deploymentApiInjectable } from "@skuberplus/kube-api-specifics";
import { makeObservable, observable, reaction } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { ScaleDialog } from "../../scale-dialog";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import deploymentScaleDialogStateInjectable from "./dialog-state.injectable";

import type { DeploymentApi } from "@skuberplus/kube-api";
import type { Deployment } from "@skuberplus/kube-object";

import type { IObservableValue, IReactionDisposer } from "mobx";

import type { Cluster } from "../../../../common/cluster/cluster";

export interface DeploymentScaleDialogProps {}

interface Dependencies {
  deploymentApi: DeploymentApi;
  state: IObservableValue<Deployment | undefined>;
  hostedCluster: Cluster | undefined;
}

/**
 * 🎯 목적: Deployment Scale Dialog 비주입 컴포넌트
 *
 * @remarks
 * MobX observable 상태로 현재/원하는 레플리카 수 관리
 * shadcn 기반 공통 ScaleDialog 사용
 */
class NonInjectedDeploymentScaleDialog extends Component<DeploymentScaleDialogProps & Dependencies> {
  @observable ready = false;
  @observable currentReplicas = 0;
  @observable desiredReplicas = 0;

  private disposer: IReactionDisposer | null = null;

  constructor(props: DeploymentScaleDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    // 🔄 Dialog 상태 변화 감지하여 onOpen 호출
    this.disposer = reaction(
      () => this.props.state.get(),
      (deployment) => {
        if (deployment) {
          this.onOpen(deployment);
        } else {
          this.onClose();
        }
      },
      { fireImmediately: true },
    );
  }

  componentWillUnmount() {
    this.disposer?.();
  }

  /**
   * 🎯 목적: Dialog 닫기
   */
  close = () => {
    this.props.state.set(undefined);
  };

  /**
   * 🎯 목적: Dialog 열릴 때 현재 레플리카 수 조회
   */
  onOpen = async (deployment: Deployment) => {
    this.ready = false;
    this.currentReplicas = await this.props.deploymentApi.getReplicas({
      namespace: deployment.getNs(),
      name: deployment.getName(),
    });
    this.desiredReplicas = this.currentReplicas;
    this.ready = true;
  };

  /**
   * 🎯 목적: Dialog 닫힐 때 상태 초기화
   */
  onClose = () => {
    this.ready = false;
  };

  /**
   * 🎯 목적: 원하는 레플리카 수 변경
   */
  onDesiredReplicasChange = (value: number) => {
    this.desiredReplicas = value;
  };

  /**
   * 🎯 목적: Scale 실행
   */
  scale = async (deployment: Deployment) => {
    const { currentReplicas, desiredReplicas, close } = this;

    try {
      if (currentReplicas !== desiredReplicas) {
        await this.props.deploymentApi.scale(
          {
            name: deployment.getName(),
            namespace: deployment.getNs(),
          },
          desiredReplicas,
        );

        // 🎯 FIX-038: clusterName을 metadata로만 전달 (description에서 제거)
        const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
        notificationPanelStore.addSuccess(
          "operations",
          "Deployment Scaled",
          `${deployment.getName()} scaled from ${currentReplicas} to ${desiredReplicas} replicas`,
          {
            actionType: "scale",
            resourceKind: "Deployment",
            resourceName: deployment.getName(),
            namespace: deployment.getNs(),
            clusterName,
          },
        );
      }
      close();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred while scaling Deployment";
      // 🆕 FIX-038: Add clusterName to error notification
      const clusterNameForError = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addError("operations", "Scale Failed", errorMsg, { clusterName: clusterNameForError });
    }
  };

  render() {
    const { state } = this.props;
    const deployment = state.get();
    const isOpen = Boolean(deployment);

    return (
      <ScaleDialog
        isOpen={isOpen}
        onClose={this.close}
        onScale={() => deployment && this.scale(deployment)}
        resourceType="Deployment"
        resourceName={deployment?.getName() ?? ""}
        currentReplicas={this.currentReplicas}
        desiredReplicas={this.desiredReplicas}
        onDesiredReplicasChange={this.onDesiredReplicasChange}
        ready={this.ready}
      />
    );
  }
}

export const DeploymentScaleDialog = withInjectables<Dependencies, DeploymentScaleDialogProps>(
  observer(NonInjectedDeploymentScaleDialog),
  {
    getProps: (di, props) => ({
      ...props,
      deploymentApi: di.inject(deploymentApiInjectable),
      state: di.inject(deploymentScaleDialogStateInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
