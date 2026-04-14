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
import { Icon } from "@skuberplus/icon";
import { observer } from "mobx-react";
import React from "react";
import styles from "./sidebar-items.module.scss";
import sidebarStorageInjectable from "./sidebar-storage/sidebar-storage.injectable";

import type { SidebarItemDeclaration } from "@skuberplus/cluster-sidebar";

import type { StorageLayer } from "../../utils/storage-helper";
import type { SidebarStorageState } from "./sidebar-storage/sidebar-storage.injectable";

interface Dependencies {
  sidebarStorage: StorageLayer<SidebarStorageState>;
}

export interface SidebarItemProps {
  item: SidebarItemDeclaration;
}

const NonInjectedSidebarItem = observer((props: SidebarItemProps & Dependencies) => {
  const { item, sidebarStorage } = props;
  const id = item.id;
  const expanded = sidebarStorage.get().expanded[id] ?? false;
  const isExpandable = item.children.length > 0 && item.children.some((item) => item.isVisible.get());
  const isActive = item.isActive.get();

  const toggleExpand = () => {
    sidebarStorage.merge((draft) => {
      draft.expanded[id] = !draft.expanded[id];
    });
  };
  const renderSubMenu = () => {
    if (!isExpandable || !expanded) {
      return null;
    }

    return (
      <div className={styles.subMenu}>
        {item.children.map((child) => (
          <SidebarItem key={child.id} item={child} />
        ))}
      </div>
    );
  };

  if (!item.isVisible.get()) {
    return null;
  }

  return (
    <div
      className={styles.SidebarItem}
      data-testid={id}
      data-is-active-test={isActive}
      data-parent-id-test={item.parentId}
    >
      <div
        className={styles.vscodeNavItem}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (isExpandable) {
            toggleExpand();
          } else {
            item.onClick();
          }
        }}
        data-testid={`link-for-${id}`}
        data-active={isActive}
      >
        {/* 🎯 VSCode 스타일: 왼쪽 꺽쇠 */}
        {isExpandable ? (
          <Icon
            className={styles.vscodeChevron}
            material={expanded ? "keyboard_arrow_down" : "keyboard_arrow_right"}
            data-testid={`expand-icon-for-${id}`}
          />
        ) : (
          <div className={styles.vscodeChevronSpacer} />
        )}

        {/* 라벨 - 🎯 아이콘 제거로 바로 텍스트 시작 */}
        <span className={styles.vscodeLabel}>{item.title}</span>
      </div>
      {renderSubMenu()}
    </div>
  );
});

export const SidebarItem = withInjectables<Dependencies, SidebarItemProps>(NonInjectedSidebarItem, {
  getProps: (di, props) => ({
    ...props,
    sidebarStorage: di.inject(sidebarStorageInjectable),
  }),
});

SidebarItem.displayName = "SidebarItem";
