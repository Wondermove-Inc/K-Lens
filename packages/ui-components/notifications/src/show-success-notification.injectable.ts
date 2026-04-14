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
 * 🎯 목적: 성공 알림을 표시하는 Injectable 함수
 * 📝 주의사항: Sonner toast.success()를 사용하여 구현
 * 🔄 변경이력: 2025-11-25 - MobX Store에서 Sonner로 마이그레이션
 */
export const showSuccessNotificationInjectable = getInjectable({
  id: "show-success-notification",

  instantiate: (): ShowNotification => {
    return (message, customOpts = {}) => {
      const toastId = toast.success(convertMessageToString(message), {
        duration: customOpts.timeout ?? 5000,
        onDismiss: customOpts.onClose,
        id: customOpts.id?.toString(),
      });

      // Disposer 함수 반환 (기존 API 호환)
      return () => toast.dismiss(toastId);
    };
  },
});
