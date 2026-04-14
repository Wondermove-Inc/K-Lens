/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import { getConvertedParts } from "@skuberplus/utilities";
import React from "react";
import { WithTooltip } from "../../with-tooltip";
import { COLUMN_PRIORITY } from "./column-priority";

import type { Pod } from "@skuberplus/kube-object";

const columnId = "name";

export const podsNameColumnInjectable = getInjectable({
  id: "pods-name-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.NAME,
    content: (pod: Pod) => (
      // 🎯 data-column-id 속성 추가로 헤더와 데이터 행 동기화
      <WithTooltip data-column-id={columnId}>{pod.getName()}</WithTooltip>
    ),
    header: {
      title: "Name",
      className: "name",
      sortBy: columnId,
      id: columnId,
      "data-column-id": columnId,
    },
    sortingCallBack: (pod) => getConvertedParts(pod.getName()),
    searchFilter: (pod) => pod.getSearchFields(),
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
