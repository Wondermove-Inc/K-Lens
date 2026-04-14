/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./ingress-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { computeRuleDeclarations, Ingress } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Table, TableCell, TableHead, TableRow } from "../table";

import type { ILoadBalancerIngress } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface IngressDetailsProps extends KubeObjectDetailsProps<Ingress> {}

interface Dependencies {
  logger: Logger;
}

class NonInjectedIngressDetails extends Component<IngressDetailsProps & Dependencies> {
  renderPaths(ingress: Ingress) {
    return ingress.getRules().map((rule, index) => (
      <div className="rules" key={index}>
        {rule.host && <div className="host-title">{`Host: ${rule.host}`}</div>}
        {rule.http && (
          <Table className="paths">
            <TableHead flat>
              <TableCell className="path">Path</TableCell>
              <TableCell className="link">Link</TableCell>
              <TableCell className="backends">Backends</TableCell>
            </TableHead>
            {computeRuleDeclarations(ingress, rule).map(({ displayAsLink, service, url, pathname }) => (
              <TableRow key={index}>
                <TableCell className="path">{pathname}</TableCell>
                <TableCell className="link">
                  {displayAsLink ? (
                    <a href={url} rel="noreferrer" target="_blank">
                      {url}
                    </a>
                  ) : (
                    url
                  )}
                </TableCell>
                <TableCell className="backends">{service}</TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>
    ));
  }

  renderIngressPoints(ingressPoints: ILoadBalancerIngress[]) {
    if (!ingressPoints || ingressPoints.length === 0) return null;

    return (
      <div>
        <Table className="ingress-points">
          <TableHead>
            <TableCell className="name">Hostname</TableCell>
            <TableCell className="ingresspoints">IP</TableCell>
          </TableHead>
          {ingressPoints.map(({ hostname, ip }, index) => (
            <TableRow key={index}>
              <TableCell className="name">{hostname ? hostname : "-"}</TableCell>
              <TableCell className="ingresspoints">{ip ? ip : "-"}</TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    );
  }

  render() {
    const { object: ingress, logger } = this.props;

    if (!ingress) {
      return null;
    }

    if (!(ingress instanceof Ingress)) {
      logger.error("[IngressDetails]: passed object that is not an instanceof Ingress", ingress);

      return null;
    }

    const port = ingress.getServiceNamePort();

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="IngressDetails">
        <DetailPanelField label="Ports">{ingress.getPorts()}</DetailPanelField>
        {ingress.spec.tls && (
          <DetailPanelField label="TLS">
            {ingress.spec.tls.map((tls, index) => (
              <p key={index}>{tls.secretName}</p>
            ))}
          </DetailPanelField>
        )}
        {port && <DetailPanelField label="Service">{`${port.serviceName}:${port.servicePort}`}</DetailPanelField>}
        <DetailPanelSection title="Rules">{this.renderPaths(ingress)}</DetailPanelSection>

        <DetailPanelSection title="Load-Balancer Ingress Points">
          {this.renderIngressPoints(ingress.status?.loadBalancer?.ingress ?? [])}
        </DetailPanelSection>
      </div>
    );
  }
}

export const IngressDetails = withInjectables<Dependencies, IngressDetailsProps>(observer(NonInjectedIngressDetails), {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
  }),
});
