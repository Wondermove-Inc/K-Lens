/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import {
  type OllamaChatResponse,
  type OllamaListRunningModelsResponse,
  type OllamaTestConnectionResponse,
  ollamaChatChannel,
  ollamaListRunningModelsChannel,
  ollamaTestConnectionChannel,
} from "../../../common/features/ollama/ollama-channel";

// ============================================
// 🎯 Ollama 연결 테스트 IPC 핸들러 (Renderer → Main)
// - Main Process에서 HTTP 요청 실행
// - Electron 보안 정책 우회
// ============================================
export const ollamaTestConnectionResponderInjectable = getRequestChannelListenerInjectable({
  id: "ollama-test-connection-channel-responder",
  channel: ollamaTestConnectionChannel,
  getHandler: () => {
    return async (req): Promise<OllamaTestConnectionResponse> => {
      const { baseUrl } = req;

      // 🎯 localhost를 127.0.0.1로 변환 (일부 환경에서 더 안정적)
      const normalizedUrl = baseUrl.replace("localhost", "127.0.0.1");

      try {
        const response = await fetch(`${normalizedUrl}/api/tags`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const models = data.models || [];

          return {
            success: true,
            modelCount: models.length,
            models: models.map((m: { name: string }) => m.name),
          };
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error("[Ollama] 연결 테스트 실패:", errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    };
  },
});

// ============================================
// 🎯 Ollama Chat IPC 핸들러 (Renderer → Main)
// - LangChain 대신 직접 HTTP 요청
// - 스트리밍 미지원 (단순 응답만)
// ============================================
export const ollamaChatResponderInjectable = getRequestChannelListenerInjectable({
  id: "ollama-chat-channel-responder",
  channel: ollamaChatChannel,
  getHandler: () => {
    return async (req): Promise<OllamaChatResponse> => {
      const { baseUrl, model, messages } = req;

      // 🎯 localhost를 127.0.0.1로 변환
      const normalizedUrl = baseUrl.replace("localhost", "127.0.0.1");

      try {
        const response = await fetch(`${normalizedUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          return {
            success: true,
            message: data.message?.content || "",
          };
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error("[Ollama] Chat 요청 실패:", errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    };
  },
});

// ============================================
// 🎯 Ollama 실행 중인 모델 목록 IPC 핸들러 (Renderer → Main)
// - GET /api/ps 엔드포인트 호출
// - 현재 메모리에 로드된 모델 목록 반환
// ============================================
export const ollamaListRunningModelsResponderInjectable = getRequestChannelListenerInjectable({
  id: "ollama-list-running-models-channel-responder",
  channel: ollamaListRunningModelsChannel,
  getHandler: () => {
    return async (req): Promise<OllamaListRunningModelsResponse> => {
      const { baseUrl } = req;

      // 🎯 localhost를 127.0.0.1로 변환
      const normalizedUrl = baseUrl.replace("localhost", "127.0.0.1");

      try {
        const response = await fetch(`${normalizedUrl}/api/ps`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();

          return {
            success: true,
            models: data.models || [],
          };
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.error("[Ollama] 실행 중인 모델 목록 조회 실패:", errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    };
  },
});
