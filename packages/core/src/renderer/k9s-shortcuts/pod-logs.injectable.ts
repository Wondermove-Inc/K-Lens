import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import createPodLogsTabInjectable from "../components/dock/logs/create-pod-logs-tab.injectable";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

import type { Pod } from "@skuberplus/kube-object";

/**
 * `l` key — View logs for the focused Pod.
 * Mirrors k9s `l` for logs. Only works when a Pod is focused.
 */
const podLogsInjectable = getInjectable({
  id: "k9s-pod-logs",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);
    const createPodLogsTab = di.inject(createPodLogsTabInjectable);

    return {
      binding: "KeyL",
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item || !("kind" in item) || (item as any).kind !== "Pod") {
          return;
        }

        const pod = item as unknown as Pod;
        if (typeof pod.getContainers !== "function" || typeof pod.getInitContainers !== "function") {
          return;
        }
        const containers = pod.getContainers();
        const initContainers = pod.getInitContainers();
        const allContainers = [...containers, ...initContainers];

        if (allContainers.length === 0) {
          return;
        }

        // Use the first container by default
        createPodLogsTab({
          selectedPod: pod,
          selectedContainer: allContainers[0],
        });
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default podLogsInjectable;
