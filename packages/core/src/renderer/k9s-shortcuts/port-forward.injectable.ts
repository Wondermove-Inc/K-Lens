import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";
import portForwardDialogModelInjectable from "../port-forward/port-forward-dialog-model/port-forward-dialog-model.injectable";

/**
 * `Shift+F` — Open port-forward dialog for the focused Service or Pod.
 * Mirrors k9s `Shift+F` for port-forward.
 */
const portForwardInjectable = getInjectable({
  id: "k9s-port-forward",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);
    const portForwardDialogModel = di.inject(portForwardDialogModelInjectable);

    return {
      binding: { code: "KeyF", shift: true },
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item || !("kind" in item)) {
          return;
        }

        const kind = (item as any).kind as string;
        if (kind !== "Service" && kind !== "Pod") {
          return;
        }

        const name = (item as any).getName?.() ?? "";
        const namespace = (item as any).getNs?.() ?? "default";

        if (!name) {
          return;
        }

        // Open port-forward dialog with a default port forward configuration
        portForwardDialogModel.open({
          kind,
          name,
          namespace,
          port: 0, // Will be filled by the dialog
          forwardPort: 0,
          protocol: "http",
          status: "Disabled",
        });
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default portForwardInjectable;
