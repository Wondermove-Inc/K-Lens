/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 THEME-011: activeTheme injectable 제거
 * 📝 CSS 변수 기반 상태 색상으로 마이그레이션
 */
import "./overview-workload-status.scss";

import { object } from "@skuberplus/utilities";
import capitalize from "lodash/capitalize";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { getChartColors, watchChartThemeChange } from "../../utils/chart-colors";
import { PieChart } from "../chart";

import type { PascalCase } from "type-fest";

import type { ChartColors } from "../../utils/chart-colors";
import type { PieChartData } from "../chart";
import type { Workload } from "./workloads/workload-injection-token";

export type LowercaseOrPascalCase<T extends string> = Lowercase<T> | PascalCase<T>;

export type WorkloadStatus = Partial<Record<LowercaseOrPascalCase<keyof typeof statusBackgroundColorMapping>, number>>;

function toLowercase<T extends string>(src: T): Lowercase<T> {
  return src.toLowerCase() as Lowercase<T>;
}

export interface OverviewWorkloadStatusProps {
  workload: Workload;
}

/**
 * 🎯 THEME-011: 상태별 배경 색상 매핑
 * CSS 변수 기반 색상 사용
 */
const statusBackgroundColorMapping = {
  running: "colorOk",
  scheduled: "colorOk",
  pending: "colorWarning",
  suspended: "colorWarning",
  evicted: "colorError",
  succeeded: "colorSuccess",
  failed: "colorError",
  terminating: "colorTerminated",
  finalizing: "colorTerminated",
  terminated: "colorTerminated",
  unknown: "colorVague",
  complete: "colorSuccess",
} as const;

/**
 * 🎯 THEME-011: CSS 변수 기반 차트 색상 훅
 * 테마 변경 시 자동으로 색상 업데이트
 */
function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(getChartColors);

  useEffect(() => {
    const observer = watchChartThemeChange(() => {
      setColors(getChartColors());
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

/**
 * 🎯 THEME-011: activeTheme 제거, CSS 변수 기반으로 변경
 */
export const OverviewWorkloadStatus = observer((props: OverviewWorkloadStatusProps) => {
  const { workload } = props;
  const colors = useChartColors();

  const statusesToBeShown = object.entries(workload.status.get()).filter(([, val]) => val > 0);

  const emptyDataSet = {
    data: [1],
    backgroundColor: [colors.pieChartDefaultColor],
    label: "Empty",
  };
  const statusDataSet = {
    label: "Status",
    data: statusesToBeShown.map(([, value]) => value),
    backgroundColor: statusesToBeShown.map(([status]) => colors[statusBackgroundColorMapping[toLowercase(status)]]),
    tooltipLabels: statusesToBeShown.map(
      ([status]) =>
        (percent: string) =>
          `${capitalize(status)}: ${percent}`,
    ),
  };

  const chartData: Required<PieChartData> = {
    datasets: [statusesToBeShown.length > 0 ? statusDataSet : emptyDataSet],

    labels: statusesToBeShown.map(([status, value]) => `${capitalize(status)}: ${value}`),
  };

  return (
    <div className="OverviewWorkloadStatus">
      <div className="flex column align-center box grow">
        <PieChart
          data={chartData}
          options={{
            elements: {
              arc: {
                borderWidth: 0,
              },
            },
          }}
          data-testid={`workload-overview-status-chart-${workload.title.toLowerCase().replace(/\s+/, "-")}`}
        />
      </div>
    </div>
  );
});
