/**
 * 🎯 목적: Input 컴포넌트 - shadcn/ui 기반 입력 필드
 *
 * @remarks
 * - vendor/shadcn 최신 버전 기반
 * - 반응형 텍스트 크기: 모바일 text-base, 데스크톱 md:text-sm
 * - 파일 입력 스타일 지원
 *
 * 🔄 변경이력:
 * - 2025-10-30: vendor 업데이트 (멀티디바이스 대응)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 🎯 목적: Input 컴포넌트
 *
 * @param className - 추가 CSS 클래스
 * @param type - input type (text, password, email 등)
 * @param props - 기타 HTML input 속성
 *
 * @example
 * <Input type="text" placeholder="Enter your name" />
 * <Input type="email" className="w-full" />
 *
 * 📝 주의사항:
 * - 반응형 텍스트 크기: 모바일 16px (text-base), 데스크톱 14px (md:text-sm)
 * - 모바일에서 16px 이상이면 iOS 자동 확대(zoom) 방지
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 🎯 FIX-042: text-foreground + [color:var(--foreground)] arbitrary property로 텍스트 색상 강제
        "text-foreground [color:var(--foreground)] file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input !bg-[var(--color-input)]/30 h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
