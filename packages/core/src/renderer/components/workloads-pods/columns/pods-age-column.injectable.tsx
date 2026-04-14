/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import React from "react";
import { KubeObjectAge } from "../../kube-object/age";
import { COLUMN_PRIORITY } from "./column-priority";

const columnId = "age";

export const podsAgeColumnInjectable = getInjectable({
  id: "pods-age-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.AGE,
    content: (pod) => (
      // 🎯 data-column-id 속성 추가로 헤더와 데이터 행 동기화
      <KubeObjectAge key="age" object={pod} data-column-id={columnId} />
    ),
    header: {
      title: "Age",
      className: "age",
      sortBy: columnId,
      id: columnId,
      "data-column-id": columnId,
    },
    sortingCallBack: (pod) => -pod.getCreationTimestamp(),
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
