/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./pod-security-policy-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { PodSecurityPolicy } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Table, TableCell, TableHead, TableRow } from "../table";

import type { Logger } from "@skuberplus/logger";
import type { StrictReactNode } from "@skuberplus/utilities";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface PodSecurityPolicyDetailsProps extends KubeObjectDetailsProps<PodSecurityPolicy> {}

interface RuleGroup {
  rule: string;
  ranges?: {
    max: number;
    min: number;
  }[];
}

interface Dependencies {
  logger: Logger;
}

class NonInjectedPodSecurityPolicyDetails extends Component<PodSecurityPolicyDetailsProps & Dependencies> {
  // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
  renderRuleGroup(title: StrictReactNode, group: RuleGroup | undefined) {
    if (!group) return null;
    const { rule, ranges } = group;

    return (
      <DetailPanelSection title={title as string}>
        <DetailPanelField label="Rule">{rule}</DetailPanelField>
        {ranges && (
          <DetailPanelField label="Ranges (Min-Max)">
            <div className="flex flex-wrap gap-1">
              {ranges.map(({ min, max }, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {`${min} - ${max}`}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
      </DetailPanelSection>
    );
  }

  render() {
    const { object: psp } = this.props;

    if (!psp) {
      return null;
    }

    if (!(psp instanceof PodSecurityPolicy)) {
      this.props.logger.error(
        "[PodSecurityPolicyDetails]: passed object that is not an instanceof PodSecurityPolicy",
        psp,
      );

      return null;
    }

    const {
      allowedHostPaths,
      allowedCapabilities,
      allowedCSIDrivers,
      allowedFlexVolumes,
      allowedProcMountTypes,
      allowedUnsafeSysctls,
      allowPrivilegeEscalation,
      defaultAddCapabilities,
      forbiddenSysctls,
      fsGroup,
      hostIPC,
      hostNetwork,
      hostPID,
      hostPorts,
      privileged,
      readOnlyRootFilesystem,
      requiredDropCapabilities,
      runAsGroup,
      runAsUser,
      runtimeClass,
      seLinux,
      supplementalGroups,
      volumes,
    } = psp.spec;

    return (
      <div className="PodSecurityPolicyDetails">
        {allowedCapabilities && (
          <DetailPanelField label="Allowed Capabilities">{allowedCapabilities.join(", ")}</DetailPanelField>
        )}

        {volumes && <DetailPanelField label="Volumes">{volumes.join(", ")}</DetailPanelField>}

        {allowedCSIDrivers && (
          <DetailPanelField label="Allowed CSI Drivers">
            {allowedCSIDrivers.map(({ name }) => name).join(", ")}
          </DetailPanelField>
        )}

        {allowedFlexVolumes && (
          <DetailPanelField label="Allowed Flex Volumes">
            {allowedFlexVolumes.map(({ driver }) => driver).join(", ")}
          </DetailPanelField>
        )}

        {allowedProcMountTypes && (
          <DetailPanelField label="Allowed Proc Mount Types">{allowedProcMountTypes.join(", ")}</DetailPanelField>
        )}

        {allowedUnsafeSysctls && (
          <DetailPanelField label="Allowed Unsafe Sysctls">{allowedUnsafeSysctls.join(", ")}</DetailPanelField>
        )}

        {forbiddenSysctls && (
          <DetailPanelField label="Forbidden Sysctls">{forbiddenSysctls.join(", ")}</DetailPanelField>
        )}

        <DetailPanelField label="Allow Privilege Escalation">
          {allowPrivilegeEscalation ? "Yes" : "No"}
        </DetailPanelField>

        <DetailPanelField label="Privileged">{privileged ? "Yes" : "No"}</DetailPanelField>

        <DetailPanelField label="Read-only Root Filesystem">{readOnlyRootFilesystem ? "Yes" : "No"}</DetailPanelField>

        {defaultAddCapabilities && (
          <DetailPanelField label="Default Add Capabilities">{defaultAddCapabilities.join(", ")}</DetailPanelField>
        )}

        {requiredDropCapabilities && (
          <DetailPanelField label="Required Drop Capabilities">{requiredDropCapabilities.join(", ")}</DetailPanelField>
        )}

        <DetailPanelField label="Host IPC">{hostIPC ? "Yes" : "No"}</DetailPanelField>

        <DetailPanelField label="Host Network">{hostNetwork ? "Yes" : "No"}</DetailPanelField>

        <DetailPanelField label="Host PID">{hostPID ? "Yes" : "No"}</DetailPanelField>

        {hostPorts && (
          <DetailPanelField label="Host Ports (Min-Max)">
            <div className="flex flex-wrap gap-1">
              {hostPorts.map(({ min, max }, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {`${min} - ${max}`}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}

        {allowedHostPaths && (
          <DetailPanelSection title="Allowed Host Paths">
            <Table>
              <TableHead>
                <TableCell>Path Prefix</TableCell>
                <TableCell>Read-only</TableCell>
              </TableHead>
              {allowedHostPaths.map(({ pathPrefix, readOnly }, index) => (
                <TableRow key={index}>
                  <TableCell>{pathPrefix}</TableCell>
                  <TableCell>{readOnly ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </Table>
          </DetailPanelSection>
        )}

        {fsGroup && this.renderRuleGroup("Fs Group", fsGroup)}
        {runAsGroup && this.renderRuleGroup("Run As Group", runAsGroup)}
        {runAsUser && this.renderRuleGroup("Run As User", runAsUser)}
        {supplementalGroups && this.renderRuleGroup("Supplemental Groups", supplementalGroups)}

        {runtimeClass && (
          <DetailPanelSection title="Runtime Class">
            <DetailPanelField label="Allowed Runtime Class Names">
              {runtimeClass.allowedRuntimeClassNames?.join(", ") || "-"}
            </DetailPanelField>
            <DetailPanelField label="Default Runtime Class Name">
              {runtimeClass.defaultRuntimeClassName || "-"}
            </DetailPanelField>
          </DetailPanelSection>
        )}

        {seLinux && (
          <DetailPanelSection title="Se Linux">
            <DetailPanelField label="Rule">{seLinux.rule}</DetailPanelField>
            {seLinux.seLinuxOptions && (
              <>
                <DetailPanelField label="Level">{seLinux.seLinuxOptions.level}</DetailPanelField>
                <DetailPanelField label="Role">{seLinux.seLinuxOptions.role}</DetailPanelField>
                <DetailPanelField label="Type">{seLinux.seLinuxOptions.type}</DetailPanelField>
                <DetailPanelField label="User">{seLinux.seLinuxOptions.user}</DetailPanelField>
              </>
            )}
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const PodSecurityPolicyDetails = withInjectables<Dependencies, PodSecurityPolicyDetailsProps>(
  observer(NonInjectedPodSecurityPolicyDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
