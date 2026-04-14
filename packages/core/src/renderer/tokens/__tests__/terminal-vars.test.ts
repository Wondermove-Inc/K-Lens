/**
 * 🎯 THEME-001: Terminal CSS Variables Test
 * TDD RED Phase - 테스트 먼저 작성
 */

import { readFileSync } from "fs";
import { resolve } from "path";

describe("THEME-001: Terminal CSS Variables", () => {
  let globalCssContent: string;

  beforeAll(() => {
    const cssPath = resolve(__dirname, "../../theme-variables.css");
    globalCssContent = readFileSync(cssPath, "utf-8");
  });

  /**
   * 필수 터미널 변수 목록 (22개)
   * - 기본 2개: foreground, background
   * - 커서 2개: cursor, cursorAccent
   * - 선택 1개: selectionBackground
   * - ANSI 기본 8색: black, red, green, yellow, blue, magenta, cyan, white
   * - ANSI 밝은 8색: brightBlack ~ brightWhite
   * - 추가 1개: selectionForeground (optional)
   */
  const requiredTerminalVars = [
    "--color-terminal-foreground",
    "--color-terminal-background",
    "--color-terminal-cursor",
    "--color-terminal-cursor-accent",
    "--color-terminal-selection-background",
    "--color-terminal-black",
    "--color-terminal-red",
    "--color-terminal-green",
    "--color-terminal-yellow",
    "--color-terminal-blue",
    "--color-terminal-magenta",
    "--color-terminal-cyan",
    "--color-terminal-white",
    "--color-terminal-bright-black",
    "--color-terminal-bright-red",
    "--color-terminal-bright-green",
    "--color-terminal-bright-yellow",
    "--color-terminal-bright-blue",
    "--color-terminal-bright-magenta",
    "--color-terminal-bright-cyan",
    "--color-terminal-bright-white",
  ];

  it("should have 21+ terminal CSS variables defined", () => {
    const terminalVarCount = (globalCssContent.match(/--color-terminal-/g) || []).length;
    expect(terminalVarCount).toBeGreaterThanOrEqual(21);
  });

  it.each(requiredTerminalVars)("should define %s", (varName) => {
    expect(globalCssContent).toContain(varName);
  });

  it("should define terminal variables in Light theme", () => {
    // Light 테마 블록에서 terminal 변수 확인
    const lightThemeMatch = globalCssContent.match(/html:where\(\.theme-default-light\)\s*\{([^}]+)\}/s);
    expect(lightThemeMatch).toBeTruthy();
    if (lightThemeMatch) {
      expect(lightThemeMatch[1]).toContain("--color-terminal-");
    }
  });

  it("should define terminal variables in Dark theme", () => {
    // Dark 테마 블록에서 terminal 변수 확인
    const darkThemeMatch = globalCssContent.match(/html:where\(\.theme-default-dark\)\s*\{([^}]+)\}/s);
    expect(darkThemeMatch).toBeTruthy();
    if (darkThemeMatch) {
      expect(darkThemeMatch[1]).toContain("--color-terminal-");
    }
  });

  it("should have ANSI-compliant color values", () => {
    // ANSI 표준 색상이 올바른 HEX/OKLCH 형식인지 확인
    const colorValuePattern = /(oklch\([^)]+\)|#[0-9a-fA-F]{6})/;

    requiredTerminalVars.forEach((varName) => {
      const varPattern = new RegExp(`${varName}:\\s*([^;]+);`);
      const match = globalCssContent.match(varPattern);
      if (match) {
        expect(match[1]).toMatch(colorValuePattern);
      }
    });
  });
});
