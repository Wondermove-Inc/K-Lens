/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./priority-classes.scss";

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";

import type { PriorityClass } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface PriorityClassesDetailsProps extends KubeObjectDetailsProps<PriorityClass> {}

@observer
export class PriorityClassesDetails extends Component<PriorityClassesDetailsProps> {
  render() {
    const { object: pc } = this.props;

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="PriorityClassesDetails">
        <DetailPanelField label="Description">{pc.getDescription()}</DetailPanelField>

        <DetailPanelField label="Value">{pc.getValue()}</DetailPanelField>

        <DetailPanelField label="Global Default">{pc.getGlobalDefault()}</DetailPanelField>
      </div>
    );
  }
}
