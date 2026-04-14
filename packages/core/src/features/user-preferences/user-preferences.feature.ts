/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getFeature } from "@skuberplus/feature-core";

/**
 * 🎯 목적: User Preferences Feature
 * 📝 주의: state injectable을 명시적으로 등록하여 renderer에서 사용 가능하도록 함
 */
export const userPreferencesFeature = getFeature({
  id: "user-preferences",

  register: (di) => {
    // State injectable 등록
    di.register(require("./common/state.injectable").default);
    di.register(require("./common/preference-descriptors.injectable").default);
    di.register(require("./common/storage.injectable").default);
  },
});
