/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { asLegacyGlobalForExtensionApi, asLegacyGlobalFunctionForExtensionApi } from "@skuberplus/legacy-global-di";
import commandOverlayInjectable from "../../renderer/components/command-palette/command-overlay.injectable";
import { ConfirmDialog as _ConfirmDialog } from "../../renderer/components/confirm-dialog";
import confirmInjectable from "../../renderer/components/confirm-dialog/confirm.injectable";
import openConfirmDialogInjectable from "../../renderer/components/confirm-dialog/open.injectable";
import renameTabInjectable from "../../renderer/components/dock/dock/rename-tab.injectable";
import createPodLogsTabInjectable from "../../renderer/components/dock/logs/create-pod-logs-tab.injectable";
import createWorkloadLogsTabInjectable from "../../renderer/components/dock/logs/create-workload-logs-tab.injectable";
import logTabStoreInjectable from "../../renderer/components/dock/logs/tab-store.injectable";
import createTerminalTabInjectable from "../../renderer/components/dock/terminal/create-terminal-tab.injectable";
import sendCommandInjectable from "../../renderer/components/dock/terminal/send-command.injectable";
import terminalStoreInjectable from "../../renderer/components/dock/terminal/store.injectable";
import getDetailsUrlInjectable from "../../renderer/components/kube-detail-params/get-details-url.injectable";
import showDetailsInjectable from "../../renderer/components/kube-detail-params/show-details.injectable";
import { notificationPanelStore } from "../../renderer/components/status-bar/items/notification-panel.store";
import podStoreInjectable from "../../renderer/components/workloads-pods/store.injectable";

import type {
  ConfirmDialogBooleanParams,
  ConfirmDialogParams,
  ConfirmDialogProps,
} from "../../renderer/components/confirm-dialog";

export * from "@skuberplus/button";
export * from "@skuberplus/icon";
export {
  type CreateNotificationOptions,
  type NotificationId,
  type NotificationMessage,
  type ShowNotification,
} from "@skuberplus/notifications";
export * from "@skuberplus/spinner";
export * from "@skuberplus/tooltip";
export * from "../../renderer/components/add-remove-buttons";
export * from "../../renderer/components/avatar";
export * from "../../renderer/components/badge";
export * from "../../renderer/components/chart";
export * from "../../renderer/components/checkbox";
export * from "../../renderer/components/countdown";
export * from "../../renderer/components/dialog";
export * from "../../renderer/components/drawer";
export * from "../../renderer/components/dropdown";
export * from "../../renderer/components/duration";
export * from "../../renderer/components/editable-list";
export * from "../../renderer/components/events";
export * from "../../renderer/components/file-picker";
export * from "../../renderer/components/gutter";
export * from "../../renderer/components/horizontal-line";
export * from "../../renderer/components/input";
export * from "../../renderer/components/item-object-list";
export * from "../../renderer/components/kube-object";
export * from "../../renderer/components/kube-object-conditions";
export * from "../../renderer/components/kube-object-details";
export * from "../../renderer/components/kube-object-link";
export * from "../../renderer/components/kube-object-list-layout";
export * from "../../renderer/components/kube-object-menu";
export * from "../../renderer/components/kube-object-meta";
export * from "../../renderer/components/layout/main-layout";
export * from "../../renderer/components/layout/page-layout";
// 🔥 setting-layout을 page-layout보다 먼저 export (page-layout이 setting-layout을 상속하므로)
export * from "../../renderer/components/layout/setting-layout";
export * from "../../renderer/components/layout/sub-title";
export * from "../../renderer/components/layout/tab-layout";
export * from "../../renderer/components/layout/wizard-layout";
export * from "../../renderer/components/line-progress";
export * from "../../renderer/components/list";
export * from "../../renderer/components/locale-date";
export * from "../../renderer/components/map";
export * from "../../renderer/components/markdown-viewer";
export * from "../../renderer/components/maybe-link";
export * from "../../renderer/components/menu";
export {
  type MonacoCustomTheme,
  MonacoEditor,
  type MonacoEditorId,
  type MonacoEditorProps,
  type MonacoTheme,
} from "../../renderer/components/monaco-editor";
export * from "../../renderer/components/namespaces/namespace-select";
export * from "../../renderer/components/namespaces/namespace-select-badge";
export * from "../../renderer/components/namespaces/namespace-select-filter";
export * from "../../renderer/components/no-items";
export * from "../../renderer/components/path-picker";
export * from "../../renderer/components/radio";
export * from "../../renderer/components/render-delay";
export * from "../../renderer/components/resource-metrics";
export * from "../../renderer/components/select";
export * from "../../renderer/components/slider";
export * from "../../renderer/components/status-brick";
export * from "../../renderer/components/stepper";
export * from "../../renderer/components/switch";
export * from "../../renderer/components/table";
export * from "../../renderer/components/tabs";
export * from "../../renderer/components/tree-view";
export * from "../../renderer/components/virtual-list";
export * from "../../renderer/components/with-tooltip";
export * from "../../renderer/components/wizard";
export * from "../../renderer/components/workloads-pods/pod-charts";
export * from "../../renderer/components/workloads-pods/pod-details-list";

export type {
  AdditionalCategoryColumnRegistration,
  CategoryColumnRegistration,
} from "../../renderer/components/catalog/custom-category-columns";

export const CommandOverlay = asLegacyGlobalForExtensionApi(commandOverlayInjectable);

export type { ConfirmDialogBooleanParams, ConfirmDialogParams, ConfirmDialogProps };
export const ConfirmDialog = Object.assign(_ConfirmDialog, {
  open: asLegacyGlobalFunctionForExtensionApi(openConfirmDialogInjectable),
  confirm: asLegacyGlobalFunctionForExtensionApi(confirmInjectable),
});

/**
 * 🔄 FIX-037: Migrated from Toast to NotificationPanel
 * Extensions should use notificationPanelStore directly for new implementations
 * These legacy wrappers maintain backward compatibility
 */
export const Notifications = {
  ok: (message: string) => notificationPanelStore.addSuccess("extensions", "Success", message),
  error: (message: string | unknown) => {
    const msg = message instanceof Error ? message.message : String(message);
    return notificationPanelStore.addError("extensions", "Error", msg);
  },
  checkedError: (error: unknown, fallback = "An error occurred") => {
    return notificationPanelStore.addCheckedError("extensions", error, fallback);
  },
  info: (message: string) => notificationPanelStore.addInfo("extensions", "Info", message),
  shortInfo: (message: string) => notificationPanelStore.addInfo("extensions", "Info", message),
};

/**
 * @deprecated Use `Renderer.Navigation.getDetailsUrl`
 */
export const getDetailsUrl = asLegacyGlobalFunctionForExtensionApi(getDetailsUrlInjectable);

/**
 * @deprecated Use `Renderer.Navigation.showDetails`
 */
export const showDetails = asLegacyGlobalFunctionForExtensionApi(showDetailsInjectable);

export const createTerminalTab = asLegacyGlobalFunctionForExtensionApi(createTerminalTabInjectable);

export const terminalStore = Object.assign(asLegacyGlobalForExtensionApi(terminalStoreInjectable), {
  sendCommand: asLegacyGlobalFunctionForExtensionApi(sendCommandInjectable),
});

const renameTab = asLegacyGlobalFunctionForExtensionApi(renameTabInjectable);
const podStore = asLegacyGlobalForExtensionApi(podStoreInjectable);

export const logTabStore = Object.assign(asLegacyGlobalForExtensionApi(logTabStoreInjectable), {
  createPodTab: asLegacyGlobalFunctionForExtensionApi(createPodLogsTabInjectable),
  createWorkloadTab: asLegacyGlobalFunctionForExtensionApi(createWorkloadLogsTabInjectable),
  renameTab: (tabId: string): void => {
    const { selectedPodId } = logTabStore.getData(tabId) ?? {};
    const pod = selectedPodId && podStore.getById(selectedPodId);

    if (pod) {
      renameTab(tabId, `Pod ${pod.getName()}`);
    }
  },
  tabs: undefined,
});

export class TerminalStore {
  static getInstance() {
    return terminalStore;
  }

  static createInstance() {
    return terminalStore;
  }

  static resetInstance() {
    console.warn("TerminalStore.resetInstance() does nothing");
  }
}

// 🔄 Sonner 마이그레이션: notificationsStore는 더 이상 사용되지 않음
// Sonner는 자체 상태를 관리하므로 store 접근이 필요 없음
// export const notificationsStore = ... (제거됨)
