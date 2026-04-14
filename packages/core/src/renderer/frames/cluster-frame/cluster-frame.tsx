/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "../../components/preferences-dialog/preferences-dialog-cluster-frame-child-component.injectable"; // 🎯 ClusterFrame에 PreferencesDialog 등록 (순환 의존성 방지를 위해 여기서 import)
import "./panel-sync-listener.injectable"; // 🎯 ClusterFrame에 Panel Sync IPC 리스너 등록 (TopBar 버튼과 iframe 간 동기화)
import { computedInjectManyInjectable } from "@ogre-tools/injectable-extension-for-mobx";
import { withInjectables } from "@ogre-tools/injectable-react";
import { ErrorBoundary } from "@skuberplus/error-boundary";
import { clusterFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { disposer } from "@skuberplus/utilities";
import { Observer, observer } from "mobx-react";
import React, { useEffect } from "react";
import namespaceStoreInjectable from "../../components/namespaces/store.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import watchHistoryStateInjectable from "../../remote-helpers/watch-history-state.injectable";

import type { ClusterFrameChildComponent } from "@skuberplus/react-application";

import type { IComputedValue } from "mobx";

import type { NamespaceStore } from "../../components/namespaces/store";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";

interface Dependencies {
  namespaceStore: NamespaceStore;
  subscribeStores: SubscribeStores;
  childComponents: IComputedValue<ClusterFrameChildComponent[]>;
  watchHistoryState: () => () => void;
}

const NonInjectedClusterFrame = observer(
  ({ namespaceStore, subscribeStores, childComponents, watchHistoryState }: Dependencies) => {
    useEffect(() => disposer(subscribeStores([namespaceStore]), watchHistoryState()), []);

    return (
      <ErrorBoundary>
        {childComponents.get().map((child) => (
          <Observer key={child.id}>{() => (child.shouldRender.get() ? <child.Component /> : null)}</Observer>
        ))}
      </ErrorBoundary>
    );
  },
);

export const ClusterFrame = withInjectables<Dependencies>(NonInjectedClusterFrame, {
  getProps: (di) => {
    const computedInjectMany = di.inject(computedInjectManyInjectable);

    return {
      namespaceStore: di.inject(namespaceStoreInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
      childComponents: computedInjectMany(clusterFrameChildComponentInjectionToken),
      watchHistoryState: di.inject(watchHistoryStateInjectable),
    };
  },
});

ClusterFrame.displayName = "ClusterFrame";
