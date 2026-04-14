/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Chart 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - Install 버튼을 headerActions로 제공 (Storybook Extension 패턴)
 *   - Version 선택, README, Maintainers, Keywords 정보 표시
 * 🔄 변경이력:
 *   - 2025-11-07: 초기 생성 (shadcn DetailPanel 기반, ReleaseDetailPanel 패턴 참조)
 */

import { Tooltip } from "@mui/material";
import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
import { Button, Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import assert from "assert";
import { Download } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { DetailPanel } from "../common/detail-panel";
import createInstallChartTabInjectable from "../dock/install-chart/create-install-chart-tab.injectable";
import { MarkdownViewer } from "../markdown-viewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shadcn-ui/select";
import readmeOfSelectHelmChartInjectable from "./details/readme-of-selected-helm-chart.injectable";
import helmChartDetailsVersionSelectionInjectable from "./details/versions/helm-chart-details-version-selection.injectable";
import versionsOfSelectedHelmChartInjectable from "./details/versions-of-selected-helm-chart.injectable";
import { HelmChartIcon } from "./icon";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { HelmChart } from "../../../common/k8s-api/endpoints/helm-charts.api";
import type { HelmChartDetailsVersionSelection } from "./details/versions/helm-chart-details-version-selection.injectable";

/**
 * 🎯 목적: HelmChartDetailPanel Props 인터페이스
 */
export interface HelmChartDetailPanelProps {
  /**
   * 표시할 Helm Chart 객체
   */
  chart: HelmChart | undefined;

  /**
   * 패널 닫기 콜백
   */
  hideDetails: () => void;
}

interface Dependencies {
  createInstallChartTab: (helmChart: HelmChart) => void;
  versions: IAsyncComputed<HelmChart[]>;
  readme: IAsyncComputed<string>;
  versionSelection: HelmChartDetailsVersionSelection;
}

/**
 * 🎯 목적: Helm Chart 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param chart - 표시할 Helm Chart 객체
 * @param hideDetails - 패널 닫기 콜백
 */
const NonInjectedHelmChartDetailPanel = observer(
  ({
    chart,
    hideDetails,
    createInstallChartTab,
    versions,
    readme,
    versionSelection,
  }: HelmChartDetailPanelProps & Dependencies) => {
    if (!chart) {
      return null;
    }

    // ============================================
    // 🎯 Install 버튼 클릭 핸들러
    // ============================================
    const handleInstall = () => {
      const selectedChart = versionSelection.value.get();

      assert(selectedChart);

      createInstallChartTab(selectedChart);
      hideDetails();
    };

    // 🎯 Chart 속성 데이터 추출
    const name = chart.getName();
    const repository = chart.getRepository();
    const description = chart.getDescription();
    const home = chart.getHome();
    const maintainers = chart.getMaintainers();
    const keywords = chart.getKeywords();

    // 🎯 로딩 상태 확인
    const readmeIsLoading = readme.pending.get();
    const versionsAreLoading = versions.pending.get();
    const selectedChart = versionSelection.value.get();

    return (
      <DetailPanel
        isOpen={!!chart}
        onClose={hideDetails}
        title={`Chart: ${name}`}
        subtitle={`Repository: ${repository}`}
        object={{ kind: "HelmChart", apiVersion: "v1" }}
      >
        {versionsAreLoading ? (
          <Spinner center data-testid="spinner-for-chart-details" />
        ) : (
          <div className="space-y-4">
            {/* ============================================ */}
            {/* 🎯 Install 버튼 + Version 선택 */}
            {/* ============================================ */}
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
              {/* Version 선택 드롭다운 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Version:</span>
                <Select
                  value={selectedChart?.version || ""}
                  onValueChange={(version) => {
                    const option = versionSelection.options.get().find((opt) => opt.value.version === version);
                    if (option) {
                      versionSelection.onChange(option);
                    }
                  }}
                >
                  <SelectTrigger id={`helm-chart-version-selector-${chart.getFullName("-")}`} className="w-[180px]">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionSelection.options.get().map(({ label, value: chartOption }) => (
                      <SelectItem
                        key={chartOption.version}
                        value={chartOption.version}
                        disabled={chartOption.deprecated}
                      >
                        {chartOption.deprecated ? (
                          <Tooltip title="Deprecated" placement="left">
                            <span className="text-muted-foreground line-through">{label}</span>
                          </Tooltip>
                        ) : (
                          label
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Install 버튼 */}
              <Button
                variant="default"
                size="sm"
                onClick={handleInstall}
                data-testid={`install-chart-for-${chart.getFullName("-")}`}
              >
                <Download className="h-4 w-4" />
                Install
              </Button>
            </div>

            {/* ============================================ */}
            {/* 🖼️ Chart 아이콘 + 설명 */}
            {/* ============================================ */}
            <div className="flex items-center gap-4">
              <HelmChartIcon imageUrl={chart.getIcon()} className="w-16 h-16 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-foreground" data-testid="selected-chart-description">
                  {description}
                </p>
              </div>
            </div>

            {/* ============================================ */}
            {/* 📋 Chart 정보 테이블 */}
            {/* ============================================ */}
            <div>
              <h3 className="text-foreground text-base font-medium mb-2">Chart Information</h3>
              <Table>
                <TableBody>
                  {/* Home */}
                  {home && (
                    <TableRow>
                      <TableCell className="border-border border-b px-2 py-[14px] w-[180px]">
                        <span className="text-foreground text-sm">Home</span>
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <a
                          href={home}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-sm hover:underline"
                        >
                          {home}
                        </a>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Maintainers */}
                  {maintainers.length > 0 && (
                    <TableRow>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <span className="text-foreground text-sm">Maintainers</span>
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <ul className="list-none space-y-1">
                          {maintainers.map(({ name, email }) => (
                            <li key={name} className="text-foreground text-sm">
                              {name}
                              {email && ` <${email}>`}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Keywords */}
                  {keywords.length > 0 && (
                    <TableRow>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <span className="text-foreground text-sm">Keywords</span>
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((key) => (
                            <Badge key={key} variant="outline">
                              {key}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ============================================ */}
            {/* 📄 README */}
            {/* ============================================ */}
            <div>
              <h3 className="text-foreground text-base font-medium mb-2">README</h3>
              {readmeIsLoading ? (
                <Spinner center data-testid="spinner-for-chart-readme" />
              ) : (
                <div className="prose prose-sm max-w-none" data-testid="helmchart-readme">
                  <MarkdownViewer markdown={readme.value.get()} />
                </div>
              )}
            </div>
          </div>
        )}
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 Helm Chart Detail Panel
 */
export const HelmChartDetailPanel = withInjectables<Dependencies, HelmChartDetailPanelProps>(
  NonInjectedHelmChartDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      createInstallChartTab: di.inject(createInstallChartTabInjectable),
      readme: props.chart ? di.inject(readmeOfSelectHelmChartInjectable, props.chart) : ({} as any),
      versions: props.chart ? di.inject(versionsOfSelectedHelmChartInjectable, props.chart) : ({} as any),
      versionSelection: props.chart ? di.inject(helmChartDetailsVersionSelectionInjectable, props.chart) : ({} as any),
    }),
  },
);
