import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableNavDownArrowShortcutInjectable = getInjectable({
  id: "k9s-table-nav-down-arrow",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "ArrowDown",
      invoke: () => tableFocusManager.moveDown(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableNavDownArrowShortcutInjectable;
