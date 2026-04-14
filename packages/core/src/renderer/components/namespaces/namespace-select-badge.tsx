/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespace 클릭으로 글로벌 네임스페이스 필터를 변경하는 Badge 컴포넌트
 *
 * @remarks
 * - shadcn Badge 기반으로 재작성 (디자인 시스템 통일)
 * - Tooltip 포함 (클릭 가능 안내)
 * - 18개 리소스 테이블에서 재사용
 *
 * 🔄 변경이력:
 * - 2025-11-04: shadcn Badge 기반으로 재작성 (Core Badge에서 마이그레이션)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { prevDefault } from "@skuberplus/utilities";
import React from "react";
import filterByNamespaceInjectable from "./namespace-select-filter-model/filter-by-namespace.injectable";

import type { FilterByNamespace } from "./namespace-select-filter-model/filter-by-namespace.injectable";

export interface NamespaceSelectBadgeProps {
  namespace: string;
  className?: string;
}

export interface Dependencies {
  filterByNamespace: FilterByNamespace;
}

export function NamespaceSelectBadgeNonInjected({
  namespace,
  filterByNamespace,
  className,
}: NamespaceSelectBadgeProps & Dependencies) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`cursor-pointer hover:bg-accent transition-colors ${className || ""}`}
          onClick={prevDefault(() => filterByNamespace(namespace))}
        >
          {namespace}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Set global namespace filter to: <b>{namespace}</b>
      </TooltipContent>
    </Tooltip>
  );
}

export const NamespaceSelectBadge = withInjectables<Dependencies, NamespaceSelectBadgeProps>(
  NamespaceSelectBadgeNonInjected,
  {
    getProps(di, props) {
      return {
        ...props,
        filterByNamespace: di.inject(filterByNamespaceInjectable),
      };
    },
  },
);
