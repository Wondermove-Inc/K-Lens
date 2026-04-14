/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./line-progress.scss";

import { cssNames } from "@skuberplus/utilities";
import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../shadcn-ui/tooltip";

import type { TooltipPosition } from "@skuberplus/tooltip";
import type { StrictReactNode } from "@skuberplus/utilities";

/**
 * 툴팁 prop 객체 형태 (preferredPositions 지원)
 */
interface LineProgressTooltipProps {
  preferredPositions?: TooltipPosition;
  children: React.ReactNode;
}

export interface LineProgressProps extends React.HTMLProps<HTMLDivElement> {
  value: number;
  min?: number;
  max?: number;
  className?: any;
  precise?: number;
  children?: StrictReactNode;
  /** 툴팁 내용 (ReactNode 또는 { children, preferredPositions } 객체) */
  tooltip?: React.ReactNode | LineProgressTooltipProps;
}

/**
 * 진행률 퍼센트 계산
 */
function valuePercent({
  value,
  min,
  max,
  precise,
}: Required<Pick<LineProgressProps, "value" | "min" | "max" | "precise">>) {
  return Math.min(100, (value / (max - min)) * 100).toFixed(precise);
}

/**
 * TooltipPosition → ShadCN side 변환
 * @param position - 레거시 TooltipPosition 값
 * @returns ShadCN Tooltip side prop ("top" | "bottom" | "left" | "right")
 */
function convertPositionToSide(position?: TooltipPosition): "top" | "bottom" | "left" | "right" {
  if (!position) return "bottom";

  // TooltipPosition enum 값은 "top", "bottom", "left", "right", "top_left" 등
  const posStr = String(position).toLowerCase();

  if (posStr.includes("top")) return "top";
  if (posStr.includes("left")) return "left";
  if (posStr.includes("right")) return "right";

  return "bottom";
}

/**
 * tooltip prop이 객체 형태인지 확인하는 타입 가드
 */
function isTooltipPropsObject(tooltip: unknown): tooltip is LineProgressTooltipProps {
  return typeof tooltip === "object" && tooltip !== null && "children" in tooltip;
}

/**
 * LineProgress 컴포넌트
 * 수평 프로그레스바를 표시하며, 선택적으로 툴팁을 지원합니다.
 */
export function LineProgress({
  className,
  min = 0,
  max = 100,
  value,
  precise = 2,
  tooltip,
  children,
  ...props
}: LineProgressProps) {
  const content = (
    <div className={cssNames("LineProgress", className)} {...props}>
      <div
        className="line"
        style={{
          width: `${valuePercent({ min, max, value, precise })}%`,
        }}
      />
      {children}
    </div>
  );

  // 툴팁이 없으면 그대로 반환
  if (!tooltip) return content;

  // tooltip prop에서 children 추출 (객체 또는 직접 ReactNode)
  const tooltipContent = isTooltipPropsObject(tooltip) ? tooltip.children : tooltip;

  // preferredPositions → side 변환
  const side = isTooltipPropsObject(tooltip) ? convertPositionToSide(tooltip.preferredPositions) : "bottom";

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side={side}>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
