import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import { clipboard } from "electron";
import { broadcastMessage } from "../../common/ipc";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

/**
 * `c` key — Copy the focused resource name to clipboard.
 * Mirrors k9s `c` for copy. Works on any resource type.
 */
const copyResourceNameInjectable = getInjectable({
  id: "k9s-copy-resource-name",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "KeyC",
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item) {
          return;
        }

        const name = (item as any).getName?.() ?? "";
        if (!name) {
          return;
        }

        clipboard.writeText(name);
        broadcastMessage("status-bar:flash", `Copied: ${name}`);
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default copyResourceNameInjectable;
