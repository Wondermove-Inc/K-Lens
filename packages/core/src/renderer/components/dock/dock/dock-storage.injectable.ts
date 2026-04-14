/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import createStorageInjectable from "../../../utils/create-storage/create-storage.injectable";
import { TabKind } from "./store";

import type { DockStorageState } from "./store";

export const DEFAULT_DOCK_HEIGHT = 300;

const dockStorageInjectable = getInjectable({
  id: "dock-storage",

  instantiate: (di) => {
    const createStorage = di.inject(createStorageInjectable);

    return createStorage<DockStorageState>("dock", {
      height: DEFAULT_DOCK_HEIGHT,
      tabs: [
        {
          id: "terminal",
          kind: TabKind.TERMINAL,
          title: "Terminal",
          pinned: false,
        },
      ],
      isOpen: false,
    });
  },
});

export default dockStorageInjectable;
