/**
 * 🎯 목적: MCP Servers Preference 페이지 정의
 * 02: Preferences에 MCP Settings 탭 추가
 *
 * 📝 설명:
 * MCP Servers 탭 클릭 시 표시되는 페이지 컴포넌트입니다.
 * MCPSettings 컴포넌트를 래핑합니다.
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import React from "react";
import { MCPSettings } from "../../../../../renderer/components/ai-chat/mcp-settings";
import { PreferencePageComponent } from "../../preference-page-component";
import { preferenceItemInjectionToken } from "../preference-item-injection-token";

import type { PreferenceItemComponent, PreferencePage } from "../preference-item-injection-token";

/**
 * MCP Servers 페이지 컴포넌트
 *
 * PreferencePageComponent로 래핑하여 일관된 스타일 제공
 */
const MCPServersPage: PreferenceItemComponent<PreferencePage> = ({ item }) => (
  <PreferencePageComponent title="MCP Servers" id={item.id}>
    <MCPSettings />
  </PreferencePageComponent>
);

/**
 * MCP Servers Preference 페이지 injectable
 */
const mcpServersPreferencePageInjectable = getInjectable({
  id: "mcp-servers-preference-page",

  instantiate: () => ({
    kind: "page" as const,
    id: "mcp-servers-page",
    parentId: "mcp-servers-tab",
    Component: MCPServersPage,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default mcpServersPreferencePageInjectable;
