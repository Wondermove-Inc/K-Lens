/**
 * 🎯 목적: ContextPills 컨테이너 컴포넌트 - 여러 컨텍스트 아이템을 필 형태로 표시
 *
 * 03: ContextPills 컨테이너 컴포넌트 구현
 *
 * 주요 기능:
 * - 컨텍스트 아이템 목록 렌더링
 * - 추가/삭제 버튼 지원
 * - 최대 표시 개수 제한 (overflow 표시)
 * - 가로/세로 레이아웃 지원
 *
 * @packageDocumentation
 */

import { Plus } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useMemo } from "react";
import { cn } from "../../../../renderer/lib/utils";
import { ContextPill, type ContextPillProps } from "./context-pill";

import type { ContextItem } from "../../common/context-types";

// ============================================
// 🎯 타입 정의
// ============================================

/** ContextPills 레이아웃 방향 */
type ContextPillsDirection = "horizontal" | "vertical";

/** ContextPills 컴포넌트 Props */
export interface ContextPillsProps {
  /** 표시할 컨텍스트 아이템 목록 */
  items: ContextItem[];
  /** 아이템 추가 콜백 (제공 시 추가 버튼 표시) */
  onAdd?: () => void;
  /** 아이템 삭제 콜백 */
  onRemove?: (id: string) => void;
  /** 아이템 클릭 콜백 */
  onItemClick?: (item: ContextItem) => void;
  /** 최대 표시 개수 (초과 시 +N more 표시) */
  maxItems?: number;
  /** 더보기 클릭 콜백 */
  onShowMore?: () => void;
  /** 레이아웃 방향 */
  direction?: ContextPillsDirection;
  /** 네임스페이스 표시 여부 */
  showNamespace?: boolean;
  /** Pill 크기 */
  size?: ContextPillProps["size"];
  /** Pill 스타일 변형 */
  variant?: ContextPillProps["variant"];
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 빈 목록일 때 표시할 메시지 */
  emptyMessage?: string;
  /** 추가 CSS 클래스 */
  className?: string;
}

// ============================================
// 🎯 컴포넌트 구현
// ============================================

/**
 * ContextPills 컨테이너 컴포넌트
 *
 * 여러 컨텍스트 아이템을 필(pill) 형태로 표시하는 컨테이너입니다.
 * 추가/삭제, 최대 개수 제한, 레이아웃 방향 등을 지원합니다.
 *
 * 📝 2026-01-07: 수정 - MobX observer 추가
 * - contextStore.attachedContexts의 변경을 감지하여 UI 업데이트
 * - X 버튼 클릭 시 즉시 리렌더링
 *
 * @example
 * ```tsx
 * <ContextPills
 *   items={contextItems}
 *   onAdd={handleAdd}
 *   onRemove={handleRemove}
 *   maxItems={5}
 * />
 * ```
 */
export const ContextPills: React.FC<ContextPillsProps> = observer(
  ({
    items,
    onAdd,
    onRemove,
    onItemClick,
    maxItems,
    onShowMore,
    direction = "horizontal",
    showNamespace = false,
    size,
    variant,
    disabled = false,
    emptyMessage,
    className,
  }) => {
    /** 표시할 아이템 목록 (maxItems 적용) */
    const visibleItems = useMemo(() => {
      if (maxItems && items.length > maxItems) {
        return items.slice(0, maxItems);
      }
      return items;
    }, [items, maxItems]);

    /** 초과 아이템 수 */
    const overflowCount = useMemo(() => {
      if (maxItems && items.length > maxItems) {
        return items.length - maxItems;
      }
      return 0;
    }, [items, maxItems]);

    /** 더보기 클릭 핸들러 */
    const handleShowMore = useCallback(() => {
      if (onShowMore) {
        onShowMore();
      }
    }, [onShowMore]);

    /** 추가 버튼 클릭 핸들러 */
    const handleAdd = useCallback(() => {
      if (!disabled && onAdd) {
        onAdd();
      }
    }, [disabled, onAdd]);

    /** 접근성 라벨 생성 */
    const ariaLabel = useMemo(() => {
      return `Context list, ${items.length} items`;
    }, [items.length]);

    /** 빈 목록 체크 (onAdd가 없고 emptyMessage도 없으면 아무것도 렌더링 안함) */
    const isEmpty = items.length === 0;
    const hasAddButton = !!onAdd;
    const hasEmptyMessage = !!emptyMessage;

    /** 컨테이너를 렌더링할지 여부 */
    const shouldRenderContainer = !isEmpty || hasAddButton || hasEmptyMessage;

    if (!shouldRenderContainer) {
      return null;
    }

    return (
      <div
        data-testid="context-pills"
        className={cn("flex flex-wrap gap-1.5", direction === "horizontal" ? "flex-row" : "flex-col", className)}
        role="list"
        aria-label={ariaLabel}
      >
        {/* 빈 상태 메시지 */}
        {isEmpty && emptyMessage && <span className="text-sm text-muted-foreground">{emptyMessage}</span>}

        {/* 아이템 목록 */}
        {visibleItems.map((item) => (
          <div key={item.id} role="listitem">
            <ContextPill
              item={item}
              showNamespace={showNamespace}
              size={size}
              variant={variant}
              disabled={disabled}
              onRemove={onRemove}
              onClick={onItemClick}
            />
          </div>
        ))}

        {/* 더보기 표시 */}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={handleShowMore}
            className={cn(
              "inline-flex items-center justify-center",
              "rounded-full px-2 py-0.5",
              "text-xs text-muted-foreground",
              "bg-muted/50 hover:bg-muted",
              "transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`Show ${overflowCount} more`}
          >
            +{overflowCount}
          </button>
        )}

        {/* 추가 버튼 */}
        {onAdd && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center gap-1",
              "rounded-full px-2 py-0.5",
              "text-xs text-muted-foreground",
              "border border-dashed border-border",
              "hover:bg-accent hover:text-accent-foreground",
              "transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            aria-label="Add context"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}
      </div>
    );
  },
);

ContextPills.displayName = "ContextPills";
