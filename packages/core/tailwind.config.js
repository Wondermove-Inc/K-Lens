/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

module.exports = {
  // 🎯 목적: TSX 파일과 CSS 파일 모두 스캔하여 테마 선택자 유지
  // 📝 주의: global.css의 html.theme-* 선택자가 tree-shake되지 않도록 CSS 포함
  // 📝 2026-01-18: Streamdown 스타일 포함 추가 (스트리밍 Markdown 렌더링)
  content: ["src/**/*.tsx", "src/**/*.css", "./node_modules/streamdown/dist/*.js"],
  darkMode: "class",
  // 🎯 2026-01-07:, 해결 - Diff 색상 클래스 강제 포함
  // 📝 JIT 컴파일러가 동적 클래스를 인식하지 못해 제거되는 문제 방지
  // 🎯 THEME-040: 테마 선택자 강제 포함 (동적 클래스 적용으로 JIT가 인식 못함)
  safelist: [
    // 🎯 THEME-040: 테마 CSS 블록 보존 - html.theme-* 선택자
    // 📝 JavaScript가 런타임에 동적으로 추가하므로 JIT가 tree-shake함
    { pattern: /^theme-default-(light|dark)$/ },
    // Diff 추가 라인 (초록)
    "bg-green-100",
    "dark:bg-green-900/80",
    "text-green-900",
    "dark:text-green-100",
    "text-green-600",
    "dark:text-green-400",
    // Diff 삭제 라인 (빨강)
    "bg-red-100",
    "dark:bg-red-900/80",
    "text-red-900",
    "dark:text-red-100",
    "text-red-600",
    "dark:text-red-400",
    // Diff 헤더 라인 (파랑)
    "bg-blue-100",
    "dark:bg-blue-900/80",
    "text-blue-700",
    "dark:text-blue-200",
    // Diff 변경 없음 라인 (회색)
    "bg-slate-50",
    "dark:bg-slate-800",
    "text-slate-800",
    "dark:text-slate-200",
    // 🎯 Tool 승인 결과 YAML 미리보기 색상
    "dark:bg-slate-900",
    "text-slate-100",
    "dark:text-slate-100",
    // 🎯 새 파일 배지 색상
    "bg-green-900/50",
    "dark:bg-green-900/50",
    "text-green-300",
    "dark:text-green-300",
    "bg-red-900/50",
    "dark:bg-red-900/50",
    "text-red-300",
    "dark:text-red-300",
    "bg-yellow-900/50",
    "dark:bg-yellow-900/50",
    "text-yellow-300",
    "dark:text-yellow-300",
    // 🎯 승인 결과 배지 색상
    "bg-green-500/10",
    "text-green-400",
    "dark:text-green-400",
    "bg-red-500/10",
    "text-red-400",
    "dark:text-red-400",
    // 🎯 THEME-040: Semantic Status 클래스 (getStatusClasses 반환값)
    // 📝 JIT가 동적 문자열 조합을 인식 못함 - semantic-status.ts에서 사용
    "bg-semantic-running",
    "bg-semantic-success",
    "bg-semantic-warning",
    "bg-semantic-error",
    "bg-semantic-neutral",
    "text-semantic-running-text",
    "text-semantic-success-text",
    "text-semantic-warning-text",
    "text-semantic-error-text",
    "text-semantic-neutral-text",
    // 🎯 THEME-040: Badge Status 클래스 (getBadgeStatusClasses 반환값)
    "bg-badge-running-bg",
    "bg-badge-succeeded-bg",
    "bg-badge-pending-bg",
    "bg-badge-failed-bg",
    "bg-badge-unknown-bg",
    "text-badge-running-fg",
    "text-badge-succeeded-fg",
    "text-badge-pending-fg",
    "text-badge-failed-fg",
    "text-badge-unknown-fg",
    "hover:opacity-90",
    // Security severity badge (SEVERITY_COLOR Record dynamic lookup)
    "dark:bg-red-900/40",
    "dark:text-red-400",
    "dark:bg-orange-900/40",
    "dark:text-orange-400",
    "bg-yellow-200",
    "text-yellow-900",
    "dark:bg-yellow-400",
    "dark:text-yellow-950",
    "dark:bg-blue-900/40",
    "dark:text-blue-400",
    "bg-gray-200",
    "text-gray-800",
    "dark:bg-gray-600",
    "dark:text-white",
    "border-gray-400",
    "dark:border-gray-500",
  ],
  theme: {
    // 🎯 폰트는 global.css의 @theme 블록에서 정의 (Tailwind v4 방식)
    // fontFamily.sans는 @theme의 --font-sans로 자동 매핑됨
    extend: {
      colors: {
        textAccent: "var(--textColorAccent)",
        textPrimary: "var(--textColorPrimary)",
        textTertiary: "var(--textColorTertiary)",
        textDimmed: "var(--textColorDimmed)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
