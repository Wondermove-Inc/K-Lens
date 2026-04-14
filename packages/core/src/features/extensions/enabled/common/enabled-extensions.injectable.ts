/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { iter } from "@skuberplus/utilities";
import { computed } from "mobx";
import enabledExtensionsStateInjectable from "./state.injectable";

const enabledExtensionsInjectable = getInjectable({
  id: "enabled-extensions",
  instantiate: (di) => {
    const state = di.inject(enabledExtensionsStateInjectable);

    return computed(() =>
      iter
        .chain(state.values())
        .filter(({ enabled }) => enabled)
        .map(({ name }) => name)
        .toArray(),
    );
  },
});

export default enabledExtensionsInjectable;
