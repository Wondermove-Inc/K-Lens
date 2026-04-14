import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableNavUpShortcutInjectable = getInjectable({
  id: "k9s-table-nav-up",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "KeyK",
      invoke: () => tableFocusManager.moveUp(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableNavUpShortcutInjectable;
