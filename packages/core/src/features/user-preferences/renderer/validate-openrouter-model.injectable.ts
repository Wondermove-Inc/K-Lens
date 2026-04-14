/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type ValidateOpenRouterModelResponse,
  validateOpenRouterModelChannel,
} from "../../../common/features/user-preferences/validate-openrouter-model-channel";

/**
 * Validate OpenRouter Model ID (Renderer-side)
 *
 * Purpose: Sends model validation request to main process
 * Direction: Renderer → Main
 *
 * Usage:
 * ```typescript
 * const validateModel = di.inject(validateOpenRouterModelInjectable);
 * const result = await validateModel("mistralai/mistral-large");
 * ```
 */
const validateOpenRouterModelInjectable = getInjectable({
  id: "validate-openrouter-model-renderer",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return async (modelId: string): Promise<ValidateOpenRouterModelResponse> => {
      return await requestFromChannel(validateOpenRouterModelChannel, { modelId });
    };
  },
});

export default validateOpenRouterModelInjectable;
