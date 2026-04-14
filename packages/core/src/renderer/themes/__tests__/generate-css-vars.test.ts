/**
 * 🎯 THEME-007: CSS Variable Generator Test
 */

import {
  camelToKebab,
  generateDarkThemeCSS,
  generateLightThemeCSS,
  getVariableStats,
  tokensToCSSVariables,
} from "../generate-css-vars";

describe("THEME-007: CSS Variable Generator", () => {
  describe("camelToKebab", () => {
    it("should convert camelCase to kebab-case", () => {
      expect(camelToKebab("backgroundColor")).toBe("background-color");
      expect(camelToKebab("primaryForeground")).toBe("primary-foreground");
      expect(camelToKebab("terminalBrightGreen")).toBe("terminal-bright-green");
    });

    it("should handle single word", () => {
      expect(camelToKebab("background")).toBe("background");
      expect(camelToKebab("primary")).toBe("primary");
    });

    it("should handle consecutive capitals", () => {
      expect(camelToKebab("statusBarBg")).toBe("status-bar-bg");
    });
  });

  describe("tokensToCSSVariables", () => {
    it("should convert tokens to CSS variable declarations", () => {
      const tokens = {
        background: "#FAFAFA",
        foreground: "#212121",
      };

      const result = tokensToCSSVariables(tokens);

      expect(result).toContain("--background: #FAFAFA;");
      expect(result).toContain("--foreground: #212121;");
    });

    it("should handle prefix", () => {
      const tokens = { test: "#000000" };
      const result = tokensToCSSVariables(tokens, "color");

      expect(result).toContain("--color-test: #000000;");
    });
  });

  describe("generateLightThemeCSS", () => {
    it("should generate CSS with theme-default-light selector", () => {
      const css = generateLightThemeCSS();

      expect(css).toContain("html:where(.theme-default-light)");
      expect(css).toContain("--background:");
      expect(css).toContain("--foreground:");
    });

    it("should include terminal variables", () => {
      const css = generateLightThemeCSS();

      expect(css).toContain("--terminal-foreground:");
      expect(css).toContain("--terminal-background:");
    });
  });

  describe("generateDarkThemeCSS", () => {
    it("should generate CSS with theme-default-dark selector", () => {
      const css = generateDarkThemeCSS();

      expect(css).toContain("html:where(.theme-default-dark)");
      expect(css).toContain("--background:");
      expect(css).toContain("--foreground:");
    });

    it("should use Soft Contrast foreground", () => {
      const css = generateDarkThemeCSS();

      expect(css).toContain("#EDEDED");
    });
  });

  describe("getVariableStats", () => {
    it("should return correct variable counts", () => {
      const stats = getVariableStats();

      expect(stats.light).toBeGreaterThanOrEqual(70);
      expect(stats.dark).toBeGreaterThanOrEqual(70);
      expect(stats.total).toBe(stats.light + stats.dark);
    });

    it("should have equal light and dark counts", () => {
      const stats = getVariableStats();

      expect(stats.light).toBe(stats.dark);
    });
  });
});
