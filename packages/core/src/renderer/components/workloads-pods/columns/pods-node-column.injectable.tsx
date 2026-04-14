/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import { LinkToNode } from "../../kube-object-link";
import { WithTooltip } from "../../with-tooltip";
import { COLUMN_PRIORITY } from "./column-priority";

export const podsNodeColumnInjectable = getInjectable({
  id: "pods-node-column",
  instantiate: (di) => {
    const columnId = "node";

    return {
      id: columnId,
      kind: "Pod",
      apiVersion: "v1",
      priority: COLUMN_PRIORITY.NODE,
      content: (pod) => (
        <WithTooltip data-column-id={columnId}>
          <LinkToNode name={pod.getNodeName()} />
        </WithTooltip>
      ),
      header: { title: "Node", className: "node", sortBy: columnId, id: columnId, "data-column-id": columnId },
      sortingCallBack: (pod) => pod.getNodeName(),
    };
  },
  injectionToken: podListLayoutColumnInjectionToken,
});
