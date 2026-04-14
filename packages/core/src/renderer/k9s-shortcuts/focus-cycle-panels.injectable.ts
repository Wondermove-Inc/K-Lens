import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import dockStoreInjectable from "../components/dock/dock/store.injectable";
import focusPanelManagerInjectable from "../components/layout/focus-panel-manager/focus-panel-manager.injectable";

const focusCyclePanelsShortcutInjectable = getInjectable({
  id: "k9s-focus-cycle-panels-shortcut",

  instantiate: (di) => {
    const dockStore = di.inject(dockStoreInjectable);
    const focusPanelManager = di.inject(focusPanelManagerInjectable);

    return {
      binding: { code: "F6" },
      invoke: () => {
        if (!dockStore.isOpen) {
          dockStore.open();
          focusPanelManager.focusDock();
          return;
        }

        const activePanel = focusPanelManager.getActivePanelId();

        if (activePanel === "dock") {
          focusPanelManager.focusContents();
        } else {
          focusPanelManager.focusDock();
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default focusCyclePanelsShortcutInjectable;
