/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { Tooltip } from "@skuberplus/tooltip";
import { observable } from "mobx";
import { observer } from "mobx-react";
import React, { useState } from "react";
import visitEntityContextMenuInjectable from "../../../common/catalog/visit-entity-context-menu.injectable";
import { broadcastMessage } from "../../../common/ipc";
import { IpcRendererNavigationEvents } from "../../../common/ipc/navigation-events";
import activeHotbarInjectable from "../../../features/hotbar/storage/common/toggling.injectable";
import normalizeCatalogEntityContextMenuInjectable from "../../catalog/normalize-menu-item.injectable";
import navigateInjectable from "../../navigation/navigate.injectable";
import { Avatar } from "../avatar";
import { Menu, MenuItem } from "../menu";

import type { VisitEntityContextMenu } from "../../../common/catalog/visit-entity-context-menu.injectable";
import type { ActiveHotbarModel } from "../../../features/hotbar/storage/common/toggling.injectable";
import type { CatalogEntity, CatalogEntityContextMenu } from "../../api/catalog-entity";
import type { NormalizeCatalogEntityContextMenu } from "../../catalog/normalize-menu-item.injectable";
import type { Navigate } from "../../navigation/navigate.injectable";

export interface SidebarClusterProps {
  clusterEntity: CatalogEntity | null | undefined;
}

interface Dependencies {
  navigate: Navigate;
  normalizeMenuItem: NormalizeCatalogEntityContextMenu;
  visitEntityContextMenu: VisitEntityContextMenu;
  entityInActiveHotbar: ActiveHotbarModel;
}

const NonInjectedSidebarCluster = observer(
  ({
    clusterEntity,
    visitEntityContextMenu: onContextMenuOpen,
    navigate,
    normalizeMenuItem,
    entityInActiveHotbar,
  }: Dependencies & SidebarClusterProps) => {
    const [menuItems] = useState(observable.array<CatalogEntityContextMenu>());
    const [opened, setOpened] = useState(false);

    if (!clusterEntity) {
      // render a Loading version of the SidebarCluster
      return (
        <div className="flex items-center p-[calc(var(--padding)*1.2)] cursor-pointer hover:bg-sidebar-accent">
          <Avatar
            title="??"
            background="var(--halfGray)"
            size={40}
            className="relative pointer-events-none font-medium mr-[calc(var(--margin)*1.5)] after:content-[''] after:absolute after:left-0 after:top-0 after:w-0 after:h-full after:bg-white/15 after:animate-waiting"
          />
          <div className="relative pointer-events-none w-4/5 h-4 after:content-[''] after:absolute after:left-0 after:top-0 after:w-0 after:h-full after:bg-white/15 after:animate-waiting" />
        </div>
      );
    }

    const onMenuOpen = () => {
      const title = entityInActiveHotbar.hasEntity(clusterEntity.getId()) ? "Remove from Hotbar" : "Add to Hotbar";
      const onClick = () => entityInActiveHotbar.toggleEntity(clusterEntity);

      menuItems.replace([{ title, onClick }]);
      onContextMenuOpen(clusterEntity, {
        menuItems,
        navigate: (url, forceMainFrame = true) => {
          if (forceMainFrame) {
            broadcastMessage(IpcRendererNavigationEvents.NAVIGATE_IN_APP, url);
          } else {
            navigate(url);
          }
        },
      });

      toggle();
    };

    const onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
      if (evt.code == "Space") {
        toggle();
      }
    };

    const toggle = () => {
      setOpened(!opened);
    };

    const id = `cluster-${clusterEntity.getId()}`;
    const tooltipId = `tooltip-${id}`;

    return (
      <div
        id={id}
        className="flex items-center p-[calc(var(--padding)*1.2)] cursor-pointer hover:bg-sidebar-accent focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="menubar"
        data-testid="sidebar-cluster-dropdown"
      >
        <Avatar
          title={clusterEntity.getName()}
          colorHash={`${clusterEntity.getName()}-${clusterEntity.metadata.source}`}
          size={40}
          src={clusterEntity.spec.icon?.src}
          background={clusterEntity.spec.icon?.background}
          className="font-medium mr-[calc(var(--margin)*1.5)]"
        />
        <div className="font-bold overflow-hidden break-words text-accent-foreground line-clamp-3" id={tooltipId}>
          {clusterEntity.getName()}
        </div>
        <Tooltip targetId={tooltipId}>{clusterEntity.getName()}</Tooltip>
        <Icon material="arrow_drop_down" className="rounded-[3px] ml-[var(--margin)]" />
        <Menu
          usePortal
          htmlFor={id}
          isOpen={opened}
          open={onMenuOpen}
          closeOnClickItem
          closeOnClickOutside
          close={toggle}
          className="w-[200px] -mt-2.5"
        >
          {menuItems.map(normalizeMenuItem).map((menuItem) => (
            <MenuItem key={menuItem.title} onClick={menuItem.onClick}>
              {menuItem.title}
            </MenuItem>
          ))}
        </Menu>
      </div>
    );
  },
);

export const SidebarCluster = withInjectables<Dependencies, SidebarClusterProps>(NonInjectedSidebarCluster, {
  getProps: (di, props) => ({
    ...props,
    visitEntityContextMenu: di.inject(visitEntityContextMenuInjectable),
    navigate: di.inject(navigateInjectable),
    normalizeMenuItem: di.inject(normalizeCatalogEntityContextMenuInjectable),
    entityInActiveHotbar: di.inject(activeHotbarInjectable),
  }),
});
