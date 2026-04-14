/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Monitor API Key 해독 및 Runtime Config 변환 유틸리티
 *
 * Monitor IPC 핸들러들이 공통으로 사용하는 API Key 해독 로직과
 * UserPreferences → RuntimeConfig 변환 로직을 분리합니다.
 */

import type { MonitorConfig, MonitorUserPreferences } from "../common/monitor-types";

/**
 * provider별 API 키 복호화 (동기)
 */
function resolveMonitorApiKeySync(params: {
  provider: MonitorConfig["provider"];
  providedApiKey?: string;
  userPreferencesState: any;
  encryptedApiKeyService: any;
}): string {
  if (params.providedApiKey) {
    return params.providedApiKey;
  }

  if (params.provider === "ollama") {
    return "";
  }

  const encrypted = params.userPreferencesState.aiApiKeys?.[params.provider];
  return encrypted ? params.encryptedApiKeyService.decryptApiKey(params.provider, encrypted) : "";
}

/**
 * provider별 API 키 복호화 (prefs 미로드 시 재시도)
 */
export async function resolveMonitorApiKey(params: {
  provider: MonitorConfig["provider"];
  providedApiKey?: string;
  userPreferencesState: any;
  encryptedApiKeyService: any;
}): Promise<string> {
  const key = resolveMonitorApiKeySync(params);
  if (key || params.provider === "ollama") {
    return key;
  }

  // prefs가 아직 hydrate 되지 않았을 수 있음 — 3초 대기 후 재시도
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return resolveMonitorApiKeySync(params);
}

/**
 * Monitor UserPreferences → Runtime Config 변환
 */
export function toRuntimeMonitorConfig(params: {
  monitorPrefs: MonitorUserPreferences | undefined;
  clusters: any[];
  apiKey: string;
  kubectlPath?: string;
  helmPath?: string;
}): MonitorConfig {
  const monitorPrefs = params.monitorPrefs;
  const selected = monitorPrefs?.clusters ?? [];
  const enabledById = new Map(selected.filter((item) => item.enabled).map((item) => [item.id, item]));
  const runtimeClusters = params.clusters
    .filter((cluster) => enabledById.has(cluster.id))
    .map((cluster) => {
      const pref = enabledById.get(cluster.id);
      if (!pref) return undefined;
      return {
        id: cluster.id,
        name: cluster.name?.get() ?? cluster.id,
        kubeconfigPath: cluster.kubeConfigPath?.get() ?? "",
        presetLevel: pref.presetLevel,
        customRules: pref.customRules,
        intervalOverrideMs: pref.intervalOverrideMs,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return {
    enabled: monitorPrefs?.enabled ?? false,
    trayResident: monitorPrefs?.trayResident ?? false,
    intervalMs: monitorPrefs?.intervalMs ?? 300_000,
    clusters: runtimeClusters,
    provider: monitorPrefs?.provider ?? "anthropic",
    apiKey: params.apiKey,
    modelId: monitorPrefs?.modelId ?? "claude-sonnet-4-6",
    kubectlPath: params.kubectlPath ?? "kubectl",
    helmPath: params.helmPath ?? "helm",
  };
}
