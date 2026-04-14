/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { KubernetesCluster } from "../../../../common/catalog-entities";
import catalogEntityRegistryInjectable from "../../../api/catalog/entity/registry.injectable";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import { TabKind } from "../dock/store";
import dockStoreInjectable from "../dock/store.injectable";
import terminalStoreInjectable from "./store.injectable";

import type { DockTabCreateSpecific } from "../dock/store";

const createTerminalTabInjectable = getInjectable({
  id: "create-terminal-tab",

  instantiate: (di) => {
    const dockStore = di.inject(dockStoreInjectable);
    const activeKubernetesCluster = di.inject(activeKubernetesClusterInjectable);
    const catalogEntityRegistry = di.inject(catalogEntityRegistryInjectable);
    const terminalStore = di.inject(terminalStoreInjectable);

    return (tabParams: DockTabCreateSpecific = {}) => {
      // 🎯 현재 활성 클러스터 ID 자동 감지
      // Cluster Frame 내부: activeKubernetesCluster.get() 사용
      // Dock (Frame 외부): catalogEntityRegistry.activeEntity 사용
      const frameCluster = activeKubernetesCluster.get();
      const globalActiveEntity = catalogEntityRegistry.activeEntity;
      const globalActiveCluster = globalActiveEntity instanceof KubernetesCluster ? globalActiveEntity : undefined;

      // 우선순위: tabParams.clusterId → frameCluster → globalActiveCluster
      const clusterId = tabParams.clusterId || frameCluster?.getId() || globalActiveCluster?.getId();

      const clusterFromRegistry = clusterId
        ? catalogEntityRegistry.items
            .get()
            .find(
              (entity): entity is KubernetesCluster =>
                entity instanceof KubernetesCluster && entity.getId() === clusterId,
            )
        : undefined;

      const resolvedCluster = clusterFromRegistry || frameCluster || globalActiveCluster;

      // 🎯 탭 제목을 클러스터 이름으로 설정
      const clusterName = tabParams.title || resolvedCluster?.getName() || "Terminal";

      const tabDescriptor = {
        title: clusterName, // ✅ 클러스터 이름을 탭 제목으로 사용
        ...tabParams,
        clusterId, // 🎨 클러스터 정보 저장 (클러스터 전환 시에도 유지됨)
        kind: TabKind.TERMINAL,
      };

      const createdTab = dockStore.createTab(tabDescriptor);

      // 🎯 새로 생성된 Terminal 탭은 TerminalWindow mount 후 connect 필요
      // TerminalWindow.componentDidMount()에서는 connect 호출하지 않으므로
      // 여기서 명시적으로 connect 트리거 (다음 tick)
      // TerminalWindow가 마운트된 후 실행되도록 setTimeout 사용
      setTimeout(() => {
        const terminal = terminalStore.getTerminal(createdTab.id);

        if (terminal) {
          terminalStore.connectTerminal(createdTab.id);
        } else {
          console.warn("[CREATE-TERMINAL-TAB] Terminal not found for connect:", {
            tabId: createdTab.id,
          });
        }
      }, 100); // TerminalWindow mount 대기 (여유 있게 100ms)

      return createdTab;
    };
  },
});

export default createTerminalTabInjectable;
