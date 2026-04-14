/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * 🎯 목적: 에이전트 설정 MD IPC 핸들러
 *
 * Renderer에서 오는 설정 파일 관련 요청을 처리합니다.
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import {
  deleteUserOverride,
  EDITABLE_CONFIGS,
  getBundledContent,
  getEffectiveContent,
  listUserOverrides,
  writeUserOverride,
} from "../agents/md-loader";
import { type ConfigFileInfo, type ConfigRequest, type ConfigResponse, configChannel } from "../common/config-channels";

const configHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-config-handler",
  channel: configChannel,
  getHandler: (di) => {
    return async (request: ConfigRequest): Promise<ConfigResponse> => {
      try {
        switch (request.type) {
          case "get-config-list": {
            const overrides = new Set(listUserOverrides());
            const files: ConfigFileInfo[] = EDITABLE_CONFIGS.map((cfg) => ({
              name: cfg.name,
              relativePath: cfg.relativePath,
              category: cfg.category,
              hasOverride: overrides.has(cfg.relativePath),
              description: cfg.description,
            }));
            return { type: "config-list", files };
          }

          case "get-config-content": {
            const config = EDITABLE_CONFIGS.find((c) => c.relativePath === request.relativePath);
            if (!config) {
              return { type: "config-error", error: `Unknown config: ${request.relativePath}` };
            }
            const bundled = getBundledContent(request.relativePath);
            const effective = getEffectiveContent(request.relativePath);
            const overrides = new Set(listUserOverrides());
            return {
              type: "config-content",
              data: {
                content: effective ?? bundled,
                isOverride: overrides.has(request.relativePath),
                bundledContent: bundled,
              },
            };
          }

          case "update-config-content": {
            const config = EDITABLE_CONFIGS.find((c) => c.relativePath === request.relativePath);
            if (!config) {
              return { type: "config-error", error: `Unknown config: ${request.relativePath}` };
            }
            writeUserOverride(request.relativePath, request.content);
            return { type: "config-updated", success: true };
          }

          case "reset-config": {
            const config = EDITABLE_CONFIGS.find((c) => c.relativePath === request.relativePath);
            if (!config) {
              return { type: "config-error", error: `Unknown config: ${request.relativePath}` };
            }
            deleteUserOverride(request.relativePath);
            const bundled = getBundledContent(request.relativePath);
            return { type: "config-reset", success: true, content: bundled };
          }

          default:
            return { type: "config-error", error: "Unknown request type" };
        }
      } catch (error) {
        return {
          type: "config-error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },
});

export default configHandlerInjectable;
