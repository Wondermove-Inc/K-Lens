import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import dockStoreInjectable from "../components/dock/dock/store.injectable";

/**
 * `Ctrl+Tab` — Cycle to the next dock tab.
 * If on the last tab, wraps around to the first.
 */
const tabCycleInjectable = getInjectable({
  id: "k9s-tab-cycle",

  instantiate: (di) => {
    const dockStore = di.inject(dockStoreInjectable);

    return {
      binding: { code: "Tab", ctrl: true },
      invoke: () => {
        const { tabs, selectedTabId } = dockStore;
        if (tabs.length <= 1) return;

        const currentIndex = tabs.findIndex((tab) => tab.id === selectedTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;

        dockStore.selectTab(tabs[nextIndex].id);
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tabCycleInjectable;
