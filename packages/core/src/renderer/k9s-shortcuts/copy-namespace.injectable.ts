import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import { clipboard } from "electron";
import { broadcastMessage } from "../../common/ipc";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

/**
 * `n` key — Copy the focused resource's namespace to clipboard.
 * Mirrors k9s `n` for namespace copy. Only works on namespaced resources.
 */
const copyNamespaceInjectable = getInjectable({
  id: "k9s-copy-namespace",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);

    return {
      binding: "KeyN",
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item) {
          return;
        }

        const namespace = (item as any).getNs?.() ?? "";
        if (!namespace) {
          return;
        }

        clipboard.writeText(namespace);
        broadcastMessage("status-bar:flash", `Copied: ${namespace}`);
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default copyNamespaceInjectable;
