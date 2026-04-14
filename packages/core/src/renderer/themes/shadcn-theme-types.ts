/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: shadcn 테마 타입 정의
 * 📝 주의: globals.css에 정의된 14개 테마와 정확히 일치해야 함
 */

// shadcn 테마 색상 옵션 (6개)
export type ShadcnThemeColor = "default" | "red" | "orange" | "green" | "blue" | "yellow" | "violet";

// 테마 모드 (light/dark)
export type ShadcnThemeMode = "light" | "dark";

// shadcn 테마 ID (14개 조합)
export type ShadcnThemeId =
  | "default-light"
  | "default-dark"
  | "red-light"
  | "red-dark"
  | "orange-light"
  | "orange-dark"
  | "green-light"
  | "green-dark"
  | "blue-light"
  | "blue-dark"
  | "yellow-light"
  | "yellow-dark"
  | "violet-light"
  | "violet-dark";

/**
 * 🎯 목적: shadcn 테마 정보 인터페이스
 */
export interface ShadcnTheme {
  id: ShadcnThemeId;
  name: string;
  color: ShadcnThemeColor;
  mode: ShadcnThemeMode;
}

/**
 * 🎯 목적: 사용 가능한 모든 shadcn 테마 목록
 * 📝 주의: globals.css의 html.theme-* 클래스와 정확히 일치
 */
export const SHADCN_THEMES: ReadonlyArray<ShadcnTheme> = [
  // Light theme
  { id: "default-light", name: "Default Light", color: "default", mode: "light" },

  // Dark theme
  { id: "default-dark", name: "Default Dark", color: "default", mode: "dark" },
] as const;

/**
 * 🎯 목적: 기본 테마 ID
 */
export const DEFAULT_SHADCN_THEME_ID: ShadcnThemeId = "default-dark";
