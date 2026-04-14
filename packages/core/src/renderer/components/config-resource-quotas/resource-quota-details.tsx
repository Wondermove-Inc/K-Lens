/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./resource-quota-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { ResourceQuota } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import {
  cpuUnitsToNumber,
  cssNames,
  hasDefinedTupleValue,
  metricUnitsToNumber,
  object,
  unitsToBytes,
} from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { LineProgress } from "../line-progress";
import { Table, TableCell, TableHead, TableRow } from "../table";

import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface ResourceQuotaDetailsProps extends KubeObjectDetailsProps<ResourceQuota> {}

function transformUnit(name: string, value: string): number | undefined {
  if (name.includes("memory") || name.includes("storage")) {
    return unitsToBytes(value);
  }

  if (name.includes("cpu")) {
    return cpuUnitsToNumber(value);
  }

  return metricUnitsToNumber(value);
}

function renderQuotas(quota: ResourceQuota): JSX.Element[] {
  const { hard = {}, used = {} } = quota.status ?? {};

  return object
    .entries(hard)
    .filter(hasDefinedTupleValue)
    .map(([name, rawMax]) => {
      const rawCurrent = used[name] ?? "0";
      const current = transformUnit(name, rawCurrent);
      const max = transformUnit(name, rawMax);

      if (current === undefined || max === undefined) {
        return (
          <div key={name} className={cssNames("param", kebabCase(name))}>
            <span className="title">{name}</span>
            <Badge variant="secondary">{`${rawCurrent} / ${rawMax}`}</Badge>
          </div>
        );
      }

      const usage =
        max === 0
          ? 100 // special case 0 max as always 100% usage
          : (current / max) * 100;

      return (
        <div key={name} className={cssNames("param", kebabCase(name))}>
          <span className="title">{name}</span>
          <Badge variant="secondary">{`${rawCurrent} / ${rawMax}`}</Badge>
          <LineProgress max={max} value={current} tooltip={<p>{`Set: ${rawMax}. Usage: ${+usage.toFixed(2)}%`}</p>} />
        </div>
      );
    });
}

interface Dependencies {
  logger: Logger;
}

class NonInjectedResourceQuotaDetails extends Component<ResourceQuotaDetailsProps & Dependencies> {
  render() {
    const { object: quota } = this.props;

    if (!quota) {
      return null;
    }

    if (!(quota instanceof ResourceQuota)) {
      this.props.logger.error("[ResourceQuotaDetails]: passed object that is not an instanceof ResourceQuota", quota);

      return null;
    }

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ResourceQuotaDetails">
        <DetailPanelField label="Quotas">
          <div className="quota-list">{renderQuotas(quota)}</div>
        </DetailPanelField>

        {quota.getScopeSelector().length > 0 && (
          <DetailPanelSection title="Scope Selector">
            <Table className="paths">
              <TableHead>
                <TableCell>Operator</TableCell>
                <TableCell>Scope name</TableCell>
                <TableCell>Values</TableCell>
              </TableHead>
              {quota.getScopeSelector().map((selector, index) => {
                const { operator, scopeName, values } = selector;

                return (
                  <TableRow key={index}>
                    <TableCell>{operator}</TableCell>
                    <TableCell>{scopeName}</TableCell>
                    <TableCell>{values.join(", ")}</TableCell>
                  </TableRow>
                );
              })}
            </Table>
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const ResourceQuotaDetails = withInjectables<Dependencies, ResourceQuotaDetailsProps>(
  observer(NonInjectedResourceQuotaDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
