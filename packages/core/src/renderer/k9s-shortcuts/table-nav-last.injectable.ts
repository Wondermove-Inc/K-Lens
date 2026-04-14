import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableNavLastShortcutInjectable = getInjectable({
  id: "k9s-table-nav-last",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: { code: "KeyG", shift: true },
      invoke: () => tableFocusManager.goToLast(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableNavLastShortcutInjectable;
