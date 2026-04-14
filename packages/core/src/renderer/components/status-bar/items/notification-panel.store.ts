/**
 * 🎯 Purpose: Unified Notification Panel Store
 * 📝 Features:
 *   - Store all application notifications (replaces Toast system)
 *   - Category-based notification grouping
 *   - Manage notification history with read/unread states
 *   - Auto-open notification panel on new notification
 * 🔄 Change History:
 *   - 2026-01-25: FIX-032 - Initial implementation
 *   - 2026-01-26: FIX-037 - Unified notification system (Toast → Panel migration)
 * @module status-bar/notification-panel.store
 */

import { action, computed, makeObservable, observable } from "mobx";

/**
 * Notification types
 */
export type NotificationType = "success" | "error" | "info" | "warning";

/**
 * 🆕 FIX-037: Extended notification categories for unified system
 * - operations: Kubernetes resource CRUD operations
 * - extensions: Extension install/management
 * - cluster: Cluster connection/settings
 * - network: Port forwarding, protocols
 * - file: File save/open operations
 * - system: System notices/settings
 * - updates: App updates (existing)
 */
export type NotificationCategory =
  | "operations" // K8s resource operations (CRUD)
  | "extensions" // Extension management
  | "cluster" // Cluster related
  | "network" // Network/port forwarding
  | "file" // File system
  | "system" // System notices
  | "updates"; // App updates

/**
 * 🆕 FIX-037: Category display configuration
 */
export interface CategoryConfig {
  id: NotificationCategory;
  label: string;
  icon: string;
  priority: number; // Lower = higher priority (display order)
}

/**
 * Category configurations for UI display
 */
export const CATEGORY_CONFIGS: CategoryConfig[] = [
  { id: "operations", label: "Operations", icon: "⚡", priority: 1 },
  { id: "cluster", label: "Cluster", icon: "🔗", priority: 2 },
  { id: "extensions", label: "Extensions", icon: "🧩", priority: 3 },
  { id: "network", label: "Network", icon: "🌐", priority: 4 },
  { id: "file", label: "File", icon: "📄", priority: 5 },
  { id: "system", label: "System", icon: "⚙️", priority: 6 },
  { id: "updates", label: "Updates", icon: "🔄", priority: 7 },
];

/**
 * 🆕 FIX-037: Extended metadata for notification actions
 */
export interface NotificationMetadata {
  /** Full diff content for Compare notifications */
  diffContent?: string;
  /** File path for context */
  filePath?: string;
  /** Action type (diff, deploy, dryrun, delete) */
  actionType?: "diff" | "deploy" | "dryrun" | "delete" | "create" | "update" | "scale" | "restart";
  /** Kubernetes resource kind (Pod, Deployment, etc.) */
  resourceKind?: string;
  /** Resource name */
  resourceName?: string;
  /** Cluster name */
  clusterName?: string;
  /** Namespace */
  namespace?: string;
  /** Optional action button */
  actionButton?: {
    label: string;
    onClick: () => void;
  };
  /** Optional link */
  link?: {
    label: string;
    href: string;
  };
}

/**
 * Single notification item
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  metadata?: NotificationMetadata;
}

/**
 * 🆕 FIX-037: Utility to convert various error types to string
 */
function errorToString(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (error && typeof error === "object" && "toString" in error) {
    const str = error.toString();
    if (str !== "[object Object]") {
      return str;
    }
  }
  return fallback;
}

/**
 * Unified Notification Panel Store
 * 🆕 FIX-037: Now handles all application notifications
 */
export class NotificationPanelStore {
  @observable notifications: NotificationItem[] = [];
  @observable isOpen: boolean = false;
  /** 🆕 FIX-037: Collapsed sections */
  @observable collapsedCategories: Set<NotificationCategory> = new Set();

  private idCounter = 0;

  constructor() {
    makeObservable(this);
  }

  /**
   * Get unread notification count
   */
  @computed
  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  /**
   * 🆕 FIX-037: Get unread count by category
   */
  getUnreadCountByCategory(category: NotificationCategory): number {
    return this.notifications.filter((n) => n.category === category && !n.read).length;
  }

  /**
   * 🆕 FIX-037: Get notifications by category (computed-like getter)
   */
  getNotificationsByCategory(category: NotificationCategory): NotificationItem[] {
    return this.notifications.filter((n) => n.category === category);
  }

  /**
   * Get operations notifications (K8s resource operations)
   */
  @computed
  get operationsNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "operations");
  }

  /**
   * Get cluster notifications
   */
  @computed
  get clusterNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "cluster");
  }

  /**
   * Get extensions notifications
   */
  @computed
  get extensionsNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "extensions");
  }

  /**
   * Get network notifications
   */
  @computed
  get networkNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "network");
  }

  /**
   * Get file notifications
   */
  @computed
  get fileNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "file");
  }

  /**
   * Get system notifications
   */
  @computed
  get systemNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "system");
  }

  /**
   * Get updates notifications
   */
  @computed
  get updatesNotifications(): NotificationItem[] {
    return this.notifications.filter((n) => n.category === "updates");
  }

  /**
   * 🆕 FIX-037: Legacy compatibility - kubectl notifications
   * @deprecated Use operationsNotifications instead
   */
  @computed
  get kubectlNotifications(): NotificationItem[] {
    // Return operations for backward compatibility
    return this.operationsNotifications;
  }

  /**
   * Check if there are any notifications
   */
  @computed
  get hasNotifications(): boolean {
    return this.notifications.length > 0;
  }

  /**
   * 🆕 FIX-037: Get categories that have notifications
   */
  @computed
  get activeCategories(): NotificationCategory[] {
    const categories = new Set<NotificationCategory>();
    this.notifications.forEach((n) => categories.add(n.category));
    return CATEGORY_CONFIGS.filter((c) => categories.has(c.id))
      .sort((a, b) => a.priority - b.priority)
      .map((c) => c.id);
  }

  /**
   * Add a new notification
   * 🆕 FIX-038: Auto-prefix cluster name for operations/network categories
   */
  @action
  addNotification(
    type: NotificationType,
    category: NotificationCategory,
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ): string {
    const id = `notification-${++this.idCounter}-${Date.now()}`;

    // 🆕 FIX-038: Auto-prefix cluster name for cluster-related categories
    // Conditions: operations/network/cluster category + has clusterName + message doesn't start with [
    let finalMessage = message;
    const isClusterRelatedCategory = category === "operations" || category === "network" || category === "cluster";
    const hasClusterName = metadata?.clusterName && metadata.clusterName.trim() !== "";
    const messageAlreadyHasPrefix = message.trim().startsWith("[");

    if (isClusterRelatedCategory && hasClusterName && !messageAlreadyHasPrefix) {
      finalMessage = `[${metadata.clusterName}] ${message}`;
    }

    const notification: NotificationItem = {
      id,
      type,
      category,
      title,
      message: finalMessage,
      timestamp: new Date(),
      read: false,
      metadata,
    };

    // Debug log
    console.log("[NotificationPanelStore] Adding notification:", {
      id,
      type,
      category,
      title,
      message: message.substring(0, 100),
    });

    // Add to beginning of array (newest first)
    this.notifications.unshift(notification);

    // Keep only last 100 notifications (increased from 50)
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }

    // Auto-open panel when new notification arrives
    this.isOpen = true;

    return id;
  }

  /**
   * Add success notification
   */
  @action
  addSuccess(category: NotificationCategory, title: string, message: string, metadata?: NotificationMetadata): string {
    return this.addNotification("success", category, title, message, metadata);
  }

  /**
   * Add error notification
   */
  @action
  addError(category: NotificationCategory, title: string, message: string, metadata?: NotificationMetadata): string {
    return this.addNotification("error", category, title, message, metadata);
  }

  /**
   * Add info notification
   */
  @action
  addInfo(category: NotificationCategory, title: string, message: string, metadata?: NotificationMetadata): string {
    return this.addNotification("info", category, title, message, metadata);
  }

  /**
   * Add warning notification
   */
  @action
  addWarning(category: NotificationCategory, title: string, message: string, metadata?: NotificationMetadata): string {
    return this.addNotification("warning", category, title, message, metadata);
  }

  /**
   * 🆕 FIX-037: Add checked error notification (type-safe error handling)
   * Equivalent to showCheckedErrorNotification
   */
  @action
  addCheckedError(
    category: NotificationCategory,
    error: unknown,
    fallbackMessage: string,
    metadata?: NotificationMetadata,
  ): string {
    const message = errorToString(error, fallbackMessage);
    return this.addError(category, "Error", message, metadata);
  }

  /**
   * Mark notification as read
   */
  @action
  markAsRead(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Mark all notifications as read
   */
  @action
  markAllAsRead(): void {
    this.notifications.forEach((n) => {
      n.read = true;
    });
  }

  /**
   * 🆕 FIX-037: Mark all notifications in a category as read
   */
  @action
  markCategoryAsRead(category: NotificationCategory): void {
    this.notifications.forEach((n) => {
      if (n.category === category) {
        n.read = true;
      }
    });
  }

  /**
   * Remove a notification
   */
  @action
  removeNotification(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
  }

  /**
   * Clear all notifications
   */
  @action
  clearAll(): void {
    this.notifications = [];
  }

  /**
   * Clear notifications by category
   */
  @action
  clearByCategory(category: NotificationCategory): void {
    this.notifications = this.notifications.filter((n) => n.category !== category);
  }

  /**
   * 🆕 FIX-037: Toggle category collapsed state
   */
  @action
  toggleCategoryCollapsed(category: NotificationCategory): void {
    if (this.collapsedCategories.has(category)) {
      this.collapsedCategories.delete(category);
    } else {
      this.collapsedCategories.add(category);
    }
  }

  /**
   * 🆕 FIX-037: Check if category is collapsed
   */
  isCategoryCollapsed(category: NotificationCategory): boolean {
    return this.collapsedCategories.has(category);
  }

  /**
   * Toggle panel open/close
   */
  @action
  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * Set panel open state
   */
  @action
  setOpen(open: boolean): void {
    this.isOpen = open;
  }
}

// Singleton instance - use global window to share across frames
declare global {
  interface Window {
    __notificationPanelStore?: NotificationPanelStore;
  }
}

// Create or get existing store from window (for cross-frame sharing)
function getOrCreateStore(): NotificationPanelStore {
  // Try to get from parent window (if in iframe)
  try {
    if (window.parent && window.parent !== window && window.parent.__notificationPanelStore) {
      console.log("[NotificationPanelStore] Using store from parent window");
      return window.parent.__notificationPanelStore;
    }
  } catch {
    // Cross-origin access error - ignore
  }

  // Try to get from current window
  if (window.__notificationPanelStore) {
    console.log("[NotificationPanelStore] Using existing store from current window");
    return window.__notificationPanelStore;
  }

  // Create new store and attach to window
  console.log("[NotificationPanelStore] Creating new store");
  const store = new NotificationPanelStore();
  window.__notificationPanelStore = store;
  return store;
}

export const notificationPanelStore = getOrCreateStore();
