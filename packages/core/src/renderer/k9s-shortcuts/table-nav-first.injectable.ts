import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableNavFirstShortcutInjectable = getInjectable({
  id: "k9s-table-nav-first",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "KeyG",
      invoke: () => tableFocusManager.goToFirst(),
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableNavFirstShortcutInjectable;
