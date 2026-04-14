/**
 * 🎯 목적: ContextPill 컴포넌트 - 컨텍스트 아이템을 필(pill) 형태로 표시
 *
 * 02: ContextPill 단일 컴포넌트 구현
 *
 * 주요 기능:
 * - 컨텍스트 타입별 아이콘 표시
 * - 삭제 버튼 (선택적)
 * - 클릭 이벤트 핸들링
 * - 다양한 크기 및 스타일 변형
 *
 * @packageDocumentation
 */

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import React, { useCallback } from "react";
import { cn } from "../../../../renderer/lib/utils";
import { getContextTypeLabel } from "../../common/context-types";
import { ContextIcon } from "./context-icon";

import type { ContextItem } from "../../common/context-types";

// ============================================
// 🎯 스타일 정의
// ============================================

/** ContextPill 스타일 변형 */
const contextPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-muted/50 border-border hover:bg-muted",
        secondary: "bg-secondary border-secondary hover:bg-secondary/80",
        outline: "bg-transparent border-border hover:bg-accent",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-sm",
        lg: "px-3 py-1.5 text-sm",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed pointer-events-none",
        false: "",
      },
      clickable: {
        true: "cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      disabled: false,
      clickable: false,
    },
  },
);

// ============================================
// 🎯 타입 정의
// ============================================

/** ContextPill 컴포넌트 Props */
export interface ContextPillProps extends VariantProps<typeof contextPillVariants> {
  /** 표시할 컨텍스트 아이템 */
  item: ContextItem;
  /** 네임스페이스 표시 여부 */
  showNamespace?: boolean;
  /** 삭제 콜백 (제공 시 삭제 버튼 표시) */
  onRemove?: (id: string) => void;
  /** 클릭 콜백 */
  onClick?: (item: ContextItem) => void;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

// ============================================
// 🎯 컴포넌트 구현
// ============================================

/**
 * ContextPill 컴포넌트
 *
 * 컨텍스트 아이템을 필(pill) 형태로 표시합니다.
 * 타입별 아이콘, 이름, 선택적 삭제 버튼을 포함합니다.
 *
 * @example
 * ```tsx
 * <ContextPill
 *   item={podItem}
 *   onRemove={(id) => handleRemove(id)}
 *   showNamespace
 * />
 * ```
 */
export const ContextPill: React.FC<ContextPillProps> = ({
  item,
  showNamespace = false,
  onRemove,
  onClick,
  variant,
  size,
  disabled = false,
  className,
}) => {
  /** 표시할 텍스트 결정 */
  const displayText = item.displayName ?? item.name;

  /** 네임스페이스 포함 텍스트 */
  const fullText = showNamespace && item.namespace ? `${item.namespace}/${displayText}` : displayText;

  /** 접근성 라벨 생성 */
  const ariaLabel = `${getContextTypeLabel(item.type)}: ${fullText}`;

  /** 클릭 핸들러 */
  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick(item);
    }
  }, [disabled, onClick, item]);

  /** 삭제 버튼 클릭 핸들러 */
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // 부모 클릭 이벤트 방지
      if (!disabled && onRemove) {
        onRemove(item.id);
      }
    },
    [disabled, onRemove, item.id],
  );

  /** 삭제 버튼 키보드 핸들러 */
  const handleRemoveKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && onRemove) {
          onRemove(item.id);
        }
      }
    },
    [disabled, onRemove, item.id],
  );

  return (
    <span
      data-testid="context-pill"
      className={cn(
        contextPillVariants({
          variant,
          size,
          disabled,
          clickable: !!onClick,
        }),
        className,
      )}
      onClick={handleClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && handleClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {/* 타입 아이콘 */}
      <ContextIcon type={item.type} size={size === "sm" ? 12 : size === "lg" ? 16 : 14} />

      {/* 컨텍스트 이름 */}
      <span className="truncate max-w-[150px]">{fullText}</span>

      {/* 삭제 버튼 */}
      {onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          onKeyDown={handleRemoveKeyDown}
          className={cn(
            "ml-0.5 rounded-full p-0.5 transition-colors",
            "hover:bg-destructive/20 hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label={`${displayText} 제거`}
          disabled={disabled}
        >
          <X className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </button>
      )}
    </span>
  );
};

ContextPill.displayName = "ContextPill";

export { contextPillVariants };
