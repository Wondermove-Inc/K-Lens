/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { Spinner } from "@skuberplus/spinner";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { autorun, observable, runInAction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import secretStoreInjectable from "../../config-secrets/store.injectable";
import getDetailsUrlInjectable from "../../kube-detail-params/get-details-url.injectable";
import { ServiceAccountsSecret } from "./secret";

import type { Secret, ServiceAccount } from "@skuberplus/kube-object";

import type { SecretStore } from "../../config-secrets/store";
import type { GetDetailsUrl } from "../../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../../kube-object-details";

export interface ServiceAccountsDetailsProps extends KubeObjectDetailsProps<ServiceAccount> {}

interface Dependencies {
  secretStore: SecretStore;
  getDetailsUrl: GetDetailsUrl;
}

class NonInjectedServiceAccountsDetails extends Component<ServiceAccountsDetailsProps & Dependencies> {
  readonly secrets = observable.array<Secret | string>();
  readonly imagePullSecrets = observable.array<Secret | string>();

  private defensiveLoadSecretIn =
    (namespace: string) =>
    ({ name }: { name: string }) =>
      this.props.secretStore.load({ name, namespace }).catch(() => name);

  componentDidMount(): void {
    disposeOnUnmount(this, [
      autorun(async () => {
        runInAction(() => {
          this.secrets.clear();
          this.imagePullSecrets.clear();
        });

        const { object: serviceAccount } = this.props;
        const namespace = serviceAccount?.getNs();

        if (!namespace) {
          return;
        }

        const defensiveLoadSecret = this.defensiveLoadSecretIn(namespace);

        const secretLoaders = Promise.all(serviceAccount.getSecrets().map(defensiveLoadSecret));
        const imagePullSecretLoaders = Promise.all(serviceAccount.getImagePullSecrets().map(defensiveLoadSecret));
        const [secrets, imagePullSecrets] = await Promise.all([secretLoaders, imagePullSecretLoaders]);

        runInAction(() => {
          this.secrets.replace(secrets);
          this.imagePullSecrets.replace(imagePullSecrets);
        });
      }),
    ]);
  }

  renderSecrets() {
    const { secrets } = this;

    if (!secrets) {
      return <Spinner center />;
    }

    return secrets.map((secret) => (
      <ServiceAccountsSecret key={typeof secret === "string" ? secret : secret.getName()} secret={secret} />
    ));
  }

  renderImagePullSecrets() {
    const { imagePullSecrets } = this;

    if (!imagePullSecrets) {
      return <Spinner center />;
    }

    return this.renderSecretLinks(imagePullSecrets);
  }

  renderSecretLinks(secrets: (Secret | string)[]) {
    return secrets.map((secret) => {
      if (typeof secret === "string") {
        return (
          <div key={secret}>
            {secret}
            <Icon small material="warning" tooltip="Secret is not found" />
          </div>
        );
      }

      return (
        <Link key={secret.getId()} to={this.props.getDetailsUrl(secret.selfLink)}>
          {secret.getName()}
        </Link>
      );
    });
  }

  render() {
    const { object: serviceAccount, secretStore } = this.props;

    if (!serviceAccount) {
      return null;
    }
    const tokens = secretStore.items.filter(
      (secret) =>
        secret.getNs() == serviceAccount.getNs() &&
        secret
          .getAnnotations()
          .some((annot) => annot == `kubernetes.io/service-account.name: ${serviceAccount.getName()}`),
    );
    const imagePullSecrets = serviceAccount.getImagePullSecrets();

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ServiceAccountsDetails">
        {tokens.length > 0 && <DetailPanelField label="Tokens">{this.renderSecretLinks(tokens)}</DetailPanelField>}
        {imagePullSecrets.length > 0 && (
          <DetailPanelField label="ImagePullSecrets">{this.renderImagePullSecrets()}</DetailPanelField>
        )}

        <DetailPanelSection title="Mountable secrets">
          <div className="secrets">{this.renderSecrets()}</div>
        </DetailPanelSection>
      </div>
    );
  }
}

export const ServiceAccountsDetails = withInjectables<Dependencies, ServiceAccountsDetailsProps>(
  observer(NonInjectedServiceAccountsDetails),
  {
    getProps: (di, props) => ({
      ...props,
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      secretStore: di.inject(secretStoreInjectable),
    }),
  },
);
