/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ChatHeader 모듈 진입점
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 */

// ChatHeader 컴포넌트
export { ChatHeader } from "./chat-header";
export {
  chatHeaderComponentInjectable,
  InjectedChatHeader,
} from "./chat-header.injectable";

export type { ChatHeaderProps, PastChat } from "./chat-header";
