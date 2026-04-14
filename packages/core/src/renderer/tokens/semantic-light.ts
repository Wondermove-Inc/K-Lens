/**
 * 🎯 THEME-004: Semantic Light Tokens
 * 📝 의미 기반 토큰 - Light 테마
 * 🔄 PRIMITIVE만 참조, WCAG AA 준수 (4.5:1)
 *
 * Layer 2 - Semantic Layer
 * - Primitive 토큰을 의미 있는 이름으로 매핑
 * - 컴포넌트에서 직접 사용
 */

import { PRIMITIVE } from "./primitives";

const { neutral, blue, red, amber, sky, orange, ansiLight, special } = PRIMITIVE;

/**
 * Semantic Light 토큰
 * ShadCN + DAIVE 변수 통합
 */
export const SEMANTIC_LIGHT = {
  // ================================
  // 🎯 기본 색상 (Base Colors)
  // ================================

  /** 메인 배경 - off-white (#FAFAFA) */
  background: neutral[50],
  /** 메인 텍스트 - near-black (#212121) */
  foreground: neutral[900],

  /** 카드/패널 배경 */
  card: special.white,
  cardForeground: neutral[900],

  /** 팝오버/드롭다운 배경 */
  popover: special.white,
  popoverForeground: neutral[900],

  /** Primary 액센트 - blue-700 */
  primary: blue[700],
  primaryForeground: special.white,

  /** Secondary - 약한 강조 */
  secondary: neutral[100],
  secondaryForeground: neutral[800],

  /** Muted - 비활성/보조 텍스트 */
  muted: neutral[100],
  mutedForeground: neutral[700], // WCAG AA 4.7:1

  /** Accent - 호버/선택 강조 */
  accent: neutral[100],
  accentForeground: neutral[900],

  /** Destructive - 삭제/위험 */
  destructive: red[600],
  destructiveForeground: special.white,

  /** 보더/구분선 */
  border: neutral[300],
  /** 입력 필드 보더 */
  input: neutral[300],
  /** 포커스 링 */
  ring: neutral[600],

  // ================================
  // 🎯 차트 색상 (Charts)
  // ================================

  chart1: orange[600],
  chart2: "#0D9488", // Teal
  chart3: "#1E3A5F", // Dark Blue
  chart4: amber[400],
  chart5: amber[300],

  // ================================
  // 🎯 사이드바 (Sidebar)
  // ================================

  sidebar: neutral[50],
  sidebarForeground: neutral[900],
  sidebarPrimary: neutral[900],
  sidebarPrimaryForeground: neutral[50],
  sidebarAccent: neutral[100],
  sidebarAccentForeground: neutral[900],
  sidebarBorder: neutral[300],
  sidebarRing: neutral[600],

  // ================================
  // 🎯 터미널 (Terminal)
  // ================================

  terminalForeground: "#333333",
  terminalBackground: neutral[50],
  terminalCursor: "#333333",
  terminalCursorAccent: neutral[50],
  terminalSelectionBackground: special.selectionLight,

  // ANSI 16색
  terminalBlack: ansiLight.black,
  terminalRed: ansiLight.red,
  terminalGreen: ansiLight.green,
  terminalYellow: ansiLight.yellow,
  terminalBlue: ansiLight.blue,
  terminalMagenta: ansiLight.magenta,
  terminalCyan: ansiLight.cyan,
  terminalWhite: ansiLight.white,
  terminalBrightBlack: ansiLight.brightBlack,
  terminalBrightRed: ansiLight.brightRed,
  terminalBrightGreen: ansiLight.brightGreen,
  terminalBrightYellow: ansiLight.brightYellow,
  terminalBrightBlue: ansiLight.brightBlue,
  terminalBrightMagenta: ansiLight.brightMagenta,
  terminalBrightCyan: ansiLight.brightCyan,
  terminalBrightWhite: ansiLight.brightWhite,

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

  statusBarBg: neutral[50],
  statusBarForeground: neutral[700],
  statusBarBorderColor: neutral[300],
  statusBarHoverBg: "rgba(0, 0, 0, 0.08)",

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

  surface: neutral[100],
  surfaceForeground: neutral[900],
  code: neutral[100],
  codeForeground: neutral[900],
  codeHighlight: amber[200],
  codeNumber: blue[700],

  // ================================
  // 🎯 선택 영역 (Selection)
  // ================================

  selection: blue[200],
  selectionForeground: neutral[900],
} as const;

export type SemanticLightTokens = typeof SEMANTIC_LIGHT;
export type SemanticLightKey = keyof SemanticLightTokens;
