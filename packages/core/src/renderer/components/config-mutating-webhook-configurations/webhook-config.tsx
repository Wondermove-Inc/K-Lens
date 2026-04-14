/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";
import styles from "./webhook-config.module.css";

import type { Webhook } from "@skuberplus/kube-object";

interface WebhookProps {
  webhook: Webhook;
}

// 🎯 shadcn DetailPanelField로 마이그레이션 완료
export const WebhookConfig: React.FC<WebhookProps> = ({ webhook }) => {
  return (
    <>
      <DetailPanelField label="Name" className={styles.firstItem}>
        <strong>{webhook.name}</strong>
      </DetailPanelField>
      <DetailPanelField label="Client Config">
        {webhook.clientConfig?.service?.name && (
          <div>
            <div>Name: {webhook.clientConfig.service.name}</div>
            <div>Namespace: {webhook.clientConfig.service.namespace}</div>
          </div>
        )}
      </DetailPanelField>
      <DetailPanelField label="Match Policy">{webhook.matchPolicy}</DetailPanelField>
      <DetailPanelField label="Failure Policy">{webhook.failurePolicy}</DetailPanelField>
      <DetailPanelField label="Admission Review Versions">
        {webhook.admissionReviewVersions?.join(", ")}
      </DetailPanelField>
      {webhook.reinvocationPolicy && (
        <DetailPanelField label="Reinvocation Policy">{webhook.reinvocationPolicy}</DetailPanelField>
      )}
      <DetailPanelField label="Side Effects">{webhook.sideEffects}</DetailPanelField>
      <DetailPanelField label="Timeout Seconds">{webhook.timeoutSeconds}</DetailPanelField>
      <DetailPanelField label="Namespace Selector">
        {webhook.namespaceSelector && (
          <div>
            <div>Match Expressions:</div>
            {webhook.namespaceSelector.matchExpressions?.map((expression, index) => (
              <div key={index}>
                <div>Key: {expression.key}</div>
                <div>Operator: {expression.operator}</div>
                <div>Values: {expression.values?.join(", ")}</div>
              </div>
            ))}
            {webhook.namespaceSelector.matchLabels && (
              <div>
                <div>Match Labels:</div>
                <div className={styles.matchLabels}>
                  {Object.entries(webhook.namespaceSelector.matchLabels).map(([key, value], index) => (
                    <Badge variant="outline" key={index}>{`${key}=${value ?? ""}`}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailPanelField>
      <DetailPanelField label="Object Selector">
        {webhook.objectSelector && (
          <div>
            <div>Match Expressions:</div>
            {webhook.objectSelector.matchExpressions?.map((expression, index) => (
              <div key={index}>
                <div>Key: {expression.key}</div>
                <div>Operator: {expression.operator}</div>
                <div>Values: {expression.values?.join(", ")}</div>
              </div>
            ))}
            {webhook.objectSelector.matchLabels && (
              <div>
                <div>Match Labels:</div>
                <div className={styles.matchLabels}>
                  {Object.entries(webhook.objectSelector.matchLabels).map(([key, value], index) => (
                    <Badge variant="outline" key={index}>{`${key}=${value ?? ""}`}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailPanelField>
      <DetailPanelField label="Rules" className={styles.lastItem}>
        {webhook.rules?.map((rule, index) => (
          <div key={index}>
            <div>API Groups: {rule.apiGroups.join(", ")}</div>
            <div>API Versions: {rule.apiVersions?.join(", ")}</div>
            <div>Operations: {rule.operations.join(", ")}</div>
            {rule.resources && <div>Resources: {rule.resources.join(", ")}</div>}
            {rule.scope && <div>Scope: {rule.scope}</div>}
          </div>
        ))}
      </DetailPanelField>
    </>
  );
};
