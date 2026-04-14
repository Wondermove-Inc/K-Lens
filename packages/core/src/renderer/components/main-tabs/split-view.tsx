/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react-lite";
/**
 * 🎯 목적: 2-pane horizontal split 레이아웃
 *
 * @description
 * - Flexbox 기반 좌우 분할
 * - ResizingAnchor를 중간에 배치하여 비율 조절
 * - 최소/최대 너비 제약 (30% ~ 70%)
 *
 * 📝 참고:
 * - VSCode SplitView 패턴 참조
 * - DAIVE Dock의 ResizingAnchor 재사용
 *
 * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ResizeHandle } from "../resize/resize-handle";
import { SPLIT_CONSTANTS } from "./split-types";

import type { SplitDirection } from "./split-types";

/**
 * 🎯 목적: Split 비율 값이 유효하지 않을 때 기본 비율(50%)로 보정합니다.
 *
 * @param min 최소 허용 비율
 * @param max 최대 허용 비율
 * @returns 허용 범위 안에서의 기본 비율
 */
const getFallbackRatio = (min: number, max: number): number =>
  Math.min(max, Math.max(min, SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO));

/**
 * 🎯 목적: 전달된 Split 비율을 허용 범위로 보정합니다.
 *
 * @param value 외부에서 전달된 비율
 * @param min 최소 허용 비율
 * @param max 최대 허용 비율
 * @returns 허용 범위를 벗어나면 기본값으로 치환한 비율
 */
const sanitizeSplitRatio = (value: number | undefined, min: number, max: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return getFallbackRatio(min, max);
  }

  if (value < min || value > max) {
    return getFallbackRatio(min, max);
  }

  return value;
};

interface SplitViewProps {
  /** 좌측 pane 컴포넌트 */
  left: React.ReactNode;

  /** 우측 pane 컴포넌트 */
  right: React.ReactNode;

  /** 초기 좌측 비율 (0.3 ~ 0.7) */
  initialLeftRatio?: number;

  /** 비율 변경 콜백 */
  onRatioChange?: (ratio: number) => void;

  /** 최소 좌측 비율 */
  minLeftRatio?: number;

  /** 최대 좌측 비율 */
  maxLeftRatio?: number;

  /** 리사이즈 시작 알림 */
  onResizeStart?: () => void;

  /** 리사이즈 종료 알림 */
  onResizeEnd?: () => void;

  /** Split 방향 */
  orientation?: SplitDirection;
}

export const SplitView = observer(
  ({
    left,
    right,
    initialLeftRatio = 0.5,
    onRatioChange,
    minLeftRatio = 0.3,
    maxLeftRatio = 0.7,
    onResizeStart,
    onResizeEnd,
    orientation = SPLIT_CONSTANTS.DEFAULT_ORIENTATION,
  }: SplitViewProps) => {
    const [leftRatio, setLeftRatio] = useState(() => sanitizeSplitRatio(initialLeftRatio, minLeftRatio, maxLeftRatio));
    const [containerExtent, setContainerExtent] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const fallbackRatio = useMemo(() => getFallbackRatio(minLeftRatio, maxLeftRatio), [minLeftRatio, maxLeftRatio]);

    /**
     * 🎯 목적: 외부에서 전달된 비율이 변경된 경우 내부 상태를 최신 값으로 동기화합니다.
     */
    React.useEffect(() => {
      const nextRatio = sanitizeSplitRatio(initialLeftRatio, minLeftRatio, maxLeftRatio);

      setLeftRatio((current) => (current === nextRatio ? current : nextRatio));
    }, [initialLeftRatio, minLeftRatio, maxLeftRatio]);

    /**
     * 🎯 목적: 컨테이너 너비 가져오기
     */
    const updateContainerExtent = useCallback(() => {
      const node = containerRef.current;
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      setContainerExtent(orientation === "horizontal" ? rect.width : rect.height);
    }, [orientation]);

    const getContainerExtent = useCallback(() => containerExtent, [containerExtent]);

    /**
     * 🎯 목적: 컨테이너 크기 변경 감지 및 상태 업데이트
     *
     * 📝 주의사항:
     * - useLayoutEffect: DOM 업데이트 직후 동기적 실행
     * - ResizeObserver: 브라우저 창 크기 변경 감지
     */
    React.useLayoutEffect(() => {
      updateContainerExtent();

      const resizeObserver = new ResizeObserver(updateContainerExtent);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }, [updateContainerExtent]);

    /**
     * 🎯 목적: Resize 핸들러
     *
     * @param newLeftWidth - 새로운 좌측 pane 너비 (px)
     *
     * 📝 주의사항:
     * - px 값을 비율로 변환
     * - minLeftRatio ~ maxLeftRatio 범위로 제한
     */
    const handleResize = useCallback(
      (newLeftWidth: number) => {
        const extent =
          orientation === "horizontal"
            ? (containerRef.current?.offsetWidth ?? 0)
            : (containerRef.current?.offsetHeight ?? 0);

        if (extent === 0) return;

        // px → 비율 변환
        let newRatio = newLeftWidth / extent;

        // 제약 적용
        newRatio = Math.max(minLeftRatio, Math.min(maxLeftRatio, newRatio));

        setLeftRatio(newRatio);
        onRatioChange?.(newRatio);
      },
      [minLeftRatio, maxLeftRatio, onRatioChange, orientation],
    );

    /**
     * 🎯 목적: ResizingAnchor의 onStart 핸들러
     */
    const handleResizeStart = useCallback(() => {
      onResizeStart?.();
    }, [onResizeStart]);

    /**
     * 🎯 목적: ResizingAnchor의 onEnd 핸들러
     */
    const handleResizeEnd = useCallback(() => {
      onResizeEnd?.();
    }, [onResizeEnd]);

    const isHorizontal = orientation === "horizontal";
    const containerClass = isHorizontal
      ? "relative flex h-full overflow-visible"
      : "relative flex h-full w-full flex-col overflow-visible";

    const primaryStyle = isHorizontal
      ? { width: `${leftRatio * 100}%`, minWidth: 0, flex: "0 0 auto" }
      : { height: `${leftRatio * 100}%`, minHeight: 0, width: "100%", flex: "0 0 auto" };

    const secondaryStyle = isHorizontal
      ? { width: `${(1 - leftRatio) * 100}%`, minWidth: 0, flex: "0 0 auto" }
      : { height: `${(1 - leftRatio) * 100}%`, minHeight: 0, width: "100%", flex: "0 0 auto" };

    const currentExtentGetter = () => getContainerExtent() * leftRatio;
    const minExtent = containerExtent * minLeftRatio;
    const maxExtent = containerExtent * maxLeftRatio;

    return (
      <div ref={containerRef} className={containerClass}>
        {/* 좌측/상단 pane */}
        <div className="flex flex-col overflow-hidden" style={primaryStyle} data-testid="split-pane-primary">
          {left}
        </div>

        <ResizeHandle
          orientation={isHorizontal ? "horizontal" : "vertical"}
          getCurrent={currentExtentGetter}
          min={minExtent}
          max={maxExtent}
          onResize={handleResize}
          onResizeStart={handleResizeStart}
          onResizeEnd={handleResizeEnd}
          onDoubleClick={() => {
            setLeftRatio(fallbackRatio);
            onRatioChange?.(fallbackRatio);
          }}
          thickness={8}
        />

        {/* 우측/하단 pane */}
        <div className="flex flex-col overflow-hidden" style={secondaryStyle} data-testid="split-pane-secondary">
          {right}
        </div>
      </div>
    );
  },
);
