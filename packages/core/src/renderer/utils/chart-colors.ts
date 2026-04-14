/**
 * 🎯 THEME-011 & THEME-020: Chart Colors Utility
 * 📝 CSS 변수 기반 차트 색상 중앙 관리 유틸리티
 *
 * 목적:
 * - activeTheme injectable 의존성 제거
 * - CSS 변수 기반 테마 시스템으로 마이그레이션
 * - Recharts + shadcn/ui ChartContainer와 호환
 * - 🆕 THEME-020: Pod Status, Workload 차트 색상 중앙 관리
 *
 * 사용법:
 * ```typescript
 * // 단일 색상 (런타임 해석)
 * const textColor = getChartColor("textColorPrimary");
 *
 * // 모든 차트 색상 (런타임 해석)
 * const colors = getChartColors();
 *
 * // 🆕 Pod Status ChartConfig (CSS 변수 참조)
 * import { getPodStatusChartConfig } from "./chart-colors";
 * <ChartContainer config={getPodStatusChartConfig()}>
 *   <Bar fill="var(--color-running)" />
 * </ChartContainer>
 * ```
 *
 * @packageDocumentation
 */

/**
 * 차트에서 사용되는 CSS 변수 색상명
 */
export type ChartColorName =
  | "textColorPrimary"
  | "borderFaintColor"
  | "chartStripesColor"
  | "chartCapacityColor"
  | "chartBackdropColor" // 🎯 THEME-023: Chart backdrop color
  | "contentColor"
  // Status colors for workload overview (THEME-011 P1)
  | "pieChartDefaultColor"
  | "colorOk"
  | "colorWarning"
  | "colorError"
  | "colorSuccess"
  | "colorTerminated"
  | "colorVague";

/**
 * 차트 색상 객체 타입
 */
export interface ChartColors {
  textColorPrimary: string;
  borderFaintColor: string;
  chartStripesColor: string;
  chartCapacityColor: string;
  chartBackdropColor: string; // 🎯 THEME-023: Chart backdrop color
  contentColor: string;
  // Status colors for workload overview (THEME-011 P1)
  pieChartDefaultColor: string;
  colorOk: string;
  colorWarning: string;
  colorError: string;
  colorSuccess: string;
  colorTerminated: string;
  colorVague: string;
}

/**
 * CSS 변수의 폴백 값 (CSS 변수가 없을 때 사용)
 */
const FALLBACK_VALUES: Record<ChartColorName, string> = {
  textColorPrimary: "var(--foreground)",
  borderFaintColor: "var(--border)",
  chartStripesColor: "rgba(0, 0, 0, 0.03)",
  chartCapacityColor: "var(--muted-foreground)",
  chartBackdropColor: "var(--chart-backdrop)", // 🎯 THEME-023: CSS 변수 폴백
  contentColor: "var(--card)",
  // Status colors fallbacks (THEME-011 P1)
  pieChartDefaultColor: "#e0e0e0",
  colorOk: "#27ae60",
  colorWarning: "#f39c12",
  colorError: "#e74c3c",
  colorSuccess: "#2ecc71",
  colorTerminated: "#95a5a6",
  colorVague: "#7f8c8d",
};

/**
 * 🎯 CSS 변수에서 단일 차트 색상을 읽어옵니다.
 *
 * @param colorName - 색상명 (예: "textColorPrimary")
 * @returns 색상 값 (예: "#212121") 또는 폴백 값
 *
 * @example
 * ```typescript
 * const textColor = getChartColor("textColorPrimary");
 * // Light: "#212121", Dark: "#EDEDED"
 * ```
 */
export function getChartColor(colorName: ChartColorName): string {
  // SSR/테스트 환경 안전 체크
  if (typeof document === "undefined") {
    return FALLBACK_VALUES[colorName];
  }

  try {
    const cssVarName = `--${colorName}`;
    const value = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();

    return value || FALLBACK_VALUES[colorName];
  } catch {
    return FALLBACK_VALUES[colorName];
  }
}

/**
 * 🎯 모든 차트 색상을 CSS 변수에서 읽어옵니다.
 *
 * @returns 차트 색상 객체
 *
 * @example
 * ```typescript
 * const colors = getChartColors();
 *
 * // Chart.js 설정에서 사용
 * const chartConfig = {
 *   ticks: { fontColor: colors.textColorPrimary },
 *   gridLines: { color: colors.borderFaintColor },
 * };
 * ```
 */
export function getChartColors(): ChartColors {
  return {
    textColorPrimary: getChartColor("textColorPrimary"),
    borderFaintColor: getChartColor("borderFaintColor"),
    chartStripesColor: getChartColor("chartStripesColor"),
    chartCapacityColor: getChartColor("chartCapacityColor"),
    chartBackdropColor: getChartColor("chartBackdropColor"), // 🎯 THEME-023
    contentColor: getChartColor("contentColor"),
    // Status colors (THEME-011 P1)
    pieChartDefaultColor: getChartColor("pieChartDefaultColor"),
    colorOk: getChartColor("colorOk"),
    colorWarning: getChartColor("colorWarning"),
    colorError: getChartColor("colorError"),
    colorSuccess: getChartColor("colorSuccess"),
    colorTerminated: getChartColor("colorTerminated"),
    colorVague: getChartColor("colorVague"),
  };
}

/**
 * 🎯 테마 변경을 감지하여 차트 색상을 업데이트하는 훅용 유틸리티
 *
 * @param callback - 테마 변경 시 호출될 콜백
 * @returns MutationObserver (정리 시 disconnect() 호출 필요)
 *
 * @example
 * ```typescript
 * useEffect(() => {
 *   const observer = watchChartThemeChange(() => {
 *     setColors(getChartColors());
 *   });
 *   return () => observer.disconnect();
 * }, []);
 * ```
 */
export function watchChartThemeChange(callback: () => void): MutationObserver {
  // SSR/테스트 환경 안전 체크
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
    return { disconnect: () => {} } as MutationObserver;
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        // class 변경 (테마 클래스) 또는 style 변경 (CSS 변수)
        if (mutation.attributeName === "class" || mutation.attributeName === "style") {
          callback();
          break;
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  return observer;
}

// ============================================
// 🎯 THEME-020: Recharts + shadcn/ui ChartConfig 중앙 관리
// ============================================

/**
 * 🎯 shadcn/ui ChartConfig 타입 (chart.tsx와 호환)
 *
 * 📝 주의: CSS 변수 문자열을 직접 color에 전달하면
 * ChartContainer의 ChartStyle이 자동으로 처리합니다.
 * getComputedStyle을 사용할 필요가 없습니다!
 */
export interface RechartsChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

/**
 * 🎯 Pod Status 차트 설정 (중앙 집중식)
 *
 * 📝 사용법:
 * ```tsx
 * import { POD_STATUS_CHART_CONFIG } from "@/utils/chart-colors";
 *
 * <ChartContainer config={POD_STATUS_CHART_CONFIG}>
 *   <Bar dataKey="running" fill="var(--color-running)" />
 *   <Bar dataKey="succeeded" fill="var(--color-succeeded)" />
 * </ChartContainer>
 * ```
 *
 * 📝 작동 원리:
 * 1. ChartStyle이 `--color-running: var(--pod-status-running);` CSS를 생성
 * 2. Recharts Bar의 `fill="var(--color-running)"`이 이 값을 참조
 * 3. 브라우저가 `var(--pod-status-running)`을 global.css에서 해석
 * 4. 테마 전환 시 자동으로 다크/라이트 색상 적용
 */
export const POD_STATUS_CHART_CONFIG: RechartsChartConfig = {
  running: {
    label: "Running",
    color: "var(--pod-status-running)",
  },
  succeeded: {
    label: "Succeeded",
    color: "var(--pod-status-succeeded)",
  },
  pending: {
    label: "Pending",
    color: "var(--pod-status-pending)",
  },
  failed: {
    label: "Failed",
    color: "var(--pod-status-failed)",
  },
  unknown: {
    label: "Unknown",
    color: "var(--pod-status-unknown)",
  },
} as const;

/**
 * 🎯 Workload Overview 차트 설정 (중앙 집중식)
 *
 * 📝 사용법:
 * ```tsx
 * import { WORKLOAD_CHART_CONFIG } from "@/utils/chart-colors";
 *
 * <ChartContainer config={WORKLOAD_CHART_CONFIG}>
 *   <Pie fill="var(--color-running)" />
 * </ChartContainer>
 * ```
 */
export const WORKLOAD_CHART_CONFIG: RechartsChartConfig = {
  value: {
    label: "Status Value",
    color: "var(--workload-default)",
  },
  succeeded: {
    label: "Succeeded",
    color: "var(--workload-succeeded)",
  },
  running: {
    label: "Running",
    color: "var(--workload-running)",
  },
  pending: {
    label: "Pending",
    color: "var(--workload-pending)",
  },
  failed: {
    label: "Failed",
    color: "var(--workload-failed)",
  },
  unknown: {
    label: "Unknown",
    color: "var(--workload-unknown)",
  },
  available: {
    label: "Available",
    color: "var(--workload-available)",
  },
  unavailable: {
    label: "Unavailable",
    color: "var(--workload-unavailable)",
  },
  suspended: {
    label: "Suspended",
    color: "var(--workload-suspended)",
  },
  complete: {
    label: "Complete",
    color: "var(--workload-complete)",
  },
  active: {
    label: "Active",
    color: "var(--workload-active)",
  },
  updating: {
    label: "Updating",
    color: "var(--workload-updating)",
  },
} as const;

/**
 * 🎯 CPU/Memory 차트 설정 (중앙 집중식)
 */
export const METRICS_CHART_CONFIG: RechartsChartConfig = {
  usage: {
    label: "Usage",
    color: "var(--chart-1)",
  },
  capacity: {
    label: "Capacity",
    color: "var(--chart-2)",
  },
} as const;

/**
 * 🎯 Pod Status 키 순서 (UI 일관성용)
 */
export const POD_STATUS_ORDER = ["running", "succeeded", "pending", "failed", "unknown"] as const;

/**
 * 🎯 Workload Status 키 순서 (UI 일관성용)
 */
export const WORKLOAD_STATUS_ORDER = [
  "succeeded",
  "running",
  "available",
  "complete",
  "active",
  "pending",
  "updating",
  "unavailable",
  "suspended",
  "failed",
  "unknown",
] as const;
