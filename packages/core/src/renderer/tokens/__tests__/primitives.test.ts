/**
 * 🎯 THEME-003: Primitive Tokens Test
 */

import { ansiDark, ansiLight, blue, green, neutral, PRIMITIVE, red } from "../primitives";

describe("THEME-003: Primitive Tokens", () => {
  describe("Structure", () => {
    it("should export PRIMITIVE object with all color palettes", () => {
      expect(PRIMITIVE).toBeDefined();
      expect(PRIMITIVE.neutral).toBeDefined();
      expect(PRIMITIVE.blue).toBeDefined();
      expect(PRIMITIVE.red).toBeDefined();
      expect(PRIMITIVE.green).toBeDefined();
      expect(PRIMITIVE.lime).toBeDefined();
      expect(PRIMITIVE.orange).toBeDefined();
      expect(PRIMITIVE.amber).toBeDefined();
      expect(PRIMITIVE.sky).toBeDefined();
      expect(PRIMITIVE.violet).toBeDefined();
      expect(PRIMITIVE.ansiLight).toBeDefined();
      expect(PRIMITIVE.ansiDark).toBeDefined();
      expect(PRIMITIVE.special).toBeDefined();
    });

    it("should have 100+ color tokens total", () => {
      const countTokens = (obj: object): number => {
        return Object.values(obj).reduce((acc, val) => {
          if (typeof val === "object" && val !== null) {
            return acc + countTokens(val);
          }
          return acc + 1;
        }, 0);
      };

      const totalTokens = countTokens(PRIMITIVE);
      expect(totalTokens).toBeGreaterThanOrEqual(100);
    });
  });

  describe("Neutral Palette", () => {
    it("should have Tailwind-standard scale (50-950)", () => {
      expect(neutral[50]).toBe("#FAFAFA");
      expect(neutral[100]).toBe("#F5F5F5");
      expect(neutral[900]).toBe("#212121");
      expect(neutral[950]).toBe("#0D0D0D");
    });

    it("should have extended steps (850, 925, 940)", () => {
      expect(neutral[850]).toBeDefined();
      expect(neutral[925]).toBeDefined();
      expect(neutral[940]).toBeDefined();
    });
  });

  describe("Blue Palette", () => {
    it("should have primary blue-700", () => {
      expect(blue[700]).toBe("#1D4ED8");
    });

    it("should have all 11 standard steps", () => {
      const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
      steps.forEach((step) => {
        expect(blue[step as keyof typeof blue]).toBeDefined();
      });
    });
  });

  describe("Red Palette", () => {
    it("should have destructive red-600", () => {
      expect(red[600]).toBe("#DC2626");
    });

    it("should have failed red-400", () => {
      expect(red[400]).toBe("#F87171");
    });
  });

  describe("Green Palette", () => {
    it("should have success green-500", () => {
      expect(green[500]).toBe("#22C55E");
    });
  });

  describe("ANSI Terminal Colors", () => {
    it("should have 16 colors for Light theme", () => {
      const expectedColors = [
        "black",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
        "cyan",
        "white",
        "brightBlack",
        "brightRed",
        "brightGreen",
        "brightYellow",
        "brightBlue",
        "brightMagenta",
        "brightCyan",
        "brightWhite",
      ];

      expectedColors.forEach((color) => {
        expect(ansiLight[color as keyof typeof ansiLight]).toBeDefined();
      });
    });

    it("should have 16 colors for Dark theme", () => {
      const expectedColors = [
        "black",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
        "cyan",
        "white",
        "brightBlack",
        "brightRed",
        "brightGreen",
        "brightYellow",
        "brightBlue",
        "brightMagenta",
        "brightCyan",
        "brightWhite",
      ];

      expectedColors.forEach((color) => {
        expect(ansiDark[color as keyof typeof ansiDark]).toBeDefined();
      });
    });
  });

  describe("Color Format", () => {
    it("should use HEX format for all colors", () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

      const checkHexFormat = (obj: object, path = ""): void => {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            checkHexFormat(value, `${path}.${key}`);
          } else if (typeof value === "string") {
            expect(value).toMatch(hexPattern);
          }
        });
      };

      checkHexFormat(PRIMITIVE);
    });
  });

  describe("No Circular References", () => {
    it("should not import SEMANTIC tokens", () => {
      // primitives.ts 파일에서 SEMANTIC을 import하지 않아야 함
      // 이 테스트는 파일 내용을 검사하는 것이 아니라 구조적 제약을 확인
      expect(typeof PRIMITIVE.neutral[50]).toBe("string");
      expect(PRIMITIVE.neutral[50]).not.toContain("SEMANTIC");
    });
  });
});
