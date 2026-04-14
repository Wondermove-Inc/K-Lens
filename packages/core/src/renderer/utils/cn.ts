/**
 * 🎯 목적: className 유틸리티 함수 (shadcn/ui 호환)
 * 📝 기능:
 *   - clsx + tailwind-merge 조합
 *   - className 조건부 결합
 * 🔄 변경이력:
 *   - 2026-01-24: lib/utils.ts에서 분리
 * @module utils/cn
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * className 조합 유틸리티
 * @param inputs - 조합할 className들
 * @returns 병합된 className 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
