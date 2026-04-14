import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-secondary/20 text-foreground",
        destructive:
          "text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * 🎯 목적: Alert 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: role="alert" 속성 유지 필수 (접근성)
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const Alert = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div ref={ref} data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
    );
  },
);
Alert.displayName = "Alert";

/**
 * 🎯 목적: AlertTitle 컴포넌트에 forwardRef 적용
 * 📝 주의사항: col-start-2 그리드 레이아웃 유지
 */
const AlertTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="alert-title"
      className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
      {...props}
    />
  );
});
AlertTitle.displayName = "AlertTitle";

/**
 * 🎯 목적: AlertDescription 컴포넌트에 forwardRef 적용
 * 📝 주의사항: text-muted-foreground 스타일 유지
 */
const AlertDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert-description"
        className={cn(
          "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
          className,
        )}
        {...props}
      />
    );
  },
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
