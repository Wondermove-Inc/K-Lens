import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import { buildKubectlExecCommand } from "../../common/utils/shell-utils";
import createTerminalTabInjectable from "../components/dock/terminal/create-terminal-tab.injectable";
import sendCommandInjectable from "../components/dock/terminal/send-command.injectable";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";

import type { Container, Pod } from "@skuberplus/kube-object";

/**
 * `s` key — Shell into the focused Pod.
 * Mirrors k9s `s` for shell. Only works when a Pod is focused.
 * Opens a terminal tab and runs `kubectl exec -it`.
 */
const podShellInjectable = getInjectable({
  id: "k9s-pod-shell",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);
    const createTerminalTab = di.inject(createTerminalTabInjectable);
    const sendCommand = di.inject(sendCommandInjectable);

    return {
      binding: "KeyS",
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item || !("kind" in item) || (item as any).kind !== "Pod") {
          return;
        }

        const pod = item as unknown as Pod;
        if (typeof pod.getRunningContainersWithType !== "function") {
          return;
        }
        const containers = pod.getRunningContainersWithType();

        if (containers.length === 0) {
          return;
        }

        const container = containers[0] as Container;
        const namespace = pod.getNs?.() ?? "";
        const podName = pod.getName?.() ?? "";

        if (!namespace || !podName) {
          return;
        }

        const tab = createTerminalTab({
          title: `Pod: ${podName} (namespace: ${namespace})`,
        });

        const command = buildKubectlExecCommand({
          kubectlPath: "kubectl",
          namespace,
          podName,
          containerName: container.name,
          podOs: pod.getSelectedNodeOs(),
        });

        sendCommand(command, { tabId: tab.id, enter: true });
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default podShellInjectable;
