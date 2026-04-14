/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 상태별 개수 표시 컴포넌트
 *
 * @remarks
 * - shadcn Badge로 마이그레이션 완료
 * - Class 컴포넌트 → Functional 컴포넌트
 * - Pod 상태에 따라 Badge variant 자동 결정
 *
 * 🔄 변경이력:
 * - 2025-11-12: 레거시 span → shadcn Badge 마이그레이션
 */

import "./pod-details-statuses.scss";

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import countBy from "lodash/countBy";
import kebabCase from "lodash/kebabCase";
import React from "react";

import type { Pod } from "@skuberplus/kube-object";

export interface PodDetailsStatusesProps {
  pods: Pod[];
}

/**
 * 🎯 목적: Pod 상태에 따른 Badge variant 결정
 */
function getStatusVariant(phase: string): "default" | "secondary" | "destructive" | "outline" {
  const lowerPhase = phase.toLowerCase();

  if (lowerPhase === "running" || lowerPhase === "succeeded") {
    return "secondary";
  }
  if (lowerPhase === "failed" || lowerPhase === "error") {
    return "destructive";
  }
  if (lowerPhase === "pending" || lowerPhase === "unknown") {
    return "outline";
  }

  return "default";
}

/**
 * 🎯 목적: Pod 상태별 개수를 Badge로 표시
 */
export function PodDetailsStatuses({ pods }: PodDetailsStatusesProps) {
  if (!pods.length) return null;

  const statuses = countBy(pods.map((pod) => pod.getStatus()));

  return (
    <div className="PodDetailsStatuses">
      {Object.entries(statuses).map(([phase, count]) => (
        <Badge key={phase} variant={getStatusVariant(phase)} className={kebabCase(phase)}>
          {`${phase}: ${count}`}
        </Badge>
      ))}
    </div>
  );
}
