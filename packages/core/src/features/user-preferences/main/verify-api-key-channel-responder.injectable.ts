/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import OpenAI from "openai";
import {
  type VerifyApiKeyResponse,
  verifyApiKeyChannel,
} from "../../../common/features/user-preferences/verify-api-key-channel";

/**
 * 목적: AI Provider API Key 유효성 검증 IPC 핸들러 (Renderer → Main)
 *
 * Provider별 최소 API 호출로 키 유효성 검증:
 * - Anthropic: models.list
 * - OpenAI: models.list
 * - OpenRouter: /api/v1/key
 */

async function verifyAnthropicKey(apiKey: string): Promise<VerifyApiKeyResponse> {
  try {
    const isSetupToken = apiKey.includes("sk-ant-oat");

    const client = isSetupToken
      ? new Anthropic({
          authToken: apiKey,
          defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
        })
      : new Anthropic({ apiKey });

    // models.list로 키 유효성만 확인 (과금 없음, 잔액과 무관)
    await client.models.list({ limit: 1 });

    return { valid: true };
  } catch (error: unknown) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { valid: false, error: "Invalid API key" };
    }

    if (error instanceof Anthropic.PermissionDeniedError) {
      return { valid: false, error: "Permission denied" };
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return { valid: false, error: "Network error: unable to reach Anthropic API" };
    }

    if (error instanceof Anthropic.APIError) {
      return { valid: false, error: `API error: ${error.message}` };
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    return { valid: false, error: message };
  }
}

async function verifyOpenaiKey(apiKey: string): Promise<VerifyApiKeyResponse> {
  try {
    const client = new OpenAI({ apiKey });

    // models.list는 과금 없이 키 유효성만 확인 가능
    await client.models.list();

    return { valid: true };
  } catch (error: unknown) {
    if (error instanceof OpenAI.AuthenticationError) {
      return { valid: false, error: "Invalid API key" };
    }

    if (error instanceof OpenAI.PermissionDeniedError) {
      return { valid: false, error: "Permission denied" };
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return { valid: false, error: "Network error: unable to reach OpenAI API" };
    }

    if (error instanceof OpenAI.APIError) {
      return { valid: false, error: `API error: ${error.message}` };
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    return { valid: false, error: message };
  }
}

async function verifyOpenrouterKey(apiKey: string): Promise<VerifyApiKeyResponse> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: HTTP ${response.status}` };
    }

    return { valid: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return { valid: false, error: `Network error: ${message}` };
  }
}

export const verifyApiKeyChannelResponderInjectable = getRequestChannelListenerInjectable({
  id: "verify-api-key-channel-responder-listener",
  channel: verifyApiKeyChannel,
  getHandler: () => {
    return async (req): Promise<VerifyApiKeyResponse> => {
      switch (req.provider) {
        case "anthropic":
          return verifyAnthropicKey(req.apiKey);
        case "openai":
          return verifyOpenaiKey(req.apiKey);
        case "openrouter":
          return verifyOpenrouterKey(req.apiKey);
        default:
          return { valid: false, error: `Verification not supported for provider: ${req.provider}` };
      }
    };
  },
});
