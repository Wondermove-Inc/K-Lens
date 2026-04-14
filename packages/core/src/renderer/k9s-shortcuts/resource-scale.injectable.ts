import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import tableFocusManagerInjectable from "../components/table/table-focus-manager.injectable";
import openDeploymentScaleDialogInjectable from "../components/workloads-deployments/scale/open.injectable";
import openReplicaSetScaleDialogInjectable from "../components/workloads-replicasets/scale-dialog/open.injectable";
import openStatefulSetScaleDialogInjectable from "../components/workloads-statefulsets/scale/open-dialog.injectable";

import type { Deployment, ReplicaSet, StatefulSet } from "@skuberplus/kube-object";

/**
 * `s` key — Scale the focused Deployment, StatefulSet, or ReplicaSet.
 * Mirrors k9s `s` for scale. Only works when one of these resource kinds is focused.
 * Note: For Pods, the `s` key opens a shell (handled by pod-shell.injectable.ts).
 */
const resourceScaleInjectable = getInjectable({
  id: "k9s-resource-scale",

  instantiate: (di) => {
    const tableFocusManager = di.inject(tableFocusManagerInjectable);
    const openDeploymentScaleDialog = di.inject(openDeploymentScaleDialogInjectable);
    const openStatefulSetScaleDialog = di.inject(openStatefulSetScaleDialogInjectable);
    const openReplicaSetScaleDialog = di.inject(openReplicaSetScaleDialogInjectable);

    return {
      binding: "KeyS",
      invoke: () => {
        const item = tableFocusManager.focusedItem;
        if (!item || !("kind" in item)) {
          return;
        }

        const kind = (item as any).kind as string;

        switch (kind) {
          case "Deployment":
            openDeploymentScaleDialog(item as unknown as Deployment);
            break;
          case "StatefulSet":
            openStatefulSetScaleDialog(item as unknown as StatefulSet);
            break;
          case "ReplicaSet":
            openReplicaSetScaleDialog(item as unknown as ReplicaSet);
            break;
          // Pod shell is handled by pod-shell.injectable.ts (same `s` key)
          default:
            break;
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default resourceScaleInjectable;
