/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import React from "react";

import type { DaemonSet } from "@skuberplus/kube-object";

/**
 * 🎯 목적: DaemonSet의 Node Selector를 shadcn Badge 배열로 표시
 *
 * @param daemonSet - DaemonSet 객체
 * @returns shadcn Badge 배열 (flex-wrap으로 자동 줄바꿈)
 *
 * 📝 주의사항:
 * - flex flex-wrap으로 가로 줄바꿈 지원
 * - 각 selector를 개별 shadcn Badge로 표시
 * - variant="secondary"로 중립적인 스타일 적용
 */
export const NodeSelectorCell = ({ daemonSet }: { daemonSet: DaemonSet }) => {
  const selectors = daemonSet.getNodeSelectors();

  return (
    <div className="flex flex-wrap gap-1">
      {selectors.map((selector) => (
        <Badge key={selector} variant="secondary">
          {selector}
        </Badge>
      ))}
    </div>
  );
};
