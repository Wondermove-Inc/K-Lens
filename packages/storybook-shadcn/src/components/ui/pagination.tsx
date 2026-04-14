import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./button";

/**
 * 🎯 목적: Pagination 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML nav 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const Pagination = React.forwardRef<HTMLElement, React.ComponentProps<"nav">>(({ className, ...props }, ref) => {
  return (
    <nav
      ref={ref}
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
});
Pagination.displayName = "Pagination";

/**
 * 🎯 목적: PaginationContent 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML ul 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => {
    return (
      <ul
        ref={ref}
        data-slot="pagination-content"
        className={cn("flex flex-row items-center gap-1", className)}
        {...props}
      />
    );
  },
);
PaginationContent.displayName = "PaginationContent";

/**
 * 🎯 목적: PaginationItem 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML li 요소 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>((props, ref) => {
  return <li ref={ref} data-slot="pagination-item" {...props} />;
});
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

/**
 * 🎯 목적: PaginationLink 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML a 요소 사용, isActive 상태에 따라 variant 변경
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, isActive, size = "icon", ...props }, ref) => {
    return (
      <a
        ref={ref}
        aria-current={isActive ? "page" : undefined}
        data-slot="pagination-link"
        data-active={isActive}
        className={cn(
          buttonVariants({
            variant: isActive ? "outline" : "ghost",
            size,
          }),
          className,
        )}
        {...props}
      />
    );
  },
);
PaginationLink.displayName = "PaginationLink";

/**
 * 🎯 목적: PaginationPrevious 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: PaginationLink 컴포넌트 사용 (이미 forwardRef 지원)
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const PaginationPrevious = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<typeof PaginationLink>>(
  ({ className, ...props }, ref) => {
    return (
      <PaginationLink
        ref={ref}
        aria-label="Go to previous page"
        className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
        {...props}
        size={props.size ?? "default"}
      >
        <ChevronLeftIcon />
        <span className="hidden sm:block">Previous</span>
      </PaginationLink>
    );
  },
);
PaginationPrevious.displayName = "PaginationPrevious";

/**
 * 🎯 목적: PaginationNext 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: PaginationLink 컴포넌트 사용 (이미 forwardRef 지원)
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const PaginationNext = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<typeof PaginationLink>>(
  ({ className, ...props }, ref) => {
    return (
      <PaginationLink
        ref={ref}
        aria-label="Go to next page"
        className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
        {...props}
        size={props.size ?? "default"}
      >
        <span className="hidden sm:block">Next</span>
        <ChevronRightIcon />
      </PaginationLink>
    );
  },
);
PaginationNext.displayName = "PaginationNext";

/**
 * 🎯 목적: PaginationEllipsis 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: HTML span 요소 사용, 더 많은 페이지가 있음을 표시
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const PaginationEllipsis = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        aria-hidden
        data-slot="pagination-ellipsis"
        className={cn("flex size-9 items-center justify-center", className)}
        {...props}
      >
        <MoreHorizontalIcon className="size-4" />
        <span className="sr-only">More pages</span>
      </span>
    );
  },
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
