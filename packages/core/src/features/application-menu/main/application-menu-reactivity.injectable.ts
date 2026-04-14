/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { getStartableStoppable } from "@skuberplus/startable-stoppable";
import { autorun } from "mobx";
import applicationMenuItemCompositeInjectable from "./application-menu-item-composite.injectable";
import populateApplicationMenuInjectable from "./populate-application-menu.injectable";

const applicationMenuReactivityInjectable = getInjectable({
  id: "application-menu-reactivity",

  instantiate: (di) => {
    const applicationMenuItemComposite = di.inject(applicationMenuItemCompositeInjectable);
    const populateApplicationMenu = di.inject(populateApplicationMenuInjectable);

    return getStartableStoppable("application-menu-reactivity", () =>
      autorun(() => populateApplicationMenu(applicationMenuItemComposite.get()), {
        delay: 100,
      }),
    );
  },
});

export default applicationMenuReactivityInjectable;
