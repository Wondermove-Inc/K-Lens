/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computedInjectManyInjectable } from "@ogre-tools/injectable-extension-for-mobx";
import { computed } from "mobx";
import { statusBarItemInjectionToken } from "./status-bar-item-injection-token";

import type { StatusBarItem as StatusBarItemRegistration } from "./status-bar-item-injection-token";
import type { StatusBarItemProps } from "./status-bar-registration";

export interface StatusItem {
  origin?: string;
  component: React.ComponentType<StatusBarItemProps>;
  state?: StatusBarItemRegistration["state"];
  badge?: StatusBarItemRegistration["badge"];
  tooltip?: StatusBarItemRegistration["tooltip"];
  onClick?: StatusBarItemRegistration["onClick"];
  priority: number;
}

export interface StatusBarItems {
  right: StatusItem[];
  left: StatusItem[];
}

const statusBarItemsInjectable = getInjectable({
  id: "status-bar-items",

  instantiate: (di) => {
    const computedInjectMany = di.inject(computedInjectManyInjectable);
    const registrations = computedInjectMany(statusBarItemInjectionToken);

    return computed(() => {
      const res: StatusBarItems = {
        left: [],
        right: [],
      };

      const items = registrations.get();

      for (const registration of items) {
        const {
          position = "right",
          component,
          visible,
          origin,
          priority = 0,
          state,
          badge,
          tooltip,
          onClick,
        } = registration;

        if (!visible.get()) {
          continue;
        }

        res[position].push({
          origin,
          component,
          state,
          badge,
          tooltip,
          onClick,
          priority,
        });
      }

      const sortByPriority = (a: StatusItem, b: StatusItem) => a.priority - b.priority;

      res.left.sort(sortByPriority);
      res.right.sort(sortByPriority);

      return res;
    });
  },
});

export default statusBarItemsInjectable;
