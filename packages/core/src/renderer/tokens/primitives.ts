/**
 * 🎯 THEME-003: Primitive Tokens
 * 📝 모든 색상의 단일 진실의 원천 (Single Source of Truth)
 * 🔄 Tailwind CSS v4 + OKLCH 색상 시스템
 *
 * Layer 1 - Primitive Layer
 * - 순수 색상 값만 정의 (의미 없음)
 * - 다른 토큰 참조 금지
 * - HEX 형식 + OKLCH 주석
 */

/**
 * Neutral 색상 팔레트 (Gray Scale)
 * Tailwind neutral 팔레트 기반
 */
export const neutral = {
  /** oklch(0.985 0 0) - 가장 밝은 배경 */
  50: "#FAFAFA",
  /** oklch(0.96 0 0) - 카드/세컨더리 배경 */
  100: "#F5F5F5",
  /** oklch(0.922 0 0) - 호버 배경 */
  200: "#E8E8E8",
  /** oklch(0.90 0 0) - 보더/입력 */
  300: "#E5E5E5",
  /** oklch(0.85 0 0) - 비활성 텍스트 */
  400: "#D4D4D4",
  /** oklch(0.70 0 0) - Muted 텍스트 (Dark) */
  500: "#B0B0B0",
  /** oklch(0.556 0 0) - 중간 회색 */
  600: "#8A8A8A",
  /** oklch(0.45 0 0) - Muted 텍스트 (Light) */
  700: "#6B6B6B",
  /** oklch(0.25 0 0) - Secondary 텍스트 (Light) */
  800: "#3D3D3D",
  /** oklch(0.22 0 0) - Muted 배경 (Dark) */
  850: "#333333",
  /** oklch(0.15 0 0) - Primary 텍스트 (Light) */
  900: "#212121",
  /** oklch(0.16 0 0) - 카드 배경 (Dark) */
  925: "#1F1F1F",
  /** oklch(0.14 0 0) - 사이드바 배경 (Dark) */
  940: "#1A1A1A",
  /** oklch(0.10 0 0) - 가장 어두운 배경 */
  950: "#0D0D0D",
} as const;

/**
 * Blue 색상 팔레트
 * Primary 액센트 색상
 */
export const blue = {
  50: "#F0F9FF",
  100: "#E0F2FE",
  200: "#BAE6FD",
  300: "#7DD3FC",
  400: "#38BDF8",
  /** oklch(0.623 0.214 259.815) - Blue 500 */
  500: "#3B82F6",
  /** oklch(0.546 0.245 262.881) - Blue 600 */
  600: "#2563EB",
  /** oklch(0.488 0.243 264.376) - Blue 700 (Primary) */
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
  950: "#082F49",
} as const;

/**
 * Red 색상 팔레트
 * Destructive/Error 색상
 */
export const red = {
  50: "#FEF2F2",
  100: "#FEE2E2",
  200: "#FECACA",
  300: "#FCA5A5",
  /** oklch(0.704 0.191 22.216) - Red 400 (Failed) */
  400: "#F87171",
  500: "#EF4444",
  /** oklch(0.577 0.245 27.325) - Red 600 (Destructive) */
  600: "#DC2626",
  700: "#B91C1C",
  800: "#991B1B",
  900: "#7F1D1D",
  950: "#4C0519",
} as const;

/**
 * Green 색상 팔레트
 * Success 색상
 */
export const green = {
  50: "#F0FDF4",
  100: "#DCFCE7",
  200: "#BBFBBA",
  300: "#86EFAC",
  400: "#4ADE80",
  500: "#22C55E",
  600: "#16A34A",
  700: "#15803D",
  800: "#166534",
  900: "#145231",
  950: "#051E11",
} as const;

/**
 * Lime 색상 팔레트
 * Green Primary 대안
 */
export const lime = {
  50: "#F7FEE7",
  100: "#ECFDF5",
  200: "#D9F97F",
  300: "#BEF264",
  400: "#A4E635",
  500: "#84CC16",
  600: "#65A30D",
  700: "#4B7506",
  800: "#3F6212",
  900: "#365314",
  950: "#1A202C",
} as const;

/**
 * Orange 색상 팔레트
 * Chart 색상
 */
export const orange = {
  50: "#FFF7ED",
  100: "#FFEDD5",
  200: "#FED7AA",
  300: "#FDBA74",
  400: "#FB923C",
  500: "#F97316",
  /** oklch(0.646 0.222 41.116) - Chart-1 */
  600: "#EA580C",
  700: "#C2410C",
  800: "#9A3412",
  900: "#7C2D12",
  950: "#431407",
} as const;

/**
 * Amber/Yellow 색상 팔레트
 * Warning/Pending 색상
 */
export const amber = {
  50: "#FFFBEB",
  100: "#FEF3C7",
  200: "#FDE68A",
  /** oklch(0.905 0.182 98.111) - Pending */
  300: "#FCD34D",
  400: "#FBBF24",
  500: "#F59E0B",
  600: "#D97706",
  700: "#B45309",
  800: "#92400E",
  900: "#78350F",
  950: "#451A03",
} as const;

/**
 * Sky 색상 팔레트
 * 정보/성공 상태 색상
 */
export const sky = {
  50: "#F0F9FF",
  100: "#E0F2FE",
  200: "#BAE6FD",
  /** oklch(0.827 0.119 214.405) - Succeeded */
  300: "#7DD3FC",
  400: "#38BDF8",
  500: "#0EA5E9",
  600: "#0284C7",
  700: "#0369A1",
  800: "#075985",
  900: "#0C4A6E",
  950: "#082F49",
} as const;

/**
 * Violet 색상 팔레트
 * 보조 액센트 색상
 */
export const violet = {
  50: "#F5F3FF",
  100: "#EDE9FE",
  200: "#DDD6FE",
  300: "#C4B5FD",
  400: "#A78BFA",
  500: "#8B5CF6",
  600: "#7C3AED",
  700: "#6D28D9",
  800: "#5B21B6",
  900: "#4C1D95",
  950: "#2E1065",
} as const;

/**
 * ANSI 터미널 기본 색상 (Light 테마)
 * VSCode Light+ 기반
 */
export const ansiLight = {
  black: "#000000",
  red: "#CD3131",
  green: "#00BC00",
  yellow: "#949800",
  blue: "#0451A5",
  magenta: "#BC05BC",
  cyan: "#0598BC",
  white: "#555555",
  brightBlack: "#666666",
  brightRed: "#CD3131",
  brightGreen: "#14CE14",
  brightYellow: "#B5BA00",
  brightBlue: "#0451A5",
  brightMagenta: "#BC05BC",
  brightCyan: "#0598BC",
  brightWhite: "#A5A5A5",
} as const;

/**
 * ANSI 터미널 기본 색상 (Dark 테마)
 * VSCode Dark+ 기반
 */
export const ansiDark = {
  black: "#000000",
  red: "#CD3131",
  green: "#0DBC79",
  yellow: "#E5E510",
  blue: "#2472C8",
  magenta: "#BC3FBC",
  cyan: "#11A8CD",
  white: "#E5E5E5",
  brightBlack: "#666666",
  brightRed: "#F14C4C",
  brightGreen: "#23D18B",
  brightYellow: "#F5F543",
  brightBlue: "#3B8EEA",
  brightMagenta: "#D670D6",
  brightCyan: "#29B8DB",
  brightWhite: "#E5E5E5",
} as const;

/**
 * 특수 색상 (Lens 레거시 호환)
 */
export const special = {
  /** 순수 흰색 - 버튼 텍스트 */
  white: "#FFFFFF",
  /** 순수 검정 */
  black: "#000000",
  /** Magenta 액센트 */
  magenta: "#C93DCE",
  /** Golden 배지/경고 */
  golden: "#FFC63D",
  /** 반투명 회색 (50% alpha) */
  halfGray: "#87909C80",
  /** 코드 에디터 배경 (예외) */
  dockEditorBackground: "#24292E",
  /** 선택 영역 (Light) */
  selectionLight: "#ADD6FF",
  /** 선택 영역 (Dark) */
  selectionDark: "#264F78",
} as const;

/**
 * 통합 Primitive 토큰
 */
export const PRIMITIVE = {
  neutral,
  blue,
  red,
  green,
  lime,
  orange,
  amber,
  sky,
  violet,
  ansiLight,
  ansiDark,
  special,
} as const;

export type PrimitiveColors = typeof PRIMITIVE;
export type NeutralScale = keyof typeof neutral;
export type BlueScale = keyof typeof blue;
export type RedScale = keyof typeof red;
export type GreenScale = keyof typeof green;
