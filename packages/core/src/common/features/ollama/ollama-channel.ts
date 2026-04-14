/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

// ============================================
// 🎯 Ollama IPC 채널 정의
// - Renderer → Main Process 통신
// - Electron 보안 정책 우회를 위해 Main에서 HTTP 요청
// ============================================

/**
 * 🎯 Ollama 연결 테스트 요청
 */
export interface OllamaTestConnectionRequest {
  baseUrl: string;
}

/**
 * 🎯 Ollama 연결 테스트 응답
 */
export interface OllamaTestConnectionResponse {
  success: boolean;
  modelCount?: number;
  models?: string[];
  error?: string;
}

/**
 * 🎯 Ollama Chat 요청 (LangChain 대신 직접 호출용)
 */
export interface OllamaChatRequest {
  baseUrl: string;
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream?: boolean;
}

/**
 * 🎯 Ollama Chat 응답
 */
export interface OllamaChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 🎯 Ollama 연결 테스트 채널 (Renderer → Main)
 */
export const ollamaTestConnectionChannel = getRequestChannel<OllamaTestConnectionRequest, OllamaTestConnectionResponse>(
  "ollama-test-connection-channel",
);

/**
 * 🎯 Ollama Chat 채널 (Renderer → Main)
 * - LangChain이 Renderer에서 직접 호출 시 CORS 문제 발생
 * - Main Process에서 HTTP 요청 후 결과 반환
 */
export const ollamaChatChannel = getRequestChannel<OllamaChatRequest, OllamaChatResponse>("ollama-chat-channel");

// ============================================
// 🎯 실행 중인 모델 목록 조회 (GET /api/ps)
// ============================================

/**
 * 🎯 실행 중인 모델 목록 요청
 */
export interface OllamaListRunningModelsRequest {
  baseUrl: string;
}

/**
 * 🎯 실행 중인 모델 정보
 */
export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  expires_at: string;
}

/**
 * 🎯 실행 중인 모델 목록 응답
 */
export interface OllamaListRunningModelsResponse {
  success: boolean;
  models?: OllamaRunningModel[];
  error?: string;
}

/**
 * 🎯 Ollama 실행 중인 모델 목록 채널 (Renderer → Main)
 * - GET /api/ps 엔드포인트 호출
 */
export const ollamaListRunningModelsChannel = getRequestChannel<
  OllamaListRunningModelsRequest,
  OllamaListRunningModelsResponse
>("ollama-list-running-models-channel");
