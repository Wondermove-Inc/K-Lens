/**
 * 🎯 THEME-010: Theme System Integration Test
 * 📝 토큰 시스템 통합 테스트
 */

import { camelToKebab, getVariableStats, tokensToCSSVariables } from "../../themes/generate-css-vars";
import { calculateContrastRatio, getColorToken, getTailwindColorToken, meetsWCAG_AA } from "../../utils/theme";
import { PRIMITIVE } from "../primitives";
import { SEMANTIC_DARK } from "../semantic-dark";
import { SEMANTIC_LIGHT } from "../semantic-light";

describe("THEME-010: Theme System Integration", () => {
  describe("Token Layer Consistency", () => {
    it("should have PRIMITIVE as base layer", () => {
      expect(PRIMITIVE).toBeDefined();
      expect(PRIMITIVE.neutral).toBeDefined();
      expect(PRIMITIVE.blue).toBeDefined();
    });

    it("should have SEMANTIC_LIGHT referencing PRIMITIVE", () => {
      // Light 테마의 primary는 blue[700]을 참조해야 함
      expect(SEMANTIC_LIGHT.primary).toBe(PRIMITIVE.blue[700]);
    });

    it("should have SEMANTIC_DARK referencing PRIMITIVE", () => {
      // Dark 테마의 primary도 blue[700]을 참조해야 함
      expect(SEMANTIC_DARK.primary).toBe(PRIMITIVE.blue[700]);
    });
  });

  describe("Semantic Token Consistency", () => {
    it("should have identical keys in Light and Dark", () => {
      const lightKeys = Object.keys(SEMANTIC_LIGHT).sort();
      const darkKeys = Object.keys(SEMANTIC_DARK).sort();

      expect(lightKeys).toEqual(darkKeys);
    });

    it("should have all required base tokens", () => {
      const requiredTokens = [
        "background",
        "foreground",
        "card",
        "cardForeground",
        "primary",
        "primaryForeground",
        "destructive",
        "destructiveForeground",
        "border",
        "input",
        "ring",
      ];

      requiredTokens.forEach((token) => {
        expect(SEMANTIC_LIGHT[token as keyof typeof SEMANTIC_LIGHT]).toBeDefined();
        expect(SEMANTIC_DARK[token as keyof typeof SEMANTIC_DARK]).toBeDefined();
      });
    });

    it("should have all terminal tokens", () => {
      const terminalTokens = [
        "terminalForeground",
        "terminalBackground",
        "terminalCursor",
        "terminalBlack",
        "terminalRed",
        "terminalGreen",
        "terminalYellow",
        "terminalBlue",
        "terminalMagenta",
        "terminalCyan",
        "terminalWhite",
        "terminalBrightBlack",
        "terminalBrightRed",
        "terminalBrightGreen",
        "terminalBrightYellow",
        "terminalBrightBlue",
        "terminalBrightMagenta",
        "terminalBrightCyan",
        "terminalBrightWhite",
      ];

      terminalTokens.forEach((token) => {
        expect(SEMANTIC_LIGHT[token as keyof typeof SEMANTIC_LIGHT]).toBeDefined();
        expect(SEMANTIC_DARK[token as keyof typeof SEMANTIC_DARK]).toBeDefined();
      });
    });
  });

  describe("CSS Variable Generation", () => {
    it("should generate correct variable count", () => {
      const stats = getVariableStats();

      expect(stats.light).toBeGreaterThanOrEqual(70);
      expect(stats.dark).toBeGreaterThanOrEqual(70);
    });

    it("should convert all token keys to valid CSS variable names", () => {
      const lightTokens = Object.keys(SEMANTIC_LIGHT);

      lightTokens.forEach((key) => {
        const cssVarName = camelToKebab(key);
        expect(cssVarName).not.toContain(" ");
        expect(cssVarName).toMatch(/^[a-z][a-z0-9-]*$/);
      });
    });
  });

  describe("Utility Functions", () => {
    it("should generate correct CSS variable references", () => {
      expect(getColorToken("background")).toBe("var(--background)");
      expect(getColorToken("primaryForeground")).toBe("var(--primary-foreground)");
    });

    it("should generate correct Tailwind color variable references", () => {
      expect(getTailwindColorToken("background")).toBe("var(--color-background)");
      expect(getTailwindColorToken("primary")).toBe("var(--color-primary)");
    });
  });

  describe("WCAG Accessibility", () => {
    it("should meet WCAG AA for Light theme foreground on background", () => {
      // #212121 on #FAFAFA
      const ratio = calculateContrastRatio(SEMANTIC_LIGHT.foreground, SEMANTIC_LIGHT.background);

      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(ratio)).toBe(true);
    });

    it("should meet WCAG AA for Dark theme foreground on background", () => {
      // #EDEDED on #0D0D0D
      const ratio = calculateContrastRatio(SEMANTIC_DARK.foreground, SEMANTIC_DARK.background);

      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWCAG_AA(ratio)).toBe(true);
    });

    it("should have Soft Contrast in Dark theme (12:1+)", () => {
      const ratio = calculateContrastRatio(SEMANTIC_DARK.foreground, SEMANTIC_DARK.background);

      expect(ratio).toBeGreaterThanOrEqual(12);
    });

    it("should meet WCAG AA for muted foreground", () => {
      // Light: #6B6B6B on #FAFAFA
      const lightMutedRatio = calculateContrastRatio(SEMANTIC_LIGHT.mutedForeground, SEMANTIC_LIGHT.background);

      expect(meetsWCAG_AA(lightMutedRatio)).toBe(true);
    });
  });

  describe("Color Value Format", () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    const rgbaPattern = /^rgba?\([^)]+\)$/;

    it("should use valid color formats in PRIMITIVE", () => {
      const checkFormat = (obj: object): void => {
        Object.values(obj).forEach((value) => {
          if (typeof value === "object" && value !== null) {
            checkFormat(value);
          } else if (typeof value === "string") {
            expect(value).toMatch(hexPattern);
          }
        });
      };

      checkFormat(PRIMITIVE);
    });

    it("should use valid color formats in SEMANTIC tokens", () => {
      const isValidFormat = (value: string): boolean => hexPattern.test(value) || rgbaPattern.test(value);

      Object.values(SEMANTIC_LIGHT).forEach((value) => {
        expect(isValidFormat(value)).toBe(true);
      });

      Object.values(SEMANTIC_DARK).forEach((value) => {
        expect(isValidFormat(value)).toBe(true);
      });
    });
  });

  describe("No Circular Dependencies", () => {
    it("should not have circular imports", () => {
      // 이 테스트가 실행되면 순환 참조가 없음을 의미
      expect(PRIMITIVE).toBeDefined();
      expect(SEMANTIC_LIGHT).toBeDefined();
      expect(SEMANTIC_DARK).toBeDefined();
    });
  });
});
