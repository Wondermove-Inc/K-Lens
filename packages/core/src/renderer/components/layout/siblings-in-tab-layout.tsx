/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import siblingTabsInjectable from "../../routes/sibling-tabs.injectable";
import { TabLayout } from "./tab-layout-2";

import type { SidebarItemDeclaration } from "@skuberplus/cluster-sidebar";
import type { StrictReactNode } from "@skuberplus/utilities";

import type { IComputedValue } from "mobx";

interface SiblingTabLayoutProps {
  children: StrictReactNode;
  scrollable?: boolean;
}

interface Dependencies {
  tabs: IComputedValue<SidebarItemDeclaration[]>;
}

const NonInjectedSiblingsInTabLayout = observer(
  ({ tabs, children, ...other }: Dependencies & SiblingTabLayoutProps) => {
    const dereferencedTabs = tabs.get();

    // 🎯 단순화된 로직: sibling-tabs.injectable에서 이미 MainTab 존재 여부를 체크함
    // 🔥 MainTab이 있으면 빈 배열을 반환하므로 여기서는 단순히 탭 개수만 확인
    if (dereferencedTabs.length > 0) {
      return (
        <TabLayout tabs={dereferencedTabs} {...other}>
          {children}
        </TabLayout>
      );
    }

    // 🎯 기본값: 탭이 없으면 children만 렌더링
    return <>{children}</>;
  },
);

export const SiblingsInTabLayout = withInjectables<Dependencies, SiblingTabLayoutProps>(
  NonInjectedSiblingsInTabLayout,

  {
    getProps: (di, props) => ({
      tabs: di.inject(siblingTabsInjectable),
      ...props,
    }),
  },
);
