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

import type { Role } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../../kube-object-details";

export interface RoleDetailsProps extends KubeObjectDetailsProps<Role> {}

@observer
export class RoleDetails extends Component<RoleDetailsProps> {
  render() {
    const { object: role } = this.props;

    if (!role) return null;
    const rules = role.getRules();

    // 🎯 shadcn DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="RoleDetails">
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
