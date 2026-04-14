/**
 * 🎯 THEME-006: Theme TypeScript Type Definitions
 * 📝 3-Layer Design Token 타입 시스템
 *
 * 특징:
 * - 자동 타입 추론 (typeof + as const)
 * - IDE 자동완성 지원
 * - 런타임 안전성 보장
 */

import type { BlueScale, GreenScale, NeutralScale, PrimitiveColors, RedScale } from "../tokens/primitives";
import type { SemanticDarkKey, SemanticDarkTokens } from "../tokens/semantic-dark";
import type { SemanticLightKey, SemanticLightTokens } from "../tokens/semantic-light";

// ================================
// 🎯 색상 값 타입
// ================================

/** HEX 색상 형식 */
export type HexColor = `#${string}`;

/** OKLCH 색상 형식 */
export type OKLCHColor = `oklch(${string})`;

/** RGBA 색상 형식 */
export type RGBAColor = `rgba(${string})`;

/** CSS 변수 참조 */
export type CSSVariableRef = `var(--${string})`;

/** 모든 색상 값 타입 */
export type ColorValue = HexColor | OKLCHColor | RGBAColor | CSSVariableRef;

// ================================
// 🎯 토큰 키 타입
// ================================

/** Semantic 토큰 키 (Light/Dark 공통) */
export type SemanticTokenKey = SemanticLightKey;

/** Semantic 토큰 값 (Light) */
export type SemanticLightValue = SemanticLightTokens[SemanticLightKey];

/** Semantic 토큰 값 (Dark) */
export type SemanticDarkValue = SemanticDarkTokens[SemanticDarkKey];

// ================================
// 🎯 CSS 변수 이름 타입
// ================================

/** camelCase를 kebab-case로 변환하는 타입 유틸리티 */
type CamelToKebab<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? "-" : ""}${Lowercase<T>}${CamelToKebab<U>}`
  : S;

/** Semantic 토큰 키에서 CSS 변수 이름 생성 */
export type SemanticCSSVarName = `--${CamelToKebab<SemanticTokenKey>}`;

/** Tailwind CSS 색상 변수 이름 */
export type TailwindColorVarName = `--color-${CamelToKebab<SemanticTokenKey>}`;

// ================================
// 🎯 테마 모드 타입
// ================================

/** 테마 모드 */
export type ThemeMode = "light" | "dark";

/** 테마 이름 */
export type ThemeName =
  | "default-light"
  | "default-dark"
  | "blue-light"
  | "blue-dark"
  | "red-light"
  | "red-dark"
  | "green-light"
  | "green-dark"
  | "orange-light"
  | "orange-dark"
  | "violet-light"
  | "violet-dark";

// ================================
// 🎯 테마 객체 타입
// ================================

/** 완전한 테마 정의 */
export interface ThemeDefinition {
  name: ThemeName;
  mode: ThemeMode;
  tokens: SemanticLightTokens | SemanticDarkTokens;
}

/** 테마 토큰 맵 */
export type ThemeTokenMap = {
  light: SemanticLightTokens;
  dark: SemanticDarkTokens;
};

// ================================
// 🎯 유틸리티 타입
// ================================

/** 토큰 키로 CSS 변수 참조 생성 */
export type GetCSSVar<K extends SemanticTokenKey> = `var(--${CamelToKebab<K>})`;

/** 토큰 키로 Tailwind 색상 변수 참조 생성 */
export type GetTailwindColorVar<K extends SemanticTokenKey> = `var(--color-${CamelToKebab<K>})`;

// ================================
// 🎯 Re-exports
// ================================

export type {
  PrimitiveColors,
  NeutralScale,
  BlueScale,
  RedScale,
  GreenScale,
  SemanticLightTokens,
  SemanticDarkTokens,
  SemanticLightKey,
  SemanticDarkKey,
};
