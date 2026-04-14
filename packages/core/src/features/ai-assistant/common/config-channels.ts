/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * 🎯 목적: 에이전트 설정 MD IPC 채널 정의
 *
 * Renderer ↔ Main 간 에이전트 설정 파일 관련 통신 채널입니다.
 * - 설정 파일 목록 조회
 * - 설정 파일 내용 조회
 * - 설정 파일 수정 (사용자 오버라이드)
 * - 설정 파일 리셋 (기본값 복원)
 */

import { getRequestChannel } from "@skuberplus/messaging";

// ============================================
// 🎯 타입 정의
// ============================================

export interface ConfigFileInfo {
  name: string;
  relativePath: string;
  category: "core" | "skill" | "expert";
  hasOverride: boolean;
  description?: string;
}

export interface ConfigContent {
  content: string;
  isOverride: boolean;
  bundledContent: string;
}

// ============================================
// 🎯 요청/응답 타입
// ============================================

export type ConfigRequest =
  | { type: "get-config-list" }
  | { type: "get-config-content"; relativePath: string }
  | { type: "update-config-content"; relativePath: string; content: string }
  | { type: "reset-config"; relativePath: string };

export type ConfigResponse =
  | { type: "config-list"; files: ConfigFileInfo[] }
  | { type: "config-content"; data: ConfigContent }
  | { type: "config-updated"; success: boolean }
  | { type: "config-reset"; success: boolean; content: string }
  | { type: "config-error"; error: string };

// ============================================
// 🎯 IPC 채널
// ============================================

export const configChannel = getRequestChannel<ConfigRequest, ConfigResponse>("ai-assistant:config");
