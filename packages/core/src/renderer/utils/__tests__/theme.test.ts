/**
 * 🎯 THEME-008: Theme Utility Functions Test
 */

import { calculateContrastRatio, camelToKebab, getColorToken, getTailwindColorToken, meetsWCAG_AA } from "../theme";

describe("THEME-008: Theme Utility Functions", () => {
  describe("camelToKebab", () => {
    it("should convert camelCase to kebab-case", () => {
      expect(camelToKebab("backgroundColor")).toBe("background-color");
      expect(camelToKebab("primaryForeground")).toBe("primary-foreground");
      expect(camelToKebab("terminalBrightGreen")).toBe("terminal-bright-green");
    });

    it("should handle single word", () => {
      expect(camelToKebab("background")).toBe("background");
    });

    it("should handle empty string", () => {
      expect(camelToKebab("")).toBe("");
    });
  });

  describe("getColorToken", () => {
    it("should return CSS variable reference", () => {
      expect(getColorToken("background")).toBe("var(--background)");
      expect(getColorToken("primaryForeground")).toBe("var(--primary-foreground)");
    });

    it("should handle terminal tokens", () => {
      expect(getColorToken("terminalForeground")).toBe("var(--terminal-foreground)");
    });
  });

  describe("getTailwindColorToken", () => {
    it("should return Tailwind CSS variable reference", () => {
      expect(getTailwindColorToken("background")).toBe("var(--color-background)");
      expect(getTailwindColorToken("primary")).toBe("var(--color-primary)");
    });

    it("should handle complex names", () => {
      expect(getTailwindColorToken("sidebarAccentForeground")).toBe("var(--color-sidebar-accent-foreground)");
    });
  });

  describe("calculateContrastRatio", () => {
    it("should calculate black on white as ~21:1", () => {
      const ratio = calculateContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("should calculate white on black as ~21:1", () => {
      const ratio = calculateContrastRatio("#FFFFFF", "#000000");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("should calculate same color as 1:1", () => {
      const ratio = calculateContrastRatio("#808080", "#808080");
      expect(ratio).toBe(1);
    });

    it("should calculate Soft Contrast (Dark theme)", () => {
      // #EDEDED on #0D0D0D
      const ratio = calculateContrastRatio("#EDEDED", "#0D0D0D");
      expect(ratio).toBeGreaterThan(12); // 약 15.5:1
    });

    it("should calculate Light theme foreground", () => {
      // #212121 on #FAFAFA
      const ratio = calculateContrastRatio("#212121", "#FAFAFA");
      expect(ratio).toBeGreaterThan(14); // 약 14.5:1
    });
  });

  describe("meetsWCAG_AA", () => {
    it("should pass for normal text >= 4.5:1", () => {
      expect(meetsWCAG_AA(4.5)).toBe(true);
      expect(meetsWCAG_AA(7)).toBe(true);
    });

    it("should fail for normal text < 4.5:1", () => {
      expect(meetsWCAG_AA(4.4)).toBe(false);
      expect(meetsWCAG_AA(3)).toBe(false);
    });

    it("should pass for large text >= 3:1", () => {
      expect(meetsWCAG_AA(3, true)).toBe(true);
      expect(meetsWCAG_AA(4.5, true)).toBe(true);
    });

    it("should fail for large text < 3:1", () => {
      expect(meetsWCAG_AA(2.9, true)).toBe(false);
    });
  });
});
