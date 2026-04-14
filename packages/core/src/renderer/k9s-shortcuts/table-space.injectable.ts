import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

/**
 * Space key toggles checkbox selection on the focused row.
 */
const tableSpaceShortcutInjectable = getInjectable({
  id: "k9s-table-space",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "Space",
      invoke: () => {
        const idx = tableFocusManager.focusedIndex;
        if (idx === null) return;

        const rows = document.querySelectorAll("[data-table-row]");
        const row = rows[idx % rows.length];
        if (!row) return;

        // shadcn Checkbox renders as <button role="checkbox" data-slot="checkbox">
        const checkbox = row.querySelector("[data-slot='checkbox']") as HTMLElement;
        if (checkbox) {
          checkbox.click();
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default tableSpaceShortcutInjectable;
