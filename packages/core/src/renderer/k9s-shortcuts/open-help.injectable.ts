import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import keyboardHelpStoreInjectable from "../components/keyboard-help-overlay/keyboard-help-store.injectable";

/**
 * `?` key (Shift+Slash) opens the keyboard shortcuts help overlay.
 * Mirrors k9s `?` for help.
 */
const openHelpInjectable = getInjectable({
  id: "k9s-open-help",

  instantiate: (di) => {
    const keyboardHelpStore = di.inject(keyboardHelpStoreInjectable);

    return {
      binding: { code: "Slash", shift: true },
      invoke: () => {
        keyboardHelpStore.toggle();
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default openHelpInjectable;
