/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./namespace-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Namespace } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Spinner } from "@skuberplus/spinner";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { cssNames } from "@skuberplus/utilities";
import { computed, makeObservable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import limitRangeStoreInjectable from "../config-limit-ranges/store.injectable";
import resourceQuotaStoreInjectable from "../config-resource-quotas/store.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { NamespaceTreeView } from "./namespace-tree-view";
import namespaceStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { LimitRangeStore } from "../config-limit-ranges/store";
import type { ResourceQuotaStore } from "../config-resource-quotas/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { NamespaceStore } from "./store";

export interface NamespaceDetailsProps extends KubeObjectDetailsProps<Namespace> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  getDetailsUrl: GetDetailsUrl;
  resourceQuotaStore: ResourceQuotaStore;
  limitRangeStore: LimitRangeStore;
  namespaceStore: NamespaceStore;
  logger: Logger;
}

class NonInjectedNamespaceDetails extends Component<NamespaceDetailsProps & Dependencies> {
  constructor(props: NamespaceDetailsProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.resourceQuotaStore, this.props.limitRangeStore])]);
  }

  @computed get quotas() {
    const namespace = this.props.object.getName();

    return this.props.resourceQuotaStore.getAllByNs(namespace);
  }

  @computed get limitranges() {
    const namespace = this.props.object.getName();

    return this.props.limitRangeStore.getAllByNs(namespace);
  }

  render() {
    const { object: namespace, resourceQuotaStore, getDetailsUrl, limitRangeStore } = this.props;

    if (!namespace) {
      return null;
    }

    if (!(namespace instanceof Namespace)) {
      this.props.logger.error("[NamespaceDetails]: passed object that is not an instanceof Namespace", namespace);

      return null;
    }

    const status = namespace.getStatus();

    // 🎯 shadcn DetailPanelField으로 마이그레이션 완료
    return (
      <div className="NamespaceDetails">
        <DetailPanelField label="Status">
          <span className={cssNames("status", status.toLowerCase())}>{status}</span>
        </DetailPanelField>

        <DetailPanelField label="Resource Quotas">
          <div className="quotas flex align-center gap-2">
            {!this.quotas && resourceQuotaStore.isLoading && <Spinner />}
            {this.quotas.map(
              (quota) =>
                quota.selfLink && (
                  <Link key={quota.getId()} to={getDetailsUrl(quota.selfLink)} className="text-primary hover:underline">
                    {quota.getName()}
                  </Link>
                ),
            )}
          </div>
        </DetailPanelField>
        <DetailPanelField label="Limit Ranges">
          {!this.limitranges && limitRangeStore.isLoading && <Spinner />}
          {this.limitranges.map(
            (limitrange) =>
              limitrange.selfLink && (
                <Link
                  key={limitrange.getId()}
                  to={getDetailsUrl(limitrange.selfLink)}
                  className="text-primary hover:underline"
                >
                  {limitrange.getName()}
                </Link>
              ),
          )}
        </DetailPanelField>

        {namespace.isControlledByHNC() && (
          <NamespaceTreeView tree={this.props.namespaceStore.getNamespaceTree(namespace)} />
        )}
      </div>
    );
  }
}

export const NamespaceDetails = withInjectables<Dependencies, NamespaceDetailsProps>(
  observer(NonInjectedNamespaceDetails),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      limitRangeStore: di.inject(limitRangeStoreInjectable),
      resourceQuotaStore: di.inject(resourceQuotaStoreInjectable),
      namespaceStore: di.inject(namespaceStoreInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
