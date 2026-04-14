import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import dockStoreInjectable from "../components/dock/dock/store.injectable";
import focusPanelManagerInjectable from "../components/layout/focus-panel-manager/focus-panel-manager.injectable";

const toggleDockShortcutInjectable = getInjectable({
  id: "k9s-toggle-dock-shortcut",

  instantiate: (di) => {
    const dockStore = di.inject(dockStoreInjectable);
    const focusPanelManager = di.inject(focusPanelManagerInjectable);

    return {
      binding: { code: "Backquote", ctrlOrCommand: true },
      invoke: () => {
        dockStore.toggle();
        if (dockStore.isOpen) {
          focusPanelManager.focusDock();
        } else {
          focusPanelManager.focusContents();
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default toggleDockShortcutInjectable;
