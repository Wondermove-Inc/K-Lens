/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { NetworkPolicy } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { isEmpty } from "lodash";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { SubTitle } from "../layout/sub-title";
import styles from "./network-policy-details.module.scss";

import type {
  LabelMatchExpression,
  LabelSelector,
  NetworkPolicyPeer,
  NetworkPolicyPort,
  PolicyIpBlock,
} from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface NetworkPolicyDetailsProps extends KubeObjectDetailsProps<NetworkPolicy> {}

interface Dependencies {
  logger: Logger;
}

class NonInjectedNetworkPolicyDetails extends Component<NetworkPolicyDetailsProps & Dependencies> {
  renderIPolicyIpBlock(ipBlock: PolicyIpBlock | undefined) {
    if (!ipBlock) {
      return null;
    }

    const { cidr, except = [] } = ipBlock;

    if (!cidr) {
      return null;
    }

    const items = [`cidr: ${cidr}`];

    if (except.length > 0) {
      items.push(`except: ${except.join(", ")}`);
    }

    return <DetailPanelField label="ipBlock">{items.join(", ")}</DetailPanelField>;
  }

  renderMatchLabels(matchLabels: Record<string, string | undefined> | undefined) {
    if (!matchLabels) {
      return null;
    }

    return Object.entries(matchLabels).map(([key, value]) => <li key={key}>{`${key}: ${value ?? ""}`}</li>);
  }

  renderMatchExpressions(matchExpressions: LabelMatchExpression[] | undefined) {
    if (!matchExpressions) {
      return null;
    }

    return matchExpressions.map((expr) => {
      switch (expr.operator) {
        case "DoesNotExist":
        case "Exists":
          return <li key={expr.key}>{`${expr.key} (${expr.operator})`}</li>;
        case "In":
        case "NotIn":
          return (
            <li key={expr.key}>
              {`${expr.key} (${expr.operator})`}
              <ul>
                {expr.values.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            </li>
          );
      }
    });
  }

  renderIPolicySelector(name: string, selector: LabelSelector | undefined) {
    if (!selector) {
      return null;
    }

    const { matchLabels, matchExpressions } = selector;

    return (
      <DetailPanelField label={name}>
        <ul className={styles.policySelectorList}>
          {this.renderMatchLabels(matchLabels)}
          {this.renderMatchExpressions(matchExpressions)}
          {isEmpty(matchLabels) && isEmpty(matchExpressions) && <li>(empty)</li>}
        </ul>
      </DetailPanelField>
    );
  }

  renderNetworkPolicyPeers(name: string, peers: NetworkPolicyPeer[] | undefined) {
    if (!peers) {
      return null;
    }

    return (
      <>
        <SubTitle className={styles.networkPolicyPeerTitle} title={name} />
        {peers.map((peer, index) => (
          <div key={index} className={styles.networkPolicyPeer}>
            {this.renderIPolicyIpBlock(peer.ipBlock)}
            {this.renderIPolicySelector("namespaceSelector", peer.namespaceSelector)}
            {this.renderIPolicySelector("podSelector", peer.podSelector)}
          </div>
        ))}
      </>
    );
  }

  renderNetworkPolicyPorts(ports: NetworkPolicyPort[] | undefined) {
    if (!ports) {
      return null;
    }

    return (
      <DetailPanelField label="Ports">
        <ul>
          {ports.map(({ protocol = "TCP", port = "<all>", endPort }, index) => (
            <li key={index}>
              {protocol}:{port}
              {typeof endPort === "number" && `:${endPort}`}
            </li>
          ))}
        </ul>
      </DetailPanelField>
    );
  }

  render() {
    const { object: policy } = this.props;

    if (!policy) {
      return null;
    }

    if (!(policy instanceof NetworkPolicy)) {
      this.props.logger.error("[NetworkPolicyDetails]: passed object that is not an instanceof NetworkPolicy", policy);

      return null;
    }

    const { ingress, egress } = policy.spec;
    const selector = policy.getMatchLabels();

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className={styles.NetworkPolicyDetails}>
        <DetailPanelField label="Pod Selector">
          {selector.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {policy.getMatchLabels().map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            `(empty) (Allowing the specific traffic to all pods in this namespace)`
          )}
        </DetailPanelField>

        {ingress && (
          <DetailPanelSection title="Ingress">
            {ingress.map((ingress, i) => (
              <div key={i} data-testid={`ingress-${i}`}>
                {this.renderNetworkPolicyPorts(ingress.ports)}
                {this.renderNetworkPolicyPeers("From", ingress.from)}
              </div>
            ))}
          </DetailPanelSection>
        )}

        {egress && (
          <DetailPanelSection title="Egress">
            {egress.map((egress, i) => (
              <div key={i} data-testid={`egress-${i}`}>
                {this.renderNetworkPolicyPorts(egress.ports)}
                {this.renderNetworkPolicyPeers("To", egress.to)}
              </div>
            ))}
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const NetworkPolicyDetails = withInjectables<Dependencies, NetworkPolicyDetailsProps>(
  observer(NonInjectedNetworkPolicyDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
