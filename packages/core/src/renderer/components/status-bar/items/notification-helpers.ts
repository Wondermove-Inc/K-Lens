/**
 * 🎯 Purpose: Notification Helper Functions for Migration
 * 📝 Features:
 *   - Helper functions to add notifications to NotificationPanel
 *   - Category-specific shortcuts
 *   - Error message extraction utilities
 * 🔄 Change History:
 *   - 2026-01-26: FIX-037 - Created for Toast → Panel migration
 * @module status-bar/notification-helpers
 */

import {
  type NotificationCategory,
  type NotificationMetadata,
  notificationPanelStore,
} from "./notification-panel.store";

/**
 * 🎯 Extract error message from various error types
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as Record<string, unknown>).message === "string") {
      return (error as Record<string, unknown>).message as string;
    }
    if ("toString" in error && typeof error.toString === "function") {
      const str = error.toString();
      if (str !== "[object Object]") {
        return str;
      }
    }
  }
  return fallback;
}

// ============================================
// Operations Category Helpers
// ============================================

/**
 * Add operation success notification
 */
export function notifyOperationSuccess(
  title: string,
  message: string,
  metadata?: Partial<NotificationMetadata>,
): string {
  return notificationPanelStore.addSuccess("operations", title, message, metadata);
}

/**
 * Add operation error notification
 */
export function notifyOperationError(title: string, message: string, metadata?: Partial<NotificationMetadata>): string {
  return notificationPanelStore.addError("operations", title, message, metadata);
}

/**
 * Add checked operation error (handles unknown error types)
 */
export function notifyOperationCheckedError(
  error: unknown,
  fallback: string,
  metadata?: Partial<NotificationMetadata>,
): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError("operations", "Error", message, metadata);
}

/**
 * Add K8s resource operation notification
 */
export function notifyResourceOperation(
  type: "success" | "error",
  action: NotificationMetadata["actionType"],
  resourceKind: string,
  resourceName: string,
  message: string,
  namespace?: string,
): string {
  const title = `${resourceKind} ${action}`;
  const metadata: NotificationMetadata = {
    actionType: action,
    resourceKind,
    resourceName,
    namespace,
  };

  if (type === "success") {
    return notificationPanelStore.addSuccess("operations", title, message, metadata);
  }
  return notificationPanelStore.addError("operations", title, message, metadata);
}

// ============================================
// Cluster Category Helpers
// ============================================

/**
 * Add cluster success notification
 */
export function notifyClusterSuccess(title: string, message: string, clusterName?: string): string {
  return notificationPanelStore.addSuccess("cluster", title, message, { clusterName });
}

/**
 * Add cluster error notification
 */
export function notifyClusterError(title: string, message: string, clusterName?: string): string {
  return notificationPanelStore.addError("cluster", title, message, { clusterName });
}

/**
 * Add checked cluster error
 */
export function notifyClusterCheckedError(error: unknown, fallback: string, clusterName?: string): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError("cluster", "Cluster Error", message, { clusterName });
}

// ============================================
// Extensions Category Helpers
// ============================================

/**
 * Add extension success notification
 */
export function notifyExtensionSuccess(title: string, message: string): string {
  return notificationPanelStore.addSuccess("extensions", title, message);
}

/**
 * Add extension error notification
 */
export function notifyExtensionError(title: string, message: string): string {
  return notificationPanelStore.addError("extensions", title, message);
}

/**
 * Add checked extension error
 */
export function notifyExtensionCheckedError(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError("extensions", "Extension Error", message);
}

// ============================================
// Network Category Helpers
// ============================================

/**
 * Add network success notification
 */
export function notifyNetworkSuccess(title: string, message: string): string {
  return notificationPanelStore.addSuccess("network", title, message);
}

/**
 * Add network error notification
 */
export function notifyNetworkError(title: string, message: string): string {
  return notificationPanelStore.addError("network", title, message);
}

/**
 * Add network info notification
 */
export function notifyNetworkInfo(title: string, message: string): string {
  return notificationPanelStore.addInfo("network", title, message);
}

/**
 * Add checked network error
 */
export function notifyNetworkCheckedError(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError("network", "Network Error", message);
}

// ============================================
// File Category Helpers
// ============================================

/**
 * Add file success notification
 */
export function notifyFileSuccess(title: string, message: string, filePath?: string): string {
  return notificationPanelStore.addSuccess("file", title, message, { filePath });
}

/**
 * Add file error notification
 */
export function notifyFileError(title: string, message: string, filePath?: string): string {
  return notificationPanelStore.addError("file", title, message, { filePath });
}

/**
 * Add checked file error
 */
export function notifyFileCheckedError(error: unknown, fallback: string, filePath?: string): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError("file", "File Error", message, { filePath });
}

// ============================================
// System Category Helpers
// ============================================

/**
 * Add system info notification
 */
export function notifySystemInfo(title: string, message: string): string {
  return notificationPanelStore.addInfo("system", title, message);
}

/**
 * Add system warning notification
 */
export function notifySystemWarning(title: string, message: string): string {
  return notificationPanelStore.addWarning("system", title, message);
}

/**
 * Add system error notification
 */
export function notifySystemError(title: string, message: string): string {
  return notificationPanelStore.addError("system", title, message);
}

/**
 * Add checked system error
 */
export function notifySystemCheckedError(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError("system", "System Error", message);
}

// ============================================
// Generic Helpers
// ============================================

/**
 * Add notification with explicit category
 */
export function notify(
  category: NotificationCategory,
  type: "success" | "error" | "info" | "warning",
  title: string,
  message: string,
  metadata?: NotificationMetadata,
): string {
  switch (type) {
    case "success":
      return notificationPanelStore.addSuccess(category, title, message, metadata);
    case "error":
      return notificationPanelStore.addError(category, title, message, metadata);
    case "info":
      return notificationPanelStore.addInfo(category, title, message, metadata);
    case "warning":
      return notificationPanelStore.addWarning(category, title, message, metadata);
  }
}

/**
 * Add checked error with explicit category
 */
export function notifyCheckedError(
  category: NotificationCategory,
  error: unknown,
  fallback: string,
  metadata?: NotificationMetadata,
): string {
  const message = extractErrorMessage(error, fallback);
  return notificationPanelStore.addError(category, "Error", message, metadata);
}
