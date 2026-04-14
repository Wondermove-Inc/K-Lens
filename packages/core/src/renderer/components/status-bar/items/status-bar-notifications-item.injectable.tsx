/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 상태바에 알림 Popover 표시
 *
 * 주요 기능:
 * - 클릭 시 Popover로 알림 목록 표시
 * - 앱 업데이트 알림 섹션 포함
 * - kubectl 작업 결과 알림 섹션 (FIX-032)
 *
 * 🔄 변경이력:
 * - 2025-11-25 - Sonner 마이그레이션으로 단순화
 * - 2025-12-11 - Popover로 변경, 업데이트 알림 섹션 추가
 * - 2026-01-25: FIX-036 - Diff 탭 열기는 postMessage로 Cluster Frame과 통신
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { statusBarItemInjectionToken } from "../status-bar-item-injection-token";
import { NotificationsPopover } from "./notifications-popover";

const statusBarNotificationsItemInjectable = getInjectable({
  id: "status-bar-notifications-item",

  instantiate: () => {
    return {
      origin: "core",
      component: NotificationsPopover,
      position: "right" as const,
      priority: 20,
      // 🎯 항상 표시
      visible: computed(() => true),
    };
  },

  injectionToken: statusBarItemInjectionToken,
});

export default statusBarNotificationsItemInjectable;
