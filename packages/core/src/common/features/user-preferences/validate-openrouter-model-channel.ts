/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

/**
 * OpenRouter Model Validation Request
 *
 * Validates if a custom model ID exists in OpenRouter's model catalog.
 */
export interface ValidateOpenRouterModelRequest {
  /** Custom model ID to validate (e.g., "mistralai/mistral-large") */
  modelId: string;
}

/**
 * OpenRouter Model Validation Response
 *
 * Contains validation result and optional error message.
 */
export interface ValidateOpenRouterModelResponse {
  /** Whether the model ID is valid and exists */
  valid: boolean;
  /** Error message if validation failed (e.g., "Model not found") */
  error?: string;
}

/**
 * IPC Channel: Validate OpenRouter Custom Model ID
 *
 * Purpose: Validates custom model ID against OpenRouter's /api/v1/models endpoint
 * Direction: Renderer → Main
 *
 * Usage:
 * ```typescript
 * const result = await sendRequest(validateOpenRouterModelChannel, { modelId: "mistralai/mistral-large" });
 * if (result.valid) {
 *   // Model ID is valid
 * }
 * ```
 */
export const validateOpenRouterModelChannel = getRequestChannel<
  ValidateOpenRouterModelRequest,
  ValidateOpenRouterModelResponse
>("validate-openrouter-model-channel");
