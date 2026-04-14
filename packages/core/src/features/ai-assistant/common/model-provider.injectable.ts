/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Model Provider를 DI 컨테이너에 등록
 *
 * 📝 Extension Host 패턴 적용:
 * - encryptedApiKeyService 제거 (API 키는 Main에서만 복호화)
 * - createIPCChatModel 추가 (IPC 기반 LLM 호출)
 *
 * 🔄 변경이력:
 * - 2025-12-16: Extension Host 패턴으로 리팩토링
 */

import { getInjectable } from "@ogre-tools/injectable";
import ollamaServiceInjectable from "../../ollama/renderer/ollama-service.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import createIPCChatModelInjectable from "../renderer/ipc-chat-model.injectable";
import { ModelProvider, type ModelProviderDependencies } from "./model-provider";

/**
 * 🎯 Model Provider Injectable
 *
 * Extension Host 패턴으로 API 키가 Renderer에서 절대 노출되지 않습니다.
 */
const modelProviderInjectable = getInjectable({
  id: "model-provider",
  instantiate: (di) => {
    const dependencies: ModelProviderDependencies = {
      userPreferencesState: di.inject(userPreferencesStateInjectable),
      // 🎯 IPCChatModel 팩토리 (OpenAI/Anthropic/Google용)
      createIPCChatModel: di.inject(createIPCChatModelInjectable),
      // 🎯 Ollama IPC 서비스 (기존 패턴 유지)
      ollamaService: di.inject(ollamaServiceInjectable),
    };

    return new ModelProvider(dependencies);
  },
});

export default modelProviderInjectable;
