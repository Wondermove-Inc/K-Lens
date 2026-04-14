import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import { v4 as uuid } from "uuid";
import { LOG_WINDOW_OPEN_CHANNEL } from "../../common/ipc/log-window-channel";
import hostedClusterIdInjectable from "../cluster-frame-context/hosted-cluster-id.injectable";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";
import ipcRendererInjectable from "../utils/channel/ipc-renderer.injectable";

import type { Pod } from "@skuberplus/kube-object";

import type { LogWindowOpenPayload } from "../../common/ipc/log-window-channel";

/**
 * `Shift+L` — Open logs for the focused Pod in a detached window.
 * Unlike `l` (dock panel), this opens a separate BrowserWindow directly.
 */
const podLogsDetachedInjectable = getInjectable({
  id: "k9s-pod-logs-detached",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);
    const ipcRenderer = di.inject(ipcRendererInjectable);
    const clusterId = di.inject(hostedClusterIdInjectable);

    return {
      binding: { code: "KeyL", shift: true },
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item || !("kind" in item) || (item as any).kind !== "Pod") {
          return;
        }

        const pod = item as unknown as Pod;
        if (typeof pod.getContainers !== "function" || typeof pod.getInitContainers !== "function") {
          return;
        }

        const containers = [...pod.getContainers(), ...pod.getInitContainers()];
        if (containers.length === 0 || !clusterId) {
          return;
        }

        const payload: LogWindowOpenPayload = {
          windowId: uuid(),
          clusterId,
          namespace: pod.getNs(),
          podId: pod.getId(),
          podName: pod.getName(),
          container: containers[0].name,
          showTimestamps: false,
          showPrevious: false,
          timestampFormat: "iso",
          visibleLevels: [],
          allContainers: [
            ...pod.getContainers().map((c) => ({ name: c.name, isInit: false })),
            ...pod.getInitContainers().map((c) => ({ name: c.name, isInit: true })),
          ],
          owner: pod.getOwnerRefs?.()[0]
            ? { uid: pod.getOwnerRefs()[0].uid, name: pod.getOwnerRefs()[0].name, kind: pod.getOwnerRefs()[0].kind }
            : undefined,
        };

        ipcRenderer.invoke(LOG_WINDOW_OPEN_CHANNEL, payload);
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default podLogsDetachedInjectable;
