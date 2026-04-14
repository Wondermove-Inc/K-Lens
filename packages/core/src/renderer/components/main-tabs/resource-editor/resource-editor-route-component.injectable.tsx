/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import resourceEditorRouteInjectable from "../../../../common/front-end-routing/routes/cluster/resource-editor/resource-editor-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../../routes/route-specific-component-injection-token";
import editResourceTabStoreInjectable from "../../dock/edit-resource/store.injectable";
import { EditResource } from "../../dock/edit-resource/view";
import { useOptionalMainTabContext } from "../main-tab-context";
import mainTabStoreInjectable from "../main-tab-store.injectable";

import type { EditResourceTabStore } from "../../dock/edit-resource/store";
import type { MainTabStore } from "../main-tab-store";

interface ResourceEditorMainViewProps {}

interface Dependencies {
  mainTabStore: MainTabStore;
  resourceEditorRoutePath: string;
  editResourceStore: EditResourceTabStore;
}

const NonInjectedResourceEditorMainView = observer(
  ({ mainTabStore, resourceEditorRoutePath, editResourceStore }: ResourceEditorMainViewProps & Dependencies) => {
    const context = useOptionalMainTabContext();

    let tabId = context?.tab.id;

    if (!tabId) {
      const activeTab = mainTabStore.activeTab;

      if (activeTab?.route === resourceEditorRoutePath) {
        tabId = activeTab.id;
      } else {
        const matchingTab = [...mainTabStore.allTabs].reverse().find((tab) => tab.route === resourceEditorRoutePath);

        if (matchingTab) {
          tabId = matchingTab.id;
        }
      }
    }

    if (!tabId) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          편집 탭을 초기화하는 중입니다…
        </div>
      );
    }

    const editingResource = editResourceStore.getData(tabId);

    if (!editingResource) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[ResourceEditor] 편집 데이터가 아직 초기화되지 않았습니다.", { tabId });
      }
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          리소스 편집 데이터를 불러오는 중입니다…
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col overflow-hidden min-h-0" data-testid={`dock-tab-content-for-${tabId}`}>
        <EditResource tabId={tabId} />
      </div>
    );
  },
);

const ResourceEditorMainView = withInjectables<Dependencies, ResourceEditorMainViewProps>(
  NonInjectedResourceEditorMainView,
  {
    getProps: (di, props) => {
      const route = di.inject(resourceEditorRouteInjectable);

      return {
        ...props,
        mainTabStore: di.inject(mainTabStoreInjectable),
        resourceEditorRoutePath: route.path,
        editResourceStore: di.inject(editResourceTabStoreInjectable),
      };
    },
  },
);

const resourceEditorRouteComponentInjectable = getInjectable({
  id: "resource-editor-route-component",

  instantiate: (di) => ({
    route: di.inject(resourceEditorRouteInjectable),
    Component: ResourceEditorMainView,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default resourceEditorRouteComponentInjectable;
