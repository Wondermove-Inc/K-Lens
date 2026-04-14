/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 THEME-011: activeTheme injectable 제거
 * 📝 CSS 변수 기반 차트 색상으로 마이그레이션
 */
import "./pie-chart.scss";

import { cssNames } from "@skuberplus/utilities";
import ChartJS from "chart.js";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { getChartColors, watchChartThemeChange } from "../../utils/chart-colors";
import { Chart } from "./chart";

import type { ChartOptions } from "chart.js";

import type { ChartColors } from "../../utils/chart-colors";
import type { ChartProps } from "./chart";

export interface PieChartProps extends ChartProps {}

export interface PieChartData extends ChartJS.ChartData {
  datasets?: PieChartDataSets[];
}

export type DatasetTooltipLabel = (percent: string) => string | string;

interface PieChartDataSets extends ChartJS.ChartDataSets {
  id?: string;
  tooltipLabels?: DatasetTooltipLabel[];
}

function getCutout(length: number | undefined): number {
  switch (length) {
    case 0:
    case 1:
      return 88;
    case 2:
      return 76;
    case 3:
      return 63;
    default:
      return 50;
  }
}

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
export const PieChart = observer(({ data, className, options, showChart, ...chartProps }: PieChartProps) => {
  const { contentColor } = useChartColors();
  const opts: ChartOptions = {
    maintainAspectRatio: false,
    tooltips: {
      mode: "index",
      callbacks: {
        title: () => "",
        label: (tooltipItem: { datasetIndex: number; index: number }, data: PieChartData) => {
          const dataset = data.datasets?.[tooltipItem.datasetIndex] ?? {};
          const datasetData = (dataset.data ?? []) as number[];
          const total = datasetData.reduce((acc, cur) => acc + cur, 0);
          const percent = Math.round(((datasetData[tooltipItem.index] as number) / total) * 100);
          const percentLabel = isNaN(percent) ? "N/A" : `${percent}%`;
          const tooltipLabelCustomizer = dataset.tooltipLabels?.[tooltipItem.index];

          return tooltipLabelCustomizer ? tooltipLabelCustomizer(percentLabel) : `${dataset.label}: ${percentLabel}`;
        },
      },
      filter: ({ datasetIndex, index }, { datasets = [] }) => {
        if (datasetIndex === undefined) {
          return false;
        }

        const { data = [] } = datasets[datasetIndex];

        if (datasets.length === 1) return true;

        return index !== data.length - 1;
      },
      position: "cursor",
    },
    elements: {
      arc: {
        borderWidth: 1,
        borderColor: contentColor,
      },
    },
    cutoutPercentage: getCutout(data.datasets?.length),
    responsive: true,
    ...options,
  };

  return (
    <Chart
      className={cssNames("PieChart flex column align-center", className)}
      data={data}
      options={showChart ? {} : opts}
      showChart={showChart}
      {...chartProps}
    />
  );
});

ChartJS.Tooltip.positioners.cursor = function (elements: any, position: { x: number; y: number }) {
  return position;
};
