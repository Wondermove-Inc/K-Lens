/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Agent IPC Handler (Main Process)
 *
 * Renderer의 Agent 요청을 Main Process에서 처리하고
 * 스트리밍 이벤트를 Renderer로 전송합니다.
 *
 * 📝 IPC 채널:
 * - agentRequestChannel: Renderer → Main (요청)
 * - agentStreamChannel: Main → Renderer (스트리밍)
 *
 * 📝 Monitor 핸들러는 monitor-ipc-handler.injectable.ts로 분리
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 * - 2026-01-18: 수정 - agentStreamBridgeInjectable 제거
 *               (initStreamBridge와 중복 구독으로 스트리밍 텍스트 2번 전송 문제 해결)
 * - 2026-03-13: Monitor 핸들러 분리 + Registry 팩토리 적용
 */

import { getRequestChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@skuberplus/messaging";
import {
  agentRequestChannel,
  agentStreamChannel,
  hitlLevelSetChannel,
  logUIMessageChannel,
  threadDeleteChannel,
  threadListChannel,
  threadLoadChannel,
} from "../common/agent-ipc-channels";
import { agentRegistryChannel } from "../common/agent-registry-channels";
import { alertAgentTriggerChannel } from "../common/alert-agent-channels";
import { skillRegistryChannel } from "../common/skill-registry-channels";
import agentRegistryInjectable from "./agent/agent-registry.injectable";
import { setHitlLevel as setMainToolsHitlLevel } from "./agent/main-tools";
import { getAvailableToolNames } from "./agent/react-tools";
import agentHostInjectable from "./agent-host.injectable";
import conversationLoggerInjectable from "./conversation-logger.injectable";
import skillRegistryInjectable from "./skills/skill-registry.injectable";
import skillRouterInjectable from "./skills/skill-router.injectable";

// ============================================
// 🎯 Shared Stream Bridge (모듈 레벨 싱글톤)
// ============================================

/**
 * Module-level stream bridge state.
 * Shared between agentRequestHandler and alertAgentTriggerHandler
 * to ensure exactly one subscription regardless of which handler runs first.
 */
let globalStreamBridgeInitialized = false;
let globalAgentHostPromise: Promise<any> | null = null;

function getSharedAgentHost(di: any): Promise<any> {
  if (!globalAgentHostPromise) {
    globalAgentHostPromise = di.inject(agentHostInjectable);
  }
  return globalAgentHostPromise!;
}

function initSharedStreamBridge(agentHost: any, sendMessageToChannel: any): void {
  if (globalStreamBridgeInitialized) return;
  globalStreamBridgeInitialized = true;

  agentHost.subscribeToStream((event: any) => {
    sendMessageToChannel(agentStreamChannel, event);
  });
}

// ============================================
// 🎯 Lazy ConversationLogger 헬퍼
// ============================================

/**
 * async injectable인 ConversationLogger를 lazy하게 가져오는 헬퍼.
 * threadList/threadLoad/threadDelete/logUIMessage 핸들러에서 공통 사용.
 */
function createLazyLogger(di: any) {
  let loggerPromise: Promise<any> | null = null;
  return async () => {
    if (!loggerPromise) {
      loggerPromise = di.inject(conversationLoggerInjectable);
    }
    return loggerPromise;
  };
}

// ============================================
// 🎯 Agent Request Handler
// ============================================

/**
 * 🎯 Agent Request IPC Handler
 *
 * Renderer에서 전송된 Agent 요청을 AgentHost로 전달합니다.
 *
 * 📝 AgentHost가 async injectable이므로 lazy하게 가져옵니다.
 */
const agentRequestHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-agent-request-handler",
  channel: agentRequestChannel,
  getHandler: (di) => {
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    return async (request) => {
      try {
        const agentHost = await getSharedAgentHost(di);

        // 🎯 첫 요청 시 StreamBridge 초기화 (모듈 레벨 공유)
        initSharedStreamBridge(agentHost, sendMessageToChannel);

        const result = await agentHost.handleRequest(request);
        return result;
      } catch (error) {
        console.error("[AgentIPC DEBUG] 요청 처리 에러:", error);
        throw error;
      }
    };
  },
});

// ============================================
// 🎯 HITL Level Handler
// ============================================

/**
 * 🎯 HITL Level Set IPC Handler
 *
 * Renderer에서 HITL 레벨 변경 시 Main Process에 동기화합니다.
 */
const hitlLevelSetHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-hitl-level-set-handler",
  channel: hitlLevelSetChannel,
  getHandler: () => {
    return async (request) => {
      try {
        setMainToolsHitlLevel(request.level);
        return {
          success: true,
          level: request.level,
        };
      } catch (error) {
        console.error("[HitlLevelSetHandler] HITL 레벨 설정 에러:", error);
        return {
          success: false,
          level: request.level,
        };
      }
    };
  },
});

// ============================================
// 🎯 Thread 조회 IPC Handlers (Past Chats UI 연동)
// ============================================

const threadListHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-thread-list-handler",
  channel: threadListChannel,
  getHandler: (di) => {
    const getLogger = createLazyLogger(di);

    return async (request) => {
      try {
        const logger = await getLogger();
        const threads = await logger.listThreads(request.limit ?? 50);
        return { threads };
      } catch (error) {
        console.error("[ThreadListHandler] Thread 목록 조회 에러:", error);
        return { threads: [] };
      }
    };
  },
});

const threadLoadHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-thread-load-handler",
  channel: threadLoadChannel,
  getHandler: (di) => {
    const getLogger = createLazyLogger(di);

    return async (request) => {
      try {
        const logger = await getLogger();
        const messages = await logger.getThreadMessages(request.threadId);
        return {
          success: true,
          threadId: request.threadId,
          messages,
        };
      } catch (error) {
        console.error("[ThreadLoadHandler] Thread 로드 에러:", error);
        return {
          success: false,
          threadId: request.threadId,
          messages: [],
          error: error instanceof Error ? error.message : "알 수 없는 에러",
        };
      }
    };
  },
});

const threadDeleteHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-thread-delete-handler",
  channel: threadDeleteChannel,
  getHandler: (di) => {
    const getLogger = createLazyLogger(di);

    return async (request) => {
      try {
        const logger = await getLogger();
        const success = await logger.deleteThread(request.threadId);
        return {
          success,
          threadId: request.threadId,
        };
      } catch (error) {
        console.error("[ThreadDeleteHandler] Thread 삭제 에러:", error);
        return {
          success: false,
          threadId: request.threadId,
          error: error instanceof Error ? error.message : "알 수 없는 에러",
        };
      }
    };
  },
});

// ============================================
// 🎯 UI 메시지 로깅 Handler
// ============================================

/**
 * 📝 2026-01-13: 해결
 * Renderer에서 UI 전용 메시지(tool-approval-result, plan-viewer 등)를
 * 확장 속성과 함께 저장하기 위한 핸들러입니다.
 */
const logUIMessageHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-log-ui-message-handler",
  channel: logUIMessageChannel,
  getHandler: (di) => {
    const getLogger = createLazyLogger(di);

    return async (request) => {
      try {
        const logger = await getLogger();
        await logger.logMessage(request.threadId, request.role, request.content, {
          presentation: request.presentation,
          toolApprovalResult: request.toolApprovalResult,
          planSnapshot: request.planSnapshot,
          planStatusMessageData: request.planStatusMessageData,
        });
        return { success: true };
      } catch (error) {
        console.error("[LogUIMessageHandler] UI 메시지 로깅 에러:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 에러",
        };
      }
    };
  },
});

// ============================================
// 🎯 Registry IPC Handlers (Agent / Skill CRUD)
// ============================================

/**
 * Agent Registry IPC Handler
 *
 * Handles CRUD operations for agent definitions (list, save, delete, reset).
 * 📝 get-tool-names는 Agent 전용이므로 팩토리 외부에서 처리
 */
const agentRegistryHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-agent-registry-handler",
  channel: agentRegistryChannel,
  getHandler: (di) => {
    const registry = di.inject(agentRegistryInjectable);

    return async (request) => {
      try {
        switch (request.type) {
          case "list": {
            const agents = await registry.getAllAgents();
            return { success: true, agents };
          }
          case "save": {
            await registry.saveUserAgent(request.agent);
            return { success: true };
          }
          case "delete": {
            await registry.deleteUserAgent(request.agentId);
            return { success: true };
          }
          case "reset": {
            await registry.resetAgent(request.agentId);
            return { success: true };
          }
          case "get-tool-names": {
            return { success: true, toolNames: getAvailableToolNames() };
          }
          default:
            return { success: false, error: "Unknown request type" };
        }
      } catch (error) {
        console.error("[AgentRegistryHandler] Error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },
});

/**
 * Skill Registry IPC Handler
 *
 * Handles CRUD operations for skill definitions (list, save, delete, reset).
 */
const skillRegistryHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-skill-registry-handler",
  channel: skillRegistryChannel,
  getHandler: (di) => {
    const registry = di.inject(skillRegistryInjectable);
    const skillRouter = di.inject(skillRouterInjectable);

    /** Rebuild skill router and sync disabled state to slash command palette */
    const rebuildAndSync = async () => {
      // Rebuild router so disabled skills are removed from execution
      const router = await skillRouter;
      await router.rebuild(registry);
    };

    return async (request) => {
      try {
        switch (request.type) {
          case "list": {
            const skills = await registry.getAll();
            return { success: true, skills };
          }
          case "save": {
            await registry.saveUserSkill(request.skill);
            await rebuildAndSync();
            return { success: true };
          }
          case "delete": {
            await registry.deleteUserSkill(request.skillId);
            await rebuildAndSync();
            return { success: true };
          }
          case "reset": {
            await registry.resetSkill(request.skillId);
            await rebuildAndSync();
            return { success: true };
          }
          case "get-content": {
            const { getEffectiveContent, getBundledContent } = await import("../agents/md-loader");
            const relativePath = `skills/${request.skillId}.md`;
            const override = getEffectiveContent(relativePath);
            const content = override ?? getBundledContent(relativePath);
            return {
              success: true,
              content,
              isOverridden: override !== null,
            };
          }
          case "save-content": {
            const { writeUserOverride, invalidateMdCache } = await import("../agents/md-loader");
            writeUserOverride(`skills/${request.skillId}.md`, request.content);
            invalidateMdCache();
            return { success: true };
          }
          default:
            return { success: false, error: "Unknown request type" };
        }
      } catch (error) {
        console.error("[SkillRegistryHandler] Error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },
});

// ============================================
// 🎯 Alert Agent Trigger Handler
// ============================================

/**
 * Alert Agent Trigger IPC Handler
 *
 * Handles "AI Analysis" button clicks from ClusterAlertsPopover.
 * Constructs an AgentSendMessageRequest and delegates to AgentHost.
 */
const alertAgentTriggerHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-alert-agent-trigger-handler",
  channel: alertAgentTriggerChannel,
  getHandler: (di) => {
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    return async (request) => {
      try {
        const agentHost = await getSharedAgentHost(di);
        initSharedStreamBridge(agentHost, sendMessageToChannel);

        // Generate unique thread ID for this alert analysis
        const threadId = `alert-${request.alert.id}-${Date.now()}`;

        // Construct synthetic user message with alert context
        const userMessage = [
          "[Alert Analysis Request]",
          `Resource: ${request.alert.resource}`,
          `Cluster: ${request.alert.clusterName}`,
          request.alert.namespace ? `Namespace: ${request.alert.namespace}` : null,
          `Alert Type: ${request.alert.alertType}`,
          `Message: ${request.alert.message}`,
          request.preferredLanguage ? `User Language: ${request.preferredLanguage}` : null,
          "",
          "Analyze this alert and provide remediation advice.",
          request.preferredLanguage && !request.preferredLanguage.startsWith("en")
            ? `Please respond in the user's language (${request.preferredLanguage}).`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        // Delegate to AgentHost as a send-message request
        const agentRequest = {
          type: "send-message" as const,
          threadId,
          message: userMessage,
          provider: request.provider,
          modelId: request.modelId,
          context: {
            clusterId: request.context.clusterId,
            clusterName: request.context.clusterName,
            namespace: request.context.namespace,
            basePath: request.context.basePath,
          },
          assistantMessageId: `alert-analysis-${Date.now()}`,
          slashCommand: {
            commandId: "alert-analyze",
            commandName: "/alert-analyze",
          },
        };

        const result = await agentHost.handleRequest(agentRequest);

        if (result.accepted) {
          return { accepted: true, threadId };
        }

        return {
          accepted: false,
          reason: result.error === "Agent is already running" ? "agent_busy" : "error",
        };
      } catch (error) {
        console.error("[AlertAgentTrigger] Error:", error);
        return {
          accepted: false,
          reason: "error",
        };
      }
    };
  },
});

export {
  agentRequestHandlerInjectable,
  hitlLevelSetHandlerInjectable,
  threadListHandlerInjectable,
  threadLoadHandlerInjectable,
  threadDeleteHandlerInjectable,
  logUIMessageHandlerInjectable,
  agentRegistryHandlerInjectable,
  skillRegistryHandlerInjectable,
  alertAgentTriggerHandlerInjectable,
};
