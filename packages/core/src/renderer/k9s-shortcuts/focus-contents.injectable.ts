import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import mainTabStoreInjectable from "../components/main-tabs/main-tab-store.injectable";

/**
 * `Cmd+2` (Mac) / `Ctrl+2` (Win/Linux) — Switch to main tab #2.
 */
const switchTab2Injectable = getInjectable({
  id: "k9s-switch-tab-2",

  instantiate: (di) => {
    const mainTabStore = di.inject(mainTabStoreInjectable);

    return {
      binding: { code: "Digit2", ctrlOrCommand: true },
      invoke: () => {
        const tab = mainTabStore.tabs[1];

        if (tab) {
          mainTabStore.activateTab(tab.id);
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default switchTab2Injectable;
