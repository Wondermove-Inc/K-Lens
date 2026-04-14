/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: @skuberplus/notifications 패키지의 public API
 * 📝 주의사항: Sonner Toast로 마이그레이션됨 (2025-11-25)
 * 🔄 변경이력:
 *   - 기존 MobX Store 기반 구현에서 Sonner로 전환
 *   - 기존 파일들은 .legacy 접미사로 백업됨
 */

// Feature 등록
export { notificationsFeature } from "./src/feature";
// Frame 컴포넌트 (Sonner Toaster 사용)
export { notificationsClusterFrameChildComponentInjectable } from "./src/notifications-cluster-frame-child-component.injectable";
export { notificationsRootFrameChildComponentInjectable } from "./src/notifications-root-frame-child-component.injectable";
// Injectable 함수들 (Sonner 래퍼)
export { showCheckedErrorNotificationInjectable } from "./src/show-checked-error.injectable";
export { showErrorNotificationInjectable } from "./src/show-error-notification.injectable";
export { showInfoNotificationInjectable } from "./src/show-info-notification.injectable";
export { showShortInfoNotificationInjectable } from "./src/show-short-info.injectable";
export { showSuccessNotificationInjectable } from "./src/show-success-notification.injectable";

// 타입 export
export type {
  CreateNotificationOptions,
  NotificationId,
  NotificationMessage,
  ShowNotification,
} from "./src/message-utils";
export type { ShowCheckedErrorNotification } from "./src/show-checked-error.injectable";

// 🔄 Legacy exports (롤백용 - 기존 코드 호환성)
// NotificationStatus, NotificationsStore, notificationsStoreInjectable는 더 이상 필요하지 않음
// 필요 시 .legacy 파일에서 import 가능
