import { getInjectable } from "@ogre-tools/injectable";
import {
  KeyboardLayer,
  keyboardLayerManagerInjectable,
  keyboardShortcutInjectionToken,
} from "@skuberplus/keyboard-shortcuts";

/**
 * Escape key handler that consumes layers from top to bottom:
 * - Layer 4 (Modal): handled by dialog's own onClose (not this shortcut)
 * - Layer 3 (Input): blur active input and return to contents panel
 * - Layer 2/1 (Panel/Global): no-op (details pane close handled elsewhere)
 */
const escapeHandlerInjectable = getInjectable({
  id: "k9s-escape-handler",

  instantiate: (di) => {
    const layerManager = di.inject(keyboardLayerManagerInjectable);

    return {
      binding: "Escape",
      invoke: () => {
        const layer = layerManager.getActiveLayer();

        if (layer === KeyboardLayer.INPUT) {
          // Blur active input and return focus to contents panel
          const activeElement = document.activeElement as HTMLElement;
          activeElement?.blur();
          const contentsPanel = document.querySelector("[data-panel-id='contents']") as HTMLElement | null;
          contentsPanel?.focus({ preventScroll: true });
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default escapeHandlerInjectable;
