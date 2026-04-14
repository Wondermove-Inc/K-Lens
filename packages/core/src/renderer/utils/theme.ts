/**
 * 🎯 THEME-008: Theme Utility Functions
 * 📝 타입 안전한 CSS 변수 접근 유틸리티
 *
 * 사용법:
 *   import { getColorToken, getTailwindColorToken } from '@/utils/theme';
 *
 *   // ShadCN 스타일
 *   <div style={{ backgroundColor: getColorToken('background') }} />
 *
 *   // Tailwind 스타일
 *   <div className={`bg-[${getTailwindColorToken('primary')}]`} />
 */

import type { SemanticTokenKey } from "../types/theme";

/**
 * camelCase를 kebab-case로 변환
 * @param str - camelCase 문자열
 * @returns kebab-case 문자열
 * @example camelToKebab('backgroundColor') => 'background-color'
 */
export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * Semantic 토큰 키에서 ShadCN CSS 변수 참조 생성
 * @param token - Semantic 토큰 키
 * @returns var(--token-name) 형식의 CSS 변수 참조
 * @example getColorToken('background') => 'var(--background)'
 */
export function getColorToken(token: SemanticTokenKey): string {
  return `var(--${camelToKebab(token)})`;
}

/**
 * Semantic 토큰 키에서 Tailwind CSS v4 색상 변수 참조 생성
 * @param token - Semantic 토큰 키
 * @returns var(--color-token-name) 형식의 CSS 변수 참조
 * @example getTailwindColorToken('primary') => 'var(--color-primary)'
 */
export function getTailwindColorToken(token: SemanticTokenKey): string {
  return `var(--color-${camelToKebab(token)})`;
}

/**
 * CSS 변수에서 실제 색상 값 가져오기 (런타임)
 * @param varName - CSS 변수 이름 (--prefix 포함)
 * @param element - 대상 요소 (기본: document.documentElement)
 * @returns 계산된 색상 값
 */
export function getCSSVariableValue(varName: string, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(varName).trim();
}

/**
 * Semantic 토큰의 실제 색상 값 가져오기 (런타임)
 * @param token - Semantic 토큰 키
 * @returns 계산된 색상 값
 */
export function getResolvedColor(token: SemanticTokenKey): string {
  const varName = `--${camelToKebab(token)}`;
  return getCSSVariableValue(varName);
}

/**
 * 현재 테마 모드 감지
 * @returns 'light' | 'dark'
 */
export function getCurrentThemeMode(): "light" | "dark" {
  const htmlClasses = document.documentElement.className;
  return htmlClasses.includes("-dark") ? "dark" : "light";
}

/**
 * 테마 클래스 토글
 * @param themeName - 테마 이름 (예: 'default-light', 'default-dark')
 */
export function setThemeClass(themeName: string): void {
  const html = document.documentElement;

  // 기존 테마 클래스 제거
  const classes = html.className.split(" ");
  const newClasses = classes.filter((cls) => !cls.startsWith("theme-"));

  // 새 테마 클래스 추가
  newClasses.push(`theme-${themeName}`);
  html.className = newClasses.join(" ");
}

/**
 * 색상 대비 계산 (WCAG)
 * @param foreground - 전경색 HEX
 * @param background - 배경색 HEX
 * @returns 대비 비율 (1 ~ 21)
 */
export function calculateContrastRatio(foreground: string, background: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = hex
      .replace("#", "")
      .match(/.{2}/g)!
      .map((x) => parseInt(x, 16) / 255);

    const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG AA 준수 여부 확인
 * @param contrastRatio - 대비 비율
 * @param isLargeText - 큰 텍스트 여부 (18px+ 또는 14px+ bold)
 * @returns AA 준수 여부
 */
export function meetsWCAG_AA(contrastRatio: number, isLargeText: boolean = false): boolean {
  return isLargeText ? contrastRatio >= 3 : contrastRatio >= 4.5;
}
