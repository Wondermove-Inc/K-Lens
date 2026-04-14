/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import { COLUMN_PRIORITY } from "./column-priority";

const columnId = "qos";

export const podsQosColumnInjectable = getInjectable({
  id: "pods-qos-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.QOS,
    content: (pod) => <span data-column-id={columnId}>{pod.getQosClass()}</span>,
    header: { title: "QoS", className: "qos", sortBy: columnId, id: columnId, "data-column-id": columnId },
    sortingCallBack: (pod) => pod.getQosClass(),
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
