/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ShadcnThemeId } from "./shadcn-theme-types";

/**
 * 🎯 목적: shadcn 테마 CSS 변수 데이터
 * 📝 주의: Tailwind CSS v4가 global.css의 테마 변수를 빌드 시 병합/제거하므로
 *         JavaScript에서 직접 CSS 변수를 인라인 스타일로 적용
 * 📦 출처: https://ui.shadcn.com/docs/theming 공식 테마 값 기반
 * 🔄 변경이력:
 *   - 2025-11-28: CSS 빌드 문제 해결을 위해 JS 인라인 방식으로 전환
 *   - 2025-11-28: 공식 shadcn.com 테마 값으로 업데이트 (Tailwind 컬러 팔레트 적용)
 *   - 2025-11-28: Dark/Light 테마별 다른 색상값 적용 (공식 shadcn.com 값 기준)
 */

export interface ThemeVariables {
  // 🎯 기본 색상 변수
  "--background": string;
  "--foreground": string;
  "--card": string;
  "--card-foreground": string;
  "--popover": string;
  "--popover-foreground": string;
  "--primary": string;
  "--primary-foreground": string;
  "--secondary": string;
  "--secondary-foreground": string;
  "--muted": string;
  "--muted-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--destructive": string;
  "--destructive-foreground": string;
  "--border": string;
  "--input": string;
  "--ring": string;
  "--chart-1": string;
  "--chart-2": string;
  "--chart-3": string;
  "--chart-4": string;
  "--chart-5": string;
  "--sidebar": string;
  "--sidebar-foreground": string;
  "--sidebar-primary": string;
  "--sidebar-primary-foreground": string;
  "--sidebar-accent": string;
  "--sidebar-accent-foreground": string;
  "--sidebar-border": string;
  "--sidebar-ring": string;

  // 🎯 Tailwind v4 --color-* 변수 (인라인 스타일로 직접 설정 필요)
  // 📝 주의: Tailwind CSS v4가 text-primary-foreground 등의 클래스를 --color-* 변수로 참조
  "--color-background": string;
  "--color-foreground": string;
  "--color-card": string;
  "--color-card-foreground": string;
  "--color-popover": string;
  "--color-popover-foreground": string;
  "--color-primary": string;
  "--color-primary-foreground": string;
  "--color-secondary": string;
  "--color-secondary-foreground": string;
  "--color-muted": string;
  "--color-muted-foreground": string;
  "--color-accent": string;
  "--color-accent-foreground": string;
  "--color-destructive": string;
  "--color-destructive-foreground": string;
  "--color-border": string;
  "--color-input": string;
  "--color-ring": string;
  "--color-chart-1": string;
  "--color-chart-2": string;
  "--color-chart-3": string;
  "--color-chart-4": string;
  "--color-chart-5": string;
  "--color-sidebar": string;
  "--color-sidebar-foreground": string;
  "--color-sidebar-primary": string;
  "--color-sidebar-primary-foreground": string;
  "--color-sidebar-accent": string;
  "--color-sidebar-accent-foreground": string;
  "--color-sidebar-border": string;
  "--color-sidebar-ring": string;

  // 🎯 로그 색상 변수 (Lens 테마 변수 오버라이드)
  "--logsBackground": string;
  "--logsForeground": string;
  "--logRowHoverBackground": string;

  // 🎯 LineProgress 배경색 (UI에서 ShadCN 테마만 변경하므로 여기서 관리)
  "--lineProgressBackground": string;
}

// ============================================
// 🎨 Tailwind 공식 컬러 팔레트 (OKLCH)
// 출처: https://ui.shadcn.com/colors
// ============================================
const TAILWIND_COLORS = {
  // Red
  "red-50": "oklch(0.971 0.013 17.38)",
  "red-100": "oklch(0.936 0.032 17.717)",
  "red-200": "oklch(0.885 0.062 18.334)",
  "red-300": "oklch(0.808 0.114 19.571)",
  "red-400": "oklch(0.704 0.191 22.216)",
  "red-500": "oklch(0.637 0.237 25.331)",
  "red-600": "oklch(0.577 0.245 27.325)",
  "red-700": "oklch(0.505 0.213 27.518)",
  "red-800": "oklch(0.444 0.177 26.899)",
  "red-900": "oklch(0.396 0.141 25.723)",
  "red-950": "oklch(0.258 0.092 26.042)",

  // Orange
  "orange-50": "oklch(0.98 0.016 73.684)",
  "orange-100": "oklch(0.954 0.038 75.164)",
  "orange-200": "oklch(0.901 0.076 70.697)",
  "orange-300": "oklch(0.837 0.128 66.29)",
  "orange-400": "oklch(0.75 0.183 55.934)",
  "orange-500": "oklch(0.705 0.213 47.604)",
  "orange-600": "oklch(0.646 0.222 41.116)",
  "orange-700": "oklch(0.553 0.195 38.402)",
  "orange-800": "oklch(0.47 0.157 37.304)",
  "orange-900": "oklch(0.408 0.123 38.172)",
  "orange-950": "oklch(0.266 0.079 36.259)",

  // Yellow
  "yellow-50": "oklch(0.987 0.026 102.212)",
  "yellow-100": "oklch(0.973 0.071 103.193)",
  "yellow-200": "oklch(0.945 0.129 101.54)",
  "yellow-300": "oklch(0.905 0.182 98.111)",
  "yellow-400": "oklch(0.852 0.199 91.936)",
  "yellow-500": "oklch(0.795 0.184 86.047)",
  "yellow-600": "oklch(0.681 0.162 75.834)",
  "yellow-700": "oklch(0.554 0.135 66.442)",
  "yellow-800": "oklch(0.476 0.114 61.907)",
  "yellow-900": "oklch(0.421 0.095 57.708)",
  "yellow-950": "oklch(0.286 0.066 53.813)",

  // Green
  "green-50": "oklch(0.982 0.018 155.826)",
  "green-100": "oklch(0.962 0.044 156.743)",
  "green-200": "oklch(0.925 0.084 155.995)",
  "green-300": "oklch(0.871 0.15 154.449)",
  "green-400": "oklch(0.792 0.209 151.711)",
  "green-500": "oklch(0.723 0.219 149.579)",
  "green-600": "oklch(0.627 0.194 149.214)",
  "green-700": "oklch(0.527 0.154 150.069)",
  "green-800": "oklch(0.448 0.119 151.328)",
  "green-900": "oklch(0.393 0.095 152.535)",
  "green-950": "oklch(0.266 0.065 152.934)",

  // Lime (Green primary용)
  "lime-50": "oklch(0.986 0.031 120.757)",
  "lime-100": "oklch(0.967 0.067 122.328)",
  "lime-200": "oklch(0.938 0.127 124.321)",
  "lime-300": "oklch(0.897 0.196 126.665)",
  "lime-400": "oklch(0.841 0.238 128.85)",
  "lime-500": "oklch(0.768 0.233 130.85)",
  "lime-600": "oklch(0.648 0.2 131.684)",
  "lime-700": "oklch(0.532 0.157 131.589)",
  "lime-800": "oklch(0.453 0.124 130.933)",
  "lime-900": "oklch(0.405 0.101 131.063)",
  "lime-950": "oklch(0.274 0.072 132.109)",

  // Blue
  "blue-50": "oklch(0.984 0.007 254.604)",
  "blue-100": "oklch(0.959 0.021 255.388)",
  "blue-200": "oklch(0.925 0.048 255.585)",
  "blue-300": "oklch(0.796 0.099 250.366)",
  "blue-400": "oklch(0.71 0.156 255)",
  "blue-500": "oklch(0.623 0.214 259.815)",
  "blue-600": "oklch(0.546 0.245 262.881)",
  "blue-700": "oklch(0.488 0.243 264.376)",
  "blue-800": "oklch(0.45 0.197 265.522)",
  "blue-900": "oklch(0.398 0.143 266.996)",
  "blue-950": "oklch(0.296 0.093 269.542)",

  // Violet
  "violet-50": "oklch(0.969 0.016 293.756)",
  "violet-100": "oklch(0.943 0.029 294.588)",
  "violet-200": "oklch(0.894 0.057 293.283)",
  "violet-300": "oklch(0.811 0.111 293.571)",
  "violet-400": "oklch(0.702 0.183 293.541)",
  "violet-500": "oklch(0.606 0.25 292.717)",
  "violet-600": "oklch(0.541 0.281 293.009)",
  "violet-700": "oklch(0.491 0.27 292.581)",
  "violet-800": "oklch(0.432 0.232 292.759)",
  "violet-900": "oklch(0.38 0.189 293.745)",
  "violet-950": "oklch(0.283 0.141 291.089)",
} as const;

// ============================================
// 📦 기본 테마 (공식 shadcn 값)
// ============================================
const DEFAULT_LIGHT: ThemeVariables = {
  // 🎯 기본 색상 변수 (Blue Light 테마 적용)
  // 📝 FIX-042: Soft Contrast 적용 - 눈 피로 감소 (대비율 14:1 최적화)
  "--background": "oklch(0.985 0 0)", // #FAFAFA (off-white)
  "--foreground": "oklch(0.15 0 0)", // #212121 (near-black) - 입력 텍스트용
  "--card": "oklch(0.995 0 0)", // #FDFDFD (배경과 미세 구분)
  "--card-foreground": "oklch(0.15 0 0)", // #212121 (near-black)
  "--popover": "oklch(0.995 0 0)",
  "--popover-foreground": "oklch(0.15 0 0)", // #212121 (near-black)
  "--primary": TAILWIND_COLORS["blue-700"],
  // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색 (#FFFFFF - 가독성 향상)
  "--primary-foreground": "oklch(1 0 0)",
  "--secondary": "oklch(0.96 0 0)", // #F5F5F5
  "--secondary-foreground": "oklch(0.25 0 0)", // #3D3D3D (Secondary-foreground)
  "--muted": "oklch(0.96 0 0)",
  "--muted-foreground": "oklch(0.45 0 0)", // #6B6B6B (Placeholder/Hint text) - WCAG AA 4.7:1 충족
  "--accent": "oklch(0.97 0 0)",
  "--accent-foreground": "oklch(0.205 0 0)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--destructive-foreground": "oklch(0.985 0 0)",
  "--border": "oklch(0.922 0 0)",
  "--input": "oklch(0.922 0 0)",
  "--ring": "oklch(0.708 0 0)",
  "--chart-1": TAILWIND_COLORS["blue-300"],
  "--chart-2": TAILWIND_COLORS["blue-500"],
  "--chart-3": TAILWIND_COLORS["blue-600"],
  "--chart-4": TAILWIND_COLORS["blue-700"],
  "--chart-5": TAILWIND_COLORS["blue-800"],
  "--sidebar": "oklch(0.985 0 0)",
  "--sidebar-foreground": "oklch(0.145 0 0)",
  "--sidebar-primary": TAILWIND_COLORS["blue-600"],
  "--sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
  "--sidebar-accent": "oklch(0.97 0 0)",
  "--sidebar-accent-foreground": "oklch(0.205 0 0)",
  "--sidebar-border": "oklch(0.922 0 0)",
  "--sidebar-ring": "oklch(0.708 0 0)",

  // 🎯 Tailwind v4 --color-* 변수 (Blue Light 테마 적용)
  // 📝 FIX-042: Soft Contrast 적용 - 눈 피로 감소 (대비율 14:1 최적화)
  "--color-background": "oklch(0.985 0 0)", // #FAFAFA (off-white)
  "--color-foreground": "oklch(0.15 0 0)", // #212121 (near-black) - 입력 텍스트용
  "--color-card": "oklch(0.995 0 0)", // #FDFDFD
  "--color-card-foreground": "oklch(0.15 0 0)", // #212121 (near-black)
  "--color-popover": "oklch(0.995 0 0)",
  "--color-popover-foreground": "oklch(0.15 0 0)", // #212121 (near-black)
  "--color-primary": TAILWIND_COLORS["blue-700"],
  // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색 (#FFFFFF - 가독성 향상)
  "--color-primary-foreground": "oklch(1 0 0)",
  "--color-secondary": "oklch(0.96 0 0)", // #F5F5F5
  "--color-secondary-foreground": "oklch(0.25 0 0)", // #3D3D3D (Secondary-foreground)
  "--color-muted": "oklch(0.96 0 0)",
  "--color-muted-foreground": "oklch(0.45 0 0)", // #6B6B6B (Placeholder/Hint text) - WCAG AA 4.7:1 충족
  "--color-accent": "oklch(0.97 0 0)",
  "--color-accent-foreground": "oklch(0.205 0 0)",
  "--color-destructive": "oklch(0.577 0.245 27.325)",
  "--color-destructive-foreground": "oklch(0.985 0 0)",
  "--color-border": "oklch(0.922 0 0)",
  "--color-input": "oklch(0.922 0 0)",
  "--color-ring": "oklch(0.708 0 0)",
  "--color-chart-1": TAILWIND_COLORS["blue-300"],
  "--color-chart-2": TAILWIND_COLORS["blue-500"],
  "--color-chart-3": TAILWIND_COLORS["blue-600"],
  "--color-chart-4": TAILWIND_COLORS["blue-700"],
  "--color-chart-5": TAILWIND_COLORS["blue-800"],
  "--color-sidebar": "oklch(0.985 0 0)",
  "--color-sidebar-foreground": "oklch(0.145 0 0)",
  "--color-sidebar-primary": TAILWIND_COLORS["blue-600"],
  "--color-sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
  "--color-sidebar-accent": "oklch(0.97 0 0)",
  "--color-sidebar-accent-foreground": "oklch(0.205 0 0)",
  "--color-sidebar-border": "oklch(0.922 0 0)",
  "--color-sidebar-ring": "oklch(0.708 0 0)",

  // 🎯 로그 색상 (터미널 스타일 유지: 검은 배경 + 흰색 텍스트)
  "--logsBackground": "#1a1a1a",
  "--logsForeground": "#ffffff",
  "--logRowHoverBackground": "#2a2a2a",

  // 🎯 LineProgress 배경색 (프로그레스 바 트랙 - 밝은 회색)
  "--lineProgressBackground": "#e8e8e8",
};

const DEFAULT_DARK: ThemeVariables = {
  // 🎯 기본 색상 변수 (Blue Dark 테마 적용)
  // 📝 FIX-042: Soft Contrast 적용 - 눈 피로 감소 (대비율 12:1 최적화)
  "--background": "oklch(0.10 0 0)", // #0D0D0D (deep dark)
  "--foreground": "oklch(0.93 0 0)", // #EDEDED (off-white) - 입력 텍스트용
  "--card": "oklch(0.16 0 0)", // #1F1F1F (계층 구분)
  "--card-foreground": "oklch(0.93 0 0)", // #EDEDED (off-white)
  "--popover": "oklch(0.16 0 0)",
  "--popover-foreground": "oklch(0.93 0 0)", // #EDEDED (off-white)
  "--primary": TAILWIND_COLORS["blue-700"],
  // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색 (#FFFFFF - 가독성 향상)
  "--primary-foreground": "oklch(1 0 0)",
  "--secondary": "oklch(0.22 0 0)", // #333333
  "--secondary-foreground": "oklch(0.85 0 0)", // #D4D4D4 (Secondary text)
  "--muted": "oklch(0.22 0 0)",
  "--muted-foreground": "oklch(0.70 0 0)", // #B0B0B0 (Placeholder/Hint text) - WCAG AA 충족
  "--accent": "oklch(0.269 0 0)",
  "--accent-foreground": "oklch(0.985 0 0)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--destructive-foreground": "oklch(0.985 0 0)",
  "--border": "oklch(1 0 0 / 10%)",
  "--input": "oklch(1 0 0 / 15%)",
  "--ring": "oklch(0.556 0 0)",
  "--chart-1": TAILWIND_COLORS["blue-300"],
  "--chart-2": TAILWIND_COLORS["blue-500"],
  "--chart-3": TAILWIND_COLORS["blue-600"],
  "--chart-4": TAILWIND_COLORS["blue-700"],
  "--chart-5": TAILWIND_COLORS["blue-800"],
  "--sidebar": "oklch(0.205 0 0)",
  "--sidebar-foreground": "oklch(0.985 0 0)",
  "--sidebar-primary": TAILWIND_COLORS["blue-500"],
  "--sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
  "--sidebar-accent": "oklch(0.269 0 0)",
  "--sidebar-accent-foreground": "oklch(0.985 0 0)",
  "--sidebar-border": "oklch(1 0 0 / 10%)",
  "--sidebar-ring": "oklch(0.556 0 0)",

  // 🎯 Tailwind v4 --color-* 변수 (Blue Dark 테마 적용)
  // 📝 FIX-042: Soft Contrast 적용 - 눈 피로 감소 (대비율 12:1 최적화)
  "--color-background": "oklch(0.10 0 0)", // #0D0D0D (deep dark)
  "--color-foreground": "oklch(0.93 0 0)", // #EDEDED (off-white) - 입력 텍스트용
  "--color-card": "oklch(0.16 0 0)", // #1F1F1F
  "--color-card-foreground": "oklch(0.93 0 0)", // #EDEDED (off-white)
  "--color-popover": "oklch(0.16 0 0)",
  "--color-popover-foreground": "oklch(0.93 0 0)", // #EDEDED (off-white)
  "--color-primary": TAILWIND_COLORS["blue-700"],
  // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색 (#FFFFFF - 가독성 향상)
  "--color-primary-foreground": "oklch(1 0 0)",
  "--color-secondary": "oklch(0.22 0 0)", // #333333
  "--color-secondary-foreground": "oklch(0.85 0 0)", // #D4D4D4 (Secondary text)
  "--color-muted": "oklch(0.22 0 0)",
  "--color-muted-foreground": "oklch(0.70 0 0)", // #B0B0B0 (Placeholder/Hint text) - WCAG AA 충족
  "--color-accent": "oklch(0.269 0 0)",
  "--color-accent-foreground": "oklch(0.985 0 0)",
  "--color-destructive": "oklch(0.704 0.191 22.216)",
  "--color-destructive-foreground": "oklch(0.985 0 0)",
  "--color-border": "oklch(1 0 0 / 10%)",
  "--color-input": "oklch(1 0 0 / 15%)",
  "--color-ring": "oklch(0.556 0 0)",
  "--color-chart-1": TAILWIND_COLORS["blue-300"],
  "--color-chart-2": TAILWIND_COLORS["blue-500"],
  "--color-chart-3": TAILWIND_COLORS["blue-600"],
  "--color-chart-4": TAILWIND_COLORS["blue-700"],
  "--color-chart-5": TAILWIND_COLORS["blue-800"],
  "--color-sidebar": "oklch(0.205 0 0)",
  "--color-sidebar-foreground": "oklch(0.985 0 0)",
  "--color-sidebar-primary": TAILWIND_COLORS["blue-500"],
  "--color-sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
  "--color-sidebar-accent": "oklch(0.269 0 0)",
  "--color-sidebar-accent-foreground": "oklch(0.985 0 0)",
  "--color-sidebar-border": "oklch(1 0 0 / 10%)",
  "--color-sidebar-ring": "oklch(0.556 0 0)",

  // 🎯 로그 색상
  "--logsBackground": "#000000",
  "--logsForeground": "#E8E9EA",
  "--logRowHoverBackground": "#35373a",

  // 🎯 LineProgress 배경색 (프로그레스 바 트랙 - 어두운 회색)
  "--lineProgressBackground": "#414448",
};

/**
 * 🎯 목적: 컬러 테마 변수 생성 헬퍼
 * 📝 공식 shadcn 방식: default 테마 기반 + 컬러별 오버라이드
 */
function createColorTheme(base: ThemeVariables, overrides: Partial<ThemeVariables>): ThemeVariables {
  return { ...base, ...overrides };
}

/**
 * 🎯 목적: 14개 shadcn 테마의 CSS 변수 값
 * 📝 구조: default 테마(light/dark) + 6개 컬러 테마(light/dark)
 * 📦 출처: https://ui.shadcn.com/docs/theming + vendor/shadcn/globals.css
 */
export const SHADCN_THEME_VARIABLES: Record<ShadcnThemeId, ThemeVariables> = {
  // ============================================
  // Default (Zinc) 테마 - 공식 shadcn 값
  // ============================================
  "default-light": DEFAULT_LIGHT,
  "default-dark": DEFAULT_DARK,

  // ============================================
  // Red 테마 (공식 shadcn.com 값)
  // Light: --primary 0.577, Dark: --primary 0.637 (더 밝음)
  // ============================================
  "red-light": createColorTheme(DEFAULT_LIGHT, {
    "--primary": TAILWIND_COLORS["red-600"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["red-400"],
    "--chart-1": TAILWIND_COLORS["red-300"],
    "--chart-2": TAILWIND_COLORS["red-500"],
    "--chart-3": TAILWIND_COLORS["red-600"],
    "--chart-4": TAILWIND_COLORS["red-700"],
    "--chart-5": TAILWIND_COLORS["red-800"],
    "--sidebar-primary": TAILWIND_COLORS["red-600"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["red-50"],
    "--sidebar-ring": TAILWIND_COLORS["red-400"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["red-600"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["red-400"],
    "--color-chart-1": TAILWIND_COLORS["red-300"],
    "--color-chart-2": TAILWIND_COLORS["red-500"],
    "--color-chart-3": TAILWIND_COLORS["red-600"],
    "--color-chart-4": TAILWIND_COLORS["red-700"],
    "--color-chart-5": TAILWIND_COLORS["red-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["red-600"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["red-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["red-400"],
  }),
  "red-dark": createColorTheme(DEFAULT_DARK, {
    "--primary": TAILWIND_COLORS["red-500"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["red-900"],
    "--chart-1": TAILWIND_COLORS["red-300"],
    "--chart-2": TAILWIND_COLORS["red-500"],
    "--chart-3": TAILWIND_COLORS["red-600"],
    "--chart-4": TAILWIND_COLORS["red-700"],
    "--chart-5": TAILWIND_COLORS["red-800"],
    "--sidebar-primary": TAILWIND_COLORS["red-500"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["red-50"],
    "--sidebar-ring": TAILWIND_COLORS["red-900"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["red-500"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["red-900"],
    "--color-chart-1": TAILWIND_COLORS["red-300"],
    "--color-chart-2": TAILWIND_COLORS["red-500"],
    "--color-chart-3": TAILWIND_COLORS["red-600"],
    "--color-chart-4": TAILWIND_COLORS["red-700"],
    "--color-chart-5": TAILWIND_COLORS["red-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["red-500"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["red-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["red-900"],
  }),

  // ============================================
  // Orange 테마 (공식 shadcn.com 값)
  // Light: --primary 0.646, Dark: --primary 0.705 (더 밝음)
  // ============================================
  "orange-light": createColorTheme(DEFAULT_LIGHT, {
    "--primary": TAILWIND_COLORS["orange-600"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["orange-400"],
    "--chart-1": TAILWIND_COLORS["orange-300"],
    "--chart-2": TAILWIND_COLORS["orange-500"],
    "--chart-3": TAILWIND_COLORS["orange-600"],
    "--chart-4": TAILWIND_COLORS["orange-700"],
    "--chart-5": TAILWIND_COLORS["orange-800"],
    "--sidebar-primary": TAILWIND_COLORS["orange-600"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["orange-50"],
    "--sidebar-ring": TAILWIND_COLORS["orange-400"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["orange-600"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["orange-400"],
    "--color-chart-1": TAILWIND_COLORS["orange-300"],
    "--color-chart-2": TAILWIND_COLORS["orange-500"],
    "--color-chart-3": TAILWIND_COLORS["orange-600"],
    "--color-chart-4": TAILWIND_COLORS["orange-700"],
    "--color-chart-5": TAILWIND_COLORS["orange-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["orange-600"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["orange-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["orange-400"],
  }),
  "orange-dark": createColorTheme(DEFAULT_DARK, {
    "--primary": TAILWIND_COLORS["orange-500"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["orange-900"],
    "--chart-1": TAILWIND_COLORS["orange-300"],
    "--chart-2": TAILWIND_COLORS["orange-500"],
    "--chart-3": TAILWIND_COLORS["orange-600"],
    "--chart-4": TAILWIND_COLORS["orange-700"],
    "--chart-5": TAILWIND_COLORS["orange-800"],
    "--sidebar-primary": TAILWIND_COLORS["orange-500"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["orange-50"],
    "--sidebar-ring": TAILWIND_COLORS["orange-900"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["orange-500"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["orange-900"],
    "--color-chart-1": TAILWIND_COLORS["orange-300"],
    "--color-chart-2": TAILWIND_COLORS["orange-500"],
    "--color-chart-3": TAILWIND_COLORS["orange-600"],
    "--color-chart-4": TAILWIND_COLORS["orange-700"],
    "--color-chart-5": TAILWIND_COLORS["orange-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["orange-500"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["orange-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["orange-900"],
  }),

  // ============================================
  // Green 테마 (공식 shadcn.com 값 - lime 팔레트 사용)
  // --primary: Light/Dark 동일, --ring/--sidebar-primary: 다름
  // ============================================
  "green-light": createColorTheme(DEFAULT_LIGHT, {
    "--primary": TAILWIND_COLORS["lime-600"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["lime-400"],
    "--chart-1": TAILWIND_COLORS["green-300"],
    "--chart-2": TAILWIND_COLORS["green-500"],
    "--chart-3": TAILWIND_COLORS["green-600"],
    "--chart-4": TAILWIND_COLORS["green-700"],
    "--chart-5": TAILWIND_COLORS["green-800"],
    "--sidebar-primary": TAILWIND_COLORS["lime-600"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["lime-50"],
    "--sidebar-ring": TAILWIND_COLORS["lime-400"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["lime-600"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["lime-400"],
    "--color-chart-1": TAILWIND_COLORS["green-300"],
    "--color-chart-2": TAILWIND_COLORS["green-500"],
    "--color-chart-3": TAILWIND_COLORS["green-600"],
    "--color-chart-4": TAILWIND_COLORS["green-700"],
    "--color-chart-5": TAILWIND_COLORS["green-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["lime-600"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["lime-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["lime-400"],
  }),
  "green-dark": createColorTheme(DEFAULT_DARK, {
    "--primary": TAILWIND_COLORS["lime-600"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["lime-900"],
    "--chart-1": TAILWIND_COLORS["green-300"],
    "--chart-2": TAILWIND_COLORS["green-500"],
    "--chart-3": TAILWIND_COLORS["green-600"],
    "--chart-4": TAILWIND_COLORS["green-700"],
    "--chart-5": TAILWIND_COLORS["green-800"],
    "--sidebar-primary": TAILWIND_COLORS["lime-500"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["lime-50"],
    "--sidebar-ring": TAILWIND_COLORS["lime-900"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["lime-600"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["lime-900"],
    "--color-chart-1": TAILWIND_COLORS["green-300"],
    "--color-chart-2": TAILWIND_COLORS["green-500"],
    "--color-chart-3": TAILWIND_COLORS["green-600"],
    "--color-chart-4": TAILWIND_COLORS["green-700"],
    "--color-chart-5": TAILWIND_COLORS["green-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["lime-500"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["lime-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["lime-900"],
  }),

  // ============================================
  // Blue 테마 (공식 shadcn.com 값)
  // --primary: Light/Dark 동일, --ring/--sidebar-primary: 다름
  // ============================================
  "blue-light": createColorTheme(DEFAULT_LIGHT, {
    "--primary": TAILWIND_COLORS["blue-700"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": "oklch(0.708 0 0)",
    "--chart-1": TAILWIND_COLORS["blue-300"],
    "--chart-2": TAILWIND_COLORS["blue-500"],
    "--chart-3": TAILWIND_COLORS["blue-600"],
    "--chart-4": TAILWIND_COLORS["blue-700"],
    "--chart-5": TAILWIND_COLORS["blue-800"],
    "--sidebar-primary": TAILWIND_COLORS["blue-600"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
    "--sidebar-ring": "oklch(0.708 0 0)",
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["blue-700"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": "oklch(0.708 0 0)",
    "--color-chart-1": TAILWIND_COLORS["blue-300"],
    "--color-chart-2": TAILWIND_COLORS["blue-500"],
    "--color-chart-3": TAILWIND_COLORS["blue-600"],
    "--color-chart-4": TAILWIND_COLORS["blue-700"],
    "--color-chart-5": TAILWIND_COLORS["blue-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["blue-600"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
    "--color-sidebar-ring": "oklch(0.708 0 0)",
  }),
  "blue-dark": createColorTheme(DEFAULT_DARK, {
    "--primary": TAILWIND_COLORS["blue-700"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": "oklch(0.556 0 0)",
    "--chart-1": TAILWIND_COLORS["blue-300"],
    "--chart-2": TAILWIND_COLORS["blue-500"],
    "--chart-3": TAILWIND_COLORS["blue-600"],
    "--chart-4": TAILWIND_COLORS["blue-700"],
    "--chart-5": TAILWIND_COLORS["blue-800"],
    "--sidebar-primary": TAILWIND_COLORS["blue-500"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
    "--sidebar-ring": "oklch(0.556 0 0)",
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["blue-700"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": "oklch(0.556 0 0)",
    "--color-chart-1": TAILWIND_COLORS["blue-300"],
    "--color-chart-2": TAILWIND_COLORS["blue-500"],
    "--color-chart-3": TAILWIND_COLORS["blue-600"],
    "--color-chart-4": TAILWIND_COLORS["blue-700"],
    "--color-chart-5": TAILWIND_COLORS["blue-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["blue-500"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["blue-50"],
    "--color-sidebar-ring": "oklch(0.556 0 0)",
  }),

  // ============================================
  // Yellow 테마 (공식 shadcn.com 값)
  // Light: --primary 0.852, Dark: --primary 0.795 (예외: Dark가 더 어두움)
  // ============================================
  "yellow-light": createColorTheme(DEFAULT_LIGHT, {
    "--primary": TAILWIND_COLORS["yellow-400"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["yellow-400"],
    "--chart-1": TAILWIND_COLORS["yellow-300"],
    "--chart-2": TAILWIND_COLORS["yellow-500"],
    "--chart-3": TAILWIND_COLORS["yellow-600"],
    "--chart-4": TAILWIND_COLORS["yellow-700"],
    "--chart-5": TAILWIND_COLORS["yellow-800"],
    "--sidebar-primary": TAILWIND_COLORS["yellow-600"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["yellow-50"],
    "--sidebar-ring": TAILWIND_COLORS["yellow-400"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["yellow-400"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["yellow-400"],
    "--color-chart-1": TAILWIND_COLORS["yellow-300"],
    "--color-chart-2": TAILWIND_COLORS["yellow-500"],
    "--color-chart-3": TAILWIND_COLORS["yellow-600"],
    "--color-chart-4": TAILWIND_COLORS["yellow-700"],
    "--color-chart-5": TAILWIND_COLORS["yellow-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["yellow-600"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["yellow-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["yellow-400"],
  }),
  "yellow-dark": createColorTheme(DEFAULT_DARK, {
    "--primary": TAILWIND_COLORS["yellow-500"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["yellow-900"],
    "--chart-1": TAILWIND_COLORS["yellow-300"],
    "--chart-2": TAILWIND_COLORS["yellow-500"],
    "--chart-3": TAILWIND_COLORS["yellow-600"],
    "--chart-4": TAILWIND_COLORS["yellow-700"],
    "--chart-5": TAILWIND_COLORS["yellow-800"],
    "--sidebar-primary": TAILWIND_COLORS["yellow-500"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["yellow-50"],
    "--sidebar-ring": TAILWIND_COLORS["yellow-900"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["yellow-500"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["yellow-900"],
    "--color-chart-1": TAILWIND_COLORS["yellow-300"],
    "--color-chart-2": TAILWIND_COLORS["yellow-500"],
    "--color-chart-3": TAILWIND_COLORS["yellow-600"],
    "--color-chart-4": TAILWIND_COLORS["yellow-700"],
    "--color-chart-5": TAILWIND_COLORS["yellow-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["yellow-500"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["yellow-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["yellow-900"],
  }),

  // ============================================
  // Violet 테마 (공식 shadcn.com 값)
  // Light: --primary 0.541, Dark: --primary 0.606 (더 밝음)
  // ============================================
  "violet-light": createColorTheme(DEFAULT_LIGHT, {
    "--primary": TAILWIND_COLORS["violet-600"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["violet-400"],
    "--chart-1": TAILWIND_COLORS["violet-300"],
    "--chart-2": TAILWIND_COLORS["violet-500"],
    "--chart-3": TAILWIND_COLORS["violet-600"],
    "--chart-4": TAILWIND_COLORS["violet-700"],
    "--chart-5": TAILWIND_COLORS["violet-800"],
    "--sidebar-primary": TAILWIND_COLORS["violet-600"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["violet-50"],
    "--sidebar-ring": TAILWIND_COLORS["violet-400"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["violet-600"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["violet-400"],
    "--color-chart-1": TAILWIND_COLORS["violet-300"],
    "--color-chart-2": TAILWIND_COLORS["violet-500"],
    "--color-chart-3": TAILWIND_COLORS["violet-600"],
    "--color-chart-4": TAILWIND_COLORS["violet-700"],
    "--color-chart-5": TAILWIND_COLORS["violet-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["violet-600"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["violet-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["violet-400"],
  }),
  "violet-dark": createColorTheme(DEFAULT_DARK, {
    "--primary": TAILWIND_COLORS["violet-500"],
    // 🎯 FIX-041: Primary 버튼 텍스트 = 순수 흰색
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": TAILWIND_COLORS["violet-900"],
    "--chart-1": TAILWIND_COLORS["violet-300"],
    "--chart-2": TAILWIND_COLORS["violet-500"],
    "--chart-3": TAILWIND_COLORS["violet-600"],
    "--chart-4": TAILWIND_COLORS["violet-700"],
    "--chart-5": TAILWIND_COLORS["violet-800"],
    "--sidebar-primary": TAILWIND_COLORS["violet-500"],
    "--sidebar-primary-foreground": TAILWIND_COLORS["violet-50"],
    "--sidebar-ring": TAILWIND_COLORS["violet-900"],
    // --color-* 변수
    "--color-primary": TAILWIND_COLORS["violet-500"],
    "--color-primary-foreground": "oklch(1 0 0)", // 순수 흰색
    "--color-ring": TAILWIND_COLORS["violet-900"],
    "--color-chart-1": TAILWIND_COLORS["violet-300"],
    "--color-chart-2": TAILWIND_COLORS["violet-500"],
    "--color-chart-3": TAILWIND_COLORS["violet-600"],
    "--color-chart-4": TAILWIND_COLORS["violet-700"],
    "--color-chart-5": TAILWIND_COLORS["violet-800"],
    "--color-sidebar-primary": TAILWIND_COLORS["violet-500"],
    "--color-sidebar-primary-foreground": TAILWIND_COLORS["violet-50"],
    "--color-sidebar-ring": TAILWIND_COLORS["violet-900"],
  }),
};
