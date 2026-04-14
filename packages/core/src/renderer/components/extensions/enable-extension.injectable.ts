/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import extensionLoaderInjectable from "../../../extensions/extension-loader/extension-loader.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { LensExtensionId } from "@skuberplus/legacy-extensions";

export type EnableExtension = (extId: LensExtensionId) => void;

const enableExtensionInjectable = getInjectable({
  id: "enable-extension",

  instantiate: (di): EnableExtension => {
    const extensionLoader = di.inject(extensionLoaderInjectable);

    return (extId) => {
      const ext = extensionLoader.getExtensionById(extId);

      if (ext && !ext.isBundled) {
        ext.isEnabled = true;

        // 🎯 FIX-037: NotificationPanel으로 마이그레이션
        notificationPanelStore.addSuccess(
          "extensions",
          "Extension Enabled",
          `Extension "${ext.manifest.name}" enabled successfully`,
        );
      }
    };
  },
});

export default enableExtensionInjectable;
