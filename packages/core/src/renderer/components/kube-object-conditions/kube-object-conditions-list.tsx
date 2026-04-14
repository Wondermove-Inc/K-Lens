/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "@skuberplus/kube-object";
import { observer } from "mobx-react";
import React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../shadcn-ui/hover-card";
import { getClassName, getTooltip } from "./components";
import { sortConditions } from "./utils";

import type { KubeObjectMetadata, KubeObjectStatus } from "@skuberplus/kube-object";

export interface KubeObjectConditionsListProps {
  object: KubeObject;
  conditionTypePriorities?: Record<string, number>;
}

export const KubeObjectConditionsList = observer((props: KubeObjectConditionsListProps) => {
  const { object, conditionTypePriorities } = props;

  if (!object) {
    return null;
  }

  if (!(object instanceof KubeObject)) {
    return null;
  }

  const conditions = (object as KubeObject<KubeObjectMetadata, KubeObjectStatus>).status?.conditions;

  if (!conditions?.length) return null;

  return (
    <>
      {sortConditions(conditions, conditionTypePriorities)
        ?.filter((condition) => condition.status === "True" || condition.type === "Ready")
        ?.sort((a, b) => {
          // Always put "Ready" type first
          if (a.type === "Ready" && b.type !== "Ready") return -1;
          if (b.type === "Ready" && a.type !== "Ready") return 1;
          return 0;
        })
        ?.map((condition) => {
          const { type } = condition;
          const id = `list-${object.getId()}-condition-${type}`;
          const name = condition.status === "False" || condition.status === "Unknown" ? `Not${type}` : type;

          return (
            <HoverCard key={type}>
              <HoverCardTrigger asChild>
                <span id={id} className={getClassName(condition, "condition", "cursor-pointer")}>
                  {name}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-auto min-w-[200px]">{getTooltip(condition, id)}</HoverCardContent>
            </HoverCard>
          );
        })}
    </>
  );
});
