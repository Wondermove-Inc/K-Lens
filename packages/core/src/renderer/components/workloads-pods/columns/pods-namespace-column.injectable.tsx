/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import { NamespaceSelectBadge } from "../../namespaces/namespace-select-badge";
import { COLUMN_PRIORITY } from "./column-priority";

const columnId = "namespace";

export const podsNamespaceColumnInjectable = getInjectable({
  id: "pods-namespace-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.NAMESPACE,
    content: (pod) => (
      // 🎯 data-column-id 속성 추가로 헤더와 데이터 행 동기화
      <NamespaceSelectBadge key="namespace" namespace={pod.getNs()} data-column-id={columnId} />
    ),
    header: {
      title: "Namespace",
      className: "namespace",
      sortBy: columnId,
      id: columnId,
      "data-column-id": columnId,
    },
    sortingCallBack: (pod) => pod.getNs(),
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
