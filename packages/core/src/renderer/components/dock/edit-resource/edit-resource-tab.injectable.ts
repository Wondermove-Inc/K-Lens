/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PenSquare } from "lucide-react";
import { reaction, runInAction } from "mobx";
import React from "react";
import resourceEditorRouteInjectable from "../../../../common/front-end-routing/routes/cluster/resource-editor/resource-editor-route.injectable";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import navigateInjectable from "../../../navigation/navigate.injectable";
import mainTabStoreInjectable from "../../main-tabs/main-tab-store.injectable";
import getRandomIdForEditResourceTabInjectable from "./get-random-id-for-edit-resource-tab.injectable";
import editResourceTabStoreInjectable from "./store.injectable";

import type { KubeObject } from "@skuberplus/kube-object";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../../common/catalog-entities";
import type { Route } from "../../../../common/front-end-routing/front-end-route-injection-token";
import type { Navigate } from "../../../navigation/navigate.injectable";
import type { MainTabStore } from "../../main-tabs/main-tab-store";
import type { TabId } from "../dock/store";

const createEditResourceTabInjectable = getInjectable({
  id: "create-edit-resource-tab",

  instantiate: (di) => {
    const editResourceStore = di.inject(editResourceTabStoreInjectable);
    const resourceEditorRoute = di.inject(resourceEditorRouteInjectable) as Route;
    const navigate = di.inject(navigateInjectable) as Navigate;
    const activeKubernetesCluster = di.inject(activeKubernetesClusterInjectable) as IComputedValue<
      KubernetesCluster | undefined
    >;
    const getRandomId = di.inject(getRandomIdForEditResourceTabInjectable);

    let cachedMainTabStore: MainTabStore | undefined;
    let cleanupInitialized = false;

    const ensureMainTabStore = (): MainTabStore => {
      if (!cachedMainTabStore) {
        cachedMainTabStore = di.inject(mainTabStoreInjectable);
      }

      if (!cleanupInitialized) {
        cleanupInitialized = true;

        reaction(
          () => cachedMainTabStore!.allTabs.map((tab) => tab.id),
          (activeTabIds) => {
            const activeIdSet = new Set(activeTabIds);

            for (const storedTabId of editResourceStore.getTabIds()) {
              if (!activeIdSet.has(storedTabId)) {
                editResourceStore.clearData(storedTabId);
              }
            }
          },
          { fireImmediately: true },
        );
      }

      return cachedMainTabStore!;
    };

    const getTargetGroup = (store: MainTabStore): "left" | "right" => {
      if (store.isSplitActive && store.rightGroup) {
        return "right";
      }

      return store.activeGroup?.id ?? "left";
    };

    return (object: KubeObject): TabId => {
      const store = ensureMainTabStore();

      // use existing tab if already opened
      const tabId = editResourceStore.getTabIdByResource(object);

      if (tabId) {
        store.activateTab(tabId);
        navigate(resourceEditorRoute.path);

        return tabId;
      }

      return runInAction(() => {
        const title = `${object.kind}: ${object.getName()}`;
        const clusterId = activeKubernetesCluster.get()?.getId();
        const targetGroupId = getTargetGroup(store);
        const tabId = getRandomId();

        const tab = store.createTab(
          {
            id: tabId,
            title,
            route: resourceEditorRoute.path,
            icon: "PenSquare",
            iconComponent: React.createElement(PenSquare, { className: "h-4 w-4" }),
            allowDuplicateRoute: true,
            clusterId,
          },
          targetGroupId,
        );

        editResourceStore.setData(tab.id, {
          resource: object.selfLink,
        });

        navigate(tab.route);

        return tab.id;
      });
    };
  },
});

export default createEditResourceTabInjectable;
