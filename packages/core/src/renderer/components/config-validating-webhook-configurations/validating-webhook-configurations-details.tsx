/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { WebhookConfig } from "../config-mutating-webhook-configurations/webhook-config";

import type { ValidatingWebhookConfiguration } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface ValidatingWebhookProps extends KubeObjectDetailsProps<ValidatingWebhookConfiguration> {}

@observer
export class ValidatingWebhookDetails extends Component<ValidatingWebhookProps> {
  render() {
    const { object: webhookConfig } = this.props;

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ValidatingWebhookDetails">
        <DetailPanelField label="API version">{webhookConfig.apiVersion}</DetailPanelField>
        <DetailPanelSection title="Webhooks">
          {webhookConfig.getWebhooks()?.length == 0 && <div style={{ opacity: 0.6 }}>No webhooks set</div>}
          {webhookConfig.getWebhooks()?.map((webhook) => (
            <WebhookConfig webhook={webhook} key={webhook.name} />
          ))}
        </DetailPanelSection>
      </div>
    );
  }
}
