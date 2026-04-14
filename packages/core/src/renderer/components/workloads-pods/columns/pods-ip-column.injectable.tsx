/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import { WithTooltip } from "../../with-tooltip";
import { COLUMN_PRIORITY } from "./column-priority";

const columnId = "ip";

export const podsipColumnInjectable = getInjectable({
  id: "pods-ip-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.IP,
    content: (pod) => <WithTooltip data-column-id={columnId}>{pod.status?.podIP}</WithTooltip>,
    header: { title: "IP", className: "ip", sortBy: columnId, id: columnId, "data-column-id": columnId },
    sortingCallBack: (pod) => pod.status?.podIP,
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
