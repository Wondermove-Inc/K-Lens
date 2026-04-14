/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./lease-details.scss";

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";

import type { Lease } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface LeaseDetailsProps extends KubeObjectDetailsProps<Lease> {}

@observer
export class LeaseDetails extends Component<LeaseDetailsProps> {
  render() {
    const { object: lease } = this.props;

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="LeaseDetails">
        <DetailPanelField label="Holder Identity">{lease.getHolderIdentity()}</DetailPanelField>

        <DetailPanelField label="Lease Duration Seconds">{lease.getLeaseDurationSeconds()}</DetailPanelField>

        {lease.getLeaseTransitions() !== undefined && (
          <DetailPanelField label="Lease Transitions">{lease.getLeaseTransitions()}</DetailPanelField>
        )}

        {lease.getAcquireTime() !== "" && (
          <DetailPanelField label="Acquire Time">{lease.getAcquireTime()}</DetailPanelField>
        )}

        <DetailPanelField label="Renew Time">{lease.getRenewTime()}</DetailPanelField>
      </div>
    );
  }
}
