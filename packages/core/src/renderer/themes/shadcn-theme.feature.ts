/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getFeature } from "@skuberplus/feature-core";

/**
 * 🎯 목적: shadcn 테마 시스템 Feature
 * 📝 주의: Injectable들을 자동 등록하기 위해 Feature로 등록
 */
export const shadcnThemeFeature = getFeature({
  id: "shadcn-theme",

  register: (di) => {
    // Injectable 자동 등록
    di.register(require("./apply-shadcn-theme.injectable").default);
    di.register(require("./load-shadcn-theme.injectable").default);
    di.register(require("./setup-apply-shadcn-theme.injectable").default);
  },
});
