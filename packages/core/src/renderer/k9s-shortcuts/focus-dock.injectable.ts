import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import mainTabStoreInjectable from "../components/main-tabs/main-tab-store.injectable";

/**
 * `Cmd+3` (Mac) / `Ctrl+3` (Win/Linux) — Switch to main tab #3.
 */
const switchTab3Injectable = getInjectable({
  id: "k9s-switch-tab-3",

  instantiate: (di) => {
    const mainTabStore = di.inject(mainTabStoreInjectable);

    return {
      binding: { code: "Digit3", ctrlOrCommand: true },
      invoke: () => {
        const tab = mainTabStore.tabs[2];

        if (tab) {
          mainTabStore.activateTab(tab.id);
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default switchTab3Injectable;
