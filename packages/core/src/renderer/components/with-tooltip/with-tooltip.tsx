/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 자식 요소에 Tooltip을 추가하는 Wrapper 컴포넌트
 *
 * @remarks
 * - shadcn Tooltip으로 마이그레이션 완료
 * - 레거시 Badge wrapper 제거, 순수 Tooltip wrapper로 변경
 * - LinkTo* 컴포넌트들에서 주로 사용
 *
 * 🔄 변경이력:
 * - 2025-11-12: 레거시 Badge → shadcn Tooltip 마이그레이션
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { StrictReactNode } from "@skuberplus/utilities/dist";
import React from "react";
import { LocaleDate } from "../locale-date";

export interface WithTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * @deprecated 더 이상 사용되지 않음 (레거시 Badge 속성)
   */
  flat?: boolean;

  /**
   * @deprecated 더 이상 사용되지 않음 (레거시 Badge 속성)
   */
  expandable?: boolean;

  children?: StrictReactNode;
  tooltip?: string | Date | StrictReactNode;
  "data-testid"?: string;
}

/**
 * 🎯 목적: 자식 요소를 Tooltip으로 감싸는 컴포넌트
 *
 * @param props - WithTooltipProps
 * @returns Tooltip이 적용된 자식 요소
 */
export function WithTooltip(props: WithTooltipProps) {
  const { children, tooltip: tooltipProp, "data-testid": dataTestId } = props;

  // 🎯 Tooltip 콘텐츠 결정
  let tooltipContent: StrictReactNode;
  if (tooltipProp instanceof Date) {
    tooltipContent = <LocaleDate date={tooltipProp} />;
  } else if (tooltipProp !== undefined) {
    tooltipContent = tooltipProp;
  } else {
    tooltipContent = children ?? "";
  }

  // 🎯 Tooltip이 없으면 children만 렌더링
  if (!tooltipContent || tooltipContent === children) {
    return <>{children}</>;
  }

  // 🎯 shadcn Tooltip으로 감싸기
  return (
    <Tooltip>
      <TooltipTrigger asChild data-testid={dataTestId}>
        <span className="inline-flex items-center">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
