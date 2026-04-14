/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import {
  type ValidateOpenRouterModelRequest,
  type ValidateOpenRouterModelResponse,
  validateOpenRouterModelChannel,
} from "../../../common/features/user-preferences/validate-openrouter-model-channel";

/**
 * OpenRouter Model Validation Handler
 *
 * Purpose: Validates custom model ID by checking OpenRouter's model catalog
 * API Endpoint: GET https://openrouter.ai/api/v1/models
 *
 * @param request - Contains modelId to validate
 * @returns Validation result with error message if invalid
 *
 * Error Cases:
 * - Model not found in catalog → "Model not found"
 * - Network error → "Network error: {message}"
 * - API error (non-200) → "API error: HTTP {status}"
 */
export async function validateOpenRouterModelHandler(
  request: ValidateOpenRouterModelRequest,
): Promise<ValidateOpenRouterModelResponse> {
  const { modelId } = request;

  try {
    // Fetch model list from OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/models");

    // Handle API errors
    if (!response.ok) {
      return {
        valid: false,
        error: `API error: HTTP ${response.status}`,
      };
    }

    // Parse response
    const data = await response.json();

    // Validate response structure
    if (!data?.data || !Array.isArray(data.data)) {
      return {
        valid: false,
        error: "Model not found",
      };
    }

    // Check if model exists in catalog (case-sensitive)
    const modelExists = data.data.some((model: { id: string }) => model.id === modelId);

    if (!modelExists) {
      return {
        valid: false,
        error: "Model not found",
      };
    }

    return { valid: true };
  } catch (error: unknown) {
    // Handle network errors
    const message = error instanceof Error ? error.message : "Unknown error";

    return {
      valid: false,
      error: `Network error: ${message}`,
    };
  }
}

/**
 * IPC Channel Responder: Validate OpenRouter Model
 *
 * Purpose: Handles model validation requests from renderer process
 * Direction: Renderer → Main
 */
export const validateOpenRouterModelChannelResponderInjectable = getRequestChannelListenerInjectable({
  id: "validate-openrouter-model-channel-responder-listener",
  channel: validateOpenRouterModelChannel,
  getHandler: () => {
    return validateOpenRouterModelHandler;
  },
});
