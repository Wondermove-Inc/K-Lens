/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { KubeObject } from "@skuberplus/kube-object";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

export type DeleteType = "delete" | "force_delete" | "force_finalize";

export interface KubeObjectDeleteService {
  delete: (object: KubeObject, deleteType: DeleteType) => Promise<void>;
}

const kubeObjectDeleteServiceInjectable = getInjectable({
  id: "kube-object-delete-service",

  instantiate: (di): KubeObjectDeleteService => {
    const apiManager = di.inject(apiManagerInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);

    // 삭제 유형별 메시지 매핑
    const deleteTypeMessages: Record<DeleteType, string> = {
      delete: "deleted",
      force_delete: "force deleted",
      force_finalize: "force finalized",
    };

    return {
      delete: async (object: KubeObject, deleteType: DeleteType) => {
        const store = apiManager.getStore(object.selfLink);

        if (!store) {
          throw new Error(`No store found for object: ${object.selfLink}`);
        }

        switch (deleteType) {
          case "delete":
            await store.remove(object);
            break;

          case "force_delete":
            // Use the delete option with grace period 0s
            await store.removeWithOptions(object, {
              gracePeriodSeconds: 0,
              propagationPolicy: "Background",
            });
            break;

          case "force_finalize":
            // For objects with finalizers in terminated state, patch finalizers
            await store.patch(
              object,
              {
                metadata: {
                  finalizers: [],
                },
              },
              "merge",
            );
            break;

          default:
            throw new Error(`Unknown delete type: ${deleteType}`);
        }

        // 🎯 FIX-037: NotificationPanel으로 마이그레이션
        const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
        const actionText = deleteTypeMessages[deleteType];
        notificationPanelStore.addSuccess(
          "operations",
          `${object.kind} ${actionText}`,
          `[${clusterName}] ${object.getName()} ${actionText} successfully`,
          {
            actionType: "delete",
            resourceKind: object.kind,
            resourceName: object.getName(),
            namespace: object.getNs(),
            clusterName,
          },
        );
      },
    };
  },
});

export default kubeObjectDeleteServiceInjectable;
