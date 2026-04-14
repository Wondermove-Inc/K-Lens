/**
 * 🎯 THEME-011: Chart Colors Utility Tests
 * 📝 TDD RED Phase - 테스트 먼저 작성
 *
 * CSS 변수에서 차트 색상을 읽어오는 유틸리티 함수 테스트
 */

import { ChartColorName, getChartColor, getChartColors } from "../chart-colors";

describe("THEME-011: Chart Colors Utility", () => {
  // Mock document.documentElement
  const originalGetComputedStyle = window.getComputedStyle;

  beforeEach(() => {
    // Mock CSS custom properties
    const mockStyles: Record<string, string> = {
      "--textColorPrimary": "#212121",
      "--borderFaintColor": "#dfdfdf",
      "--chartStripesColor": "#00000009",
      "--chartCapacityColor": "#cccccc",
      "--contentColor": "#ffffff",
      "--foreground": "#212121",
      // Status colors
      "--pieChartDefaultColor": "#e0e0e0",
      "--colorOk": "#27ae60",
      "--colorWarning": "#f39c12",
      "--colorError": "#e74c3c",
      "--colorSuccess": "#2ecc71",
      "--colorTerminated": "#95a5a6",
      "--colorVague": "#7f8c8d",
    };

    window.getComputedStyle = jest.fn().mockReturnValue({
      getPropertyValue: (prop: string) => mockStyles[prop] || "",
    });
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
  });

  describe("getChartColor", () => {
    it("should return textColorPrimary from CSS variable", () => {
      const color = getChartColor("textColorPrimary");
      expect(color).toBe("#212121");
    });

    it("should return borderFaintColor from CSS variable", () => {
      const color = getChartColor("borderFaintColor");
      expect(color).toBe("#dfdfdf");
    });

    it("should return chartStripesColor from CSS variable", () => {
      const color = getChartColor("chartStripesColor");
      expect(color).toBe("#00000009");
    });

    it("should return chartCapacityColor from CSS variable", () => {
      const color = getChartColor("chartCapacityColor");
      expect(color).toBe("#cccccc");
    });

    it("should return contentColor from CSS variable", () => {
      const color = getChartColor("contentColor");
      expect(color).toBe("#ffffff");
    });

    it("should return trimmed value", () => {
      const mockStyles: Record<string, string> = {
        "--textColorPrimary": "  #212121  ",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("textColorPrimary");
      expect(color).toBe("#212121");
    });

    it("should return fallback for missing CSS variable", () => {
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: () => "",
      });

      const color = getChartColor("textColorPrimary");
      expect(color).toBe("var(--foreground)");
    });
  });

  describe("getChartColors", () => {
    it("should return all chart colors", () => {
      const colors = getChartColors();

      expect(colors).toEqual({
        textColorPrimary: "#212121",
        borderFaintColor: "#dfdfdf",
        chartStripesColor: "#00000009",
        chartCapacityColor: "#cccccc",
        chartBackdropColor: expect.any(String),
        contentColor: "#ffffff",
        // Status colors
        pieChartDefaultColor: "#e0e0e0",
        colorOk: "#27ae60",
        colorWarning: "#f39c12",
        colorError: "#e74c3c",
        colorSuccess: "#2ecc71",
        colorTerminated: "#95a5a6",
        colorVague: "#7f8c8d",
      });
    });

    it("should be usable in chart configuration", () => {
      const colors = getChartColors();

      // Chart.js 설정에서 사용되는 패턴 테스트
      const chartConfig = {
        ticks: {
          fontColor: colors.textColorPrimary,
        },
        gridLines: {
          color: colors.borderFaintColor,
        },
      };

      expect(chartConfig.ticks.fontColor).toBe("#212121");
      expect(chartConfig.gridLines.color).toBe("#dfdfdf");
    });
  });

  describe("ChartColorName type", () => {
    it("should only accept valid color names", () => {
      // TypeScript 컴파일 시점 검증 - 유효한 색상명만 허용
      const validNames: ChartColorName[] = [
        "textColorPrimary",
        "borderFaintColor",
        "chartStripesColor",
        "chartCapacityColor",
        "chartBackdropColor",
        "contentColor",
        // Status colors for workload overview
        "pieChartDefaultColor",
        "colorOk",
        "colorWarning",
        "colorError",
        "colorSuccess",
        "colorTerminated",
        "colorVague",
      ];

      expect(validNames).toHaveLength(13);
    });
  });

  describe("Status Colors (THEME-011 P1)", () => {
    it("should return pieChartDefaultColor from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--pieChartDefaultColor": "#e0e0e0",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("pieChartDefaultColor");
      expect(color).toBe("#e0e0e0");
    });

    it("should return colorOk from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--colorOk": "#27ae60",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("colorOk");
      expect(color).toBe("#27ae60");
    });

    it("should return colorWarning from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--colorWarning": "#f39c12",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("colorWarning");
      expect(color).toBe("#f39c12");
    });

    it("should return colorError from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--colorError": "#e74c3c",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("colorError");
      expect(color).toBe("#e74c3c");
    });

    it("should return colorSuccess from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--colorSuccess": "#2ecc71",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("colorSuccess");
      expect(color).toBe("#2ecc71");
    });

    it("should return colorTerminated from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--colorTerminated": "#95a5a6",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("colorTerminated");
      expect(color).toBe("#95a5a6");
    });

    it("should return colorVague from CSS variable", () => {
      const mockStyles: Record<string, string> = {
        "--colorVague": "#7f8c8d",
      };
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (prop: string) => mockStyles[prop] || "",
      });

      const color = getChartColor("colorVague");
      expect(color).toBe("#7f8c8d");
    });
  });
});
