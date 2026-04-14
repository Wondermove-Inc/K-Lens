/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeApplicationIsLoadingInjectionToken } from "@skuberplus/application";
import { buildVersionInitializationInjectable } from "../../vars/build-version/main/init.injectable";
import userPreferencesPersistentStorageInjectable from "../common/storage.injectable";

const loadUserPreferencesStorageInjectable = getInjectable({
  id: "load-user-preferences-storage",
  instantiate: (di) => ({
    run: async () => {
      const storage = di.inject(userPreferencesPersistentStorageInjectable);

      storage.loadAndStartSyncing();
    },
    runAfter: buildVersionInitializationInjectable,
  }),
  injectionToken: beforeApplicationIsLoadingInjectionToken,
});

export default loadUserPreferencesStorageInjectable;
