/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { CustomResourceDefinition } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Input } from "../input";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { MonacoEditor } from "../monaco-editor";
import { Table, TableCell, TableHead, TableRow } from "../table";
import { WithTooltip } from "../with-tooltip";

import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface CustomResourceDefinitionDetailsProps extends KubeObjectDetailsProps<CustomResourceDefinition> {}

interface Dependencies {
  logger: Logger;
}

class NonInjectedCustomResourceDefinitionDetails extends Component<
  CustomResourceDefinitionDetailsProps & Dependencies
> {
  render() {
    const { object: crd } = this.props;

    if (!crd) {
      return null;
    }

    if (!(crd instanceof CustomResourceDefinition)) {
      this.props.logger.error(
        "[CustomResourceDefinitionDetails]: passed object that is not an instanceof CustomResourceDefinition",
        crd,
      );

      return null;
    }

    const { plural, singular, kind, listKind, shortNames } = crd.getNames();
    const printerColumns = crd.getPrinterColumns();
    const validation = crd.getValidation();

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="CustomResourceDefinitionDetails">
        <DetailPanelField label="Group">{crd.getGroup()}</DetailPanelField>
        <DetailPanelField label="Versions">
          {crd.getVersions()?.map((version, idx) => (
            <div key={idx}>
              {version}
              {version === crd.getVersion() && (
                <>
                  {" "}
                  <Icon small material="star" tooltip="Preferred Version" className="set_default_icon" />
                </>
              )}
            </div>
          ))}
        </DetailPanelField>
        <DetailPanelField label="Stored Versions">
          {crd
            .getStoredVersions()
            .split(", ")
            ?.map((version, idx) => (
              <div key={idx}>{version}</div>
            ))}
        </DetailPanelField>
        <DetailPanelField label="Scope">{crd.getScope()}</DetailPanelField>
        <DetailPanelField label="Resource">
          <Link to={crd.getResourceUrl()} className="text-primary hover:underline">
            {crd.getResourceTitle()}
          </Link>
        </DetailPanelField>
        <DetailPanelField label="Conversion">
          <Input multiLine theme="round-black" className="box grow" value={crd.getConversion()} readOnly />
        </DetailPanelField>
        <KubeObjectConditionsDrawer object={crd} />
        <DetailPanelSection title="Names">
          <Table selectable className="names box grow">
            <TableHead>
              <TableCell>plural</TableCell>
              <TableCell>singular</TableCell>
              <TableCell>kind</TableCell>
              <TableCell>listKind</TableCell>
              <TableCell>shortNames</TableCell>
            </TableHead>
            <TableRow>
              <TableCell>
                <WithTooltip>{plural}</WithTooltip>
              </TableCell>
              <TableCell>
                <WithTooltip>{singular}</WithTooltip>
              </TableCell>
              <TableCell>
                <WithTooltip>{kind}</WithTooltip>
              </TableCell>
              <TableCell>
                <WithTooltip>{listKind}</WithTooltip>
              </TableCell>
              <TableCell>
                <WithTooltip>{shortNames?.join(",")}</WithTooltip>
              </TableCell>
            </TableRow>
          </Table>
        </DetailPanelSection>
        {printerColumns.length > 0 && (
          <DetailPanelSection title="Additional Printer Columns">
            <Table selectable className="printer-columns box grow">
              <TableHead>
                <TableCell className="name">Name</TableCell>
                <TableCell className="type">Type</TableCell>
                <TableCell className="json-path">JSON Path</TableCell>
              </TableHead>
              {printerColumns.map((column, index) => {
                const { name, type, jsonPath } = column;

                return (
                  <TableRow key={index}>
                    <TableCell className="name">{name}</TableCell>
                    <TableCell className="type">{type}</TableCell>
                    <TableCell className="json-path">
                      <Badge variant="outline">{jsonPath}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          </DetailPanelSection>
        )}
        {validation && (
          <DetailPanelSection title="Validation">
            <MonacoEditor readOnly value={validation} style={{ height: 400 }} />
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const CustomResourceDefinitionDetails = withInjectables<Dependencies, CustomResourceDefinitionDetailsProps>(
  observer(NonInjectedCustomResourceDefinitionDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
