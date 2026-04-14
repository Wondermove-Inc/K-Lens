/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

import type { IComputedValue } from "mobx";

export interface SidebarVisibilityHandle {
  readonly isOpen: IComputedValue<boolean>;
  readonly toggle: () => void;
}

export interface SidebarVisibilityRegistry {
  set: (clusterId: string, handle: SidebarVisibilityHandle) => void;
  delete: (clusterId: string) => void;
  get: (clusterId: string) => SidebarVisibilityHandle | undefined;
}

const sidebarVisibilityRegistryInjectable = getInjectable({
  id: "sidebar-visibility-registry",
  instantiate: (): SidebarVisibilityRegistry => {
    const handles = observable.map<string, SidebarVisibilityHandle>();

    return {
      set: (clusterId, handle) => {
        handles.set(clusterId, handle);
      },
      delete: (clusterId) => {
        handles.delete(clusterId);
      },
      get: (clusterId) => handles.get(clusterId),
    };
  },
});

export default sidebarVisibilityRegistryInjectable;
