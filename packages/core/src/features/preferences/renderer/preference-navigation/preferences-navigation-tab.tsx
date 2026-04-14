/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { AppWindow, Code, Container, Network, Plug, Terminal } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Tab } from "../../../../renderer/components/tabs";
import preferenceTabIsActiveInjectable from "./navigate-to-preference-tab/preference-tab-is-active.injectable";

import type { LucideIcon } from "lucide-react";
import type { IComputedValue } from "mobx";

import type { PreferenceTab } from "../preference-items/preference-item-injection-token";

/**
 * 🎯 목적: iconName을 lucide-react 아이콘 컴포넌트로 매핑
 * 📝 2026-01-05: MCP Servers 탭용 plug 아이콘 추가
 */
const iconMap: Record<string, LucideIcon> = {
  "app-window": AppWindow,
  network: Network,
  container: Container,
  code: Code,
  terminal: Terminal,
  plug: Plug, // MCP Servers 탭용
};

interface Dependencies {
  tabIsActive: IComputedValue<boolean>;
}

interface PreferenceNavigationTabProps {
  tab: PreferenceTab;
}

const NonInjectedPreferencesNavigationTab = observer(
  ({ tabIsActive, tab }: Dependencies & PreferenceNavigationTabProps) => {
    // 🎯 lucide-react 아이콘으로 변환
    const IconComponent = tab.iconName ? iconMap[tab.iconName] : undefined;
    const icon = IconComponent ? <IconComponent size={16} /> : undefined;

    return (
      <Tab
        active={tabIsActive.get()}
        icon={icon}
        label={tab.label}
        data-preference-tab-link-test={tab.pathId}
        value={tab.pathId}
      />
    );
  },
);

export const PreferencesNavigationTab = withInjectables<Dependencies, PreferenceNavigationTabProps>(
  NonInjectedPreferencesNavigationTab,
  {
    getProps: (di, props) => ({
      ...props,
      tabIsActive: di.inject(preferenceTabIsActiveInjectable, props.tab.pathId),
    }),
  },
);
