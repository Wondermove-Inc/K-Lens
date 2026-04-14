/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * ReAct Agent Tool Registry
 *
 * Assembles all tools for the ReAct loop agent.
 * - Tools are pure executors (no interrupt() calls)
 * - HITL decisions are made by the ReAct loop, not inside tools
 * - Each tool has metadata: { requiresApproval, isWriteOperation }
 */

import { BrowserWindow, shell } from "electron";
import { AI_FILE_CHANGE_CHANNEL, type AIFileChangeNotification } from "../../common/ai-file-channels";
import { createAIFileServices } from "../ai-file-service";
import { createAIFileTools } from "./ai-file-tools";
import { createConfigTools } from "./config-tools";
import { createMainTools, type MainToolsDependencies } from "./main-tools";
import { createProfileTools } from "./profile-tools";

import type { Logger } from "@skuberplus/logger";

import type { StructuredToolInterface } from "@langchain/core/tools";

import type { AgentContext } from "../../common/agent-ipc-channels";
import type { ExpertRole } from "./expert-personas";

// ============================================
// Tool Metadata
// ============================================

export interface ToolMetadata {
  /** Tool requires user approval before execution */
  requiresApproval: boolean;
  /** Tool performs a write/destructive operation */
  isWriteOperation: boolean;
  /** Tool is safe to run concurrently with other safe tools (read-only, no shared state) */
  concurrencySafe: boolean;
}

/** Write commands for kubectl that require approval */
const WRITE_KUBECTL_COMMANDS = [
  "apply",
  "create",
  "delete",
  "patch",
  "replace",
  "scale",
  "edit",
  "label",
  "annotate",
  "set",
  "rollout",
  "taint",
  "cordon",
  "uncordon",
  "drain",
];

/** Write commands for helm that require approval */
const WRITE_HELM_COMMANDS = ["install", "upgrade", "uninstall", "rollback", "test", "push"];

/** Tools that always require approval */
const ALWAYS_APPROVE_TOOLS = new Set(["shell", "write_file", "save_to_cluster", "delete_file"]);

/** Tools that never require approval */
const NEVER_APPROVE_TOOLS = new Set([
  "list_directory",
  "ensure_cluster_dir",
  "open_in_explorer",
  "search_files",
  "read_file",
  "read_user_profile",
  "read_config",
]);

/** Tools safe to run concurrently (read-only, no shared mutable state) */
const CONCURRENCY_SAFE_TOOLS = new Set([
  // Structured query tools — each spawns independent kubectl subprocess
  "getPods",
  "getDeployments",
  "getServices",
  "getNodes",
  "getNamespaces",
  "getLogs",
  "describeResource",
  // File read tools — independent IPC calls, no writes
  "list_directory",
  "search_files",
  "read_file",
  "read_user_profile",
  "read_config",
  // Read-only kubectl/helm commands are handled dynamically in isToolConcurrencySafe()
]);

/**
 * Determine if a tool call requires approval based on tool name and input.
 *
 * Used by the ReAct loop to decide whether to prompt for HITL.
 */
export function getToolApprovalInfo(
  toolName: string,
  toolInput: Record<string, unknown>,
  hitlLevel: "always_approve" | "read_only" | "allow_all",
  autoApprovalRules?: string[],
): ToolMetadata {
  const concurrencySafe = isToolConcurrencySafe(toolName, toolInput);

  // allow_all: skip all approvals
  if (hitlLevel === "allow_all") {
    return { requiresApproval: false, isWriteOperation: false, concurrencySafe };
  }

  // NEVER_APPROVE_TOOLS: 읽기 전용 도구는 hitlLevel과 무관하게 항상 자동승인
  if (NEVER_APPROVE_TOOLS.has(toolName)) {
    return { requiresApproval: false, isWriteOperation: false, concurrencySafe };
  }

  // Determine write status
  let isWrite = false;

  if (toolName === "kubectl") {
    const command = (toolInput.command as string) ?? "";
    isWrite = WRITE_KUBECTL_COMMANDS.includes(command.toLowerCase());
  } else if (toolName === "helm") {
    const command = (toolInput.command as string) ?? "";
    isWrite = WRITE_HELM_COMMANDS.includes(command.toLowerCase());
  } else if (ALWAYS_APPROVE_TOOLS.has(toolName)) {
    isWrite = true;
  } else if (NEVER_APPROVE_TOOLS.has(toolName)) {
    isWrite = false;
  }

  // User-configured auto-approval rules (Settings → AI Settings)
  if (autoApprovalRules?.length) {
    const approvalKey = buildApprovalKey(toolName, toolInput);
    if (autoApprovalRules.includes(approvalKey)) {
      return { requiresApproval: false, isWriteOperation: isWrite, concurrencySafe };
    }
  }

  // read_only: only approve writes
  if (hitlLevel === "read_only") {
    return { requiresApproval: isWrite, isWriteOperation: isWrite, concurrencySafe };
  }

  // always_approve: approve everything
  return { requiresApproval: true, isWriteOperation: isWrite, concurrencySafe };
}

/**
 * Determine if a tool call is safe to run concurrently with other safe tools.
 *
 * Safe = read-only with no shared mutable state.
 * Used by the ReAct loop to partition tool calls for parallel vs serial execution.
 */
export function isToolConcurrencySafe(toolName: string, toolInput: Record<string, unknown>): boolean {
  // Static safe tools (structured queries, file reads)
  if (CONCURRENCY_SAFE_TOOLS.has(toolName)) return true;

  // kubectl: read commands (get, describe, logs, top, etc.) are safe
  if (toolName === "kubectl") {
    const command = (toolInput.command as string)?.toLowerCase() ?? "";
    return !WRITE_KUBECTL_COMMANDS.includes(command);
  }

  // helm: read commands (list, status, get, show, etc.) are safe
  if (toolName === "helm") {
    const command = (toolInput.command as string)?.toLowerCase() ?? "";
    return !WRITE_HELM_COMMANDS.includes(command);
  }

  // All other tools (shell, write_file, save_to_cluster, etc.) are NOT safe
  return false;
}

/**
 * Build an approval key for matching against auto-approval rules.
 *
 * Granularity: tool + command (level 2).
 * - kubectl/helm: "toolName:command" (e.g., "kubectl:get", "helm:install")
 * - Other tools: toolName only (e.g., "getPods", "shell")
 */
export function buildApprovalKey(toolName: string, toolInput: Record<string, unknown>): string {
  if (toolName === "kubectl" || toolName === "helm") {
    const command = (toolInput.command as string) ?? "";
    return `${toolName}:${command.toLowerCase()}`;
  }
  return toolName;
}

// ============================================
// File Change Notification Helper
// ============================================

function sendFileChangeNotification(notification: AIFileChangeNotification): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(AI_FILE_CHANGE_CHANNEL, notification);
        try {
          for (const frame of win.webContents.mainFrame.frames) {
            try {
              frame.send(AI_FILE_CHANGE_CHANNEL, notification);
            } catch {
              /* frame destroyed */
            }
          }
        } catch {
          /* mainFrame access error */
        }
      }
    }
  } catch {
    /* notification failure non-fatal */
  }
}

// ============================================
// Tool Assembly
// ============================================

export interface ReactToolsDependencies {
  executeKubectl: MainToolsDependencies["executeKubectl"];
  executeShell: MainToolsDependencies["executeShell"];
  executeHelm?: MainToolsDependencies["executeHelm"];
  logger: Logger;
  context: AgentContext;
  userProfileStore?: import("../user-profile/user-profile-store").UserProfileStore;
}

/**
 * Create all tools for the ReAct agent.
 *
 * Returns LangChain-compatible tools with their schemas intact.
 * HITL is NOT handled inside tools - the ReAct loop checks getToolApprovalInfo()
 * before calling each tool.
 */
export function createReactTools(deps: ReactToolsDependencies): StructuredToolInterface[] {
  const { executeKubectl, executeShell, executeHelm, logger, context } = deps;

  // Main tools (kubectl, shell, helm, structured queries)
  const mainTools = createMainTools({
    executeKubectl,
    executeShell,
    executeHelm,
    getClusterId: () => context.clusterId ?? null,
  });

  // AI File tools
  const aiFileServices = createAIFileServices(
    {
      logger,
      onFileChange: sendFileChangeNotification,
    },
    shell,
  );

  const aiFileTools = createAIFileTools({
    readFile: aiFileServices.readFile,
    writeFile: aiFileServices.writeFile,
    ensureDir: aiFileServices.ensureDir,
    listDir: aiFileServices.listDir,
    getDiff: aiFileServices.getDiff,
    deleteFile: aiFileServices.deleteFile,
    openExplorer: aiFileServices.openExplorer,
    searchFiles: aiFileServices.searchFiles,
    getClusterId: () => context.clusterId ?? null,
    getClusterName: () => context.clusterName ?? null,
    getBasePath: () => context.basePath ?? null,
  });

  // Profile editing tools
  const profileTools = deps.userProfileStore ? createProfileTools({ userProfileStore: deps.userProfileStore }) : [];

  // 🎯 Config editing tools (SOUL.md, TOOLS.md, skills, experts)
  const configTools = createConfigTools();

  return [...mainTools, ...aiFileTools, ...profileTools, ...configTools];
}

// ============================================
// Tool Filtering
// ============================================

/** Filter tools based on agent allowedTools/deniedTools configuration */
export function filterToolsForAgent(
  allTools: StructuredToolInterface[],
  agentConfig: Pick<ExpertRole, "allowedTools" | "deniedTools">,
): StructuredToolInterface[] {
  if (agentConfig.allowedTools?.length) {
    return allTools.filter((t) => agentConfig.allowedTools!.includes(t.name));
  }
  if (agentConfig.deniedTools?.length) {
    return allTools.filter((t) => !agentConfig.deniedTools!.includes(t.name));
  }
  return allTools;
}

/** Available tool names for UI display (static list matching createReactTools output) */
export function getAvailableToolNames(): string[] {
  return [
    "kubectl",
    "shell",
    "helm",
    "getPods",
    "getDeployments",
    "getServices",
    "getLogs",
    "describeResource",
    "getNodes",
    "getNamespaces",
    "read_file",
    "write_file",
    "list_directory",
    "ensure_cluster_dir",
    "save_to_cluster",
    "delete_file",
    "open_in_explorer",
    "search_files",
    "read_user_profile",
    "edit_user_profile",
    "read_config",
    "edit_config",
    "reset_config",
  ];
}
