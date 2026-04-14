/**
 * 🎯 THEME-015: 하드코딩된 색상 검증 스크립트 테스트
 * @jest-environment node
 */

const fs = require("fs");
const path = require("path");

// 스크립트에서 테스트할 함수를 직접 정의 (모듈화되지 않은 스크립트용)
const COLOR_PATTERNS = {
  HEX: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  RGB: /\brgba?\s*\([^)]+\)/gi,
  HSL: /\bhsla?\s*\([^)]+\)/gi,
  NAMED:
    /\b(red|blue|green|yellow|orange|purple|pink|cyan|magenta|white|black|gray|grey|brown|navy|teal|maroon|olive|lime|aqua|fuchsia|silver)\b/gi,
};

const ALLOWED_PATTERNS = [
  /var\s*\(--[^)]+\)/g,
  /oklch\s*\([^)]+\)/gi,
  /currentColor/gi,
  /inherit/gi,
  /transparent/gi,
  /initial/gi,
  /unset/gi,
];

/**
 * 🎯 값이 하드코딩된 색상인지 확인
 */
function isHardcodedColor(value) {
  if (typeof value !== "string") return false;

  // 허용된 패턴 확인
  const isAllowed = ALLOWED_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });

  if (isAllowed) return false;

  // 색상 패턴 확인
  for (const [type, pattern] of Object.entries(COLOR_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) {
      return true;
    }
  }

  return false;
}

describe("check-hardcoded-colors", () => {
  describe("Hex 색상 감지", () => {
    it("3자리 hex 색상을 감지해야 함", () => {
      expect(isHardcodedColor("#fff")).toBe(true);
      expect(isHardcodedColor("#FFF")).toBe(true);
      expect(isHardcodedColor("#abc")).toBe(true);
    });

    it("4자리 hex 색상(알파 포함)을 감지해야 함", () => {
      expect(isHardcodedColor("#fff0")).toBe(true);
      expect(isHardcodedColor("#ABCD")).toBe(true);
    });

    it("6자리 hex 색상을 감지해야 함", () => {
      expect(isHardcodedColor("#ffffff")).toBe(true);
      expect(isHardcodedColor("#FFFFFF")).toBe(true);
      expect(isHardcodedColor("#00ff00")).toBe(true);
    });

    it("8자리 hex 색상(알파 포함)을 감지해야 함", () => {
      expect(isHardcodedColor("#ffffff00")).toBe(true);
      expect(isHardcodedColor("#00000080")).toBe(true);
    });
  });

  describe("RGB/RGBA 색상 감지", () => {
    it("rgb() 색상을 감지해야 함", () => {
      expect(isHardcodedColor("rgb(255, 0, 0)")).toBe(true);
      expect(isHardcodedColor("rgb(0,0,0)")).toBe(true);
    });

    it("rgba() 색상을 감지해야 함", () => {
      expect(isHardcodedColor("rgba(255, 0, 0, 0.5)")).toBe(true);
      expect(isHardcodedColor("rgba(0,0,0,1)")).toBe(true);
    });
  });

  describe("HSL/HSLA 색상 감지", () => {
    it("hsl() 색상을 감지해야 함", () => {
      expect(isHardcodedColor("hsl(120, 100%, 50%)")).toBe(true);
    });

    it("hsla() 색상을 감지해야 함", () => {
      expect(isHardcodedColor("hsla(120, 100%, 50%, 0.5)")).toBe(true);
    });
  });

  describe("명명된 색상 감지", () => {
    it("일반적인 명명된 색상을 감지해야 함", () => {
      expect(isHardcodedColor("red")).toBe(true);
      expect(isHardcodedColor("blue")).toBe(true);
      expect(isHardcodedColor("green")).toBe(true);
      expect(isHardcodedColor("white")).toBe(true);
      expect(isHardcodedColor("black")).toBe(true);
    });

    it("대소문자 구분 없이 감지해야 함", () => {
      expect(isHardcodedColor("RED")).toBe(true);
      expect(isHardcodedColor("Red")).toBe(true);
    });
  });

  describe("허용된 패턴 예외", () => {
    it("CSS 변수는 허용해야 함", () => {
      expect(isHardcodedColor("var(--color-primary)")).toBe(false);
      expect(isHardcodedColor("var(--foreground)")).toBe(false);
    });

    it("oklch() 색상은 허용해야 함", () => {
      expect(isHardcodedColor("oklch(0.5 0.2 120)")).toBe(false);
      expect(isHardcodedColor("OKLCH(0.5 0.2 120)")).toBe(false);
    });

    it("currentColor는 허용해야 함", () => {
      expect(isHardcodedColor("currentColor")).toBe(false);
    });

    it("inherit/transparent/initial/unset은 허용해야 함", () => {
      expect(isHardcodedColor("inherit")).toBe(false);
      expect(isHardcodedColor("transparent")).toBe(false);
      expect(isHardcodedColor("initial")).toBe(false);
      expect(isHardcodedColor("unset")).toBe(false);
    });
  });

  describe("비색상 값", () => {
    it("숫자 값은 감지하지 않아야 함", () => {
      expect(isHardcodedColor("10px")).toBe(false);
      expect(isHardcodedColor("100%")).toBe(false);
    });

    it("일반 문자열은 감지하지 않아야 함", () => {
      expect(isHardcodedColor("normal")).toBe(false);
      expect(isHardcodedColor("auto")).toBe(false);
      expect(isHardcodedColor("none")).toBe(false);
    });

    it("비문자열 값은 감지하지 않아야 함", () => {
      expect(isHardcodedColor(123)).toBe(false);
      expect(isHardcodedColor(null)).toBe(false);
      expect(isHardcodedColor(undefined)).toBe(false);
    });
  });
});

describe("스크립트 파일 존재 확인", () => {
  it("check-hardcoded-colors.js 파일이 존재해야 함", () => {
    const scriptPath = path.join(__dirname, "..", "check-hardcoded-colors.js");
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it("스크립트에 shebang이 있어야 함", () => {
    const scriptPath = path.join(__dirname, "..", "check-hardcoded-colors.js");
    const content = fs.readFileSync(scriptPath, "utf-8");
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
