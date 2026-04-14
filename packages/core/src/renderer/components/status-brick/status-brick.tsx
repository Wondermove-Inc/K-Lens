/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./status-brick.scss";

import { Tooltip, TooltipContent, TooltipTrigger } from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { cssNames } from "@skuberplus/utilities";
import React from "react";

import type { StrictReactNode } from "@skuberplus/utilities";

/**
 * 🎯 목적: Pod 컨테이너 상태를 표시하는 색상 블록 컴포넌트
 *
 * @param className - CSS 클래스명 (상태에 따른 색상 클래스)
 * @param tooltip - 툴팁 내용 (선택적)
 * @param children - 자식 요소
 *
 * 📝 주의사항:
 * - tooltip이 없으면 순수 div만 렌더링
 * - tooltip이 있으면 shadcn Tooltip으로 감싸서 렌더링
 * - 레거시 withTooltip HOC에서 shadcn Tooltip으로 마이그레이션됨
 */
export interface StatusBrickProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: StrictReactNode;
  tooltip?: React.ReactNode;
}

export function StatusBrick({ className, tooltip, ...elemProps }: StatusBrickProps) {
  const brick = <div className={cssNames("StatusBrick", className)} {...elemProps} />;

  if (!tooltip) {
    return brick;
  }

  return (
    <Tooltip disableHoverableContent={false}>
      <TooltipTrigger asChild>{brick}</TooltipTrigger>
      <TooltipContent className="max-w-sm" sideOffset={4}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
