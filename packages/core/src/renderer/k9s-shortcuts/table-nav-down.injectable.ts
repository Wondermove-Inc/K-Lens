import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableNavDownShortcutInjectable = getInjectable({
  id: "k9s-table-nav-down",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "KeyJ",
      invoke: () => tableFocusManager.moveDown(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableNavDownShortcutInjectable;
