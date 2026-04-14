/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./config-map-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { ConfigMap } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerTitle 대체
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { autorun, makeObservable, observable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { MonacoEditor } from "../monaco-editor";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import configMapStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { ConfigMapStore } from "./store";

export interface ConfigMapDetailsProps extends KubeObjectDetailsProps<ConfigMap> {}

interface Dependencies {
  configMapStore: ConfigMapStore;
  logger: Logger;
  // 🆕 FIX-038: hostedCluster DI 추가
  hostedCluster: HostedCluster | undefined;
}

class NonInjectedConfigMapDetails extends Component<ConfigMapDetailsProps & Dependencies> {
  @observable isSaving = false;
  @observable data = observable.map<string, string | undefined>();

  constructor(props: ConfigMapDetailsProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      autorun(() => {
        const { object: configMap } = this.props;

        if (configMap) {
          this.data.replace(configMap.data); // refresh
        }
      }),
    ]);
  }

  save = () => {
    const { object: configMap, configMapStore } = this.props;

    void (async () => {
      try {
        this.isSaving = true;
        await configMapStore.update(configMap, {
          ...configMap,
          data: Object.fromEntries(this.data),
        });
        notificationPanelStore.addSuccess(
          "operations",
          "Success",
          `ConfigMap ${configMap.getName()} successfully updated.`,
        );
      } catch (error) {
        // 🆕 FIX-038: clusterName 추가
        const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
        notificationPanelStore.addError("operations", "Error", `Failed to save config map: ${String(error)}`, {
          clusterName,
        });
      } finally {
        this.isSaving = false;
      }
    })();
  };

  render() {
    const { object: configMap, logger } = this.props;

    if (!configMap) {
      return null;
    }

    if (!(configMap instanceof ConfigMap)) {
      logger.error("[ConfigMapDetails]: passed object that is not an instanceof ConfigMap", configMap);

      return null;
    }

    const data = Array.from(this.data.entries());

    return (
      <div className="ConfigMapDetails">
        {/* 🎯 shadcn DetailPanelSection으로 마이그레이션 완료 */}
        {data.length > 0 && (
          <DetailPanelSection title="Data">
            {data.map(([name, value = ""]) => (
              <div key={name} className="data">
                <Badge variant="outline">{name}</Badge>
                <MonacoEditor
                  id={`config-map-data-${name}`}
                  style={{
                    resize: "vertical",
                    overflow: "hidden",
                    border: "1px solid var(--borderFaintColor)",
                    borderRadius: "4px",
                  }}
                  value={value}
                  onChange={(v) => this.data.set(name, v)}
                  setInitialHeight
                  options={{
                    scrollbar: {
                      alwaysConsumeMouseWheel: false,
                    },
                  }}
                />
              </div>
            ))}
            <Button primary label="Save" waiting={this.isSaving} className="save-btn" onClick={this.save} />
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const ConfigMapDetails = withInjectables<Dependencies, ConfigMapDetailsProps>(
  observer(NonInjectedConfigMapDetails),
  {
    getProps: (di, props) => ({
      ...props,
      configMapStore: di.inject(configMapStoreInjectable),
      logger: di.inject(loggerInjectionToken),
      // 🆕 FIX-038: hostedCluster DI 추가
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
