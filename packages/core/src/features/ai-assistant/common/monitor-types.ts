/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 목적: 감시 규칙 조건 타입
 */
export interface MonitorRuleCondition {
  resource: string;
  field?: string;
  operator: "gt" | "lt" | "eq" | "contains" | "regex";
  value: string;
}

/**
 * 목적: 커스텀 감시 규칙 타입
 */
export interface MonitorRule {
  id: string;
  description: string;
  condition: MonitorRuleCondition;
  severity: "critical" | "warning" | "info";
  enabled: boolean;
  intervalMs?: number;
  evalCommand?: string;
  evalInterpretHint?: string;
}

/**
 * 목적: 커스텀 룰 사전 수집 결과 타입
 */
export interface CustomRuleEvalResult {
  ruleId: string;
  ruleDescription: string;
  evalCommand: string;
  output: string;
  error?: string;
  severity: MonitorRule["severity"];
  interpretHint?: string;
}

/**
 * 목적: 클러스터별 감시 설정 타입
 */
export interface MonitorClusterConfig {
  id: string;
  name: string;
  kubeconfigPath: string;
  presetLevel: "basic" | "standard" | "strict";
  customRules: MonitorRule[];
  intervalOverrideMs?: number;
}

/**
 * 목적: 감시 런타임 설정 타입
 */
export interface MonitorConfig {
  enabled: boolean;
  trayResident: boolean;
  clusters: MonitorClusterConfig[];
  intervalMs: number;
  provider: "openai" | "anthropic" | "google" | "ollama" | "openrouter";
  apiKey: string;
  modelId?: string;
  kubectlPath: string;
  helmPath: string;
}

/**
 * 목적: 감시 원시 이벤트 타입
 */
export interface K8sEvent {
  kind: "event" | "pod" | "node" | "rule" | "deployment" | "statefulset" | "pvc" | "ingress" | "job";
  uid?: string;
  namespace?: string;
  name: string;
  reason?: string;
  message: string;
  severity: "critical" | "warning" | "info";
  source: string;
  timestamp: number;
  containerName?: string;
  restartCount?: number;
  raw?: unknown;
}

/**
 * 목적: 감시 리포트 항목 타입
 */
export interface MonitorFinding {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  suggestedCommands: string[];
}

/**
 * 목적: 감시 알림 타입
 */
export interface MonitorAlert {
  clusterId: string;
  clusterName: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  findings: MonitorFinding[];
  events: K8sEvent[];
  timestamp: number;
}

/**
 * 목적: 감시 상태 타입
 */
export interface MonitorStatus {
  clusterId: string;
  health: "healthy" | "degraded" | "critical" | "unknown";
  lastChecked: number;
  findingCount?: number;
  error?: string;
}

/**
 * 목적: Renderer 저장용 감시 사용자 설정 타입
 */
export interface MonitorUserPreferences {
  enabled: boolean;
  trayResident: boolean;
  intervalMs: number;
  provider: "openai" | "anthropic" | "google" | "ollama" | "openrouter";
  modelId?: string;
  customRules?: MonitorRule[];
  clusters: Array<{
    id: string;
    enabled: boolean;
    presetLevel: "basic" | "standard" | "strict";
    intervalOverrideMs?: number;
    customRules: MonitorRule[];
  }>;
}
