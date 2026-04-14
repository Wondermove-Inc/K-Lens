import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

/**
 * `Ctrl+F` — Page forward (k9s/vim style).
 * Uses physical Ctrl (not Cmd) to avoid conflict with Cmd+F browser search on Mac.
 */
const tablePageDownShortcutInjectable = getInjectable({
  id: "k9s-table-page-down",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: { code: "KeyF", ctrl: true },
      invoke: () => tableFocusManager.pageForward(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tablePageDownShortcutInjectable;
