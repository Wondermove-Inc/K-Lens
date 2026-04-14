/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./details.scss";

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerTitle 대체
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";

import type { ClusterRole } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../../kube-object-details";

export interface ClusterRoleDetailsProps extends KubeObjectDetailsProps<ClusterRole> {}

@observer
export class ClusterRoleDetails extends Component<ClusterRoleDetailsProps> {
  render() {
    const { object: clusterRole } = this.props;

    if (!clusterRole) return null;
    const rules = clusterRole.getRules();

    // 🎯 shadcn DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ClusterRoleDetails">
        <DetailPanelSection title="Rules">
          {rules.map(({ resourceNames, apiGroups, resources, verbs }, index) => {
            return (
              <div className="rule" key={index}>
                {resources && (
                  <>
                    <div className="name">Resources</div>
                    <Badge variant="secondary">{resources.join(", ")}</Badge>
                  </>
                )}
                {verbs && (
                  <>
                    <div className="name">Verbs</div>
                    <Badge variant="secondary">{verbs.join(", ")}</Badge>
                  </>
                )}
                {apiGroups && (
                  <>
                    <div className="name">Api Groups</div>
                    <Badge variant="secondary">
                      {apiGroups.map((apiGroup) => (apiGroup === "" ? `'${apiGroup}'` : apiGroup)).join(", ")}
                    </Badge>
                  </>
                )}
                {resourceNames && (
                  <>
                    <div className="name">Resource Names</div>
                    <Badge variant="secondary">{resourceNames.join(", ")}</Badge>
                  </>
                )}
              </div>
            );
          })}
        </DetailPanelSection>
      </div>
    );
  }
}
