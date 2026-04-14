/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 펼치기/접기 가능한 파라미터 섹션 (Affinities, Tolerations 등에서 사용)
 *
 * @remarks
 * - shadcn Collapsible로 마이그레이션 완료
 * - Class 컴포넌트 → Functional 컴포넌트
 * - 상태 관리는 Collapsible이 자동 처리
 *
 * 🔄 변경이력:
 * - 2025-11-12: 레거시 Class 컴포넌트 → shadcn Collapsible 마이그레이션
 */

import "./drawer-param-toggler.scss";

import { Icon } from "@skuberplus/icon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/collapsible";
import React from "react";

import type { StrictReactNode } from "@skuberplus/utilities";

export interface DrawerParamTogglerProps {
  label: string | number;
  children: StrictReactNode;
}

/**
 * 🎯 목적: 펼치기/접기 가능한 파라미터 토글러
 *
 * @param label - 파라미터 개수 또는 레이블
 * @param children - 펼쳐질 콘텐츠
 * @returns Collapsible 컴포넌트
 */
export function DrawerParamToggler({ label, children }: DrawerParamTogglerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="DrawerParamToggler">
        <div className="flex gaps align-center params">
          <div className="param-label">{label}</div>
          <CollapsibleTrigger asChild>
            <div className="param-link" data-testid="drawer-param-toggler">
              <span className="param-link-text">{open ? "Hide" : "Show"}</span>
              <Icon material={`arrow_drop_${open ? "up" : "down"}`} />
            </div>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="param-content open">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
