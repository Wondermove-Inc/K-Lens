/**
 * 🎯 THEME-005: Semantic Dark Tokens
 * 📝 의미 기반 토큰 - Dark 테마
 * 🔄 PRIMITIVE만 참조, Soft Contrast (12:1)
 *
 * Layer 2 - Semantic Layer
 * - Primitive 토큰을 의미 있는 이름으로 매핑
 * - 컴포넌트에서 직접 사용
 */

import { PRIMITIVE } from "./primitives";

const { neutral, blue, red, green, amber, sky, violet, ansiDark, special } = PRIMITIVE;

/**
 * Semantic Dark 토큰
 * ShadCN + DAIVE 변수 통합
 * 🎯 FIX-042: Soft Contrast 적용 (off-white 텍스트)
 */
export const SEMANTIC_DARK = {
  // ================================
  // 🎯 기본 색상 (Base Colors)
  // ================================

  /** 메인 배경 - deep dark (#0D0D0D) */
  background: neutral[950],
  /** 메인 텍스트 - off-white (#EDEDED) - Soft Contrast 12:1 */
  foreground: "#EDEDED",

  /** 카드/패널 배경 */
  card: neutral[925],
  cardForeground: "#EDEDED",

  /** 팝오버/드롭다운 배경 */
  popover: neutral[925],
  popoverForeground: "#EDEDED",

  /** Primary 액센트 - blue-700 */
  primary: blue[700],
  primaryForeground: special.white,

  /** Secondary - 약한 강조 */
  secondary: neutral[850],
  secondaryForeground: neutral[400],

  /** Muted - 비활성/보조 텍스트 */
  muted: neutral[850],
  mutedForeground: neutral[500], // WCAG AA

  /** Accent - 호버/선택 강조 */
  accent: neutral[850],
  accentForeground: "#EDEDED",

  /** Destructive - 삭제/위험 */
  destructive: red[400],
  destructiveForeground: neutral[50],

  /** 보더/구분선 - 투명도 사용 */
  border: "rgba(255, 255, 255, 0.12)",
  /** 입력 필드 보더 */
  input: "rgba(255, 255, 255, 0.15)",
  /** 포커스 링 */
  ring: neutral[600],

  // ================================
  // 🎯 차트 색상 (Charts)
  // ================================

  chart1: blue[700],
  chart2: green[500],
  chart3: amber[300],
  chart4: violet[500],
  chart5: red[500],

  // ================================
  // 🎯 사이드바 (Sidebar)
  // ================================

  sidebar: neutral[940],
  sidebarForeground: "#EDEDED",
  sidebarPrimary: neutral[300],
  sidebarPrimaryForeground: neutral[925],
  sidebarAccent: neutral[850],
  sidebarAccentForeground: "#EDEDED",
  sidebarBorder: "rgba(255, 255, 255, 0.20)", // 트리 라인 가시성
  sidebarRing: neutral[600],

  // ================================
  // 🎯 터미널 (Terminal)
  // ================================

  terminalForeground: "#CCCCCC",
  terminalBackground: neutral[950],
  terminalCursor: special.white,
  terminalCursorAccent: neutral[950],
  terminalSelectionBackground: special.selectionDark,

  // ANSI 16색
  terminalBlack: ansiDark.black,
  terminalRed: ansiDark.red,
  terminalGreen: ansiDark.green,
  terminalYellow: ansiDark.yellow,
  terminalBlue: ansiDark.blue,
  terminalMagenta: ansiDark.magenta,
  terminalCyan: ansiDark.cyan,
  terminalWhite: ansiDark.white,
  terminalBrightBlack: ansiDark.brightBlack,
  terminalBrightRed: ansiDark.brightRed,
  terminalBrightGreen: ansiDark.brightGreen,
  terminalBrightYellow: ansiDark.brightYellow,
  terminalBrightBlue: ansiDark.brightBlue,
  terminalBrightMagenta: ansiDark.brightMagenta,
  terminalBrightCyan: ansiDark.brightCyan,
  terminalBrightWhite: ansiDark.brightWhite,

  // ================================
  // 🎯 워크로드 상태 (Workload Status)
  // ================================

  workloadSucceeded: sky[300],
  workloadRunning: blue[500],
  workloadPending: amber[300],
  workloadFailed: red[400],

  // ================================
  // 🎯 상태바 (Status Bar)
  // ================================

  statusBarBg: neutral[940],
  statusBarForeground: neutral[500],
  statusBarBorderColor: "rgba(255, 255, 255, 0.20)",
  statusBarHoverBg: "rgba(255, 255, 255, 0.12)",

  // ================================
  // 🎯 로그 (Logs)
  // ================================

  logsForeground: special.white,
  logsBackground: neutral[950],

  // ================================
  // 🎯 진행률 (Progress)
  // ================================

  progressBackground: blue[500],

  // ================================
  // 🎯 코드/표면 (Code/Surface)
  // ================================

  surface: neutral[925],
  surfaceForeground: "#EDEDED",
  code: neutral[850],
  codeForeground: "#EDEDED",
  codeHighlight: amber[900],
  codeNumber: blue[400],

  // ================================
  // 🎯 선택 영역 (Selection)
  // ================================

  selection: blue[800],
  selectionForeground: "#EDEDED",
} as const;

export type SemanticDarkTokens = typeof SEMANTIC_DARK;
export type SemanticDarkKey = keyof SemanticDarkTokens;
