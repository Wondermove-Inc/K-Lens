/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./runtime-classes.scss";

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { RuntimeClassDetailsTolerations } from "./runtime-classes-details-tolerations";

import type { RuntimeClass } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface RuntimeClassesDetailsProps extends KubeObjectDetailsProps<RuntimeClass> {}

@observer
export class RuntimeClassesDetails extends Component<RuntimeClassesDetailsProps> {
  render() {
    const { object: rc } = this.props;
    const nodeSelector = rc.getNodeSelectors();

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="RuntimeClassesDetails">
        <DetailPanelField label="Handler">{rc.getHandler()}</DetailPanelField>

        {rc.getPodFixed() !== "" && <DetailPanelField label="Pod Fixed">{rc.getPodFixed()}</DetailPanelField>}

        {nodeSelector.length > 0 && (
          <DetailPanelField label="Node Selector">
            <div className="flex flex-wrap gap-1">
              {nodeSelector.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}

        <RuntimeClassDetailsTolerations runtimeClass={rc} />
      </div>
    );
  }
}
