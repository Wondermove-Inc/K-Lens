/**
 * 🎯 THEME-004/005: Semantic Tokens Test
 */

import { SEMANTIC_DARK, SemanticDarkKey } from "../semantic-dark";
import { SEMANTIC_LIGHT, SemanticLightKey } from "../semantic-light";

describe("THEME-004/005: Semantic Tokens", () => {
  describe("Key Consistency", () => {
    it("should have same keys in Light and Dark themes", () => {
      const lightKeys = Object.keys(SEMANTIC_LIGHT).sort();
      const darkKeys = Object.keys(SEMANTIC_DARK).sort();

      expect(lightKeys).toEqual(darkKeys);
    });
  });

  describe("Token Count", () => {
    it("should have 70+ tokens in Light theme", () => {
      const tokenCount = Object.keys(SEMANTIC_LIGHT).length;
      expect(tokenCount).toBeGreaterThanOrEqual(70);
    });

    it("should have 70+ tokens in Dark theme", () => {
      const tokenCount = Object.keys(SEMANTIC_DARK).length;
      expect(tokenCount).toBeGreaterThanOrEqual(70);
    });
  });

  describe("SEMANTIC_LIGHT", () => {
    it("should have base colors", () => {
      expect(SEMANTIC_LIGHT.background).toBeDefined();
      expect(SEMANTIC_LIGHT.foreground).toBeDefined();
      expect(SEMANTIC_LIGHT.primary).toBeDefined();
      expect(SEMANTIC_LIGHT.destructive).toBeDefined();
    });

    it("should have sidebar colors", () => {
      expect(SEMANTIC_LIGHT.sidebar).toBeDefined();
      expect(SEMANTIC_LIGHT.sidebarForeground).toBeDefined();
      expect(SEMANTIC_LIGHT.sidebarBorder).toBeDefined();
    });

    it("should have terminal colors", () => {
      expect(SEMANTIC_LIGHT.terminalForeground).toBeDefined();
      expect(SEMANTIC_LIGHT.terminalBackground).toBeDefined();
      expect(SEMANTIC_LIGHT.terminalBlack).toBeDefined();
      expect(SEMANTIC_LIGHT.terminalBrightWhite).toBeDefined();
    });

    it("should have workload status colors", () => {
      expect(SEMANTIC_LIGHT.workloadSucceeded).toBeDefined();
      expect(SEMANTIC_LIGHT.workloadRunning).toBeDefined();
      expect(SEMANTIC_LIGHT.workloadPending).toBeDefined();
      expect(SEMANTIC_LIGHT.workloadFailed).toBeDefined();
    });
  });

  describe("SEMANTIC_DARK", () => {
    it("should use Soft Contrast foreground (#EDEDED)", () => {
      expect(SEMANTIC_DARK.foreground).toBe("#EDEDED");
      expect(SEMANTIC_DARK.cardForeground).toBe("#EDEDED");
    });

    it("should use deep dark background (#0D0D0D)", () => {
      expect(SEMANTIC_DARK.background).toBe("#0D0D0D");
    });

    it("should have transparent border for Dark theme", () => {
      expect(SEMANTIC_DARK.border).toContain("rgba");
    });
  });

  describe("No Hardcoded Colors (except special cases)", () => {
    const allowedPatterns = [
      /^#[0-9A-Fa-f]{6}$/, // HEX without alpha
      /^#[0-9A-Fa-f]{8}$/, // HEX with alpha
      /^rgba?\([^)]+\)$/, // rgba()
    ];

    it("should use valid color formats in Light", () => {
      Object.entries(SEMANTIC_LIGHT).forEach(([key, value]) => {
        const isValid = allowedPatterns.some((pattern) => pattern.test(value));
        expect(isValid).toBe(true);
      });
    });

    it("should use valid color formats in Dark", () => {
      Object.entries(SEMANTIC_DARK).forEach(([key, value]) => {
        const isValid = allowedPatterns.some((pattern) => pattern.test(value));
        expect(isValid).toBe(true);
      });
    });
  });

  describe("Primary Color Consistency", () => {
    it("should use same primary color in both themes", () => {
      expect(SEMANTIC_LIGHT.primary).toBe(SEMANTIC_DARK.primary);
    });

    it("should have white primary foreground", () => {
      expect(SEMANTIC_LIGHT.primaryForeground).toBe("#FFFFFF");
      expect(SEMANTIC_DARK.primaryForeground).toBe("#FFFFFF");
    });
  });
});
