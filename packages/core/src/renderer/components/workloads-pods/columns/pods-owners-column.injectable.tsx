/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
// 🎯 shadcn UI 컴포넌트: 레거시 Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { stopPropagation } from "@skuberplus/utilities";
import React from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../../common/k8s-api/api-manager/manager.injectable";
import getDetailsUrlInjectable from "../../kube-detail-params/get-details-url.injectable";
import { COLUMN_PRIORITY } from "./column-priority";

export const podsOwnersColumnInjectable = getInjectable({
  id: "pods-owners-column",
  instantiate: (di) => {
    const getDetailsUrl = di.inject(getDetailsUrlInjectable);
    const apiManager = di.inject(apiManagerInjectable);
    const columnId = "owners";

    return {
      id: columnId,
      kind: "Pod",
      apiVersion: "v1",
      priority: COLUMN_PRIORITY.OWNERS,
      content: (pod) => (
        <div data-column-id={columnId}>
          {pod.getOwnerRefs().map((ref) => {
            const { kind, name } = ref;
            const detailsLink = getDetailsUrl(apiManager.lookupApiLink(ref, pod));

            return (
              <Badge variant="outline" key={name} className="owner" title={name}>
                <Link to={detailsLink} onClick={stopPropagation}>
                  {kind}
                </Link>
              </Badge>
            );
          })}
        </div>
      ),
      header: {
        title: "Controlled By",
        className: "owners",
        sortBy: columnId,
        id: columnId,
        "data-column-id": columnId,
      },
      sortingCallBack: (pod) => pod.getOwnerRefs().map((ref) => ref.kind),
    };
  },
  injectionToken: podListLayoutColumnInjectionToken,
});
