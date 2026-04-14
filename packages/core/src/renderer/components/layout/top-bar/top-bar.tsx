/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { cssNames } from "@skuberplus/utilities";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo } from "react";
import watchHistoryStateInjectable from "../../../remote-helpers/watch-history-state.injectable";
import { Gutter } from "../../gutter";
import { Map } from "../../map";
import toggleMaximizeWindowInjectable from "./toggle-maximize-window/toggle-maximize-window.injectable";
import styles from "./top-bar.module.scss";
import topBarItemsOnLeftSideInjectable from "./top-bar-items/top-bar-items-on-left-side.injectable";
import topBarItemsOnRightSideInjectable from "./top-bar-items/top-bar-items-on-right-side.injectable";

import type { IComputedValue } from "mobx";

import type { TopBarItem } from "./top-bar-items/top-bar-item-injection-token";

interface Dependencies {
  itemsOnLeft: IComputedValue<TopBarItem[]>;
  itemsOnRight: IComputedValue<TopBarItem[]>;
  toggleMaximizeWindow: () => void;
  watchHistoryState: () => () => void;
}

const NonInjectedTopBar = observer(
  ({ itemsOnLeft, itemsOnRight, toggleMaximizeWindow, watchHistoryState }: Dependencies) => {
    useEffect(() => watchHistoryState(), []);

    const leftItems = itemsOnLeft.get();
    const rightItems = itemsOnRight.get();

    const { leadingItems, centerItems } = useMemo(() => {
      const centerIds = new Set(["navigation-controls", "top-bar-search"]);
      const center: TopBarItem[] = [];
      const leading: TopBarItem[] = [];

      for (const item of leftItems) {
        if (centerIds.has(item.id)) {
          center.push(item);
        } else {
          leading.push(item);
        }
      }

      return { leadingItems: leading, centerItems: center };
    }, [leftItems]);

    const renderItems = (items: TopBarItem[], separatorSize: "xs" | "sm" | "md" | "xl" = "sm") => (
      <Map items={items} getSeparator={() => <Gutter size={separatorSize} />}>
        {toItemWhichWorksWithWindowDraggingAndDoubleClicking}
      </Map>
    );

    return (
      <div className={styles.topBar} onDoubleClick={toggleMaximizeWindow}>
        <div className={styles.items}>
          <div className={styles.leadingItems}>{renderItems(leadingItems)}</div>

          <div className={styles.centerItems}>{renderItems(centerItems, "xs")}</div>

          <div className={styles.trailingItems}>{renderItems(rightItems)}</div>
        </div>
      </div>
    );
  },
);

export const TopBar = withInjectables<Dependencies>(NonInjectedTopBar, {
  getProps: (di) => ({
    itemsOnLeft: di.inject(topBarItemsOnLeftSideInjectable),
    itemsOnRight: di.inject(topBarItemsOnRightSideInjectable),
    toggleMaximizeWindow: di.inject(toggleMaximizeWindowInjectable),
    watchHistoryState: di.inject(watchHistoryStateInjectable),
  }),
});

const toItemWhichWorksWithWindowDraggingAndDoubleClicking = (item: TopBarItem) => (
  <div
    className={cssNames(styles.preventedDragging, {
      [styles.expandToFill]: item.id === "top-bar-search",
    })}
    onDoubleClick={(event) => {
      return event.stopPropagation();
    }}
  >
    <item.Component />
  </div>
);
