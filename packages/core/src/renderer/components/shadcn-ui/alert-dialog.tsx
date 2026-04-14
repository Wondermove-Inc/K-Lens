"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { XIcon } from "lucide-react";
import React from "react";
import { buttonVariants } from "@/components/shadcn-ui/button";
import { cn } from "@/lib/utils";

/**
 * 🎯 목적: AlertDialog Root 컴포넌트
 * 📝 주의사항: Radix UI AlertDialog.Root primitive는 ref를 지원하지 않음
 */
const AlertDialog = AlertDialogPrimitive.Root;

/**
 * 🎯 목적: AlertDialogTrigger 컴포넌트에 forwardRef 적용
 */
const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Trigger>
>((props, ref) => {
  return <AlertDialogPrimitive.Trigger ref={ref} data-slot="alert-dialog-trigger" {...props} />;
});
AlertDialogTrigger.displayName = "AlertDialogTrigger";

/**
 * 🎯 목적: AlertDialogPortal 컴포넌트
 * 📝 주의사항: Portal은 ref를 지원하지 않음
 */
const AlertDialogPortal = AlertDialogPrimitive.Portal;

/**
 * 🎯 목적: AlertDialogOverlay 컴포넌트에 forwardRef 적용
 * 📝 주의사항: 배경 어둡게 처리 (라이트: bg-black/50, 다크: bg-black/70), 애니메이션 적용
 */
const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[9999] bg-black/50 dark:bg-black/70",
        className,
      )}
      {...props}
    />
  );
});
AlertDialogOverlay.displayName = "AlertDialogOverlay";

/**
 * 🎯 목적: AlertDialogContent 컴포넌트에 forwardRef 적용
 * 📝 주의사항: Portal 내부에서 Overlay와 함께 렌더링, 중앙 배치
 * 🔄 변경이력: 2025-11-19 - X 닫기 버튼 추가 (Dialog 패턴 참조)
 */
const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
    showCloseButton?: boolean;
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[9999] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <AlertDialogPrimitive.Cancel className="absolute top-4 right-4 rounded-xs opacity-70 hover:opacity-100 focus:outline-hidden cursor-pointer [&_svg]:size-4">
            <XIcon />
            <span className="sr-only">Close</span>
          </AlertDialogPrimitive.Cancel>
        )}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = "AlertDialogContent";

/**
 * 🎯 목적: AlertDialogHeader 컴포넌트에 forwardRef 적용
 * 📝 주의사항: HTML div 요소 사용
 */
const AlertDialogHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert-dialog-header"
        className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
        {...props}
      />
    );
  },
);
AlertDialogHeader.displayName = "AlertDialogHeader";

/**
 * 🎯 목적: AlertDialogFooter 컴포넌트에 forwardRef 적용
 * 📝 주의사항: HTML div 요소 사용
 */
const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="alert-dialog-footer"
        className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
        {...props}
      />
    );
  },
);
AlertDialogFooter.displayName = "AlertDialogFooter";

/**
 * 🎯 목적: AlertDialogTitle 컴포넌트에 forwardRef 적용
 */
const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
});
AlertDialogTitle.displayName = "AlertDialogTitle";

/**
 * 🎯 목적: AlertDialogDescription 컴포넌트에 forwardRef 적용
 */
const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      data-slot="alert-dialog-description"
      className={cn("text-sm/normal text-muted-foreground", className)}
      {...props}
    />
  );
});
AlertDialogDescription.displayName = "AlertDialogDescription";

/**
 * 🎯 목적: AlertDialogAction 컴포넌트에 forwardRef 적용
 * 📝 주의사항: buttonVariants 기본 스타일 사용
 */
const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => {
  return <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />;
});
AlertDialogAction.displayName = "AlertDialogAction";

/**
 * 🎯 목적: AlertDialogCancel 컴포넌트에 forwardRef 적용
 * 📝 주의사항: buttonVariants outline 스타일 사용
 */
const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
