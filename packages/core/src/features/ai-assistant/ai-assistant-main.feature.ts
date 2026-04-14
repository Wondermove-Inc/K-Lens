/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant Main Process Feature (Extension Host)
 *
 * Main Process에서만 사용되는 injectable들을 등록합니다.
 * - LLM API Handler
 * - Agent Host
 * - Checkpointer
 * - Session Manager
 * - kubectl/shell 실행 핸들러
 *
 * 📝 주의: 이 파일은 Main Process에서만 import되어야 합니다.
 * Renderer 컴포넌트를 import하면 빌드 에러가 발생합니다.
 *
 * 🔄 변경이력:
 * - 2025-12-16: Main/Renderer Feature 분리 (Webpack 빌드 에러 해결)
 */

import { getFeature } from "@skuberplus/feature-core";

// ============================================
// 🎯 Main Process Injectables (Extension Host)
// ============================================

// 🔧 LLM API Handler (Phase 1)
import "./main/llm-chat-handler.injectable";
import "./main/llm-model-factory.injectable";

// 🔧 Agent Host (Phase 2)
import "./main/agent-host.injectable";
import "./main/agent-ipc-handler.injectable";
import "./main/monitor-ipc-handler.injectable";
import "./main/monitor/monitor-supervisor.injectable";
import "./main/monitor/monitor-quit-cleanup.injectable";

// 🔧 Session Manager
import "./main/session/agent-session-manager.injectable";
import "./main/session/hitl-session-handler.injectable";

// 🔧 ConversationLogger (파일 기반 대화 저장)
import "./main/conversation-logger.injectable";

// 🔧 kubectl/shell/helm 실행 핸들러
import "./main/kubectl-execute-handler.injectable";
import "./main/shell-execute-handler.injectable";
import "./main/helm-execute-handler.injectable";

// 🔧 AI File System Handlers (Phase 1-3: File I/O, Delete, Search)
import "./main/ai-file-handler.injectable";

// Security Fix Snapshot / Rollback / CrashLoop Watch Handlers
import "../security/main/fix-snapshot-handler.injectable";
// CVE Image Upgrade IPC 핸들러 DI 등록
import "../security/main/cve-upgrade-ipc-handler.injectable";
import "../security/main/pod-status-poll-handler.injectable";
import "../security/main/rollback-log-handler.injectable";

export const aiAssistantMainFeature = getFeature({
  id: "ai-assistant-main",
  register: (_di) => {
    // side-effect imports로 등록 완료
  },
});
