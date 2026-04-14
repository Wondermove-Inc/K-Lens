/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { app } from "electron";
import { computed } from "mobx";
import { getApplicationMenuOperationSystemActionInjectable } from "../../get-application-menu-operation-system-action-injectable";

/**
 * DevTools 토글 메뉴 아이템
 * - 개발 모드에서만 메뉴 표시 (패키징된 앱에서는 visible: false)
 * - 단축키(Cmd+Option+I)는 숨겨진 상태에서도 작동
 */
export const actionForToggleDevTools = getApplicationMenuOperationSystemActionInjectable({
  id: "toggle-dev-tools",
  parentId: "view",
  orderNumber: 70,
  actionName: "toggleDevTools",
  electronVisible: computed(() => !app.isPackaged),
});

export const actionForResetZoom = getApplicationMenuOperationSystemActionInjectable({
  id: "reset-zoom",
  parentId: "view",
  orderNumber: 90,
  actionName: "resetZoom",
});

export const actionForZoomIn = getApplicationMenuOperationSystemActionInjectable({
  id: "zoom-in",
  parentId: "view",
  orderNumber: 100,
  actionName: "zoomIn",
});

export const actionForZoomOut = getApplicationMenuOperationSystemActionInjectable({
  id: "zoom-out",
  parentId: "view",
  orderNumber: 110,
  actionName: "zoomOut",
});

export const actionForToggleFullScreen = getApplicationMenuOperationSystemActionInjectable({
  id: "toggle-full-screen",
  parentId: "view",
  orderNumber: 130,
  actionName: "togglefullscreen",
});
