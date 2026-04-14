/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
// 🎯 shadcn UI 컴포넌트: 레거시 Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { reaction, runInAction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { Notice } from "../../extensions/notice";
import mainTabStoreInjectable from "../../main-tabs/main-tab-store.injectable";
import { EditorPanel } from "../editor-panel";
import { InfoPanel } from "../info-panel";
import editResourceModelInjectable from "./edit-resource-model/edit-resource-model.injectable";

import type { MainTabStore } from "../../main-tabs/main-tab-store";
import type { EditResourceModel } from "./edit-resource-model/edit-resource-model.injectable";

export interface EditResourceProps {
  tabId: string;
}

interface Dependencies {
  model: EditResourceModel;
  mainTabStore: MainTabStore;
}

const NonInjectedEditResource = observer(({ model, tabId, mainTabStore }: EditResourceProps & Dependencies) => {
  // 🔄 isDirty 동기화: EditResourceModel → MainTab.isDirty
  React.useEffect(() => {
    const disposer = reaction(
      () => {
        try {
          const draft = model.editingResource.draft;
          const firstDraft = model.editingResource.firstDraft;

          return { draft, firstDraft };
        } catch {
          return { draft: undefined, firstDraft: undefined };
        }
      },
      ({ draft, firstDraft }) => {
        const tab = mainTabStore.allTabs.find((t) => t.id === tabId);

        if (tab) {
          runInAction(() => {
            tab.isDirty = draft !== undefined && draft !== firstDraft;
            mainTabStore.groups = [...mainTabStore.groups];
          });
        }
      },
      { fireImmediately: true },
    );

    return disposer;
  }, [model, tabId, mainTabStore]);

  // 🔒 저장 핸들러 등록 (Cmd+W 다이얼로그용)
  React.useEffect(() => {
    const unregister = mainTabStore.registerSaveHandler(tabId, async () => {
      const result = await model.save();

      return result !== null;
    });

    return unregister;
  }, [model, tabId, mainTabStore]);

  return (
    <div className="EditResource flex flex-1 flex-col min-h-0 overflow-hidden">
      {model.shouldShowErrorAboutNoResource ? (
        <Notice>Resource not found</Notice>
      ) : (
        <>
          <InfoPanel
            tabId={tabId}
            // 🎯 수정: shadcn 테마 호환을 위해 Tailwind 배경/텍스트 클래스 추가
            className="!bg-muted !text-foreground"
            error={model.configuration.error.value.get()}
            submit={model.save}
            showNotifications={false}
            submitLabel="Save"
            submittingMessage="Applying..."
            submitTestId={`save-edit-resource-from-tab-for-${tabId}`}
            submitAndCloseTestId={`save-and-close-edit-resource-from-tab-for-${tabId}`}
            cancelTestId={`cancel-edit-resource-from-tab-for-${tabId}`}
            submittingTestId={`saving-edit-resource-from-tab-for-${tabId}`}
            controls={
              <div className="resource-info flex gaps align-center">
                <span>Kind:</span>
                <Badge variant="outline">{model.kind}</Badge>
                <span>Name:</span>
                <Badge variant="outline">{model.name}</Badge>
                <span>Namespace:</span>
                <Badge variant="outline">{model.namespace}</Badge>
              </div>
            }
          />
          <div className="flex-1 min-h-0">
            <EditorPanel
              tabId={tabId}
              value={model.configuration.value.get()}
              onChange={model.configuration.onChange}
              onError={model.configuration.error.onChange}
            />
          </div>
        </>
      )}
    </div>
  );
});

export const EditResource = withInjectables<Dependencies, EditResourceProps>(NonInjectedEditResource, {
  getPlaceholder: () => <Spinner center data-testid="edit-resource-tab-spinner" />,
  getProps: async (di, props) => ({
    ...props,
    model: await di.inject(editResourceModelInjectable, props.tabId),
    mainTabStore: di.inject(mainTabStoreInjectable),
  }),
});
