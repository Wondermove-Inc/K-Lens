/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import { getStatusClasses } from "../../../utils/semantic-status";
import { Badge } from "../../shadcn-ui/badge";
import { COLUMN_PRIORITY } from "./column-priority";

const columnId = "status";

export const podsStatusColumnInjectable = getInjectable({
  id: "pods-status-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.STATUS,
    content: (pod) => {
      const status = pod.getStatusMessage();

      // 🎯 THEME-040: 통합 semantic-status 유틸리티 사용
      return (
        <Badge data-column-id={columnId} className={getStatusClasses(status)}>
          {status}
        </Badge>
      );
    },
    header: { title: "Status", className: "status", sortBy: columnId, id: columnId, "data-column-id": columnId },
    sortingCallBack: (pod) => pod.getStatusMessage(),
    searchFilter: (pod) => pod.getStatusMessage(),
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
