/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Alert Agent IPC Channel Definitions
 *
 * Renderer → Main IPC channel for alert-triggered AI analysis.
 * The renderer sends alert context; main routes to AlertAnalyzeSkill.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";

// ============================================
// Alert Agent 요청/응답 타입
// ============================================

/**
 * Alert analysis trigger request (Renderer → Main)
 */
export interface AlertAgentTriggerRequest {
  alert: {
    /** ClusterAlertItem.id (e.g. "clusterId:type:resource") */
    id: string;
    clusterId: string;
    clusterName: string;
    /** e.g. "Pod/my-pod", "Node/worker-1" */
    resource: string;
    namespace?: string;
    /** Original alert message */
    message: string;
    alertType: "node" | "event";
  };
  provider: AIProvider;
  modelId?: string;
  /** AgentContext construction data */
  context: {
    clusterId: string;
    clusterName: string;
    namespace: string | null;
    basePath: string | null;
  };
  /** User's OS/browser locale (e.g. "ko-KR", "ja-JP", "en-US") for response language */
  preferredLanguage?: string;
}

/**
 * Alert analysis trigger response
 */
export interface AlertAgentTriggerResponse {
  accepted: boolean;
  threadId?: string;
  /** Rejection reason: "agent_busy" | "no_api_key" | "error" */
  reason?: string;
}

// ============================================
// IPC Channel
// ============================================

export const alertAgentTriggerChannel = getRequestChannel<AlertAgentTriggerRequest, AlertAgentTriggerResponse>(
  "ai-assistant:alert-agent-trigger",
);
