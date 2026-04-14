/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: LLM Model Factory의 DI Injectable 정의
 *
 * Main Process에서 LLM 모델을 생성하는 팩토리를 주입합니다.
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Extension Host 패턴 마이그레이션)
 */

import { getInjectable } from "@ogre-tools/injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import encryptApiKeyInjectable from "../../user-preferences/main/encrypt-api-key.injectable";
import { LLMModelFactory } from "./llm-model-factory";

/**
 * 🎯 LLM Model Factory Injectable
 *
 * Main Process에서만 사용 가능합니다.
 */
const llmModelFactoryInjectable = getInjectable({
  id: "llm-model-factory",
  instantiate: (di) => {
    const encryptedApiKeyService = di.inject(encryptApiKeyInjectable);
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    return new LLMModelFactory({
      encryptedApiKeyService,
      userPreferencesState,
    });
  },
});

export default llmModelFactoryInjectable;
