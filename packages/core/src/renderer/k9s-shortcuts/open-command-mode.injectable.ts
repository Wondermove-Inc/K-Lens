import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import { broadcastMessage } from "../../common/ipc";
import hostedClusterIdInjectable from "../cluster-frame-context/hosted-cluster-id.injectable";
import inlineCommandPaletteStoreInjectable from "../components/command-palette/inline-command-palette-store.injectable";

/**
 * `:` key (Shift+Semicolon) focuses the inline search bar with `:` prefilled.
 * This mirrors the k9s `:` command mode for quickly navigating to resources.
 *
 * In cluster frame: broadcasts IPC to root frame (search bar lives there).
 * In root frame: directly focuses the search bar.
 */
const openCommandModeInjectable = getInjectable({
  id: "k9s-open-command-mode",

  instantiate: (di) => {
    const clusterId = di.inject(hostedClusterIdInjectable);
    const store = di.inject(inlineCommandPaletteStoreInjectable);

    return {
      binding: { code: "Semicolon", shift: true },
      invoke: () => {
        if (clusterId) {
          // Cluster frame → broadcast to root frame
          broadcastMessage("inline-command-palette:focus", ":");
        } else {
          // Root frame → focus directly
          store.focus(":");
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default openCommandModeInjectable;
