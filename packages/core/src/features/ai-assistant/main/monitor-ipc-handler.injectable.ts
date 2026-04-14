/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Monitor IPC Handler (Main Process)
 *
 * Cluster Monitor의 시작/중지/설정/상태조회/즉시점검/커스텀룰 IPC를 처리합니다.
 *
 * 📝 agent-ipc-handler.injectable.ts에서 분리 (구조 정리)
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import clustersInjectable from "../../cluster/storage/common/clusters.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import encryptApiKeyInjectable from "../../user-preferences/main/encrypt-api-key.injectable";
import {
  monitorCheckNowChannel,
  monitorConfigGetChannel,
  monitorConfigSetChannel,
  monitorCustomRuleAddChannel,
  monitorStartChannel,
  monitorStatusChannel,
  monitorStopChannel,
} from "../common/agent-ipc-channels";
import monitorSupervisorInjectable from "./monitor/monitor-supervisor.injectable";
import { parseNaturalLanguageRule, parseNaturalLanguageRuleWithLLM } from "./monitor/natural-language-rule-parser";
import { resolveMonitorApiKey, toRuntimeMonitorConfig } from "./monitor-config-resolver";

import type { MonitorStatus, MonitorUserPreferences } from "../common/monitor-types";

/**
 * 목적: Monitor 시작 IPC Handler
 */
const monitorStartHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-start-handler",
  channel: monitorStartChannel,
  getHandler: (di) => {
    const monitorSupervisor = di.inject(monitorSupervisorInjectable);
    const userPreferencesState = di.inject(userPreferencesStateInjectable) as any;
    const encryptedApiKeyService = di.inject(encryptApiKeyInjectable);
    return async (config) => {
      const apiKey = await resolveMonitorApiKey({
        provider: config.provider,
        providedApiKey: config.apiKey,
        userPreferencesState,
        encryptedApiKeyService,
      });

      const runtimeConfig = { ...config, apiKey };
      if (monitorSupervisor.isRunning()) {
        monitorSupervisor.updateConfig(runtimeConfig);
      } else {
        monitorSupervisor.start(runtimeConfig);
      }
    };
  },
});

/**
 * 목적: Monitor 중지 IPC Handler
 */
const monitorStopHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-stop-handler",
  channel: monitorStopChannel,
  getHandler: (di) => {
    const monitorSupervisor = di.inject(monitorSupervisorInjectable);
    const userPreferencesState = di.inject(userPreferencesStateInjectable) as any;
    return async () => {
      monitorSupervisor.stop();

      // 앱 재시작 시 UI/워커 상태 불일치 방지: preference도 disabled로 저장
      if (userPreferencesState.monitorConfig) {
        userPreferencesState.monitorConfig = {
          ...userPreferencesState.monitorConfig,
          enabled: false,
        };
      }
    };
  },
});

/**
 * 목적: Monitor 설정 저장 IPC Handler
 */
const monitorConfigSetHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-config-set-handler",
  channel: monitorConfigSetChannel,
  getHandler: (di) => {
    const monitorSupervisor = di.inject(monitorSupervisorInjectable);
    const userPreferencesState = di.inject(userPreferencesStateInjectable) as any;
    const encryptedApiKeyService = di.inject(encryptApiKeyInjectable);
    return async (config) => {
      const apiKey = await resolveMonitorApiKey({
        provider: config.provider,
        providedApiKey: config.apiKey,
        userPreferencesState,
        encryptedApiKeyService,
      });

      const runtimeConfig = { ...config, apiKey };
      if (monitorSupervisor.isRunning()) {
        monitorSupervisor.updateConfig(runtimeConfig);
      } else if (runtimeConfig.enabled) {
        monitorSupervisor.start(runtimeConfig);
      }
    };
  },
});

/**
 * 목적: Monitor 설정 조회 IPC Handler
 */
const monitorConfigGetHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-config-get-handler",
  channel: monitorConfigGetChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable) as any;
    const encryptedApiKeyService = di.inject(encryptApiKeyInjectable);
    const clusters = di.inject(clustersInjectable);
    return async () => {
      const provider =
        (userPreferencesState.monitorConfig as MonitorUserPreferences | undefined)?.provider ?? "anthropic";
      const apiKey = await resolveMonitorApiKey({
        provider,
        userPreferencesState,
        encryptedApiKeyService,
      });
      return toRuntimeMonitorConfig({
        monitorPrefs: userPreferencesState.monitorConfig as MonitorUserPreferences | undefined,
        clusters: clusters.get(),
        apiKey,
      });
    };
  },
});

/**
 * 목적: Monitor 상태 조회 IPC Handler
 */
const monitorStatusHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-status-handler",
  channel: monitorStatusChannel,
  getHandler: (di) => {
    const monitorSupervisor = di.inject(monitorSupervisorInjectable);
    return async (): Promise<MonitorStatus[]> => monitorSupervisor.getStatuses();
  },
});

/**
 * 목적: Monitor 즉시 점검 IPC Handler
 */
const monitorCheckNowHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-check-now-handler",
  channel: monitorCheckNowChannel,
  getHandler: (di) => {
    const monitorSupervisor = di.inject(monitorSupervisorInjectable);
    return async (clusterId) => {
      monitorSupervisor.triggerCheck(clusterId);
    };
  },
});

/**
 * 목적: Monitor 커스텀 룰 추가 IPC Handler
 */
const monitorCustomRuleAddHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-monitor-custom-rule-add-handler",
  channel: monitorCustomRuleAddChannel,
  getHandler: (di) => {
    const userPreferencesState = di.inject(userPreferencesStateInjectable) as any;
    const encryptedApiKeyService = di.inject(encryptApiKeyInjectable);
    return async (description) => {
      try {
        const prefs = userPreferencesState.monitorConfig as MonitorUserPreferences | undefined;
        const provider = prefs?.provider ?? "anthropic";
        const apiKey = await resolveMonitorApiKey({
          provider,
          userPreferencesState,
          encryptedApiKeyService,
        });
        if (apiKey || provider === "ollama") {
          return await parseNaturalLanguageRuleWithLLM({
            description,
            provider,
            apiKey: apiKey ?? "",
            modelId: prefs?.modelId,
          });
        }
      } catch (error) {
        console.warn("[IPC] LLM rule parser failed, falling back to regex:", error);
      }
      return parseNaturalLanguageRule(description);
    };
  },
});

export {
  monitorStartHandlerInjectable,
  monitorStopHandlerInjectable,
  monitorConfigSetHandlerInjectable,
  monitorConfigGetHandlerInjectable,
  monitorStatusHandlerInjectable,
  monitorCheckNowHandlerInjectable,
  monitorCustomRuleAddHandlerInjectable,
};
