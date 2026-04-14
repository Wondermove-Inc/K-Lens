/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { hasTypedProperty, isObject, isString } from "@skuberplus/utilities";
import { computed, makeObservable, observable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import navigateToEntitySettingsInjectable from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import navigateToWelcomeInjectable from "../../../common/front-end-routing/routes/welcome/navigate-to-welcome.injectable";
import { ipcRendererOn } from "../../../common/ipc";
import requestClusterActivationInjectable from "../../../features/cluster/activation/renderer/request-activation.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import { LoadingOverlay } from "../shadcn-ui/loading-overlay";
import styles from "./cluster-status.module.scss";

import type { IClassName } from "@skuberplus/utilities";

import type { Cluster } from "../../../common/cluster/cluster";
import type { KubeAuthUpdate } from "../../../common/cluster-types";
import type { NavigateToEntitySettings } from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import type { RequestClusterActivation } from "../../../features/cluster/activation/common/request-token";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";

export interface ClusterStatusProps {
  className?: IClassName;
  cluster: Cluster;
}

interface Dependencies {
  navigateToEntitySettings: NavigateToEntitySettings;
  entityRegistry: CatalogEntityRegistry;
  requestClusterActivation: RequestClusterActivation;
  navigateToWelcome: () => void;
}

class NonInjectedClusterStatus extends Component<ClusterStatusProps & Dependencies> {
  @observable authOutput: KubeAuthUpdate[] = [];
  @observable isReconnecting = false;

  constructor(props: ClusterStatusProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  get cluster(): Cluster {
    return this.props.cluster;
  }

  @computed get entity() {
    return this.props.entityRegistry.getById(this.cluster.id);
  }

  @computed get hasErrorsOrWarnings(): boolean {
    return this.authOutput.some(({ level }) => level !== "info");
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      ipcRendererOn(`cluster:${this.cluster.id}:connection-update`, (evt, res: unknown) => {
        if (
          isObject(res) &&
          hasTypedProperty(res, "message", isString) &&
          hasTypedProperty(res, "level", function (val): val is KubeAuthUpdate["level"] {
            return ["info", "warning", "error"].includes(val as string);
          })
        ) {
          this.authOutput.push(res);
        } else {
          console.warn(`Got invalid connection update for ${this.cluster.id}`, { update: res });
        }
      }),
    ]);
  }

  componentDidUpdate(prevProps: Readonly<ClusterStatusProps>): void {
    if (prevProps.cluster.id !== this.props.cluster.id) {
      this.isReconnecting = false;
      this.authOutput = [];
    }
  }

  reconnect = async () => {
    this.authOutput = [];
    this.isReconnecting = true;

    try {
      await this.props.requestClusterActivation({
        clusterId: this.cluster.id,
        force: true,
      });
    } catch (error) {
      this.authOutput.push({
        message: String(error),
        level: "error",
      });
    } finally {
      this.isReconnecting = false;
    }
  };

  manageProxySettings = () => {
    this.props.navigateToEntitySettings(this.cluster.id, "proxy");
  };

  closeOverlay = () => {
    // 🎯 목적: 연결 실패 시 닫기 버튼을 누르면 Welcome으로 이동
    this.props.navigateToWelcome();
  };

  render() {
    // 🎯 목적: 항상 LoadingOverlay를 사용하여 로딩 화면 표시
    // 에러 발생 시에는 오버레이 안에 에러 메시지와 액션 버튼 표시
    return (
      <div className={styles.status}>
        <LoadingOverlay
          isVisible={true}
          title={`Connecting ${this.entity?.getName() ?? this.cluster.name.get()}...`}
          messages={this.authOutput}
          width="400px"
          size="lg"
          showActions={this.hasErrorsOrWarnings}
          anchor="parent"
          message={this.authOutput.length === 0 ? "Connecting..." : undefined}
          dimmed={false}
          onReconnect={this.hasErrorsOrWarnings ? this.reconnect : undefined}
          onClose={this.hasErrorsOrWarnings ? this.closeOverlay : undefined}
        />
      </div>
    );
  }
}

export const ClusterStatus = withInjectables<Dependencies, ClusterStatusProps>(observer(NonInjectedClusterStatus), {
  getProps: (di, props) => ({
    ...props,
    navigateToEntitySettings: di.inject(navigateToEntitySettingsInjectable),
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    requestClusterActivation: di.inject(requestClusterActivationInjectable),
    navigateToWelcome: di.inject(navigateToWelcomeInjectable),
  }),
});
