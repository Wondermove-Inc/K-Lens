import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

/**
 * `Ctrl+B` — Page backward (k9s/vim style).
 * Uses physical Ctrl (not Cmd) to avoid conflict with browser shortcuts on Mac.
 */
const tablePageUpShortcutInjectable = getInjectable({
  id: "k9s-table-page-up",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: { code: "KeyB", ctrl: true },
      invoke: () => tableFocusManager.pageBackward(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tablePageUpShortcutInjectable;
