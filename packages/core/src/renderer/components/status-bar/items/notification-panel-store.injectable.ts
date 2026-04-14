/**
 * 🎯 Purpose: Notification Panel Store Injectable
 * 📝 Features:
 *   - DI container registration for NotificationPanelStore
 *   - Singleton instance across the application
 * 🔄 Change History:
 *   - 2026-01-25: FIX-032 - Initial implementation
 * @module status-bar/notification-panel-store.injectable
 */

import { getInjectable } from "@ogre-tools/injectable";
import { notificationPanelStore } from "./notification-panel.store";

const notificationPanelStoreInjectable = getInjectable({
  id: "notification-panel-store",
  instantiate: () => notificationPanelStore,
});

export default notificationPanelStoreInjectable;
