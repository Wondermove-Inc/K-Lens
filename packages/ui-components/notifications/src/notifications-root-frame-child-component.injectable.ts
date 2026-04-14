/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { rootFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed } from "mobx";
import { Toaster } from "./toaster";

/**
 * 🎯 목적: Sonner Toast 컴포넌트를 Root Frame에 마운트
 * 📝 주의사항: 기존 Notifications 컴포넌트에서 Sonner Toaster로 마이그레이션
 * 🔄 변경이력: 2025-11-25 - Sonner Toast로 마이그레이션
 */
export const notificationsRootFrameChildComponentInjectable = getInjectable({
  id: "notifications-root-frame-child-component",

  instantiate: () => ({
    id: "notifications",
    shouldRender: computed(() => true),
    Component: Toaster,
  }),

  injectionToken: rootFrameChildComponentInjectionToken,
});
