/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { cn } from "../../lib/utils";

import type { CSSProperties } from "react";

export type ResizeHandleOrientation = "horizontal" | "vertical";

export interface ResizeHandleProps {
  orientation: ResizeHandleOrientation;
  getCurrent?: () => number;
  onResize?: (next: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onDoubleClick?: () => void;
  min?: number;
  max?: number;
  className?: string;
  invertDelta?: boolean;
  thickness?: number;
  style?: CSSProperties;
}

interface DragState {
  startX: number;
  startY: number;
  startValue: number;
  pointerId: number;
  element: HTMLElement;
  handleMove: (event: PointerEvent) => void;
  handleUp: (event: PointerEvent) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  orientation,
  getCurrent,
  onResize,
  onResizeStart,
  onResizeEnd,
  onDoubleClick,
  min,
  max,
  className,
  invertDelta = false,
  // 🎯 thickness는 더 이상 사용하지 않음 (shadcn 스타일: 1px 고정, after로 클릭 영역 확장)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  thickness: _thickness,
  style,
}) => {
  const isHorizontal = orientation === "horizontal";
  const dragState = React.useRef<DragState | null>(null);
  const originalCursor = React.useRef<string | "unset">("unset");
  const originalUserSelect = React.useRef<string | "unset">("unset");

  const clamp = React.useCallback(
    (value: number) => {
      if (typeof min === "number") {
        value = Math.max(min, value);
      }
      if (typeof max === "number") {
        value = Math.min(max, value);
      }
      return value;
    },
    [min, max],
  );

  const cleanup = React.useCallback(() => {
    const state = dragState.current;
    if (state) {
      state.element.removeEventListener("pointermove", state.handleMove);
      state.element.removeEventListener("pointerup", state.handleUp);
      state.element.releasePointerCapture(state.pointerId);
    }

    if (originalCursor.current === "unset") {
      document.body.style.removeProperty("cursor");
    } else {
      document.body.style.cursor = originalCursor.current;
    }

    if (originalUserSelect.current === "unset") {
      document.body.style.removeProperty("user-select");
    } else {
      document.body.style.userSelect = originalUserSelect.current;
    }

    dragState.current = null;
    originalCursor.current = "unset";
    originalUserSelect.current = "unset";
    onResizeEnd?.();
  }, [onResizeEnd]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startValue = getCurrent?.() ?? 0;
      const element = event.currentTarget as HTMLElement;

      const state: DragState = {
        startX: event.clientX,
        startY: event.clientY,
        startValue,
        pointerId: event.pointerId,
        element,
        handleMove: (_event: PointerEvent) => {},
        handleUp: (_event: PointerEvent) => {},
      };

      originalCursor.current = document.body.style.cursor || "unset";
      originalUserSelect.current = document.body.style.userSelect || "unset";

      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const handleMove = (pointerEvent: PointerEvent) => {
        let delta = isHorizontal ? pointerEvent.clientX - state.startX : pointerEvent.clientY - state.startY;
        if (invertDelta) {
          delta = -delta;
        }

        const next = clamp(state.startValue + delta);
        onResize?.(next);
      };

      const handleUp = (pointerEvent: PointerEvent) => {
        pointerEvent.preventDefault();
        cleanup();
      };

      state.handleMove = handleMove;
      state.handleUp = handleUp;
      dragState.current = state;

      element.setPointerCapture(event.pointerId);
      element.addEventListener("pointermove", handleMove);
      element.addEventListener("pointerup", handleUp, { once: true });

      onResizeStart?.();
    },
    [clamp, cleanup, getCurrent, invertDelta, isHorizontal, onResize, onResizeStart],
  );

  React.useEffect(() => () => cleanup(), [cleanup]);

  // 🎯 shadcn ResizableHandle 스타일 적용
  // 시각적 두께는 1px, 클릭 영역은 after pseudo-element로 확장
  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      data-slot="resize-handle"
      className={cn(
        // 🎯 shadcn 디자인 토큰 기반 스타일
        "bg-border relative flex shrink-0 items-center justify-center transition-colors",
        // 호버/액티브 시 하이라이트 (디자인 토큰 사용)
        "hover:bg-primary/50 active:bg-primary",
        "focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-offset-1",
        // 클릭 영역 확장 (after pseudo-element)
        isHorizontal
          ? "w-px cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2"
          : "h-px cursor-row-resize after:absolute after:inset-x-0 after:top-1/2 after:h-3 after:-translate-y-1/2",
        className,
      )}
      onPointerDown={handlePointerDown}
      onDoubleClick={onDoubleClick}
      tabIndex={0}
      style={style}
    />
  );
};
