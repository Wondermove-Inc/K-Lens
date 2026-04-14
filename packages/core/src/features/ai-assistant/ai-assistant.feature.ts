/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant Renderer Process Feature
 *
 * Renderer Process에서만 사용되는 injectable들을 등록합니다.
 * - Agent IPC Client (Main Process와 통신)
 * - Stream Event Bus
 * - IPC Chat Model
 * - Agent System (Orchestrator 등)
 * - AI Chat Panel UI 컴포넌트
 * - DAIVE v2.1 상태 관리 (Session, Streaming, Thinking 등)
 *
 * 📝 주의: Main Process용 injectable은 ai-assistant-main.feature.ts에 있습니다.
 *
 * 🔄 변경이력:
 * - 2025-12-16: Main/Renderer Feature 분리 (Webpack 빌드 에러 해결)
 * - 2026-01-05: DAIVE v2.1 상태 관리 injectable 추가 (통합 작업)
 */

import { getFeature } from "@skuberplus/feature-core";

// ============================================
// 🎯 Renderer Process Injectables
// ============================================

// 🔧 Agent IPC Client (Phase 2)
import "./renderer/agent-ipc-client.injectable";
import "./renderer/agent-stream-event-bus.injectable";
import "./renderer/agent-stream-listener.injectable";
import "./renderer/monitor-ui/monitor-stream-listener.injectable";
import "./renderer/monitor-ui/monitor-alert-handler.injectable";

// 🔧 IPC Chat Model (Phase 1)
import "./renderer/ipc-chat-model.injectable";

// 🔧 AI Chat Panel 파일들 (renderer/components/ai-chat/)
// 📝 2026-01-17: Root Frame 마이그레이션 - ClusterFrame 대신 Root Frame에서 렌더링
import "../../renderer/components/ai-chat/ai-chat-panel-root-frame-child-component.injectable";
// 📝 2026-01-17: 키보드 단축키 핸들러 (Root Frame)
import "../../renderer/components/ai-chat/ai-chat-keyboard-shortcut-handler.injectable";
// 📝 2026-01-17: ClusterFrame 등록 제거
// import "../../renderer/components/ai-chat/ai-chat-panel-cluster-frame-child-component.injectable";
import "../../renderer/components/ai-chat/ai-chat-panel-store.injectable";
import "../../renderer/components/ai-chat/ai-chat-panel-storage.injectable";

// ============================================
// 🎯 DAIVE v2.1 상태 관리 Injectables
// ============================================

// 🔧 세션 관리 (SessionManager + SessionState)
import "./common/session-manager.injectable";
import "./common/session-state.injectable";

// 🔧 스트리밍 상태 (LLM 응답 스트리밍)
import "./common/streaming-state.injectable";

// 🔧 사고 과정 상태 (Thinking 블록 관리)
import "./common/thinking-state.injectable";

// 🔧 멘션 상태 (@멘션 기능)
import "./common/mention-state.injectable";

// 🔧 슬래시 명령어 상태 (/명령어 기능)
import "./common/slash-command-state.injectable";

// 🔧 Agent Mode 컨트롤러 (FR-004: AgentProgress 연결용)
import "./common/agent-mode-controller.injectable";

// ============================================
// 🎯 MCP Settings Preference Injectables
// ============================================
// 📝 2026-01-07: MCP 설정이 Settings에 표시되지 않는 문제 해결 ()
// webpack auto-register가 패턴 매칭에도 불구하고 등록하지 않아 명시적 import 추가
// 📝 2026-01-07: 경로 수정 - ../../features → ../preferences (ai-assistant 폴더 기준)
import "../preferences/renderer/preference-items/mcp-servers/mcp-servers-preference-tab.injectable";
import "../preferences/renderer/preference-items/mcp-servers/mcp-servers-preference-page.injectable";

export const aiAssistantFeature = getFeature({
  id: "ai-assistant",
  register: (_di) => {
    // side-effect imports로 등록 완료
  },
});
