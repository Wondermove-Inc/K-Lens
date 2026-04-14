/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ITheme } from "@xterm/xterm";

/**
 * 🎯 목적: CSS 변수에서 터미널 색상을 읽어 xterm.js ITheme 객체로 변환
 * 📝 주의: VSCode getXtermTheme() 메서드와 동일한 구조
 * 🔄 변경이력: 2025-10-26 - CSS 변수 기반 테마 시스템 도입
 *
 * @returns xterm.js ITheme 객체 (VSCode 호환)
 *
 * 📝 주의사항:
 * - getComputedStyle()은 DOM이 준비된 이후에만 호출 가능
 * - Terminal 생성 시점에 호출하므로 DOM 준비 보장됨
 */
export function getXtermThemeFromCssVariables(): ITheme {
  // 🎯 CSS 변수에서 값 읽기 (document.documentElement = html 요소)
  const styles = getComputedStyle(document.documentElement);

  /**
   * 🔧 CSS 변수 값 읽기 헬퍼 함수
   * @param varName - CSS 변수 이름 (예: --color-terminal-background)
   * @returns 트림된 색상 값 또는 undefined
   */
  const getCssVar = (varName: string): string | undefined => {
    const value = styles.getPropertyValue(varName).trim();

    return value || undefined;
  };

  // 🎯 xterm.js ITheme 객체 구성 (THEME-013: CSS 변수 통합)
  const theme = {
    // 기본 색상
    background: getCssVar("--color-terminal-background"),
    foreground: getCssVar("--color-terminal-foreground"),

    // 커서 색상
    cursor: getCssVar("--color-terminal-cursor"),
    cursorAccent: getCssVar("--color-terminal-cursor-accent"),

    // 선택 영역 색상
    selectionBackground: getCssVar("--color-terminal-selection-background"),

    // ANSI 기본 8색 (normal)
    black: getCssVar("--color-terminal-black"),
    red: getCssVar("--color-terminal-red"),
    green: getCssVar("--color-terminal-green"),
    yellow: getCssVar("--color-terminal-yellow"),
    blue: getCssVar("--color-terminal-blue"),
    magenta: getCssVar("--color-terminal-magenta"),
    cyan: getCssVar("--color-terminal-cyan"),
    white: getCssVar("--color-terminal-white"),

    // ANSI 밝은 8색 (bright)
    brightBlack: getCssVar("--color-terminal-bright-black"),
    brightRed: getCssVar("--color-terminal-bright-red"),
    brightGreen: getCssVar("--color-terminal-bright-green"),
    brightYellow: getCssVar("--color-terminal-bright-yellow"),
    brightBlue: getCssVar("--color-terminal-bright-blue"),
    brightMagenta: getCssVar("--color-terminal-bright-magenta"),
    brightCyan: getCssVar("--color-terminal-bright-cyan"),
    brightWhite: getCssVar("--color-terminal-bright-white"),
  };

  return theme;
}

/**
 * 🎯 목적: HTML 클래스 변경 감지를 통한 테마 전환 감시
 * 📝 주의: MutationObserver를 사용하여 html.theme-* 클래스 변경 감지
 *
 * @param callback - 테마 변경 시 호출할 콜백 함수
 * @returns MutationObserver 인스턴스 (정리 시 disconnect() 호출 필요)
 *
 * 📝 사용 예시:
 * ```typescript
 * const observer = watchThemeChange(() => {
 *   this.xterm.options.theme = getXtermThemeFromCssVariables();
 * });
 * // 정리 시
 * observer.disconnect();
 * ```
 */
export function watchThemeChange(callback: () => void): MutationObserver {
  const observer = new MutationObserver((mutations) => {
    // 🎯 html 요소의 class 속성 변경만 감지
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "class") {
        // ⚠️ 중요: 테마 클래스 변경 시에만 콜백 호출
        callback();
        break;
      }
    }
  });

  // 🎯 document.documentElement (html 요소)의 class 속성 변경 감시
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"], // class 속성만 감시
  });

  return observer;
}
