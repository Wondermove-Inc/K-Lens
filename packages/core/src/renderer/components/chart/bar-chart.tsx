/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 THEME-011: activeTheme injectable 제거
 * 📝 CSS 변수 기반 차트 색상으로 마이그레이션
 */
import { bytesToUnits, cssNames, isObject } from "@skuberplus/utilities";
import assert from "assert";
import Color from "color";
import merge from "lodash/merge";
import { observer } from "mobx-react";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { getChartColors, watchChartThemeChange } from "../../utils/chart-colors";
import { NoMetrics } from "../resource-metrics/no-metrics";
import { Chart, ChartKind } from "./chart";
import { ZebraStripesPlugin } from "./zebra-stripes.plugin";

import type { ChartOptions, ChartTooltipCallback, ChartTooltipItem, Scriptable } from "chart.js";

import type { ChartColors } from "../../utils/chart-colors";
import type { ChartProps } from "./chart";

export interface BarChartProps extends ChartProps {
  name?: string;
  timeLabelStep?: number; // Minute labels appearance step
}

const getBarColor: Scriptable<string> = ({ dataset }) => Color(dataset?.borderColor).alpha(0.2).string();

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
export const BarChart = observer(
  ({ name, data, className, timeLabelStep = 10, plugins, options: customOptions, ...settings }: BarChartProps) => {
    const { textColorPrimary, borderFaintColor, chartStripesColor, chartBackdropColor } = useChartColors();
    const { datasets: rawDatasets = [], ...rest } = data;
    const datasets = rawDatasets
      .filter((set) => set.data?.length)
      .map((item) => ({
        type: ChartKind.BAR,
        borderWidth: { top: 3 },
        barPercentage: 0.85, // 🎯 50-55초 폭 효과: 85% 너비로 연속적 느낌
        categoryPercentage: 0.95, // 🔄 카테고리 간 여백 최소화로 더 붙어보이게
        ...item,
      }));

    plugins ??= [
      new ZebraStripesPlugin({
        stripeColor: chartStripesColor,
        interval: datasets[0]?.data?.length,
      }),
    ];

    if (datasets.length === 0) {
      return <NoMetrics />;
    }

    const formatTimeLabels = (timestamp: string, index: number) => {
      const label = moment(parseInt(timestamp)).format("HH:mm");
      const offset = "     ";

      if (index == 0) return offset + label;
      if (index == 60) return label + offset;

      return index % timeLabelStep == 0 ? label : "";
    };

    const barOptions: ChartOptions = {
      maintainAspectRatio: false,
      responsive: true,
      scales: {
        xAxes: [
          {
            type: "time",
            offset: true,
            gridLines: {
              display: false,
            },
            stacked: true,
            ticks: {
              callback: formatTimeLabels,
              autoSkip: false,
              source: "data",
              backdropColor: chartBackdropColor, // 🎯 THEME-023: CSS 변수 사용
              fontColor: textColorPrimary,
              fontSize: 11,
              maxRotation: 0,
              minRotation: 0,
            },
            bounds: "data",
            time: {
              unit: "minute",
              displayFormats: {
                minute: "x",
              },
              parser: (timestamp) => moment.unix(parseInt(timestamp)),
            },
          },
        ],
        yAxes: [
          {
            position: "right",
            gridLines: {
              color: borderFaintColor,
              drawBorder: false,
              tickMarkLength: 0,
              zeroLineWidth: 0,
            },
            ticks: {
              maxTicksLimit: 6,
              fontColor: textColorPrimary,
              fontSize: 11,
              padding: 8,
              min: 0,
            },
          },
        ],
      },
      tooltips: {
        mode: "index",
        position: "cursor",
        callbacks: {
          title([tooltip]: ChartTooltipItem[]) {
            const xLabel = tooltip?.xLabel;
            const skipLabel = xLabel == null || new Date(xLabel).getTime() > Date.now();

            if (skipLabel) return "";

            return String(xLabel);
          },
          // 🎯 THEME-021: CSS 변수 기반 색상 사용
          labelColor: ({ datasetIndex }) =>
            typeof datasetIndex === "number"
              ? {
                  borderColor: borderFaintColor,
                  backgroundColor: datasets[datasetIndex].borderColor as string,
                }
              : {
                  borderColor: borderFaintColor,
                  backgroundColor: borderFaintColor,
                },
        },
      },
      animation: {
        duration: 0,
      },
      elements: {
        rectangle: {
          backgroundColor: getBarColor.bind(null),
        },
      },
    };

    return (
      <Chart
        className={cssNames("BarChart flex box grow column", className)}
        type={ChartKind.BAR}
        data={{ datasets, ...rest }}
        options={merge(barOptions, customOptions)}
        plugins={plugins}
        {...settings}
      />
    );
  },
);

const tooltipCallbackWith =
  (precision: number): ChartTooltipCallback["label"] =>
  ({ datasetIndex, index }, { datasets = [] }) => {
    if (typeof datasetIndex !== "number" || typeof index !== "number") {
      return "";
    }

    const { label, data } = datasets[datasetIndex];

    if (!label || !data) {
      return "<unknown>";
    }

    const value = data[index];

    assert(isObject(value) && !Array.isArray(value) && typeof value.y === "number");

    return `${label}: ${bytesToUnits(parseInt(value.y.toString()), { precision })}`;
  };

// Default options for all charts containing memory units (network, disk, memory, etc)
export const memoryOptions: ChartOptions = {
  scales: {
    yAxes: [
      {
        ticks: {
          callback: (value) => {
            if (typeof value == "string") {
              const float = parseFloat(value);

              if (float < 1) {
                return float.toFixed(3);
              }

              return bytesToUnits(parseInt(value));
            }

            return bytesToUnits(value);
          },
          stepSize: 1,
        },
      },
    ],
  },
  tooltips: {
    callbacks: {
      label: tooltipCallbackWith(3),
    },
  },
};

// Default options for all charts with cpu units or other decimal numbers
export const cpuOptions: ChartOptions = {
  scales: {
    yAxes: [
      {
        ticks: {
          callback: (value) => {
            const float = parseFloat(`${value}`);

            if (float == 0) return "0";
            if (float < 10) return float.toFixed(3);
            if (float < 100) return float.toFixed(2);

            return float.toFixed(1);
          },
        },
      },
    ],
  },
  tooltips: {
    callbacks: {
      label: tooltipCallbackWith(2),
    },
  },
};
