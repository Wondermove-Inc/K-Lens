/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { sidebarItemsInjectable } from "@skuberplus/cluster-sidebar";
import { Icon } from "@skuberplus/icon";
import { cssNames } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { isKubernetesCluster, LensKubernetesClusterStatus } from "../../../common/catalog-entities/kubernetes-cluster";
import navigateToAddClusterInjectable from "../../../common/front-end-routing/routes/add-cluster/navigate-to-add-cluster.injectable";
import navigateToCatalogInjectable from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import navigateToClusterViewInjectable from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import navigateToEntitySettingsInjectable from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import openPathPickingDialogInjectable from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import addSyncEntriesInjectable from "../../initializers/add-sync-entries.injectable";
import { getClusterColor } from "./cluster-colors";
import styles from "./sidebar.module.scss";
import { SidebarItem } from "./sidebar-item";

import type { SidebarItemDeclaration } from "@skuberplus/cluster-sidebar";

import type { IComputedValue } from "mobx";

import type { NavigateToCatalog } from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import type { NavigateToClusterView } from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import type { NavigateToEntitySettings } from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import type { OpenPathPickingDialog } from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";

interface Dependencies {
  sidebarItems: IComputedValue<SidebarItemDeclaration[]>;
  entityRegistry: CatalogEntityRegistry;
  navigateToClusterView: NavigateToClusterView;
  navigateToCatalog: NavigateToCatalog;
  navigateToAddCluster: () => void;
  navigateToEntitySettings: NavigateToEntitySettings;
  openPathPickingDialog: OpenPathPickingDialog;
  addSyncEntries: (filePaths: string[]) => void;
}

const NonInjectedSidebar = observer(
  ({
    sidebarItems,
    entityRegistry,
    navigateToClusterView,
    navigateToCatalog,
    navigateToAddCluster,
    navigateToEntitySettings,
    openPathPickingDialog,
    addSyncEntries,
  }: Dependencies) => {
    // 🎯 각 클러스터별 접기/펼치기 상태 관리
    const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

    // 🔄 클러스터별 연결 상태 관리
    const [connectingClusters, setConnectingClusters] = useState<Set<string>>(new Set());

    // 🎯 클러스터 추가 드롭다운 메뉴 상태 관리
    const [showAddClusterMenu, setShowAddClusterMenu] = useState<boolean>(false);

    // 🔧 클러스터 우클릭 컨텍스트 메뉴 상태 관리
    const [contextMenu, setContextMenu] = useState<{
      clusterId: string;
      x: number;
      y: number;
    } | null>(null);

    // 카탈로그에서 모든 Kubernetes 클러스터들 가져오기
    const clusters = entityRegistry.items.get().filter(isKubernetesCluster);
    const activeCluster = entityRegistry.activeEntity;

    // 🎨 전체 클러스터 ID 목록 (색상 할당용)
    const allClusterIds = clusters.map((cluster) => cluster.getId());

    // 클러스터 접기/펼치기 토글
    const toggleCluster = (clusterId: string) => {
      const newExpanded = new Set(expandedClusters);
      if (newExpanded.has(clusterId)) {
        newExpanded.delete(clusterId);
      } else {
        newExpanded.add(clusterId);
      }
      setExpandedClusters(newExpanded);
    };

    // 클러스터 연결 상태 확인
    const getClusterStatus = (cluster: any) => {
      return cluster.status?.phase || LensKubernetesClusterStatus.DISCONNECTED;
    };

    // 🔗 kubeconfig 파일 동기화 핸들러
    const handleSyncKubeconfig = () => {
      openPathPickingDialog({
        message: "Select kubeconfig file",
        buttonLabel: "Sync",
        properties: ["showHiddenFiles", "multiSelections", "openFile"],
        onPick: addSyncEntries,
      });
      setShowAddClusterMenu(false);
    };

    // 🔗 클러스터 추가 메뉴 토글
    const toggleAddClusterMenu = () => {
      setShowAddClusterMenu(!showAddClusterMenu);
    };

    // 🔧 클러스터 우클릭 핸들러
    const handleClusterContextMenu = (e: React.MouseEvent, clusterId: string) => {
      e.preventDefault(); // 기본 브라우저 컨텍스트 메뉴 방지
      e.stopPropagation(); // 이벤트 전파 방지

      setContextMenu({
        clusterId,
        x: e.clientX,
        y: e.clientY,
      });
    };

    // 🔧 컨텍스트 메뉴 닫기
    const closeContextMenu = () => {
      setContextMenu(null);
    };

    // 🔧 클러스터 설정으로 이동
    const handleOpenClusterSettings = (clusterId: string) => {
      navigateToEntitySettings(clusterId, "metrics"); // 메트릭 설정 탭으로 직접 이동
      closeContextMenu();
    };

    // 🔧 클릭 시 컨텍스트 메뉴 닫기 이벤트 리스너
    useEffect(() => {
      const handleClickOutside = () => {
        if (contextMenu) {
          closeContextMenu();
        }
        if (showAddClusterMenu) {
          setShowAddClusterMenu(false);
        }
      };

      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }, [contextMenu, showAddClusterMenu]);

    // 🔗 클러스터 클릭 시 활성화
    const handleClusterClick = async (cluster: any) => {
      const clusterId = cluster.getId();

      // 이미 연결 중인 경우 무시
      if (connectingClusters.has(clusterId)) {
        return;
      }

      // 이미 활성화된 클러스터인 경우 토글만
      if (activeCluster?.getId() === clusterId) {
        toggleCluster(clusterId);
        return;
      }

      try {
        // 🔄 연결 시작 표시
        setConnectingClusters((prev) => new Set(prev).add(clusterId));

        // 🎯 실제 클러스터 연결 (카탈로그에서 사용하는 방법)
        navigateToClusterView(clusterId);

        // 클러스터 선택 시 자동으로 펼치기
        if (!expandedClusters.has(clusterId)) {
          toggleCluster(clusterId);
        }
      } catch (error) {
        // 🚨 연결 실패 시 에러 처리
        console.error(`❌ 클러스터 ${cluster.getName()} 활성화 실패:`, error);
      } finally {
        // 🔄 연결 중 상태 해제 (약간의 지연으로 피드백 제공)
        setTimeout(() => {
          setConnectingClusters((prev) => {
            const newSet = new Set(prev);
            newSet.delete(clusterId);
            return newSet;
          });
        }, 500);
      }
    };

    return (
      <div className={cssNames("flex flex-col")} data-testid="cluster-sidebar">
        <div className={`${styles.sidebarNav} sidebar-active-status`}>
          {/* 🔗 클러스터 추가 드롭다운 버튼 */}
          <div className={styles.addClusterButton}>
            <div className={`${styles.vscodeTreeItem} ${styles.addButton}`} onClick={toggleAddClusterMenu}>
              <Icon material="add" className={styles.vscodeTreeIcon} />
              <span className={styles.vscodeTreeLabel}>Add Cluster</span>
            </div>

            {/* 🎯 드롭다운 메뉴 */}
            {showAddClusterMenu && (
              <div className={styles.addClusterDropdown}>
                <div
                  className={`${styles.vscodeTreeItem} ${styles.dropdownItem}`}
                  onClick={() => {
                    navigateToAddCluster();
                    setShowAddClusterMenu(false);
                  }}
                >
                  <Icon material="description" className={styles.vscodeTreeIcon} />
                  <span className={styles.vscodeTreeLabel}>Add from kubeconfig</span>
                </div>
                <div className={`${styles.vscodeTreeItem} ${styles.dropdownItem}`} onClick={handleSyncKubeconfig}>
                  <Icon material="sync" className={styles.vscodeTreeIcon} />
                  <span className={styles.vscodeTreeLabel}>Sync kubeconfig</span>
                </div>
              </div>
            )}
          </div>

          {/* 🔗 클러스터 목록 표시 */}
          {clusters.map((cluster) => {
            const clusterId = cluster.getId();
            const isExpanded = expandedClusters.has(clusterId);
            const isActive = activeCluster?.getId() === clusterId;
            const status = getClusterStatus(cluster);
            const isConnected = status === LensKubernetesClusterStatus.CONNECTED;
            const isConnecting = connectingClusters.has(clusterId);

            return (
              <div key={clusterId} className={styles.clusterGroup}>
                {/* 클러스터 헤더 */}
                <div
                  className={`${styles.vscodeTreeItem} ${isActive ? styles.activeCluster : ""}`}
                  onClick={() => handleClusterClick(cluster)}
                  onContextMenu={(e) => handleClusterContextMenu(e, clusterId)}
                >
                  {/* 왼쪽 꺽쇠 */}
                  <Icon
                    material={isExpanded ? "keyboard_arrow_down" : "keyboard_arrow_right"}
                    className={styles.vscodeTreeChevron}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCluster(clusterId);
                    }}
                  />

                  {/* 🎯 쿠버네티스 아이콘 - 클러스터별 고유 색상 */}
                  <Icon
                    material="settings_input_component"
                    className={styles.vscodeTreeIcon}
                    style={{ color: getClusterColor(clusterId, allClusterIds) }}
                  />

                  {/* 클러스터 이름 */}
                  <span className={styles.vscodeTreeLabel}>{cluster.getName()}</span>

                  {/* 🔄 연결 상태 표시 - THEME-020: CSS 변수 사용 */}
                  {isConnecting ? (
                    <div
                      className={styles.connectionStatus}
                      title="연결 중..."
                      style={{ color: "var(--connection-status-connecting)" }}
                    >
                      ●
                    </div>
                  ) : isConnected ? (
                    <div
                      className={styles.connectionStatus}
                      title="연결됨"
                      style={{ color: "var(--connection-status-connected)" }}
                    >
                      ●
                    </div>
                  ) : (
                    <div
                      className={styles.connectionStatus}
                      title="연결 안됨"
                      style={{ color: "var(--connection-status-disconnected)" }}
                    >
                      ●
                    </div>
                  )}
                </div>

                {/* 클러스터가 활성화되고 펼쳐진 경우 리소스 표시 */}
                {isActive && isExpanded && (
                  <div className={styles.vscodeTreeChildren}>
                    {sidebarItems.get().map((hierarchicalSidebarItem) => (
                      <SidebarItem item={hierarchicalSidebarItem} key={hierarchicalSidebarItem.id} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 클러스터가 없을 때 메시지 */}
          {clusters.length === 0 && (
            <div className={styles.emptyMessage}>클러스터가 없습니다. 카탈로그에서 클러스터를 추가하세요.</div>
          )}
        </div>

        {/* 🔧 클러스터 우클릭 컨텍스트 메뉴 */}
        {contextMenu && (
          <div
            className={styles.contextMenu}
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.contextMenuItem} onClick={() => handleOpenClusterSettings(contextMenu.clusterId)}>
              <Icon material="settings" className={styles.contextMenuIcon} />
              <span className={styles.contextMenuLabel}>클러스터 설정</span>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export const Sidebar = withInjectables<Dependencies>(NonInjectedSidebar, {
  getProps: (di, props) => ({
    ...props,
    sidebarItems: di.inject(sidebarItemsInjectable),
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    navigateToClusterView: di.inject(navigateToClusterViewInjectable),
    navigateToCatalog: di.inject(navigateToCatalogInjectable),
    navigateToAddCluster: di.inject(navigateToAddClusterInjectable),
    navigateToEntitySettings: di.inject(navigateToEntitySettingsInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    addSyncEntries: di.inject(addSyncEntriesInjectable),
  }),
});

Sidebar.displayName = "Sidebar";
