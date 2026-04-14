import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import mainTabStoreInjectable from "../components/main-tabs/main-tab-store.injectable";

/**
 * `Cmd+1` (Mac) / `Ctrl+1` (Win/Linux) — Switch to main tab #1.
 */
const switchTab1Injectable = getInjectable({
  id: "k9s-switch-tab-1",

  instantiate: (di) => {
    const mainTabStore = di.inject(mainTabStoreInjectable);

    return {
      binding: { code: "Digit1", ctrlOrCommand: true },
      invoke: () => {
        const tab = mainTabStore.tabs[0];

        if (tab) {
          mainTabStore.activateTab(tab.id);
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default switchTab1Injectable;
