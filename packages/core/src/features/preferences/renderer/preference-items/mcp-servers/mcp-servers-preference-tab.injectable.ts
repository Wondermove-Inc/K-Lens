/**
 * 🎯 목적: MCP Servers Preference 탭 정의
 * 02: Preferences에 MCP Settings 탭 추가
 *
 * 📝 설명:
 * Preferences 사이드바에 MCP Servers 탭을 추가합니다.
 * Feature Flag(MCP_INTEGRATION)로 조건부 표시됩니다.
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../preference-item-injection-token";

/**
 * MCP Servers Preference 탭 injectable
 *
 * general-tab-group에 속하며, Kubernetes 탭 다음에 표시됩니다.
 */
const mcpServersPreferenceTabInjectable = getInjectable({
  id: "mcp-servers-preference-tab",

  instantiate: () => ({
    kind: "tab" as const,
    id: "mcp-servers-tab",
    parentId: "general-tab-group" as const,
    pathId: "mcp-servers",
    label: "MCP Servers",
    iconName: "plug", // lucide-react Plug 아이콘
    orderNumber: 45, // Kubernetes(40) 다음
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default mcpServersPreferenceTabInjectable;
