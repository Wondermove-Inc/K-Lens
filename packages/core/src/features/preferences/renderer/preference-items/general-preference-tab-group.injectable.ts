/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "./preference-item-injection-token";

const generalPreferenceTabGroupInjectable = getInjectable({
  id: "general-preference-tab-group",

  instantiate: () => ({
    kind: "tab-group" as const,
    id: "general-tab-group",
    parentId: "preference-tabs" as const,
    label: "", // 🎯 Storybook Settings 템플릿처럼 사이드바에 그룹 헤더 제거
    orderNumber: 10,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default generalPreferenceTabGroupInjectable;
