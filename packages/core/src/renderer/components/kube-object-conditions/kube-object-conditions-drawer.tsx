/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Kubernetes 오브젝트의 Conditions를 Badge로 표시하는 컴포넌트
 * 📝 주의사항:
 *   - shadcn DetailPanelField 컴포넌트로 마이그레이션 완료
 *   - shadcn CSS 변수 (text-muted-foreground, border-border) 사용으로 테마 동기화
 * 🔄 변경이력:
 *   - 2025-12-01: DrawerItem → Tailwind CSS 마이그레이션 (화이트 테마 호환성)
 *   - 2025-12-04: DetailPanelField 컴포넌트로 리팩토링
 */

import { KubeObject } from "@skuberplus/kube-object";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Tooltip, TooltipContent, TooltipTrigger } from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { observer } from "mobx-react";
import React from "react";
import { getClassName, getTooltip } from "./components";
import { sortConditions } from "./utils";

import type { KubeObjectMetadata, KubeObjectStatus } from "@skuberplus/kube-object";

export interface KubeObjectConditionsDrawerProps {
  object: KubeObject;
  conditionTypePriorities?: Record<string, number>;
}

/**
 * 🎯 목적: Kubernetes 오브젝트의 Conditions를 shadcn Badge로 표시
 *
 * @param object - Kubernetes 오브젝트 (Node, Pod 등)
 * @param conditionTypePriorities - Condition 타입별 정렬 우선순위
 */
export const KubeObjectConditionsDrawer = observer((props: KubeObjectConditionsDrawerProps) => {
  const { object, conditionTypePriorities } = props;

  if (!object) {
    return null;
  }

  if (!(object instanceof KubeObject)) {
    return null;
  }

  const conditions = (object as KubeObject<KubeObjectMetadata, KubeObjectStatus>).status?.conditions;

  if (!conditions?.length) return null;

  // 🎯 shadcn DetailPanelField로 마이그레이션 완료
  return (
    <DetailPanelField label="Conditions" className="conditions">
      <div className="flex flex-wrap gap-1">
        {sortConditions(conditions, conditionTypePriorities)?.map((condition) => {
          return (
            <Tooltip key={condition.type}>
              <TooltipTrigger asChild>
                <Badge
                  variant={condition.status === "False" ? "outline" : "secondary"}
                  className={getClassName(condition)}
                >
                  {condition.type}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {getTooltip(condition, `drawer-${object.getId()}-condition-${condition.type}`)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </DetailPanelField>
  );
});
