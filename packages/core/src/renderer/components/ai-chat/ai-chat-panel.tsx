/**
 * DAIVE AI Chat Panel
 *
 * Storybook Template Source:
 * - File: packages/storybook-shadcn/vendor/shadcn/src/registry/templates/ai-assistant/ai-assistant.stories.tsx
 * - Story: BeforeUtterance (Line 116-322)
 * - Commit: b7e3c9f
 * - Last Updated: 2025-10-31
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { clipboard } from "electron";
// 📝 2026-01-18: Issue 5 - ChevronRight 제거 (Past Chats 섹션 삭제로 미사용)
// 📝 2026-01-18: - ArrowUp, ChevronDown, Infinity, Square → InputGroup으로 이동
import { Check, Copy, History, Plus, Settings, X } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
// 🎯 DAIVE v2.1: AgentModeController DI
import agentModeControllerInjectable from "../../../features/ai-assistant/common/agent-mode-controller.injectable";
// planState는 PlanViewer 컴포넌트 내부에서 직접 참조됨
import { agentModeState } from "../../../features/ai-assistant/common/agent-mode-state";
import { isFeatureEnabled } from "../../../features/ai-assistant/common/feature-flags";
import { mentionState } from "../../../features/ai-assistant/common/mention-state";
// 📝 2026-01-18: - ScrollArea, Textarea → InputGroup으로 이동
// 🎯 DAIVE v2.1: 멘션/슬래시 명령어 상태
import { slashCommandState } from "../../../features/ai-assistant/common/slash-command-state";
import { SlashCommandId } from "../../../features/ai-assistant/common/slash-command-types";
import { getSlashCommandByName, parseSlashCommandInput } from "../../../features/ai-assistant/common/slash-commands";
// 🎯 DAIVE v2.1: MobX 상태 import
import { thinkingState } from "../../../features/ai-assistant/common/thinking-state";
// 🎯 DAIVE v2.1: ContextPills 스토어 (컴포넌트는 InputGroup으로 이동)
// 📝 2026-01-18: - ContextPills → InputGroup으로 이동
import { ContextPickerModal } from "../../../features/ai-assistant/renderer/components/context-picker-modal";
import { ExpertDebatePanel } from "../../../features/ai-assistant/renderer/components/expert-debate-panel";
// 🎯 2026-01-06: SessionRestorePanel 통합 (USER-GUIDE.md 기능 구현)
import { SessionRestorePanel } from "../../../features/ai-assistant/renderer/components/session-restore-panel";
import { monitorState } from "../../../features/ai-assistant/renderer/monitor-ui/monitor-state";
import { getContextStore } from "../../../features/ai-assistant/renderer/store/context-store";
// 📝 2026-01-18: - getAvailableModels, getModelDisplayName → InputGroup으로 이동
import openPreferencesDialogInjectable from "../../../features/preferences/renderer/open-preferences-dialog.injectable";
import { ResizeHandle } from "../resize/resize-handle";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../shadcn-ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../shadcn-ui/tabs";
// 📝 2026-01-18: MermaidRenderer import 제거 - Streamdown 통일로 자체 Mermaid 지원
import { AgentProgress } from "./agent-progress";
import { AiAssistantSettings } from "./ai-assistant-settings";
import {
  AIChatPanelStore,
  buildClarifySubmissionFromSuggestion,
  buildClarifySubmissionFromText,
  type ChatMessage,
  type ClarifySuggestion,
  SUPERVISOR_HITL_OPTIONS,
} from "./ai-chat-panel-store";
// 📝 2026-01-18: - HITL_LEVEL_OPTIONS → InputGroup으로 이동
import aiChatPanelStoreInjectable from "./ai-chat-panel-store.injectable";
import { AlertsTabContent } from "./alerts-tab/alerts-tab-content";
// 🎯 2026-01-17: Root Frame Migration - ChatHeader & ClusterSelectionPrompt
import { ChatHeader } from "./chat-header";
import { Clarify } from "./clarify";
import { ClusterSelectionPrompt } from "./cluster-selector";
import { FeedbackButtons } from "./feedback-buttons";
import { HitlApproval } from "./hitl-approval";
// 🎯 2026-01-18: - InputGroup 공통 컴포넌트
import { InputGroup } from "./input-group";
import { NodeProgressCard } from "./node-progress-card";
import { PlanViewer } from "./plan-viewer";
// 🎯 DAIVE v2.1: 미연결 컴포넌트 import (PRD: AI Feature Integration)
import { StreamingText } from "./streaming-text";
import { ThinkingIndicator } from "./thinking-indicator";
// 🎯 2026-01-06: 컴팩트 승인 UI 및 승인 결과 표시 컴포넌트 (기존 ToolApprovalPrompt 대체)
import { ToolApprovalCompact } from "./tool-approval-compact";
// 🎯 2026-01-06: Diff 표시 가능한 승인 UI (Cursor AI 스타일)
import { ToolApprovalDiff } from "./tool-approval-diff";
import { ToolApprovalResult } from "./tool-approval-result";
import { useKubernetesResourceFetcher } from "./use-kubernetes-resource-fetcher";

import type { SlashCommandInfo } from "../../../features/ai-assistant/common/agent-ipc-channels";
import type { AgentModeController } from "../../../features/ai-assistant/common/agent-mode-controller";
import type { ContextItem, ContextTypeValue } from "../../../features/ai-assistant/common/context-types";
import type { SessionSummary } from "../../../features/ai-assistant/common/session-types";
import type { SlashCommand } from "../../../features/ai-assistant/common/slash-commands";
import type { FeedbackCategory } from "../../../features/ai-assistant/common/user-profile-types";
import type { OpenPreferencesDialog } from "../../../features/preferences/renderer/open-preferences-dialog.injectable";
// 📝 2026-01-18: - SlashCommandPalette, MentionAutocomplete → InputGroup으로 이동
import type { MentionSuggestion } from "./mention-autocomplete";

// ============================================
// 🎯 ChatMessageItem 컴포넌트 (가상화용 메모이제이션)
// ============================================

/**
 * 🎯 ChatMessageItem Props
 */
interface ChatMessageItemProps {
  message: ChatMessage;
  copiedMessageId: string | null;
  onCopy: (message: ChatMessage) => void;
  /** 🎯 현재 threadId (피드백 전송용) */
  threadId?: string;
  /** 🎯 피드백 콜백 */
  onFeedback?: (
    messageId: string,
    threadId: string,
    rating: "positive" | "negative",
    category?: FeedbackCategory,
    detail?: string,
  ) => void;
}

/**
 * 🎯 목적: 개별 메시지 렌더링 컴포넌트 (React.memo로 불필요한 리렌더링 방지)
 *
 * 📝 주의사항:
 * - Virtuoso의 itemContent에서 사용됨
 * - 메시지 content 변경 시에만 리렌더링
 * - margin 대신 padding 사용 (Virtuoso 높이 측정 정확도)
 */
const ChatMessageItem = React.memo(
  ({ message, copiedMessageId, onCopy, threadId, onFeedback }: ChatMessageItemProps) => {
    // 🎯 2026-01-06: Tool 승인 결과 메시지 렌더링
    // 📝 2026-01-07: 해결 - yamlContent, diffStats, filePath 전달 추가
    // 📝 2026-01-13: output 전달 추가 (명령어 실행 결과)
    if (message.presentation === "tool-approval-result" && message.toolApprovalResult) {
      return (
        <div className="py-1">
          <ToolApprovalResult
            approved={message.toolApprovalResult.approved}
            command={message.toolApprovalResult.command}
            timestamp={message.toolApprovalResult.timestamp}
            yamlContent={message.toolApprovalResult.yamlContent}
            diffStats={message.toolApprovalResult.diffStats}
            filePath={message.toolApprovalResult.filePath}
            output={message.toolApprovalResult.output}
          />
        </div>
      );
    }

    // 🎯 FIX (BUG-B,C): Plan 뷰어 메시지 렌더링 - 메시지 흐름에 포함
    // 📝 2026-01-13: Plan이 생성된 위치에 표시되도록 함 (Footer 대신)
    // PlanViewerInline은 아래에서 별도 정의 (store 접근 필요)
    if (message.presentation === "plan-viewer") {
      // PlanViewer는 store 접근이 필요하므로 여기서는 placeholder만 렌더링
      // 실제 렌더링은 Virtuoso itemContent에서 처리
      return null; // itemContent에서 직접 처리
    }

    // 📝 2026-01-13: - plan-status-message 렌더링 제거
    // - 기존: PlanStatusMessage 컴포넌트로 박스형 상태 메시지 표시
    // - 수정: PlanViewer에서 이미 상태 표시, LLM 응답은 일반 메시지로 표시
    // - 불필요한 중복 UI 제거로 심플화

    if (message.role === "user") {
      return (
        <div className="py-2">
          <button
            type="button"
            className="border-input bg-background hover:bg-accent hover:text-accent-foreground h-auto w-full cursor-pointer justify-start rounded-md border text-left text-sm font-medium break-words whitespace-normal px-3 py-2"
          >
            {message.content}
          </button>
        </div>
      );
    }

    // Assistant 메시지
    return (
      <div className="flex flex-col items-start gap-2 w-full min-w-0 overflow-hidden py-1">
        <div className="flex w-full min-w-0 flex-col items-start overflow-hidden">
          <div className="flex w-full min-w-0 shrink-0 items-start overflow-hidden">
            {/* 🎯 2026-01-18: Streamdown 통일 - 스트리밍/완료 모두 동일한 렌더링 엔진 사용 */}
            {/* - 스트리밍: mode="streaming", 커서 애니메이션 활성화 */}
            {/* - 완료: mode="static", 정적 렌더링 */}
            {/* 🎯 2026-01-06: content가 비어있을 때는 표시 안 함 (하얀색 박스 방지) */}
            {/* 🎯 2026-01-30: skeleton dots는 Footer의 isWaitingForLLMResponse로 통합 */}
            {message.content.trim() && (
              <StreamingText
                content={message.content}
                isStreaming={message.status === "streaming"}
                autoScroll={message.status === "streaming"}
                className="w-full min-w-0"
              />
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-1">
          {message.status === "complete" && (
            <>
              {/* 🎯 피드백 버튼 */}
              {threadId && onFeedback && (
                <FeedbackButtons messageId={message.id} threadId={threadId} onFeedback={onFeedback} />
              )}
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 w-8 shrink-0 p-0 opacity-50 hover:opacity-100 rounded-md hover:bg-accent"
                onClick={() => onCopy(message)}
                disabled={!message.content.trim()}
              >
                {copiedMessageId === message.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">{copiedMessageId === message.id ? "Copied response" : "Copy response"}</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 🎯 커스텀 비교 함수: content, status, copiedMessageId, toolApprovalResult 비교
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.status === nextProps.message.status &&
      prevProps.message.presentation === nextProps.message.presentation &&
      prevProps.copiedMessageId === nextProps.copiedMessageId &&
      prevProps.threadId === nextProps.threadId
    );
  },
);

ChatMessageItem.displayName = "ChatMessageItem";

/**
 * 🎯 목적: 시간을 상대적 형식으로 변환 (e.g., "1h", "2d", "1w")
 *
 * @param dateString - ISO 형식 날짜 문자열
 * @returns 상대 시간 문자열
 */
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return `${diffWeeks}w`;
  } catch {
    return "";
  }
}

/**
 * 목적: AI Chat Panel Props 타입 정의
 */
interface AIChatPanelProps {
  /** MobX Store에서 패널 상태 관리 */
  store: AIChatPanelStore;
  /** Preferences Dialog를 여는 함수 */
  openPreferencesDialog: OpenPreferencesDialog;
  /** Agent Mode 제어 컨트롤러 */
  agentModeController: AgentModeController;
}

/**
 * 목적: withInjectables용 Dependencies 타입
 */
interface Dependencies {
  store: AIChatPanelStore;
  openPreferencesDialog: OpenPreferencesDialog;
  agentModeController: AgentModeController;
}

/**
 * 🎯 목적: AI Chat Panel 메인 컴포넌트
 *
 * shadcn/ui BeforeUtterance story 구조 기반:
 * - 헤더 (Title + History/Close 버튼)
 * - InputGroup (Textarea + Agent/Auto + Send)
 *
 * ⚠️  주의: 스토리북 템플릿의 디자인 토큰과 클래스명을 그대로 사용
 */
const NonInjectedAIChatPanel = observer(({ store, openPreferencesDialog, agentModeController }: AIChatPanelProps) => {
  // 목적: Store에서 상태 추출
  // 📝 2026-01-18: 수정 - isOpen, width 제외
  // ⚠️ 중요: MobX computed 값은 destructuring하면 초기값만 캡처됨
  // store.isOpen, store.width로 직접 참조해야 변경 감지 가능
  const {
    clarifyPrompt,
    clarifySubmissionPending,
    hitlPrompt,
    hitlSubmissionPending,
    toolApprovalPrompt,
    toolApprovalSubmissionPending,
    isProcessing,
  } = store;

  // 목적: 채팅 입력 상태 관리
  const [message, setMessage] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 🎯 DAIVE v2.1: 멘션 제안 목록 상태
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);

  // 🎯 DAIVE v2.1: ContextPills 상태
  const contextStore = getContextStore();
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);

  // 🎯 2026-01-06: SessionRestorePanel 상태 (USER-GUIDE.md 기능 구현)
  const [isSessionRestorePanelOpen, setIsSessionRestorePanelOpen] = useState(false);

  /**
   * 🎯 목적: store.pastChats를 SessionSummary 형태로 변환
   * 📝 주의사항: ThreadInfo와 SessionSummary 타입 매핑
   */
  const sessionsForRestore: SessionSummary[] = React.useMemo(() => {
    return store.pastChats.map((chat) => ({
      id: chat.threadId,
      title: chat.title,
      status: "active" as const,
      messageCount: chat.messageCount,
      createdAt: chat.lastUpdatedAt, // createdAt 정보가 없으므로 lastUpdatedAt 사용
      updatedAt: chat.lastUpdatedAt,
      preview: chat.lastMessage,
    }));
  }, [store.pastChats]);

  // 🎯 DAIVE v2.1: Kubernetes 리소스 Fetcher (실제 API 연결)
  const { fetchResources } = useKubernetesResourceFetcher(store.currentClusterId, store.selectedNamespace);

  // 🎯 캐시된 리소스 목록 (멘션 드롭다운용)
  const cachedResourcesRef = useRef<MentionSuggestion[]>([]);

  // 🎯 DAIVE v2.1: 슬래시 명령어 팔레트 표시 여부 (MobX로 관리)
  const isSlashPaletteOpen = slashCommandState.isOpen;
  const slashSearchQuery = slashCommandState.searchQuery;

  // 🎯 DAIVE v2.1: 멘션 자동완성 표시 여부 (MobX로 관리)
  const isMentionOpen = mentionState.isOpen;
  const mentionQuery = mentionState.query;
  const mentionPosition = mentionState.position;
  const mentionSelectedIndex = mentionState.selectedIndex;

  // 🎯 참고: autoScroll 상태 제거됨
  // - Virtuoso의 followOutput이 자동 스크롤을 내부적으로 관리
  // - 별도의 상태 관리 불필요

  // 🎯 목적: 로그 메시지 및 빈 메시지를 제외한 표시용 메시지 필터링
  // - Virtuoso의 data prop으로 사용
  // - presentation이 "log"인 메시지는 채팅 UI에 표시하지 않음
  // - 🎯 2026-01-06: 빈 content 메시지 제외 (하얀색 빈 프롬프트 박스 문제 해결)
  //   - user 메시지: content가 비어있으면 빈 버튼이 렌더링되어 보기 흉함
  //   - assistant 메시지: content가 비어있고 완료 상태면 빈 박스가 렌더링됨
  // - useMemo 제거: MobX observer가 store.messages 변경을 자동 감지
  const filteredMessages = store.messages.filter((m) => {
    // 로그 메시지 제외
    if (m.presentation === "log") return false;
    // tool-approval-result는 항상 표시 (content 비어있어도 toolApprovalResult로 렌더링)
    if (m.presentation === "tool-approval-result") return true;
    // 📝 2026-01-13: - plan-status-message 필터링 제거 (더 이상 생성하지 않음)
    // 🎯 plan-viewer도 항상 표시
    if (m.presentation === "plan-viewer") return true;
    // system 메시지: UI에 표시하지 않음 (AI 컨텍스트 주입용)
    if (m.role === "system") return false;
    // hidden-ctx: security 그룹 컨텍스트 주입용 — AI에게는 전달되지만 UI에는 숨김
    if (m.id?.startsWith("hidden-ctx-")) return false;
    // 🎯 user 메시지: 빈 content 제외 (하얀색 빈 버튼 문제 해결)
    if (m.role === "user" && !m.content.trim()) return false;
    // 🎯 assistant 메시지: 빈 content의 완료된 메시지 제외
    // 스트리밍 중인 메시지는 제외하지 않음 (아직 응답 대기 중일 수 있음)
    if (m.role === "assistant" && m.status === "complete" && !m.content.trim()) return false;
    return true;
  });

  const isClarifyActive = Boolean(clarifyPrompt);
  const isUserInputLocked = Boolean(hitlPrompt || isClarifyActive);
  const inputPlaceholder = hitlPrompt
    ? "Select approve/reject from the card above."
    : isClarifyActive
      ? "Respond to Clarify request from the card above."
      : "Ask, Search or Chat...";

  useEffect(() => {
    if (store.isOpen && store.hasApiKey) {
      void store.initializeAgent();
    }
  }, [store, store.isOpen, store.hasApiKey]);

  // 🎯 목적: Virtuoso followOutput 콜백 - 새 메시지 추가 시 자동 스크롤
  // - Virtuoso가 자체적으로 스크롤 위치를 관리
  // - 항상 "smooth" 반환하여 부드러운 스크롤 유지
  const handleFollowOutput = useCallback(() => "smooth" as const, []);

  // 🎯 목적: clarifyPrompt, hitlPrompt 등 표시 시 스크롤
  // - autoScroll을 의존성에서 제거: 상태 변경 시 불필요한 스크롤 방지
  // - Virtuoso Footer에 렌더링되므로 followOutput이 자동 처리
  useEffect(() => {
    if (virtuosoRef.current && (clarifyPrompt || hitlPrompt || toolApprovalPrompt)) {
      virtuosoRef.current.scrollToIndex({
        index: "LAST",
        behavior: "smooth",
      });
    }
  }, [clarifyPrompt, hitlPrompt, toolApprovalPrompt]);

  // 목적: Send 버튼 활성화 여부 계산
  const isSendEnabled =
    Boolean(message.trim().length) && store.agentStatus === "ready" && !isProcessing && !isUserInputLocked;

  // 🎯 목적: Copy 클릭 후 체크 아이콘 전환 상태 관리
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedMessageId) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopiedMessageId(null), 2000);

    return () => window.clearTimeout(timer);
  }, [copiedMessageId]);

  // 🎯 목적: 패널 닫기 핸들러 (애니메이션 제거됨)
  // 📝 2026-01-20: 수정 - 애니메이션 완전 제거
  const handleClose = () => {
    store.toggle();
  };

  // 🎯 2026-01-18: Issue 2 - 패널 열림 시 메인 콘텐츠 밀기
  // CSS 변수를 통해 #app에 padding-right 적용
  // 📝 2026-01-18: 수정 - store.isOpen, store.width 직접 참조
  // 📝 2026-01-20: - isAnimating 조건 제거
  useEffect(() => {
    const root = document.documentElement;

    if (store.isOpen) {
      // 패널이 열려있을 때 CSS 변수 설정
      root.style.setProperty("--ai-panel-width", `${store.width}px`);
      root.style.setProperty("--ai-panel-open", "1");
    } else {
      // 패널이 닫혀있을 때 제거
      root.style.setProperty("--ai-panel-width", "0px");
      root.style.setProperty("--ai-panel-open", "0");
    }

    // Cleanup: 컴포넌트 언마운트 시 초기화
    return () => {
      root.style.setProperty("--ai-panel-width", "0px");
      root.style.setProperty("--ai-panel-open", "0");
    };
  }, [store.isOpen, store.width]);

  // 디버깅: isSendEnabled 상태 추적
  useEffect(() => {
    console.log("[AIChatPanel] 📤 Send 버튼 상태:", {
      isSendEnabled,
      hasMessage: message.trim().length > 0,
      agentStatus: store.agentStatus,
    });
  }, [isSendEnabled, message, store.agentStatus]);

  // 🎯 목적: ESC 키로 현재 실행 중인 AI 작업 취소
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && store.isProcessing) {
        event.preventDefault();
        console.log("[AIChatPanel] ESC 키로 작업 취소");
        void store.cancelCurrentExecution();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  // 🎯 목적: Stop 버튼 클릭 핸들러
  const handleStop = () => {
    console.log("[AIChatPanel] Stop 버튼 클릭");
    void store.cancelCurrentExecution();
  };

  /**
   * 🎯 목적: 메시지 전송 핸들러
   *
   * 📝 2026-01-07: 수정
   * - attachedContexts: 사용자가 선택한 컨텍스트 리소스 전달
   * - slashCommand: 슬래시 명령어 정보 및 행동 지침 전달
   * - 전송 후 컨텍스트 클리어 (일회성 사용)
   */
  const handleSend = async () => {
    if (!isSendEnabled || isUserInputLocked) {
      return;
    }

    const text = message.trim();
    // 🎯 전송 전에 현재 선택된 컨텍스트 복사 (전송 후 클리어를 위해)
    const currentContexts = [...contextStore.attachedContexts];

    // 🎯 슬래시 명령어 파싱 (메시지가 /로 시작하면)
    let slashCommandInfo: SlashCommandInfo | undefined;
    const parsedCommand = parseSlashCommandInput(text);
    if (parsedCommand && parsedCommand.command) {
      const foundCommand = getSlashCommandByName(parsedCommand.command);
      if (foundCommand) {
        // 🎯 2026-01-29: 특수 명령어 즉시 실행 (Tab 자동완성 후 Enter 시에도 동작)
        // /clear, /new, /help 명령어는 AI에게 전송하지 않고 즉시 로컬에서 실행
        if (foundCommand.id === SlashCommandId.CLEAR) {
          setMessage("");
          store.clearMessages();
          console.log("[AIChatPanel] 대화 클리어 (handleSend)");
          return;
        }
        if (foundCommand.id === SlashCommandId.NEW) {
          setMessage("");
          store.startNewChat();
          console.log("[AIChatPanel] 새 대화방 시작 (handleSend)");
          return;
        }

        // 🎯 슬래시 명령어 behavior 완전 전달 (7개 필드 모두)
        // 📝 이전: purpose, workflow, actions, allowedTools만 전달 (4개)
        // 📝 수정: outputFormat, options, examples, relatedCommands 추가 (7개 전체)
        slashCommandInfo = {
          commandId: foundCommand.id,
          commandName: foundCommand.name,
          behavior: foundCommand.behavior
            ? {
                purpose: foundCommand.behavior.purpose,
                workflow: foundCommand.behavior.workflow?.map((step) => ({
                  step: step.step,
                  name: step.name,
                  description: step.description,
                })),
                actions: foundCommand.behavior.actions,
                allowedTools: foundCommand.behavior.allowedTools,
                // 🆕 누락된 4개 필드 추가
                outputFormat: foundCommand.behavior.outputFormat,
                options: foundCommand.behavior.options?.map((opt) => ({
                  name: opt.name,
                  description: opt.description,
                  defaultValue: opt.defaultValue,
                })),
                examples: foundCommand.behavior.examples,
                relatedCommands: foundCommand.behavior.relatedCommands,
                expertPanel: foundCommand.behavior.expertPanel,
              }
            : undefined,
        };
        console.log(`[AIChatPanel] 슬래시 명령어 감지: ${foundCommand.name}`, slashCommandInfo.behavior?.purpose);
      }
    }

    setMessage("");

    try {
      // 🎯 attachedContexts와 slashCommand를 함께 전달
      await store.sendMessage(
        text,
        currentContexts.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          namespace: c.namespace,
        })),
        slashCommandInfo,
      );

      // 🎯 2026-01-07: 수정 - 컨텍스트 자동 클리어 제거
      // 사용자가 수동으로 제거하기 전까지 선택한 리소스 유지
      // 이전: contextStore.clearContexts();
    } catch (error) {
      console.error("[AIChatPanel] 메시지 전송 실패", error);
    }
  };

  const handleToolApproval = async (value: string) => {
    try {
      await store.submitToolApproval(value);
    } catch (error) {
      console.error("[AIChatPanel] Tool 승인 응답 실패", error);
    }
  };

  const handleClarifySuggestion = async (value: ClarifySuggestion) => {
    try {
      const submission = buildClarifySubmissionFromSuggestion(value);
      store.logClarifySubmit(submission);
      await store.submitClarifyAnswer(submission);
    } catch (error) {
      console.error("[AIChatPanel] Clarify 제안 응답 실패", error);
    }
  };

  const handleClarifyManual = async (value: string) => {
    try {
      const submission = buildClarifySubmissionFromText(value);
      store.logClarifySubmit(submission);
      await store.submitClarifyAnswer(submission);
    } catch (error) {
      console.error("[AIChatPanel] Clarify 직접 입력 응답 실패", error);
    }
  };

  const handleHitlDecision = async (decision: string) => {
    try {
      await store.submitHitlDecision(decision);
    } catch (error) {
      console.error("[AIChatPanel] HITL 응답 제출 실패", error);
    }
  };

  // ============================================
  // 🎯 DAIVE v2.1: 슬래시 명령어 & 멘션 핸들러
  // ============================================

  /**
   * 🎯 목적: 텍스트 입력 시 슬래시 명령어/멘션 감지
   * 실제 Kubernetes API를 사용하여 리소스 목록을 가져옵니다.
   */
  const handleInputChange = useCallback(
    async (value: string) => {
      setMessage(value);

      // 🎯 슬래시 명령어 감지 (입력이 /로 시작하면)
      if (value.startsWith("/")) {
        slashCommandState.detectSlashInput(value);
      } else if (slashCommandState.isOpen) {
        slashCommandState.closePalette();
      }

      // 🎯 멘션 감지 (@가 입력되면)
      if (textareaRef.current) {
        const cursorPosition = textareaRef.current.selectionStart;
        const rect = textareaRef.current.getBoundingClientRect();
        // 드롭다운 위치 계산 (Textarea 위에 표시)
        const position = {
          top: rect.top - 200, // Textarea 위로 200px
          left: rect.left,
        };
        mentionState.detectMentionTrigger(value, cursorPosition, position);

        // 멘션 열려있으면 제안 목록 업데이트 (실제 Kubernetes API 호출)
        if (mentionState.isOpen) {
          // 🎯 캐시가 비어있으면 API 호출하여 리소스 로드
          if (cachedResourcesRef.current.length === 0) {
            try {
              const resources = await fetchResources();
              cachedResourcesRef.current = resources;
              console.log(`[AIChatPanel] ${resources.length}개 리소스 로드됨`);
            } catch (error) {
              console.error("[AIChatPanel] 리소스 로드 실패:", error);
            }
          }

          // 🎯 검색어로 필터링
          const searchQuery = mentionState.searchQuery.toLowerCase();
          const filteredSuggestions = cachedResourcesRef.current
            .filter((s) => s.name.toLowerCase().includes(searchQuery) || s.type.toLowerCase().includes(searchQuery))
            .slice(0, 10); // 최대 10개

          setMentionSuggestions(filteredSuggestions);
        } else {
          // 멘션이 닫히면 캐시 클리어 (30초 후 자동 갱신을 위해)
          // cachedResourcesRef.current = []; // 선택: 즉시 클리어하지 않음 (성능)
        }
      }
    },
    [fetchResources],
  );

  /**
   * 🎯 목적: 슬래시 명령어 선택 핸들러
   * 특수 명령어는 즉시 실행하고, 나머지는 메시지로 설정합니다.
   */
  const handleSlashCommandSelect = useCallback(
    (command: SlashCommand) => {
      slashCommandState.closePalette();

      // 🎯 특수 명령어 즉시 실행
      switch (command.id) {
        case SlashCommandId.CLEAR: {
          // 🎯 2026-01-29: 대화 클리어 - Thread ID 유지, 메시지만 삭제
          store.clearMessages();
          console.log("[AIChatPanel] 대화가 클리어되었습니다 (Thread 유지).");
          return;
        }

        case SlashCommandId.NEW: {
          // 🎯 새 대화방: 새 Thread ID 생성
          store.startNewChat();
          console.log("[AIChatPanel] 새 대화방이 시작되었습니다.");
          return;
        }

        default: {
          // 🎯 2026-01-07: 수정 - Tab 완성 시 입력창에만 채우기
          // 📝 올바른 흐름: Tab → 명령어 자동완성 → 사용자가 프롬프트 추가 입력 → Enter로 전송
          // 📝 명령어 뒤에 공백 추가하여 사용자가 바로 프롬프트 입력 가능하도록 함
          const commandMessage = `${command.name} `;
          console.log(`[AIChatPanel] 슬래시 명령어 입력창에 채우기: ${commandMessage}`);
          setMessage(commandMessage);
          // 입력창에 포커스 유지하고 커서를 끝으로 이동
          setTimeout(() => {
            textareaRef.current?.focus();
            const len = commandMessage.length;
            textareaRef.current?.setSelectionRange(len, len);
          }, 0);
        }
      }
    },
    [store],
  );

  /**
   * 🎯 목적: 슬래시 명령어 자동완성 핸들러 (Tab 전용)
   *
   * 📝 2026-01-28: Tab과 Enter 동작 분리
   * - Tab: 입력창에 명령어만 채우기 (실행 안함)
   * - Enter/클릭: handleSlashCommandSelect → 특수 명령어 즉시 실행
   *
   * 🔄 변경이력: 2026-01-28 - Tab 자동완성 버그 수정
   * - 이전: Tab 시 /help 명령어가 도움말 텍스트와 함께 전송됨
   * - 수정: Tab 시 입력창에 명령어만 채우고 실행하지 않음
   */
  const handleSlashCommandAutoComplete = useCallback((command: SlashCommand) => {
    slashCommandState.closePalette();

    // 🎯 Tab 자동완성: 모든 명령어를 입력창에만 채움 (실행 안함)
    const commandMessage = `${command.name} `;
    console.log(`[AIChatPanel] Tab 자동완성: ${commandMessage}`);
    setMessage(commandMessage);

    // 입력창에 포커스 유지하고 커서를 끝으로 이동
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = commandMessage.length;
      textareaRef.current?.setSelectionRange(len, len);
    }, 0);
  }, []);

  /**
   * 🎯 목적: 멘션 선택 핸들러
   */
  const handleMentionSelect = useCallback(
    (suggestion: MentionSuggestion) => {
      // 현재 메시지에서 @ 부분을 선택한 리소스로 교체
      const triggerIndex = mentionState.triggerIndex;
      const beforeAt = message.slice(0, triggerIndex);
      const afterQuery = message.slice(triggerIndex + 1 + mentionState.query.length);
      const newMessage = `${beforeAt}@${suggestion.type}:${suggestion.name}${afterQuery} `;
      setMessage(newMessage);
      mentionState.closeMention();
      textareaRef.current?.focus();
    },
    [message],
  );

  // ============================================
  // 🎯 DAIVE v2.1: ContextPills 핸들러
  // ============================================

  /**
   * 🎯 목적: 컨텍스트 추가 버튼 클릭 핸들러
   * 📝 2026-01-07: 수정 - 클러스터 연결 없이도 모달은 열리지만 메시지 표시
   */
  const handleContextAdd = useCallback(() => {
    // 🎯 클러스터 연결 확인 (로그만, 모달은 항상 열림)
    if (!store.currentClusterId) {
      console.log("[AIChatPanel] 클러스터 연결 없음 - 리소스 조회 불가");
    }
    setIsContextPickerOpen(true);
  }, [store.currentClusterId]);

  /**
   * 🎯 목적: 컨텍스트 삭제 핸들러
   */
  const handleContextRemove = useCallback(
    (id: string) => {
      contextStore.removeContext(id);
    },
    [contextStore],
  );

  /**
   * 🎯 목적: 컨텍스트 선택 완료 핸들러 (모달에서 선택 후)
   */
  const handleContextSelect = useCallback(
    (selected: ContextItem | ContextItem[]) => {
      if (Array.isArray(selected)) {
        contextStore.addContexts(selected);
      } else {
        contextStore.addContext(selected);
      }
      setIsContextPickerOpen(false);
    },
    [contextStore],
  );

  /**
   * 🎯 목적: 컨텍스트 피커용 리소스 fetcher
   * 🔄 2026-01-06: ResourceQuery 인터페이스 호환성 수정
   * 🔄 2026-01-07: 수정 - kubectl 복수형 타입 매핑 추가
   *
   * @param query - 리소스 쿼리 (types, search, namespace 포함)
   * @returns ContextItem[] - createdAt 필드 포함
   */
  const contextPickerFetcher = useCallback(
    async (query: { types: ContextTypeValue[]; search?: string }) => {
      // 🎯 2026-01-07: - ContextType → kubectl 리소스 타입 매핑
      // kubectl은 복수형 사용 (pod → pods, deployment → deployments)
      const typeToKubectl: Record<string, string> = {
        pod: "pods",
        deployment: "deployments",
        service: "services",
        configmap: "configmaps",
        secret: "secrets",
        node: "nodes",
        namespace: "namespaces",
        ingress: "ingresses",
        pvc: "persistentvolumeclaims",
        statefulset: "statefulsets",
        daemonset: "daemonsets",
        replicaset: "replicasets",
        job: "jobs",
        cronjob: "cronjobs",
      };

      try {
        // 🎯 디버깅: 클러스터 연결 상태 로그
        console.log("[AIChatPanel] contextPickerFetcher 호출:", {
          types: query.types,
          search: query.search,
          clusterId: store.currentClusterId,
        });

        // 🎯 타입별로 리소스 조회 (useKubernetesResourceFetcher는 단일 타입 필터만 지원)
        const allResources: ContextItem[] = [];

        for (const type of query.types) {
          // 🎯 2026-01-07: - kubectl 복수형 타입으로 변환
          const kubectlType = typeToKubectl[type] ?? type;
          console.log(`[AIChatPanel] 리소스 조회: ${type} → ${kubectlType}`);

          const resources = await fetchResources(kubectlType);
          console.log(`[AIChatPanel] ${kubectlType} 조회 결과: ${resources.length}개`);

          for (const r of resources) {
            allResources.push({
              id: r.id,
              type: r.type,
              name: r.name,
              namespace: r.namespace,
              createdAt: new Date(), // 기본값 (실제 생성 시간은 API에서 제공 안함)
            });
          }
        }

        // 🎯 검색어 필터링
        if (query.search) {
          const searchLower = query.search.toLowerCase();
          return allResources.filter((r) => r.name.toLowerCase().includes(searchLower));
        }

        console.log(`[AIChatPanel] 총 리소스 수: ${allResources.length}개`);
        return allResources;
      } catch (error) {
        console.error("[AIChatPanel] 컨텍스트 리소스 로드 실패:", error);
        return [];
      }
    },
    [fetchResources, store.currentClusterId],
  );

  // ============================================
  // 🎯 2026-01-06: SessionRestorePanel 핸들러
  // ============================================
  // 📝 2026-01-07: handleOpenSessionRestorePanel 제거 (- Sessions 버튼 제거)

  /**
   * 🎯 목적: 세션 선택 핸들러 (SessionSummary → threadId 변환)
   */
  const handleSelectSessionForRestore = useCallback(
    (session: SessionSummary) => {
      store.selectPastChat(session.id);
      setIsSessionRestorePanelOpen(false);
    },
    [store],
  );

  /**
   * 🎯 목적: 세션 삭제 핸들러
   */
  const handleDeleteSessionForRestore = useCallback(
    (sessionId: string) => {
      void store.deletePastChat(sessionId);
    },
    [store],
  );

  /**
   * 🎯 목적: 새 세션 생성 핸들러
   */
  const handleCreateNewSessionFromRestore = useCallback(() => {
    store.startNewChat();
    setIsSessionRestorePanelOpen(false);
  }, [store]);

  /**
   * 🎯 목적: 채팅 입력 Textarea 키 처리
   * - Enter: 전송
   * - Shift/Alt/Meta + Enter: 줄바꿈 삽입
   */
  const handleTextareaKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 🎯 슬래시 팔레트가 열려있으면 키보드 네비게이션 처리
    if (slashCommandState.isOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        slashCommandState.moveSelection("down");
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        slashCommandState.moveSelection("up");
        return;
      }
      // 🎯 2026-01-06: Tab 자동완성 추가 (UX 개선)
      // 📝 2026-01-28: Tab과 Enter 동작 분리
      // - Tab: 입력창에 명령어만 채움 (실행 안함)
      // - Enter: 명령어 실행 (특수 명령어는 즉시 실행)
      if (event.key === "Tab" && slashCommandState.currentCommand) {
        event.preventDefault();
        handleSlashCommandAutoComplete(slashCommandState.currentCommand);
        return;
      }
      if (event.key === "Enter" && slashCommandState.currentCommand) {
        event.preventDefault();
        handleSlashCommandSelect(slashCommandState.currentCommand);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        slashCommandState.closePalette();
        return;
      }
    }

    // 🎯 멘션이 열려있으면 키보드 네비게이션 처리
    if (mentionState.isOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        mentionState.moveSelection("down", mentionSuggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        mentionState.moveSelection("up", mentionSuggestions.length);
        return;
      }
      if (event.key === "Enter" && mentionSuggestions[mentionState.selectedIndex]) {
        event.preventDefault();
        handleMentionSelect(mentionSuggestions[mentionState.selectedIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        mentionState.closeMention();
        return;
      }
    }
    if (event.key !== "Enter") {
      return;
    }

    // Alt/Option 또는 Meta(Command) + Enter: 줄바꿈 직접 삽입 (플랫폼별 기본 동작 누락 방지)
    if (event.altKey || event.metaKey) {
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart, selectionEnd } = target;
      const next = message.slice(0, selectionStart) + "\n" + message.slice(selectionEnd);

      setMessage(next);
      // React 상태 업데이트 후 커서 위치 복구
      requestAnimationFrame(() => {
        target.setSelectionRange(selectionStart + 1, selectionStart + 1);
      });
      return;
    }

    // Shift + Enter: 기본 줄바꿈 허용
    if (event.shiftKey || event.ctrlKey) {
      return;
    }

    // 기본 Enter: 전송
    event.preventDefault();
    await handleSend();
  };

  // 🎯 목적: AI 응답 복사 시 차트 데이터(code fence 기반)를 제외하고 클립보드에 기록
  // 🎯 피드백 제출 핸들러
  const handleFeedback = useCallback(
    (
      messageId: string,
      threadId: string,
      rating: "positive" | "negative",
      category?: FeedbackCategory,
      detail?: string,
    ) => {
      store.submitFeedback(messageId, threadId, rating, category, detail);
    },
    [store],
  );

  const copyAssistantMessage = (entry: ChatMessage) => {
    const sanitized = entry.content.replace(/```(?:chart|chart-data)[\s\S]*?```/gi, "").trim();

    if (!sanitized) {
      return;
    }

    clipboard.writeText(sanitized);
    setCopiedMessageId(entry.id);
  };

  // 패널이 닫혀있으면 렌더링하지 않음
  // 📝 2026-01-18: 수정 - store.isOpen 직접 참조
  // 📝 2026-01-20: - isAnimating 조건 제거
  if (!store.isOpen) {
    return null;
  }

  // 🎯 목적: Wrapper + Content 분리 (Sidebar 패턴 적용으로 ResizeHandle 작동)
  // - Wrapper: fixed 위치 + flex row (ResizeHandle과 aside를 형제로 배치)
  // - Content: flex-col + 스타일 (실제 패널 콘텐츠)
  // 📝 2026-01-18: 수정
  // - 문제: CSS 변수가 inline style에서 제대로 적용되지 않음
  // - 해결: 고정값 사용 (TopBar 40px, StatusBar 24px)
  // - height: calc로 명시적 높이 계산하여 StatusBar 영역 확보
  const panelWrapperClass = "AIChatPanelWrapper fixed right-0 z-50 flex";
  const panelWrapperStyle: React.CSSProperties = {
    // 🎯 고정값으로 StatusBar 영역 확보
    // - top: TopBar 높이 (40px)
    // - height: viewport 높이 - TopBar - StatusBar = calc(100vh - 64px)
    // - bottom 대신 height 사용으로 명확한 크기 지정
    top: 40,
    height: "calc(100vh - 40px - 24px)",
  };
  // 🎯 FIX-042: bg-sidebar 클래스 + 인라인 스타일로 배경색 강제 적용
  const panelContentClass = "border-border flex-1 flex flex-col border-l p-4 shadow-lg min-w-0 overflow-hidden";
  const panelContentStyle = { backgroundColor: "var(--sidebar)" };

  // 목적: 조건부 렌더링 - API key 없으면 Settings UI, 있으면 Chat UI
  // 📝 2026-01-18: 수정 - store.width 직접 참조
  if (!store.hasApiKey) {
    return (
      <div className={`${panelWrapperClass}`} style={{ ...panelWrapperStyle, width: `${store.width}px` }}>
        {/* 🎯 목적: 리사이즈 핸들 - 형제로 배치, 실시간 저장 (Sidebar 패턴) */}
        <ResizeHandle
          orientation="horizontal"
          getCurrent={() => store.width}
          min={store.minWidth}
          max={store.maxWidth}
          onResize={(newWidth) => {
            store.width = newWidth;
          }}
          onDoubleClick={() => {
            store.width = store.defaultWidth;
          }}
          invertDelta={true}
        />
        <AiAssistantSettings
          onClose={handleClose}
          onSetupClick={() => openPreferencesDialog("LLM Models")}
          className={panelContentClass}
          style={panelContentStyle}
        />
      </div>
    );
  }

  // 📝 2026-01-18: 수정 - store.width 직접 참조
  if (store.messages.length === 0) {
    return (
      <div className={`${panelWrapperClass}`} style={{ ...panelWrapperStyle, width: `${store.width}px` }}>
        {/* 🎯 목적: 리사이즈 핸들 - 형제로 배치, 실시간 저장 (Sidebar 패턴) */}
        <ResizeHandle
          orientation="horizontal"
          getCurrent={() => store.width}
          min={store.minWidth}
          max={store.maxWidth}
          onResize={(newWidth) => {
            store.width = newWidth;
          }}
          onDoubleClick={() => {
            store.width = store.defaultWidth;
          }}
          invertDelta={true}
        />
        <aside className={panelContentClass} style={panelContentStyle}>
          {/* 🎯 2026-01-17: Root Frame Migration - ChatHeader 컴포넌트 */}
          {/* 📝 2026-01-18: Issue 4 - maxClusters 제거 (동적 처리) */}
          <ChatHeader
            connectedClusters={store.connectedClusters}
            selectedClusterIds={store.selectedClusterIds}
            onToggleCluster={(id) => store.toggleClusterSelection(id)}
            onSelectSingle={(id) => store.selectSingleCluster(id)}
            pastChats={store.pastChats}
            isPastChatsLoading={store.isPastChatsLoading}
            onLoadPastChats={() => store.loadPastChats()}
            onSelectPastChat={(threadId) => store.selectPastChat(threadId)}
            onNewChat={() => store.startNewChat()}
            onOpenSettings={() => openPreferencesDialog("LLM Models")}
            onClose={handleClose}
          />

          {/* 🎯 목적: Chat / Alerts 탭 (빈 상태) */}
          <Tabs
            value={store.activeTab}
            onValueChange={(value) => store.selectTab(value as "chat" | "alerts")}
            className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden"
          >
            {isFeatureEnabled("CLUSTER_MONITOR") && (
              <TabsList className="w-full shrink-0">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="alerts" className="gap-1">
                  Alerts
                  {monitorState.unacknowledgedCount > 0 && (
                    <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                      {monitorState.unacknowledgedCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-0">
              {/* 🎯 2026-01-17: 클러스터 미선택 시 안내 프롬프트 */}
              {store.selectedClusterIds.size === 0 && (
                <ClusterSelectionPrompt
                  connectedClusters={store.connectedClusters}
                  selectedClusterIds={store.selectedClusterIds}
                  onToggleCluster={(id) => store.toggleClusterSelection(id)}
                  onSelectSingle={(id) => store.selectSingleCluster(id)}
                  className="mx-1"
                />
              )}

              {/* Spacer: 입력창 하단 고정 */}
              <div className="flex-1 min-h-0" />

              {/* 🎯 2026-01-18: - InputGroup 공통 컴포넌트 */}
              <InputGroup
                message={message}
                textareaRef={textareaRef}
                isProcessing={isProcessing}
                isSendEnabled={isSendEnabled}
                store={store}
                attachedContexts={contextStore.attachedContexts}
                onInputChange={handleInputChange}
                onKeyDown={handleTextareaKeyDown}
                onSend={handleSend}
                onStop={handleStop}
                onContextRemove={handleContextRemove}
                onContextAdd={handleContextAdd}
                isSlashPaletteOpen={isSlashPaletteOpen}
                slashSearchQuery={slashSearchQuery}
                onSlashClose={() => slashCommandState.closePalette()}
                onSlashSelect={handleSlashCommandSelect}
                onSlashAutoComplete={handleSlashCommandAutoComplete}
                onSlashSearchChange={(q) => slashCommandState.setSearchQuery(q)}
                isMentionOpen={isMentionOpen}
                mentionPosition={mentionPosition}
                mentionQuery={mentionQuery}
                mentionSuggestions={mentionSuggestions}
                mentionSelectedIndex={mentionSelectedIndex}
                onMentionSelect={handleMentionSelect}
                onMentionClose={() => mentionState.closeMention()}
                onMentionNavigate={(dir) => mentionState.moveSelection(dir, mentionSuggestions.length)}
              />
            </TabsContent>

            {isFeatureEnabled("CLUSTER_MONITOR") && (
              <TabsContent value="alerts" className="flex-1 min-h-0 mt-0 overflow-hidden">
                <AlertsTabContent store={store} />
              </TabsContent>
            )}
          </Tabs>
        </aside>

        {/* 🎯 2026-01-07: 해결 - 빈 대화방에서도 ContextPickerModal 렌더링 */}
        {/* 📝 문제: 빈 대화방에서 Add 클릭 시 모달이 안 열림 (대화 있는 상태에만 Modal 있었음) */}
        <ContextPickerModal
          isOpen={isContextPickerOpen}
          onClose={() => setIsContextPickerOpen(false)}
          onSelect={handleContextSelect}
          fetcher={contextPickerFetcher}
          isClusterConnected={!!store.currentClusterId}
        />
      </div>
    );
  }

  // 📝 2026-01-18: 수정 - store.width 직접 참조
  return (
    <div className={`${panelWrapperClass}`} style={{ ...panelWrapperStyle, width: `${store.width}px` }}>
      {/* 🎯 목적: 리사이즈 핸들 - 형제로 배치, 실시간 저장 (Sidebar 패턴) */}
      <ResizeHandle
        orientation="horizontal"
        getCurrent={() => store.width}
        min={store.minWidth}
        max={store.maxWidth}
        onResize={(newWidth) => {
          store.width = newWidth;
        }}
        onDoubleClick={() => {
          store.width = store.defaultWidth;
        }}
        invertDelta={true}
      />
      <aside className={panelContentClass} style={panelContentStyle}>
        {/* 🎯 목적: 헤더 섹션 */}
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-lg leading-7 font-semibold">DAIVE Assistant</h3>

            <div className="flex items-center">
              {/* History 드롭다운 */}
              <DropdownMenu onOpenChange={(open) => open && store.loadPastChats()}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 p-0 opacity-70 hover:opacity-100">
                    <History className="h-4 w-4" />
                    <span className="sr-only">History</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                  {store.isPastChatsLoading ? (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground">Loading...</span>
                    </DropdownMenuItem>
                  ) : store.pastChats.length === 0 ? (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground">No past chats</span>
                    </DropdownMenuItem>
                  ) : (
                    store.pastChats.map((chat) => (
                      <DropdownMenuItem
                        key={chat.threadId}
                        onClick={() => store.selectPastChat(chat.threadId)}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="text-sm font-medium truncate w-full">{chat.title}</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(chat.lastUpdatedAt)}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* New Chat 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => store.startNewChat()}
                className="h-8 w-8 shrink-0 p-0 opacity-70 hover:opacity-100"
                title="New Chat"
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">New Chat</span>
              </Button>

              {/* 🎯 Settings 버튼 (MCP 설정 등 AI 관련 설정) */}
              {/* 🔄 변경이력: 2026-01-06 - 초기 추가 (USER-GUIDE.md 기능 구현) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openPreferencesDialog("LLM Models")}
                className="h-8 w-8 shrink-0 p-0 opacity-70 hover:opacity-100"
                title="AI Settings"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">AI Settings</span>
              </Button>

              {/* Close 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 shrink-0 p-0 opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close AI Assistant</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 🎯 목적: Chat / Alerts 탭 */}
        <Tabs
          value={store.activeTab}
          onValueChange={(value) => store.selectTab(value as "chat" | "alerts")}
          className="flex-1 min-h-0 flex flex-col"
        >
          {isFeatureEnabled("CLUSTER_MONITOR") && (
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="alerts" className="gap-1">
                Alerts
                {monitorState.unacknowledgedCount > 0 && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                    {monitorState.unacknowledgedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col mt-0">
            {/* 🎯 목적: AI 응답 섹션 (react-virtuoso 가상화 적용) */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <Virtuoso
                ref={virtuosoRef}
                data={filteredMessages}
                followOutput={handleFollowOutput}
                className="h-full"
                style={{ overscrollBehavior: "contain" }}
                itemContent={(index, message) => {
                  // 🎯 FIX (BUG-B,C): Plan 뷰어 메시지는 직접 PlanViewer 렌더링
                  // 📝 2026-01-13: Plan이 생성된 위치에 표시되도록 함 (Footer 대신)
                  // 📝 2026-01-13: 해결 - planSnapshot 전달로 Plan 독립성 확보
                  if (message.presentation === "plan-viewer") {
                    return (
                      <div className="py-2">
                        <PlanViewer
                          onApprove={() => store.submitPlanApproval("approve")}
                          onReject={() => store.submitPlanApproval("reject")}
                          conversationId={store.conversationId}
                          planSnapshot={message.planSnapshot}
                        />
                      </div>
                    );
                  }

                  return (
                    <ChatMessageItem
                      message={message}
                      copiedMessageId={copiedMessageId}
                      onCopy={copyAssistantMessage}
                      threadId={store.conversationId}
                      onFeedback={handleFeedback}
                    />
                  );
                }}
                components={{
                  // 🎯 Footer: ThinkingIndicator, AgentProgress, NodeProgress, Clarify, HITL, ToolApproval 카드
                  // 메시지 목록 아래에 렌더링되며 스크롤 영역에 포함됨
                  // 📝 2026-01-13: PlanViewer는 Footer에서 제거됨 (BUG-B,C 수정)
                  // - Plan은 이제 메시지 목록에 포함되어 생성 위치에 표시됨
                  Footer: () => (
                    <div className="flex flex-col gap-4 pr-4 pb-4">
                      {/* 🎯 Expert Debate Panel - 전문가 토론 과정 실시간 시각화 */}
                      {isFeatureEnabled("SKILL_EXPERT") && <ExpertDebatePanel />}

                      {/* 🎯 FR-002: ThinkingIndicator 통합 - AI 추론 과정 시각화 */}
                      {thinkingState.isThinking && <ThinkingIndicator />}

                      {/* 🎯 FR-004: AgentProgress 통합 - Agent Mode 진행 상황 표시 */}
                      {agentModeState.isActive && <AgentProgress controller={agentModeController} />}

                      {/* 🎯 2026-01-30: LLM 응답 대기 중 skeleton dots 표시
                      - isWaitingForLLMResponse: Tool/Clarify/HITL 승인 후 LLM 응답 생성 중
                      - streaming + empty content: LLM이 문서 작성 시작 전 (사용자에게 진행 표시) */}
                      {(store.isWaitingForLLMResponse ||
                        (store.messages.at(-1)?.status === "streaming" && !store.messages.at(-1)?.content?.trim())) && (
                        <div className="flex items-center gap-1 py-1">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/60 animate-bounce"></span>
                        </div>
                      )}

                      {/* 🎯 목적: 노드 진행 상황 카드 (사용자 질문 아래 표시) */}
                      {store.nodeProgress.isActive && (
                        <NodeProgressCard
                          currentStep={store.nodeProgress.currentStep}
                          completedSteps={store.nodeProgress.completedSteps}
                          isExpanded={store.nodeProgress.isExpanded}
                          onToggle={() => store.toggleNodeProgress()}
                          isRunning={store.isProcessing}
                        />
                      )}

                      {clarifyPrompt && (
                        <Clarify
                          prompt={clarifyPrompt.prompt}
                          suggestions={clarifyPrompt.suggestions}
                          missingSlots={clarifyPrompt.missingSlots}
                          attempts={clarifyPrompt.attempts}
                          slotDetails={clarifyPrompt.slotDetails}
                          collectedValues={clarifyPrompt.collectedValues}
                          latestRawInput={clarifyPrompt.latestRawInput}
                          lastInputMode={clarifyPrompt.lastInputMode}
                          isSubmitting={clarifySubmissionPending || isProcessing}
                          onSelectSuggestion={handleClarifySuggestion}
                          onSubmitManual={handleClarifyManual}
                        />
                      )}

                      {hitlPrompt && (
                        <HitlApproval
                          question={hitlPrompt.question}
                          approveLabel={hitlPrompt.approveLabel}
                          rejectLabel={hitlPrompt.rejectLabel}
                          isSubmitting={hitlSubmissionPending || isProcessing}
                          onApprove={() => handleHitlDecision(SUPERVISOR_HITL_OPTIONS.APPROVE)}
                          onReject={() => handleHitlDecision(SUPERVISOR_HITL_OPTIONS.REJECT)}
                        />
                      )}

                      {/* 🎯 2026-01-06: 기존 ToolApprovalPrompt 제거 - 입력창 위로 이동 */}
                    </div>
                  ),
                }}
              />
            </div>

            {/* 🎯 2026-01-06: Cursor AI 스타일 - 승인 UI를 입력창 바로 위에 표시 */}
            {toolApprovalPrompt && (
              <div className="mb-2">
                {/* 🎯 2026-01-06: approval이 있으면 Diff UI, 없으면 컴팩트 UI */}
                {toolApprovalPrompt.approval?.diff ? (
                  <ToolApprovalDiff
                    approval={toolApprovalPrompt.approval}
                    onApprove={() => {
                      const approveOption =
                        toolApprovalPrompt.options.find(
                          (opt) => opt.toLowerCase() === "yes" || opt.toLowerCase() === "approve",
                        ) ?? toolApprovalPrompt.options[0];
                      handleToolApproval(approveOption);
                    }}
                    onReject={() => {
                      const rejectOption =
                        toolApprovalPrompt.options.find(
                          (opt) => opt.toLowerCase() === "no" || opt.toLowerCase() === "reject",
                        ) ??
                        toolApprovalPrompt.options[1] ??
                        "Reject";
                      handleToolApproval(rejectOption);
                    }}
                    isSubmitting={toolApprovalSubmissionPending || isProcessing}
                  />
                ) : (
                  <ToolApprovalCompact
                    question={toolApprovalPrompt.question}
                    options={toolApprovalPrompt.options}
                    requestString={toolApprovalPrompt.requestString}
                    actionSummary={toolApprovalPrompt.actionSummary}
                    stdin={toolApprovalPrompt.stdin}
                    isSubmitting={toolApprovalSubmissionPending || isProcessing}
                    onSelect={handleToolApproval}
                  />
                )}
              </div>
            )}

            {/* 🎯 2026-01-18: - InputGroup 공통 컴포넌트 */}
            {/* 📝 2026-01-28: Tab과 Enter 동작 분리 - onSlashAutoComplete 추가 */}
            <InputGroup
              message={message}
              textareaRef={textareaRef}
              isProcessing={isProcessing}
              isSendEnabled={isSendEnabled}
              isUserInputLocked={isUserInputLocked}
              placeholder={inputPlaceholder}
              store={store}
              attachedContexts={contextStore.attachedContexts}
              onInputChange={handleInputChange}
              onKeyDown={handleTextareaKeyDown}
              onSend={handleSend}
              onStop={handleStop}
              onContextRemove={handleContextRemove}
              onContextAdd={handleContextAdd}
              isSlashPaletteOpen={isSlashPaletteOpen}
              slashSearchQuery={slashSearchQuery}
              onSlashClose={() => slashCommandState.closePalette()}
              onSlashSelect={handleSlashCommandSelect}
              onSlashAutoComplete={handleSlashCommandAutoComplete}
              onSlashSearchChange={(q) => slashCommandState.setSearchQuery(q)}
              isMentionOpen={isMentionOpen}
              mentionPosition={mentionPosition}
              mentionQuery={mentionQuery}
              mentionSuggestions={mentionSuggestions}
              mentionSelectedIndex={mentionSelectedIndex}
              onMentionSelect={handleMentionSelect}
              onMentionClose={() => mentionState.closeMention()}
              onMentionNavigate={(dir) => mentionState.moveSelection(dir, mentionSuggestions.length)}
            />
          </TabsContent>

          {isFeatureEnabled("CLUSTER_MONITOR") && (
            <TabsContent value="alerts" className="flex-1 min-h-0 mt-0 overflow-hidden">
              <AlertsTabContent store={store} />
            </TabsContent>
          )}
        </Tabs>
      </aside>

      {/* 🎯 DAIVE v2.1: ContextPickerModal - 컨텍스트 선택 모달 */}
      {/* 📝 2026-01-07: isClusterConnected 추가 (- 명확한 메시지 표시) */}
      <ContextPickerModal
        isOpen={isContextPickerOpen}
        onClose={() => setIsContextPickerOpen(false)}
        onSelect={handleContextSelect}
        fetcher={contextPickerFetcher}
        multiSelect={true}
        title="Add Context"
        isClusterConnected={!!store.currentClusterId}
      />

      {/* 🎯 2026-01-06: SessionRestorePanel - 세션 관리 모달 (USER-GUIDE.md 기능 구현) */}
      <SessionRestorePanel
        isOpen={isSessionRestorePanelOpen}
        onClose={() => setIsSessionRestorePanelOpen(false)}
        onSelectSession={handleSelectSessionForRestore}
        onDeleteSession={handleDeleteSessionForRestore}
        onCreateNewSession={handleCreateNewSessionFromRestore}
        sessions={sessionsForRestore}
        isLoading={store.isPastChatsLoading}
        title="Manage Sessions"
      />
    </div>
  );
});

/**
 * 🎯 목적: DI 패턴이 적용된 AI Chat Panel (Cluster Frame에서 사용)
 */
export const AIChatPanel = withInjectables<Dependencies, AIChatPanelProps>(NonInjectedAIChatPanel, {
  getProps: (di, props) => ({
    store: props?.store ?? di.inject(aiChatPanelStoreInjectable),
    openPreferencesDialog: di.inject(openPreferencesDialogInjectable),
    agentModeController: di.inject(agentModeControllerInjectable),
  }),
});

/**
 * 🎯 목적: Cluster Frame Child Component용 export (Props 없이 DI만 사용)
 */
export const AIChatPanelForClusterFrame = withInjectables<Dependencies>(NonInjectedAIChatPanel, {
  getProps: (di) => ({
    store: di.inject(aiChatPanelStoreInjectable),
    openPreferencesDialog: di.inject(openPreferencesDialogInjectable),
    agentModeController: di.inject(agentModeControllerInjectable),
  }),
});
