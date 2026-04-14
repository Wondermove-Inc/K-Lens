import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import createEditResourceTabInjectable from "../components/dock/edit-resource/edit-resource-tab.injectable";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

import type { KubeObject } from "@skuberplus/kube-object";

/**
 * `e` key — Edit the focused resource (opens YAML editor tab).
 * Mirrors k9s `e` for edit.
 */
const resourceEditInjectable = getInjectable({
  id: "k9s-resource-edit",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);

    return {
      binding: "KeyE",
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (item && "selfLink" in item && typeof item.selfLink === "string") {
          createEditResourceTab(item as KubeObject);
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default resourceEditInjectable;
