/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { stopPropagation } from "@skuberplus/utilities";
import { makeObservable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import getDetailsUrlInjectable, { type GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import styles from "./ingress-class-details.module.scss";

import type { IngressClass } from "@skuberplus/kube-object";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface IngressClassDetailsProps extends KubeObjectDetailsProps<IngressClass> {}

interface Dependencies {
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
}

class NonInjectedIngressDetails extends Component<IngressClassDetailsProps & Dependencies> {
  constructor(props: IngressClassDetailsProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  renderParameters() {
    const { object: ingressClass } = this.props;

    if (!ingressClass.spec.parameters) return;

    const url =
      ingressClass.spec.parameters &&
      this.props.getDetailsUrl(this.props.apiManager.lookupApiLink(ingressClass.spec.parameters));

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <DetailPanelSection title="Parameters">
        <DetailPanelField label="Name">
          {url ? (
            <Link key="link" to={url} onClick={stopPropagation} className="text-primary hover:underline">
              {ingressClass.getCtrlName()}
            </Link>
          ) : (
            ingressClass.getCtrlName()
          )}
        </DetailPanelField>
        {ingressClass.getCtrlNs() && <DetailPanelField label="Namespace">{ingressClass.getCtrlNs()}</DetailPanelField>}
        <DetailPanelField label="Scope">{ingressClass.getCtrlScope()}</DetailPanelField>
        <DetailPanelField label="Kind">{ingressClass.getCtrlKind()}</DetailPanelField>
        <DetailPanelField label="API Group">{ingressClass.getCtrlApiGroup()}</DetailPanelField>
      </DetailPanelSection>
    );
  }

  render() {
    const { object: ingressClass } = this.props;

    return (
      <div className={styles.IngressClassDetails}>
        <DetailPanelField label="Controller">
          <Badge variant="outline">{ingressClass.getController()}</Badge>
        </DetailPanelField>
        {this.renderParameters()}
      </div>
    );
  }
}

export const IngressClassDetails = withInjectables<Dependencies, IngressClassDetailsProps>(
  observer(NonInjectedIngressDetails),
  {
    getProps: (di, props) => ({
      ...props,
      apiManager: di.inject(apiManagerInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
    }),
  },
);
