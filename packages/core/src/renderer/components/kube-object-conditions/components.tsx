import { cssNames } from "@skuberplus/utilities";
import yaml from "js-yaml";
import { upperFirst } from "lodash/fp";
import moment from "moment-timezone";
import React from "react";
import { defaultYamlDumpOptions } from "../../../common/kube-helpers";
import { DurationAbsoluteTimestamp } from "../events";

import type { Condition } from "@skuberplus/kube-object";

export function getTooltip(condition: Condition, id: string) {
  return (
    <>
      {Object.entries(condition)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => {
          if (value === undefined) return null;
          if (value === null) return null;
          if (typeof value === "string") {
            const m = moment(value, moment.ISO_8601, true);
            if (m.isValid()) {
              value = <DurationAbsoluteTimestamp timestamp={value} />;
            }
          } else {
            value = yaml.dump(value, defaultYamlDumpOptions);
          }
          return (
            <div key={key} className="flex gap-2 items-center">
              <span className="text-xs font-normal text-muted-foreground">{upperFirst(key)}</span>
              <span className="text-xs font-medium text-foreground">{value}</span>
            </div>
          );
        })}
    </>
  );
}

export function getClassName(condition: Condition, ...additionalClasses: string[]) {
  if (condition.status === "False" || condition.status === "Unknown") {
    return cssNames("error", ...additionalClasses);
  }
  return cssNames(condition.type, condition.reason, ...additionalClasses);
}
