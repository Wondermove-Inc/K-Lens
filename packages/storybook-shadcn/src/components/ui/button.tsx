/**
 * 🎯 목적: Button 컴포넌트 - shadcn/ui 기반 버튼
 *
 * @remarks
 * - vendor/shadcn 최신 버전 기반
 * - forwardRef 적용 (React 18/19 호환)
 * - 다양한 variant 및 size 지원
 *
 * 🔄 변경이력:
 * - 2025-10-30: vendor 업데이트 (멀티디바이스 대응)
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 🎯 목적: Button variant 스타일 정의
 *
 * @remarks
 * - default: 기본 primary 버튼
 * - destructive: 삭제, 취소 등 위험한 동작
 * - outline: 아웃라인 버튼 (보조 동작)
 * - secondary: 보조 버튼
 * - ghost: 투명 배경 버튼
 * - link: 링크 스타일 버튼
 */
const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all cursor-pointer outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // 🎯 FIX-042: [color:white] arbitrary property로 텍스트 색상 강제 (Tailwind v4 purge 방지)
        default: "bg-primary !text-primary-foreground [color:white] hover:bg-primary/90",
        destructive:
          "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 !text-destructive-foreground [color:white]",
        outline: "border-input bg-background hover:bg-accent hover:text-accent-foreground border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * 🎯 목적: Button 컴포넌트
 *
 * @param className - 추가 CSS 클래스
 * @param variant - 버튼 스타일 variant
 * @param size - 버튼 크기
 * @param asChild - Radix Slot 사용 여부
 * @param ref - React ref
 *
 * @example
 * <Button variant="outline" size="sm">Click me</Button>
 */
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return <Comp ref={ref} data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
