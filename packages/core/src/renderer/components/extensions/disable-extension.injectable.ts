/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import extensionLoaderInjectable from "../../../extensions/extension-loader/extension-loader.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { LensExtensionId } from "@skuberplus/legacy-extensions";

export type DisableExtension = (extId: LensExtensionId) => void;

const disableExtensionInjectable = getInjectable({
  id: "disable-extension",

  instantiate: (di): DisableExtension => {
    const extensionLoader = di.inject(extensionLoaderInjectable);

    return (extId) => {
      const ext = extensionLoader.getExtensionById(extId);

      if (ext && !ext.isBundled) {
        ext.isEnabled = false;

        // 🎯 FIX-037: NotificationPanel으로 마이그레이션
        notificationPanelStore.addSuccess(
          "extensions",
          "Extension Disabled",
          `Extension "${ext.manifest.name}" disabled successfully`,
        );
      }
    };
  },
});

export default disableExtensionInjectable;
