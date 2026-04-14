/**
 * 🎯 THEME-007: CSS Variable Generator
 * 📝 TypeScript 토큰 → CSS 변수 자동 생성
 *
 * 사용법:
 *   pnpm tsx packages/core/src/renderer/themes/generate-css-vars.ts
 *   또는 build:theme 스크립트로 실행
 */

import { SEMANTIC_DARK } from "../tokens/semantic-dark";
import { SEMANTIC_LIGHT } from "../tokens/semantic-light";

/**
 * camelCase를 kebab-case로 변환
 * @example camelToKebab('backgroundColor') => 'background-color'
 */
export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * 토큰 객체를 CSS 변수 문자열로 변환
 * @param tokens - Semantic 토큰 객체
 * @param prefix - CSS 변수 접두사 (기본: '')
 * @returns CSS 변수 선언 문자열
 */
export function tokensToCSSVariables(tokens: Record<string, string>, prefix: string = ""): string {
  return Object.entries(tokens)
    .map(([key, value]) => {
      const varName = prefix ? `--${prefix}-${camelToKebab(key)}` : `--${camelToKebab(key)}`;
      return `  ${varName}: ${value};`;
    })
    .join("\n");
}

/**
 * Tailwind CSS v4 색상 변수 생성
 * @param tokens - Semantic 토큰 객체
 * @returns --color-* 형식의 CSS 변수 선언
 */
export function tokensToTailwindColorVars(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => {
      const varName = `--color-${camelToKebab(key)}`;
      const refVarName = `--${camelToKebab(key)}`;
      return `  ${varName}: var(${refVarName});`;
    })
    .join("\n");
}

/**
 * Light 테마 CSS 생성
 */
export function generateLightThemeCSS(): string {
  const vars = tokensToCSSVariables(SEMANTIC_LIGHT as unknown as Record<string, string>);
  return `html:where(.theme-default-light) {\n${vars}\n}`;
}

/**
 * Dark 테마 CSS 생성
 */
export function generateDarkThemeCSS(): string {
  const vars = tokensToCSSVariables(SEMANTIC_DARK as unknown as Record<string, string>);
  return `html:where(.theme-default-dark) {\n${vars}\n}`;
}

/**
 * Tailwind @theme inline 블록 생성
 */
export function generateTailwindThemeInline(): string {
  const colorVars = tokensToTailwindColorVars(SEMANTIC_LIGHT as unknown as Record<string, string>);
  return `@theme inline {\n${colorVars}\n}`;
}

/**
 * 전체 테마 CSS 파일 생성
 * @returns 완전한 CSS 문자열
 */
export function generateFullThemeCSS(): string {
  const header = `/**
 * 🎯 자동 생성된 테마 CSS 변수
 * 📝 이 파일은 generate-css-vars.ts에 의해 자동 생성됩니다.
 * 🔄 수정하지 마세요. 토큰 파일을 수정 후 pnpm build:theme 실행
 * 생성 시각: ${new Date().toISOString()}
 */

`;

  const lightTheme = generateLightThemeCSS();
  const darkTheme = generateDarkThemeCSS();

  return `${header}${lightTheme}\n\n${darkTheme}`;
}

/**
 * CSS 변수 개수 통계
 */
export function getVariableStats(): { light: number; dark: number; total: number } {
  const lightCount = Object.keys(SEMANTIC_LIGHT).length;
  const darkCount = Object.keys(SEMANTIC_DARK).length;
  return {
    light: lightCount,
    dark: darkCount,
    total: lightCount + darkCount,
  };
}

// CLI 실행 시 CSS 출력
if (require.main === module) {
  console.log(generateFullThemeCSS());
}
