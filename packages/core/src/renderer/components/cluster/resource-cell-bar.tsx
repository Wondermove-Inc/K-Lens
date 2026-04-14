/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: GitHub 잔디 스타일의 셀 기반 리소스 바 컴포넌트
 *
 * 📝 설명:
 * - 20개의 셀로 리소스 사용량을 시각화
 * - Usage는 Request 영역 내에서 채워지는 느낌
 * - Limit 이후는 위험 구역(빨간색)으로 표시
 *
 * 🔄 변경이력:
 * - 2025-01-22 - 초기 생성 (GitHub contribution graph 스타일)
 */

import React from "react";
import { cn } from "../../lib/utils";

/**
 * 🎯 목적: 셀 상태 타입
 * - usage: 실제 사용 중인 셀 (진한 색상)
 * - request: 요청되었지만 미사용 (연한 색상)
 * - available: 사용 가능한 영역 (연한 회색)
 * - limits: Limit 영역 (연한 분홍색)
 */
type CellState = "usage" | "request" | "available" | "limits";

/**
 * 🎯 목적: ResourceCellBar Props
 */
interface ResourceCellBarProps {
  /** 총 용량 (Capacity) */
  capacity: number;
  /** 실제 사용량 (Usage) */
  usage: number;
  /** 요청량 (Requests) - Pods는 0 */
  requests: number;
  /** 제한량 (Limits) - Pods는 capacity와 동일 */
  limits: number;
  /** 셀 개수 (기본값: 40) */
  cellCount?: number;
  /** 리소스 타입 */
  type: "cpu" | "memory" | "pods";
  /** 추가 클래스명 */
  className?: string;
  /** 경고 상태 (Usage가 Limits에 근접하거나 초과) */
  isWarning?: boolean;
}

/**
 * 🎯 목적: 셀 상태 배열 계산
 *
 * @param capacity - 총 용량
 * @param usage - 실제 사용량
 * @param requests - 요청량
 * @param limits - 제한량
 * @param cellCount - 셀 개수
 * @returns 각 셀의 상태 배열
 *
 * 📝 시각화 개념 (이미지 기준):
 * |---------------------------- CAPACITY (20 cells) -----------------------------|
 * | USAGE (진한) | REQUEST (연한) |  AVAILABLE (회색)  |  LIMITS (분홍색, 1-2셀) |
 * |████████████████|░░░░░░░░░░░░░░|                    |██████████████████████████|
 * |<-- usage ---->|<-- request ->|<--- available --->|<------- limits --------->|
 */
const calculateCells = (
  capacity: number,
  usage: number,
  requests: number,
  limits: number,
  cellCount: number,
): CellState[] => {
  // capacity가 0이면 모든 셀을 available로 표시
  if (capacity <= 0) {
    return Array(cellCount).fill("available");
  }

  // 각 구간의 셀 수 계산
  const usageCells = Math.floor((usage / capacity) * cellCount);
  const requestCells = Math.floor((requests / capacity) * cellCount);
  const limitCells = Math.floor((limits / capacity) * cellCount);

  return Array.from({ length: cellCount }, (_, i) => {
    // Limits 영역: Limit 이후 (연한 분홍색)
    if (i >= limitCells) {
      return "limits";
    }
    // Usage: 실제 사용 중인 영역 (진한 색상)
    if (i < usageCells) {
      return "usage";
    }
    // Request: 요청되었지만 미사용 (연한 색상)
    if (i < requestCells) {
      return "request";
    }
    // Available: 사용 가능 영역 (연한 회색)
    return "available";
  });
};

/**
 * 🎯 목적: 셀 상태에 따른 CSS 변수 색상 반환
 * 📝 THEME-022: Tailwind 클래스에서 CSS 변수로 마이그레이션
 *
 * @param state - 셀 상태
 * @param type - 리소스 타입
 * @param isWarning - 경고 상태 여부
 * @returns CSS 변수 참조 문자열
 *
 * 📝 색상 스킴:
 * - 정상 상태:
 *   - Usage: 진한 파란색 (--cell-bar-usage)
 *   - Request: 연한 파란색 (--cell-bar-request)
 *   - Available: 연한 회색 (--cell-bar-available)
 *   - Limits: 연한 분홍색 (--cell-bar-limits)
 * - 경고 상태:
 *   - Usage: 노란색/주황색 (--cell-bar-usage-warning)
 */
const getCellColor = (state: CellState, type: "cpu" | "memory" | "pods", isWarning: boolean = false): string => {
  switch (state) {
    case "usage":
      // 경고 상태면 노란색, 아니면 진한 파란색
      return isWarning ? "var(--cell-bar-usage-warning)" : "var(--cell-bar-usage)";
    case "request":
      // 연한 파란색 (Request 영역)
      return "var(--cell-bar-request)";
    case "available":
      // 연한 회색 (Available 영역)
      return "var(--cell-bar-available)";
    case "limits":
      // 레드 (Limits 영역) - CPU는 좀 더 연한 red
      return type === "cpu" ? "var(--cell-bar-limits)" : "var(--cell-bar-limits-alt)";
    default:
      return "var(--cell-bar-available)";
  }
};

/**
 * 🎯 목적: GitHub 잔디 스타일의 셀 기반 리소스 바 컴포넌트
 *
 * 📝 사용법:
 * ```tsx
 * <ResourceCellBar
 *   type="cpu"
 *   capacity={10}
 *   usage={2}
 *   requests={4}
 *   limits={8}
 *   cellCount={20}
 * />
 * ```
 */
export const ResourceCellBar: React.FC<ResourceCellBarProps> = ({
  capacity,
  usage,
  requests,
  limits,
  cellCount = 40,
  type,
  className,
  isWarning = false,
}) => {
  const cells = calculateCells(capacity, usage, requests, limits, cellCount);

  return (
    <div
      className={cn("flex h-5 w-full items-center gap-0.5", className)}
      role="progressbar"
      aria-valuenow={usage}
      aria-valuemin={0}
      aria-valuemax={capacity}
    >
      {cells.map((state, index) => (
        <div
          key={index}
          className={cn(
            "h-full flex-1 transition-colors duration-200",
            // 첫 번째 셀: 왼쪽 라운드 (최소)
            index === 0 && "rounded-l-[2px]",
            // 마지막 셀: 오른쪽 라운드 (최소)
            index === cellCount - 1 && "rounded-r-[2px]",
          )}
          // 🎯 THEME-022: CSS 변수로 색상 적용
          style={{ backgroundColor: getCellColor(state, type, isWarning) }}
        />
      ))}
    </div>
  );
};

export default ResourceCellBar;
