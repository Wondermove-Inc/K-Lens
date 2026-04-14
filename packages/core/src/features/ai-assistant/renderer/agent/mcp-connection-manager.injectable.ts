/**
 * 🎯 목적: MCP 연결 관리자 Injectable
 * 01: MCPAgentOrchestrator 연결 로직
 *
 * 📝 설명:
 * DI 컨테이너에서 MCPConnectionManager를 제공합니다.
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { MCPConnectionManager } from "./mcp-connection-manager";

/**
 * MCP 연결 관리자 Injectable
 *
 * 📝 사용법:
 * ```typescript
 * const connectionManager = di.inject(mcpConnectionManagerInjectable);
 * await connectionManager.connectAllEnabled();
 * const tools = connectionManager.getAllTools();
 * ```
 */
const mcpConnectionManagerInjectable = getInjectable({
  id: "mcp-connection-manager",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);

    return new MCPConnectionManager({ logger });
  },
});

export default mcpConnectionManagerInjectable;
