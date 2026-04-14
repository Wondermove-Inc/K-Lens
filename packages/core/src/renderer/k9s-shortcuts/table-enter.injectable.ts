import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

const tableEnterShortcutInjectable = getInjectable({
  id: "k9s-table-enter",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "Enter",
      invoke: () => {
        if (tableFocusManager.focusedIndex === null) return;

        // Simulate a click on the focused row to reuse the same onRowClick path
        const rows = document.querySelectorAll("[data-table-row]");
        const row = rows[tableFocusManager.focusedIndex % rows.length];
        if (row instanceof HTMLElement) {
          row.click();
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableEnterShortcutInjectable;
