/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { getRandomIdInjectionToken } from "@skuberplus/random";
import { computed } from "mobx";
import React from "react";
import { extensionRegistratorInjectionToken } from "../../../extensions/extension-loader/extension-registrator-injection-token";
import { statusBarItemInjectionToken } from "./status-bar-item-injection-token";

import type { Logger } from "@skuberplus/logger";

import type { Injectable } from "@ogre-tools/injectable";

import type { LensRendererExtension } from "../../../extensions/lens-renderer-extension";
import type { StatusBarItem } from "./status-bar-item-injection-token";
import type { StatusBarItemProps, StatusBarRegistration } from "./status-bar-registration";

const statusBarItemRegistratorInjectable = getInjectable({
  id: "status-bar-item-registrator",

  instantiate: (di) => (extension) => {
    const rendererExtension = extension as LensRendererExtension;
    const getRandomId = di.inject(getRandomIdInjectionToken);
    const logger = di.inject(loggerInjectionToken);

    return rendererExtension.statusBarItems.flatMap(toItemInjectableFor(rendererExtension, getRandomId, logger));
  },

  injectionToken: extensionRegistratorInjectionToken,
});

export default statusBarItemRegistratorInjectable;

const toItemInjectableFor = (extension: LensRendererExtension, getRandomId: () => string, logger: Logger) => {
  return (registration: StatusBarRegistration): Injectable<StatusBarItem, StatusBarItem, void>[] => {
    const id = `${getRandomId()}-status-bar-item-for-extension-${extension.sanitizedExtensionId}`;
    let component: React.ComponentType<StatusBarItemProps>;
    let position: "left" | "right";

    if (registration?.item) {
      const { item } = registration;

      position = "right";
      component = (_props: StatusBarItemProps) => <>{typeof item === "function" ? item() : item}</>;
    } else if (registration?.components) {
      const { position: pos = "right", Item } = registration.components;

      if (pos !== "left" && pos !== "right") {
        throw new TypeError("StatusBarRegistration.components.position must be either 'right' or 'left'");
      }

      position = pos;
      component = Item;
    } else {
      logger.warn("StatusBarRegistration must have valid item or components field");

      return [];
    }

    return [
      getInjectable({
        id,

        instantiate: () => ({
          origin: extension.sanitizedExtensionId,
          component,
          position,
          visible: registration?.visible ?? computed(() => true),
        }),

        injectionToken: statusBarItemInjectionToken,
      }),
    ];
  };
};
