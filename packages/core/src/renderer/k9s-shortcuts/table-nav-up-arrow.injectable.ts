import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableNavUpArrowShortcutInjectable = getInjectable({
  id: "k9s-table-nav-up-arrow",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "ArrowUp",
      invoke: () => tableFocusManager.moveUp(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableNavUpArrowShortcutInjectable;
