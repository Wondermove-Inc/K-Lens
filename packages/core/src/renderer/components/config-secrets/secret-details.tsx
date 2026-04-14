/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./secret-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { Icon } from "@skuberplus/icon";
import { Secret } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { base64, toggle } from "@skuberplus/utilities";
import { autorun, makeObservable, observable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { Input } from "../input";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import secretStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { SecretStore } from "./store";

export interface SecretDetailsProps extends KubeObjectDetailsProps<Secret> {}

interface Dependencies {
  secretStore: SecretStore;
  logger: Logger;
  // 🆕 FIX-038: clusterName metadata 추가
  hostedCluster: Cluster | undefined;
}

class NonInjectedSecretDetails extends Component<SecretDetailsProps & Dependencies> {
  @observable isSaving = false;
  @observable data: Partial<Record<string, string>> = {};
  /** ObservableSet은 이미 observable이므로 @observable 데코레이터 제거 (HOC 체이닝 반응성 문제 해결) */
  revealSecret = observable.set<string>();

  constructor(props: SecretDetailsProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      autorun(() => {
        const { object: secret } = this.props;

        if (secret) {
          this.data = secret.data;
          this.revealSecret.clear();
        }
      }),
    ]);
  }

  saveSecret = () => {
    const { object: secret } = this.props;

    void (async () => {
      this.isSaving = true;

      try {
        await this.props.secretStore.update(secret, { ...secret, data: this.data });
        // 🆕 FIX-038: clusterName metadata 추가
        const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
        notificationPanelStore.addSuccess("operations", "Success", "Secret successfully updated.", { clusterName });
      } catch (err) {
        // 🆕 FIX-038: clusterName metadata 추가
        const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
        notificationPanelStore.addError(
          "operations",
          "Error",
          err instanceof Error ? err.message : "Unknown error occurred while updating the secret",
          { clusterName },
        );
      }
      this.isSaving = false;
    })();
  };

  editData = (name: string, value: string, encoded: boolean) => {
    this.data[name] = encoded ? value : base64.encode(value);
  };

  renderSecret = ([name, value]: [string, string | undefined]) => {
    let decodedVal: string | undefined;

    try {
      decodedVal = value ? base64.decode(value) : undefined;
    } catch {
      /**
       * The value failed to be decoded, so don't show the visibility
       * toggle until the value is saved
       */
      this.revealSecret.delete(name);
    }

    const revealSecret = this.revealSecret.has(name);

    if (revealSecret && typeof decodedVal === "string") {
      value = decodedVal;
    }

    return (
      <div key={name} className="data" data-testid={`${name}-secret-entry`}>
        <Badge variant="outline">{name}</Badge>
        <div className="flex gaps align-center">
          <Input
            multiLine
            theme="round-black"
            className="box grow"
            value={value || ""}
            onChange={(value) => this.editData(name, value, !revealSecret)}
          />
          {typeof decodedVal === "string" && (
            <Icon
              material={revealSecret ? "visibility" : "visibility_off"}
              tooltip={revealSecret ? "Hide" : "Show"}
              onClick={() => toggle(this.revealSecret, name)}
            />
          )}
        </div>
      </div>
    );
  };

  renderData() {
    const secrets = Object.entries(this.data);

    if (secrets.length === 0) {
      return null;
    }

    return (
      <DetailPanelSection title="Data">
        {secrets.map(this.renderSecret)}
        <Button primary label="Save" waiting={this.isSaving} className="save-btn" onClick={this.saveSecret} />
      </DetailPanelSection>
    );
  }

  // 🎯 shadcn DetailPanelField로 마이그레이션 완료
  render() {
    const { object: secret, logger } = this.props;

    if (!secret) {
      return null;
    }

    if (!(secret instanceof Secret)) {
      logger.error("[SecretDetails]: passed object that is not an instanceof Secret", secret);

      return null;
    }

    return (
      <div className="SecretDetails">
        <DetailPanelField label="Type">{secret.type}</DetailPanelField>
        {this.renderData()}
      </div>
    );
  }
}

export const SecretDetails = withInjectables<Dependencies, SecretDetailsProps>(observer(NonInjectedSecretDetails), {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
    secretStore: di.inject(secretStoreInjectable),
    // 🆕 FIX-038: hostedCluster DI 추가
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
