/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./helm-chart-details.scss";

import { styled, Tooltip } from "@mui/material";
import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { Spinner } from "@skuberplus/spinner";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { stopPropagation } from "@skuberplus/utilities";
import assert from "assert";
import autoBindReact from "auto-bind/react";
import { observer } from "mobx-react";
import React, { Component } from "react";
import createInstallChartTabInjectable from "../dock/install-chart/create-install-chart-tab.injectable";
import { Drawer } from "../drawer";
import { MarkdownViewer } from "../markdown-viewer";
import { Select } from "../select";
import readmeOfSelectHelmChartInjectable from "./details/readme-of-selected-helm-chart.injectable";
import helmChartDetailsVersionSelectionInjectable from "./details/versions/helm-chart-details-version-selection.injectable";
import versionsOfSelectedHelmChartInjectable from "./details/versions-of-selected-helm-chart.injectable";
import { HelmChartIcon } from "./icon";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { HelmChart } from "../../../common/k8s-api/endpoints/helm-charts.api";
import type { HelmChartDetailsVersionSelection } from "./details/versions/helm-chart-details-version-selection.injectable";

export interface HelmChartDetailsProps {
  hideDetails(): void;
  chart: HelmChart;
}

const LargeTooltip = styled(Tooltip)({
  tooltip: {
    fontSize: "var(--font-size-small)",
  },
});

interface Dependencies {
  createInstallChartTab: (helmChart: HelmChart) => void;
  versions: IAsyncComputed<HelmChart[]>;
  readme: IAsyncComputed<string>;
  versionSelection: HelmChartDetailsVersionSelection;
}

class NonInjectedHelmChartDetails extends Component<HelmChartDetailsProps & Dependencies> {
  constructor(props: HelmChartDetailsProps & Dependencies) {
    super(props);
    autoBindReact(this);
  }

  get chart() {
    return this.props.chart;
  }

  install() {
    const chart = this.props.versionSelection.value.get();

    assert(chart);

    this.props.createInstallChartTab(chart);
    this.props.hideDetails();
  }

  renderIntroduction(selectedChart: HelmChart) {
    const testId = selectedChart.getFullName("-");

    return (
      <div className="introduction flex align-flex-start">
        <HelmChartIcon imageUrl={selectedChart.getIcon()} className="intro-logo" />
        <div className="intro-contents box grow">
          <div className="description flex align-center justify-space-between" data-testid="selected-chart-description">
            {selectedChart.getDescription()}
            <Button primary label="Install" onClick={this.install} data-testid={`install-chart-for-${testId}`} />
          </div>
          {/* 🎯 shadcn DetailPanelField으로 마이그레이션 완료 */}
          <DetailPanelField label="Version">
            <div onClick={stopPropagation}>
              <Select
                id={`helm-chart-version-selector-${testId}`}
                themeName="outlined"
                menuPortalTarget={null}
                options={this.props.versionSelection.options.get()}
                formatOptionLabel={({ value: chart }) =>
                  chart.deprecated ? (
                    <LargeTooltip title="Deprecated" placement="left">
                      <span className="deprecated">{chart.version}</span>
                    </LargeTooltip>
                  ) : (
                    chart.version
                  )
                }
                isOptionDisabled={({ value: chart }) => chart.deprecated}
                value={this.props.versionSelection.value.get()}
                onChange={this.props.versionSelection.onChange}
              />
            </div>
          </DetailPanelField>
          <DetailPanelField label="Home">
            <a href={selectedChart.getHome()} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {selectedChart.getHome()}
            </a>
          </DetailPanelField>
          <DetailPanelField label="Maintainers">
            <ul className="maintainers">
              {selectedChart.getMaintainers().map(({ name, email }) => (
                <li key={name}>{`${name}<${email}>`}</li>
              ))}
            </ul>
          </DetailPanelField>
          {selectedChart.getKeywords().length > 0 && (
            <DetailPanelField label="Keywords">
              <div className="flex flex-wrap gap-1">
                {selectedChart.getKeywords().map((key) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}
                  </Badge>
                ))}
              </div>
            </DetailPanelField>
          )}
        </div>
      </div>
    );
  }

  renderReadme() {
    return (
      <div className="chart-description" data-testid="helmchart-readme">
        <MarkdownViewer markdown={this.props.readme.value.get()} />
      </div>
    );
  }

  renderContent() {
    const readmeIsLoading = this.props.readme.pending.get();
    const versionsAreLoading = this.props.versions.pending.get();

    if (!this.chart || versionsAreLoading) {
      return <Spinner center data-testid="spinner-for-chart-details" />;
    }

    return (
      <div className="box grow">
        {this.renderIntroduction(this.chart)}

        {readmeIsLoading ? <Spinner center data-testid="spinner-for-chart-readme" /> : this.renderReadme()}
      </div>
    );
  }

  render() {
    return (
      <Drawer
        className="HelmChartDetails"
        usePortal={true}
        open={!!this.chart}
        title={this.chart ? `Chart: ${this.chart.getFullName()}` : ""}
        onClose={this.props.hideDetails}
      >
        {this.renderContent()}
      </Drawer>
    );
  }
}

export const HelmChartDetails = withInjectables<Dependencies, HelmChartDetailsProps>(
  observer(NonInjectedHelmChartDetails),
  {
    getProps: (di, props) => ({
      ...props,
      createInstallChartTab: di.inject(createInstallChartTabInjectable),
      readme: di.inject(readmeOfSelectHelmChartInjectable, props.chart),
      versions: di.inject(versionsOfSelectedHelmChartInjectable, props.chart),
      versionSelection: di.inject(helmChartDetailsVersionSelectionInjectable, props.chart),
    }),
  },
);
