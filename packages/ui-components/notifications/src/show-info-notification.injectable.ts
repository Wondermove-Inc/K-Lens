/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { toast } from "sonner";
import { convertMessageToString } from "./message-utils";

import type { ShowNotification } from "./message-utils";

/**
 * 🎯 목적: 정보 알림을 표시하는 Injectable 함수
 * 📝 주의사항: Sonner toast.info()를 사용, 기본적으로 자동 닫힘 없음 (Infinity)
 * 🔄 변경이력: 2025-11-25 - MobX Store에서 Sonner로 마이그레이션
 */
export const showInfoNotificationInjectable = getInjectable({
  id: "show-info-notification",

  instantiate: (): ShowNotification => {
    return (message, customOpts = {}) => {
      const toastId = toast.info(convertMessageToString(message), {
        duration: customOpts.timeout ?? Number.POSITIVE_INFINITY,
        onDismiss: customOpts.onClose,
        id: customOpts.id?.toString(),
      });

      // Disposer 함수 반환 (기존 API 호환)
      return () => toast.dismiss(toastId);
    };
  },
});
