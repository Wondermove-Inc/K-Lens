/**
 * Slash Command Data — UI metadata only
 *
 * Behavior/workflow/prompts are owned by Skill implementations.
 * This file provides UI metadata for the command palette:
 * id, name, description, category, icon, keywords, args, label, enabled
 *
 * /clear and /new retain behavior because they are UI-only actions
 * (not routed through AgentHost/SkillRouter).
 *
 * @packageDocumentation
 */

import { SlashCommand, SlashCommandCategory, SlashCommandId } from "./slash-command-types";

export const SLASH_COMMANDS: SlashCommand[] = [
  // ============================================
  // General commands (UI-only, no skill routing)
  // ============================================
  {
    id: SlashCommandId.CLEAR,
    name: "/clear",
    description: "Clear all conversation messages",
    category: SlashCommandCategory.GENERAL,
    icon: "trash-2",
    keywords: ["clear", "reset", "clean", "delete"],
    label: "Clear Chat",
    enabled: true,
    behavior: {
      purpose: "Delete all messages in the current session and reset to initial state",
      workflow: [
        { step: 1, name: "Clear Messages", description: "Delete conversation history", isAutomatic: true },
        { step: 2, name: "Reset Context", description: "Reset session context", isAutomatic: true },
        { step: 3, name: "Confirm", description: "Display completion message", isAutomatic: true },
      ],
      actions: ["Delete conversation history", "Reset session context", "Preserve cluster connection", "Refresh UI"],
      outputFormat: `##  Conversation Cleared

Conversation history has been cleared.

> [TIP] Cluster connection is preserved.`,
      examples: ["/clear"],
      relatedCommands: ["/new", "/help"],
    },
  },
  {
    id: SlashCommandId.NEW,
    name: "/new",
    description: "Start a new conversation session",
    category: SlashCommandCategory.GENERAL,
    icon: "plus-circle",
    keywords: ["new", "start", "fresh", "begin"],
    label: "New Chat",
    enabled: true,
    behavior: {
      purpose: "Start a new conversation session with welcome message",
      workflow: [
        { step: 1, name: "End Session", description: "End current conversation", isAutomatic: true },
        { step: 2, name: "Create Session", description: "Create new session", isAutomatic: true },
        { step: 3, name: "Welcome", description: "Display welcome message", isAutomatic: true },
      ],
      actions: [
        "Save current conversation (optional)",
        "Generate new session ID",
        "Maintain cluster context",
        "Display welcome message with quick start guide",
      ],
      outputFormat: `##  New Conversation Started

Starting a new conversation with DAIVE.

###  Quick Start
- \`/pods\` - Check pod list
- \`/diagnose\` - Diagnose resources
- \`/help\` - View all commands

How can I help you?`,
      examples: ["/new"],
      relatedCommands: ["/clear", "/help"],
    },
  },

  // ============================================
  // Kubernetes commands — behavior owned by skills
  // ============================================
  {
    id: SlashCommandId.PODS,
    name: "/pods",
    description: "List pods with status summary in cluster/namespace",
    category: SlashCommandCategory.KUBERNETES,
    icon: "box",
    keywords: ["pods", "pod", "container", "workload"],
    label: "Pod List",
    enabled: true,
  },
  {
    id: SlashCommandId.DEPLOYMENTS,
    name: "/deployments",
    description: "List deployments with rollout status summary",
    category: SlashCommandCategory.KUBERNETES,
    icon: "layers",
    keywords: ["deployments", "deploy", "rollout", "replica"],
    label: "Deployment List",
    enabled: true,
  },
  {
    id: SlashCommandId.SERVICES,
    name: "/services",
    description: "List services with network connection status",
    category: SlashCommandCategory.KUBERNETES,
    icon: "network",
    keywords: ["services", "service", "svc", "network", "loadbalancer"],
    label: "Service List",
    enabled: true,
  },
  {
    id: SlashCommandId.LOGS,
    name: "/logs",
    description: "View and analyze pod/container logs",
    category: SlashCommandCategory.KUBERNETES,
    icon: "file-text",
    keywords: ["logs", "log", "tail", "debug", "output", "console"],
    args: [{ name: "<pod-name>", required: true, description: "Name of the pod to view logs" }],
    label: "Pod Logs",
    enabled: true,
  },

  // ============================================
  // Diagnostics commands — behavior owned by skills
  // ============================================
  {
    id: SlashCommandId.DIAGNOSE,
    name: "/diagnose",
    description: "Diagnose Kubernetes resource status and suggest solutions",
    category: SlashCommandCategory.DIAGNOSTICS,
    icon: "stethoscope",
    keywords: ["diagnose", "debug", "troubleshoot", "health", "status", "analyze", "investigate"],
    label: "Resource Diagnose",
    enabled: true,
  },
  {
    id: SlashCommandId.METRICS,
    name: "/metrics",
    description: "View resource metrics (CPU/Memory) and optimization opportunities",
    category: SlashCommandCategory.DIAGNOSTICS,
    icon: "bar-chart-2",
    keywords: ["metrics", "cpu", "memory", "usage", "monitoring", "top"],
    label: "Resource Metrics",
    enabled: true,
  },
  {
    id: SlashCommandId.EVENTS,
    name: "/events",
    description: "View cluster events and timeline analysis",
    category: SlashCommandCategory.DIAGNOSTICS,
    icon: "activity",
    keywords: ["events", "event", "warning", "alert", "notification"],
    label: "Cluster Events",
    enabled: true,
  },

  // ============================================
  // Problem Solving — behavior owned by skills
  // ============================================
  {
    id: SlashCommandId.SOLVE,
    name: "/solve",
    description: "Systematic problem solving process with root cause analysis",
    category: SlashCommandCategory.PROBLEM_SOLVING,
    icon: "wrench",
    keywords: ["solve", "debug", "bug", "error", "fix", "troubleshoot", "issue"],
    args: [{ name: "<problem-description>", required: true, description: "Description of the problem to solve" }],
    label: "Problem Solve",
    enabled: true,
  },

  // ============================================
  // Infrastructure — behavior owned by skills
  // ============================================
  {
    id: SlashCommandId.DEVOPS,
    name: "/devops",
    description: "Safe infrastructure operations across Cloud, K8s, IaC, DB, CI/CD",
    category: SlashCommandCategory.INFRASTRUCTURE,
    icon: "server",
    keywords: ["devops", "infrastructure", "deploy", "cloud", "terraform", "ansible", "ops", "iac"],
    args: [{ name: "<operation-type>", required: false, description: "Infrastructure operation type" }],
    label: "DevOps Operations",
    enabled: true,
  },
  {
    id: SlashCommandId.FINOPS,
    name: "/finops",
    description: "Kubernetes cluster cost analysis and Skuber+ Cost Optimize recommendation",
    category: SlashCommandCategory.INFRASTRUCTURE,
    icon: "dollar-sign",
    keywords: ["finops", "cost", "billing", "optimization", "savings", "budget", "expense"],
    args: [{ name: "[namespace]", required: false, description: "Target namespace for analysis (default: all)" }],
    label: "FinOps Analysis",
    enabled: true,
  },
  {
    id: SlashCommandId.ASSESSMENT,
    name: "/assessment",
    description: "Generate comprehensive cluster inventory report with CSP/scaling/workload/network analysis",
    category: SlashCommandCategory.INFRASTRUCTURE,
    icon: "clipboard-check",
    keywords: ["assessment", "assess", "inventory", "report", "cluster-info", "summary", "audit", "profile"],
    args: [{ name: "[namespace]", required: false, description: "Target namespace for assessment (default: all)" }],
    label: "Cluster Assessment Report",
    enabled: true,
  },

  // ============================================
  // Research — behavior owned by skills
  // ============================================
  {
    id: SlashCommandId.RESEARCH,
    name: "/research",
    description: "Systematic technical research with key insights extraction",
    category: SlashCommandCategory.RESEARCH,
    icon: "search",
    keywords: ["research", "search", "study", "learn", "investigate", "explore"],
    args: [{ name: "<topic>", required: true, description: "Topic to research" }],
    label: "Research",
    enabled: true,
  },
];
