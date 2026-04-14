/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { Tooltip, TooltipPosition } from "@skuberplus/tooltip";
import { cssNames, isMiddleClick, prevDefault } from "@skuberplus/utilities";
import autoBindReact from "auto-bind/react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { isKubernetesCluster } from "../../../common/catalog-entities";
import isMacInjectable from "../../../common/vars/is-mac.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import { getClusterColor } from "../layout/cluster-colors";
import { Menu, MenuItem } from "../menu";
import { Tab } from "../tabs";
import dockStoreInjectable from "./dock/store.injectable";
import styles from "./dock-tab.module.scss";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { TabProps } from "../tabs";
import type { DockStore, DockTab as DockTabModel } from "./dock/store";

export interface DockTabProps extends TabProps<DockTabModel> {
  moreActions?: StrictReactNode;
}

interface Dependencies {
  dockStore: DockStore;
  isMac: boolean;
  entityRegistry: CatalogEntityRegistry;
}

class NonInjectedDockTab extends Component<DockTabProps & Dependencies> {
  private readonly menuVisible = observable.box(false);

  constructor(props: DockTabProps & Dependencies) {
    super(props);
    autoBindReact(this);
  }

  close(id: string) {
    this.props.dockStore.closeTab(id);
  }

  renderMenu(tabId: string) {
    const { closeTab, closeAllTabs, closeOtherTabs, closeTabsToTheRight, tabs, getTabIndex } = this.props.dockStore;
    const closeAllDisabled = tabs.length === 1;
    const closeOtherDisabled = tabs.length === 1;
    const closeRightDisabled = getTabIndex(tabId) === tabs.length - 1;

    return (
      <Menu
        usePortal
        htmlFor={`tab-${tabId}`}
        className="DockTabMenu"
        isOpen={this.menuVisible.get()}
        open={() => this.menuVisible.set(true)}
        close={() => this.menuVisible.set(false)}
        toggleEvent="contextmenu"
      >
        <MenuItem onClick={() => closeTab(tabId)}>Close</MenuItem>
        <MenuItem onClick={() => closeAllTabs()} disabled={closeAllDisabled}>
          Close all tabs
        </MenuItem>
        <MenuItem onClick={() => closeOtherTabs(tabId)} disabled={closeOtherDisabled}>
          Close other tabs
        </MenuItem>
        <MenuItem onClick={() => closeTabsToTheRight(tabId)} disabled={closeRightDisabled}>
          Close tabs to the right
        </MenuItem>
      </Menu>
    );
  }

  render() {
    const { className, moreActions, dockStore, active, isMac, entityRegistry, ...tabProps } = this.props;

    if (!tabProps.value) {
      return;
    }

    const { title, pinned, id, clusterId } = tabProps.value;
    const close = prevDefault(() => this.close(id));

    // 🎨 전체 클러스터 ID 목록 (색상 할당용)
    const clusters = entityRegistry.items.get().filter(isKubernetesCluster);
    const allClusterIds = clusters.map((cluster) => cluster.getId());

    // 🎨 탭의 클러스터 색상 계산
    const tabActiveColor = clusterId
      ? getClusterColor(clusterId, allClusterIds) // 클러스터가 있으면 해당 색상
      : "var(--primary)"; // 클러스터 없으면 기본 파란색

    return (
      <>
        <Tab
          {...tabProps}
          id={`tab-${id}`}
          className={cssNames(styles.DockTab, className, {
            [styles.pinned]: pinned,
          })}
          onContextMenu={() => this.menuVisible.set(true)}
          label={
            <>
              <div className="flex align-center" onAuxClick={isMiddleClick(close)}>
                <span className={styles.title}>{title}</span>
                {moreActions}
                {!pinned && (
                  <div className={styles.close}>
                    <Icon
                      small
                      material="close"
                      tooltip={`Close ${this.props.isMac ? "⌘+W" : "Ctrl+W"}`}
                      onClick={close}
                      data-testid={`dock-tab-close-for-${id}`}
                    />
                  </div>
                )}
                <Tooltip
                  targetId={`tab-${id}`}
                  preferredPositions={[TooltipPosition.TOP, TooltipPosition.TOP_LEFT]}
                  style={{ transitionDelay: "700ms" }}
                >
                  {title}
                </Tooltip>
              </div>
              {/* 🎨 활성 탭 밑줄 - 클러스터 색상으로 직접 표시 */}
              {active && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    backgroundColor: tabActiveColor === "var(--primary)" ? "var(--primary)" : tabActiveColor,
                    zIndex: 10,
                  }}
                />
              )}
            </>
          }
          data-testid={`dock-tab-for-${id}`}
        />
        {this.renderMenu(id)}
      </>
    );
  }
}

export const DockTab = withInjectables<Dependencies, DockTabProps>(observer(NonInjectedDockTab), {
  getProps: (di, props) => ({
    dockStore: di.inject(dockStoreInjectable),
    isMac: di.inject(isMacInjectable),
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    ...props,
  }),
});
