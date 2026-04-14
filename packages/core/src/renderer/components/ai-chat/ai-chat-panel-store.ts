/**
 * 🎯 목적: AI Chat Panel의 상태를 관리하는 MobX Store
 *
 * 주요 기능:
 * - 패널 열기/닫기 상태 관리
 * - 패널 너비 조절 (리사이즈)
 * - localStorage를 통한 상태 영속화
 *
 * 패턴: Dock Store와 동일한 구조 (DAIVE 표준 패턴)
 *
 * 📝 Extension Host 패턴 (2025-12-16):
 * - DaiveAgentOrchestrator 대신 AgentIPCClient 사용
 * - 모든 Agent 실행은 Main Process에서 처리
 * - Renderer는 IPC를 통해 요청만 전송하고 결과를 수신
 * - 스트림 처리: LangChain 스트림 → IPC 이벤트 기반으로 변경
 */

import autoBind from "auto-bind";
import { action, computed, makeObservable, observable, reaction, runInAction } from "mobx";
import { v4 as uuid } from "uuid";
import { planState } from "../../../features/ai-assistant/common/plan-state";
import { createPlanSnapshot } from "../../../features/ai-assistant/common/plan-types";
import { streamingState } from "../../../features/ai-assistant/common/streaming-state";
import { expertDebateStore } from "../../../features/ai-assistant/renderer/components/expert-debate-panel";
import { monitorState } from "../../../features/ai-assistant/renderer/monitor-ui/monitor-state";
import { getProviderByModel } from "../../../features/ai-assistant/renderer/provider/ai-models";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type { ActivityPhase } from "../../../features/ai-assistant/common/activity-indicator-types";
import type {
  AgentContext,
  AgentStreamEvent,
  SlashCommandInfo,
  ThreadInfo,
} from "../../../features/ai-assistant/common/agent-ipc-channels";
import type { FeedbackCategory } from "../../../features/ai-assistant/common/user-profile-types";
import type { AgentIPCClient } from "../../../features/ai-assistant/renderer/agent-ipc-client";
import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";
import type { EncryptedApiKeyService } from "../../../features/user-preferences/renderer/encrypt-api-key.injectable";
import type { StorageLayer } from "../../utils/storage-helper";

// ============================================
// 🎯 인라인 타입/상수 (삭제된 파일에서 이관)
// ============================================

export interface ClarifySuggestion {
  title: string;
  slotIds: string[];
  valueHints: Record<string, string>;
}

export interface SlotDetail {
  label: string | null;
  description: string | null;
  example: string;
}

export type ClarifyInputMode = "suggestion" | "freeform";

interface ClarifySubmissionPayload {
  slotValues?: Record<string, string>;
  rawText?: string;
  inputMode?: ClarifyInputMode;
}

const CLARIFY_GENERIC_PROMPT = "Additional details are required to continue.";

const SUPERVISOR_HITL_PROMPT_TEXT = {
  QUESTION: "Do you approve the plan?",
} as const;

export const SUPERVISOR_HITL_OPTIONS = {
  APPROVE: "Approve",
  REJECT: "Reject",
} as const;

function sanitizeClarifySubmissionPayload(payload: ClarifySubmissionPayload): ClarifySubmissionPayload {
  const sanitizedSlots: Record<string, string> = {};
  if (payload.slotValues && typeof payload.slotValues === "object") {
    Object.entries(payload.slotValues).forEach(([rawSlot, rawValue]) => {
      const slotId = rawSlot.trim();
      const slotValue = typeof rawValue === "string" ? rawValue.trim() : "";
      if (slotId && slotValue) {
        sanitizedSlots[slotId] = slotValue;
      }
    });
  }
  const sanitizedRawText = payload.rawText?.trim();
  const sanitizedInputMode =
    payload.inputMode === "suggestion" || payload.inputMode === "freeform" ? payload.inputMode : undefined;
  return {
    slotValues: Object.keys(sanitizedSlots).length > 0 ? sanitizedSlots : undefined,
    rawText: sanitizedRawText && sanitizedRawText.length > 0 ? sanitizedRawText : undefined,
    inputMode: sanitizedInputMode,
  };
}

function hasClarifySubmissionContent(payload: ClarifySubmissionPayload): boolean {
  return Boolean(
    (payload.slotValues && Object.keys(payload.slotValues).length > 0) ||
      (payload.rawText && payload.rawText.length > 0),
  );
}

export function buildClarifySubmissionFromSuggestion(suggestion: ClarifySuggestion): ClarifySubmissionPayload {
  const slotValues: Record<string, string> = {};
  suggestion.slotIds.forEach((slotId) => {
    const trimmedSlot = slotId.trim();
    const hint = suggestion.valueHints?.[slotId]?.trim();
    if (trimmedSlot && hint) {
      slotValues[trimmedSlot] = hint;
    }
  });
  return sanitizeClarifySubmissionPayload({
    slotValues: Object.keys(slotValues).length > 0 ? slotValues : undefined,
    rawText: suggestion.title,
    inputMode: "suggestion",
  });
}

export function buildClarifySubmissionFromText(text: string): ClarifySubmissionPayload {
  return sanitizeClarifySubmissionPayload({ rawText: text, inputMode: "freeform" });
}

// ============================================
// 🎯 유틸리티: <think> 태그 제거
// ============================================

/**
 * 🎯 목적: LLM 응답에서 thinking/reasoning 태그 및 placeholder 제거
 *
 * 다양한 모델의 내부 추론 과정을 숨깁니다:
 * - Ollama DeepSeek, Qwen: <think>...</think>
 * - Claude: <thinking>...</thinking>
 * - 기타: <reasoning>...</reasoning>
 *
 * 📝 주의사항:
 * - Main Process(agent-host.ts)에서 1차 필터링 수행
 * - 이 함수는 2차 안전장치로 동작 (혹시 누락된 태그 처리)
 * - thinking placeholder (제로 폭 공백)도 제거
 * - 스트리밍 중에는 trim하지 않아 줄바꿈 보존
 *
 * @param content - 원본 LLM 응답
 * @param isFinal - true면 완료 상태로 trim 적용 (기본: false)
 * @returns thinking 태그가 제거된 응답
 */
function stripThinkingTags(content: string, isFinal = false): string {
  // 다양한 thinking 태그 형식 지원 (멀티라인, 대소문자 무관)
  // thinking placeholder (제로 폭 공백)도 제거
  const result = content
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>\s*/gi, "")
    .replace(/\u200B/g, ""); // 제로 폭 공백 제거

  // 스트리밍 중에는 trim 하지 않음 (줄바꿈 보존)
  // 최종 완료 시에만 trim 적용
  return isFinal ? result.trim() : result;
}

/**
 * 🎯 목적: AI Chat Panel Storage 상태 타입 정의
 */
export interface AIChatPanelStorageState {
  /** 패널 열림/닫힘 상태 */
  isOpen: boolean;
  /** 패널 너비 (px) */
  width: number;
}

/**
 * 🎯 목적: 클러스터별 대화 상태 타입 정의
 *
 * 📝 2026-01-17: DAIVE Root Frame Migration
 * - 다중 클러스터 지원을 위한 클러스터별 대화 상태 저장
 */
export interface ConversationState {
  /** 대화 메시지 목록 */
  messages: ChatMessage[];
  /** LangGraph thread_id */
  conversationId: string;
  /** 마지막 업데이트 시간 */
  lastUpdated: number;
}

/**
 * 🎯 목적: 클러스터 정보 타입 (의존성 주입용)
 *
 * 📝 2026-01-17: DAIVE Root Frame Migration
 * - Store가 클러스터 목록을 참조할 수 있도록 추상화된 타입
 */
export interface ClusterInfo {
  /** 클러스터 고유 ID */
  id: string;
  /** 클러스터 이름 */
  name: string;
  /** 연결 상태 */
  isConnected?: boolean;
  /** 컨텍스트 이름 (kubeconfig context) */
  contextName?: string;
  /** 상태 표시 (connected, disconnected, connecting) */
  status?: "connected" | "disconnected" | "connecting";
}

/**
 * 🎯 목적: AI Chat Panel Store 의존성
 *
 * 📝 Extension Host 패턴 (2025-12-16):
 * - orchestrator 대신 agentIPCClient 사용
 * - Main Process의 AgentHost와 IPC로 통신
 *
 * 📝 2025-12-17: activeEntityId, selectedNamespacesStorage 추가
 * - Agent 컨텍스트에 clusterId, namespace 주입용
 *
 * 📝 2026-01-17: DAIVE Root Frame Migration
 * - connectedClusters: 연결된 클러스터 목록 (IComputedValue)
 * - activeKubernetesCluster: 현재 활성 클러스터 (IComputedValue)
 */
interface Dependencies {
  readonly storage: StorageLayer<AIChatPanelStorageState>;
  readonly userPreferencesState: UserPreferencesState;
  readonly encryptService: EncryptedApiKeyService;
  /** 🎯 Extension Host: Main Process Agent와 통신하는 IPC 클라이언트 */
  readonly agentIPCClient: AgentIPCClient;
  /** 🎯 현재 활성화된 클러스터 Entity ID */
  readonly activeEntityId: { get(): string | undefined };
  /** 🎯 선택된 네임스페이스 저장소 */
  readonly selectedNamespacesStorage: { get(): string[] };
  /** 🆕 2026-01-17: 연결된 클러스터 목록 (computed) */
  readonly connectedClusters?: { get(): ClusterInfo[] };
  /** 🆕 2026-01-17: 현재 활성 클러스터 (computed) */
  readonly activeKubernetesCluster?: { get(): ClusterInfo | undefined };
}

export type ChatMessageRole = "user" | "assistant" | "system";

/**
 * 🎯 목적: Tool 승인 결과 정보 (메시지에 표시용)
 *
 * 📝 2026-01-07: 해결 - yamlContent 필드 추가
 * 📝 2026-01-13: output 필드 추가 - 명령어 실행 결과 표시
 */
export interface ToolApprovalResultData {
  /** 승인 여부 (true: 승인, false: 거절) */
  approved: boolean;
  /** 명령어 또는 액션 요약 */
  command: string;
  /** 승인/거절 시간 */
  timestamp: string;
  /** 🆕 YAML 내용 (kubectl 승인 시 표시용) - */
  yamlContent?: string;
  /** 🆕 Diff 통계 (파일 수정 시 표시용) */
  diffStats?: { additions: number; deletions: number };
  /** 🆕 파일 경로 */
  filePath?: string;
  /** 🆕 명령어 실행 결과 (접힌 상태로 표시) - 2026-01-13 */
  output?: string;
}

/**
 * 🆕 Plan 상태 메시지 데이터
 *
 * 📝 2026-01-13: Problem 2 해결 - 이모지 대신 lucide-react 아이콘 사용
 */
export interface PlanStatusMessageData {
  /** 상태 타입: approved, completed, partial, failed, rejected */
  statusType: "approved" | "completed" | "partial" | "failed" | "rejected";
  /** 메시지 제목 (예: "Plan Approved") */
  title: string;
  /** 부가 설명 (예: "Executing 5 steps...") */
  description?: string;
  /** 상세 내용 (LLM 생성 요약 등) */
  details?: string;
  /** 관련 스텝 정보 */
  stepInfo?: { current?: number; total: number; completed?: number };
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  status?: "streaming" | "complete" | "error";
  /**
   * 🎯 목적: 메시지 표현 방식 지정
   * - "chat": 기존 채팅 버블 렌더링
   * - "log": 진행 상황 등 단순 로그 텍스트
   * - "tool-approval-result": 승인/거절 결과 표시
   * - "plan-viewer": Plan 뷰어 (BUG-B,C 수정)
   * - "plan-status-message": Plan 상태 메시지 (Problem 2 해결)
   */
  presentation?: "chat" | "log" | "tool-approval-result" | "plan-viewer" | "plan-status-message";
  /**
   * 🎯 목적: Tool 승인 결과 데이터 (presentation이 "tool-approval-result"일 때 사용)
   */
  toolApprovalResult?: ToolApprovalResultData;
  /**
   * 🆕 Plan 상태 스냅샷 (presentation이 "plan-viewer"일 때 사용)
   *
   * 📝 2026-01-13: 해결
   * - 각 plan-viewer 메시지가 자신만의 Plan 상태를 보관
   * - planState 싱글톤 대신 스냅샷 사용으로 Plan 독립성 확보
   * - 새 Plan 생성 시 기존 Plan UI가 영향받지 않음
   */
  planSnapshot?: import("../../../features/ai-assistant/common/plan-types").PlanSnapshot;
  /**
   * 🆕 Plan 상태 메시지 데이터 (presentation이 "plan-status-message"일 때 사용)
   *
   * 📝 2026-01-13: Problem 2 해결 - 이모지 대신 lucide-react 아이콘으로 렌더링
   */
  planStatusMessage?: PlanStatusMessageData;
}

export interface ClarifyPromptState {
  prompt: string;
  suggestions: ClarifySuggestion[];
  missingSlots: string[];
  attempts: number;
  slotDetails?: Record<string, SlotDetail>;
  collectedValues?: Record<string, string>;
  latestRawInput?: string;
  lastInputMode?: ClarifyInputMode | null;
}

export interface HitlPromptState {
  question: string;
  approveLabel: string;
  rejectLabel: string;
}

export interface ToolApprovalPromptState {
  question: string;
  options: string[];
  requestString?: string;
  actionSummary?: string;
  /** kubectl apply -f - 등에서 stdin으로 전달할 YAML 내용 */
  stdin?: string;
  /** 🎯 2026-01-06: Diff 정보를 포함한 승인 요청 (Cursor AI 스타일) */
  approval?: import("../../../features/ai-assistant/common/tool-approval-types").ToolApprovalWithDiff;
  /** 🎯 2026-01-13: Tool 이름 (실행 결과 연결용) - Problem 1 해결 */
  toolName?: string;
}

/**
 * 🎯 목적: HITL (Human-in-the-Loop) 승인 수준 타입
 *
 * - "always_approve": 모든 도구 실행 전 사용자 승인 필요 (가장 안전, 디폴트)
 * - "read_only": 읽기 작업은 자동 실행, 쓰기 작업만 승인 필요
 * - "allow_all": 모든 작업 자동 실행 (승인 없음, 주의 필요)
 */
export type HitlLevel = "always_approve" | "read_only" | "allow_all";

/**
 * 🎯 목적: HITL 수준별 UI 표시 정보
 */
export const HITL_LEVEL_OPTIONS: Array<{ value: HitlLevel; label: string; description: string }> = [
  { value: "always_approve", label: "Always Approve", description: "Approval required before all actions" },
  { value: "read_only", label: "Read Only", description: "Read auto, write needs approval" },
  { value: "allow_all", label: "Full Access", description: "All actions run automatically" },
];

/**
 * 🎯 목적: 노드 진행 단계 정보
 */
export interface NodeProgressStep {
  id: string;
  nodeName: string;
  displayName: string;
  status: "running" | "completed" | "failed";
  summary?: string;
  timestamp: number;
}

/**
 * 🎯 목적: 노드 진행 상태 관리
 */
export interface NodeProgressState {
  isActive: boolean;
  currentStep: NodeProgressStep | null;
  completedSteps: NodeProgressStep[];
  isExpanded: boolean;
}

/**
 * 🎯 목적: AI Chat Panel의 상태 관리 Store 클래스
 *
 * MobX 패턴:
 * - @computed: 계산된 속성 (getter/setter를 통해 storage와 연동)
 * - @action: 상태 변경 메서드
 * - makeObservable(this): MobX 반응형 객체로 변환
 * - autoBind(this): 메서드 this 바인딩 자동화
 */
export class AIChatPanelStore implements AIChatPanelStorageState {
  /** 🎯 Extension Host: 현재 진행 중인 메시지 ID (스트림 이벤트 처리용) */
  private currentAssistantMessageId: string | null = null;

  /** 🎯 Extension Host: IPC 이벤트 구독 해제 함수 (dispose 시 사용) */
  private unsubscribeFromStream: (() => void) | null = null;

  /**
   * 🆕 Tool별 Approval Result 메시지 ID 매핑 (실행 결과 연결용) - 2026-01-13
   *
   * 📝 Key: Tool 이름 (예: "execute_command", "kubectl_apply")
   * 📝 Value: 해당 Tool의 Approval Result 메시지 ID
   *
   * 📝 FIX: 단일 ID 대신 Map 사용
   * - 여러 Tool이 연속으로 승인될 때 각각의 output이 올바른 메시지에 연결됨
   */
  private toolApprovalResultMessageIds: Map<string, string> = new Map();

  /**
   * 🆕 대기 중인 Tool Approval Result 메시지 ID Queue
   *
   * 📝 2026-01-13: 단일 변수 → Queue 변경 (다중 Tool 연속 승인 지원)
   * 📝 승인 시점에는 Tool 이름을 모르므로, 일단 Queue에 push
   * 📝 tool-execution started 이벤트에서 shift하여 Tool 이름과 함께 Map에 등록
   * 📝 FIFO 순서로 올바르게 매핑됨
   */
  private pendingToolApprovalResultMessageIds: string[] = [];

  /**
   * 🆕 Activity Phase 타임아웃 ID
   *
   * 📝 2026-01-29: PHASE 3 - Timeout fallback mechanism
   * - "preparing" 상태가 10초 이상 지속되면 타임아웃 처리
   * - node-progress 이벤트 수신 시 타임아웃 취소
   */
  private activityTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * 🎯 Activity Phase 타임아웃 시간 (ms)
   * 📝 10초 - 네트워크 지연을 고려한 충분한 시간
   */
  private static readonly ACTIVITY_TIMEOUT_MS = 10000;

  // ============================================
  // 🆕 다중 클러스터 지원 Observable (2026-01-17)
  // DAIVE Root Frame Migration
  // ============================================

  /**
   * 🎯 목적: 선택된 클러스터 ID 집합
   *
   * 📝 AC1: observable.set<string>() 타입으로 구현
   * 📝 2026-01-19: - 단일 클러스터만 선택 가능
   *    (백엔드 API가 단일 clusterId만 지원하므로 UI도 단일 선택으로 제한)
   */
  @observable
  readonly selectedClusterIds: Set<string> = observable.set<string>();

  /**
   * 🎯 목적: 클러스터별 대화 상태 저장
   *
   * 📝 AC2: observable.map 타입으로 구현
   * 📝 클러스터별로 독립된 대화 히스토리 관리
   */
  @observable
  private readonly conversationsByCluster: Map<string, ConversationState> = observable.map<string, ConversationState>();

  /**
   * 🎯 목적: 클러스터 자동 선택 활성화 여부
   *
   * 📝 true: 클러스터 접속 시 자동으로 해당 클러스터 선택
   * 📝 false: 수동 선택만 허용
   */
  @observable
  autoSelectEnabled = true;

  /**
   * 🎯 목적: Chat / Alerts 탭 전환 상태
   */
  @observable
  activeTab: "chat" | "alerts" = "chat";

  /**
   * 🎯 목적: 최대 동시 선택 가능한 클러스터 수
   *
   * 📝 2026-01-19: - 3 → 1로 변경
   *    백엔드 API(AgentContext.clusterId)가 단일 클러스터만 지원하므로
   *    UI에서도 단일 선택만 허용하도록 제한
   */
  static readonly MAX_CONCURRENT_CLUSTERS = 1;

  // ============================================
  // 🆕 AbortController 통합 (2026-01-17)
  // ============================================

  /**
   * 🎯 목적: 클러스터별 AbortController 관리
   *
   * 📝 abortControllers Map 구현
   * 📝 각 클러스터의 스트리밍 요청을 개별적으로 취소 가능
   */
  private readonly abortControllers = new Map<string, AbortController>();

  /**
   * 🎯 목적: dispose 후 메서드 호출 방지
   *
   * 📝 검증 2차에서 발견된 Edge Case 처리
   */
  private isDisposed = false;

  constructor(private readonly dependencies: Dependencies) {
    makeObservable(this);
    autoBind(this);

    // 🎯 목적: hitlLevel 변경 시 Main Process에 동기화
    reaction(
      () => this.hitlLevel,
      (level) => {
        // 🎯 Extension Host: Main Process의 HITL 레벨 동기화
        this.dependencies.agentIPCClient.setHitlLevel(level).catch((error) => {
          console.error("[AIChatPanelStore] Main Process HITL 레벨 동기화 실패:", error);
        });
      },
      { fireImmediately: true },
    );

    // 🎯 Extension Host: Main Process에서 오는 스트림 이벤트 구독
    this.subscribeToAgentStream();

    // 🎯 자동 클러스터 선택 (connectedClusters 변경 시)
    // 📝 2026-01-18: Issue 2,3 - activeKubernetesCluster 기반으로 변경
    // - 기존: connectedClusters 변경 시 첫 번째 클러스터 자동 선택 → Home에서도 클러스터 선택됨
    // - 변경: activeKubernetesCluster 없으면 선택 안함 (Home 화면 대응)
    reaction(
      () => this.connectedClusters,
      (clusters) => {
        // 자동 선택이 비활성화되어 있으면 무시
        if (!this.autoSelectEnabled) {
          return;
        }

        // 📝 2026-01-18: Home 화면 (activeKubernetesCluster가 없는 경우) 처리
        // - 활성 클러스터가 없으면 자동 선택하지 않음
        // - 사용자가 클러스터 프레임에 진입해야만 해당 클러스터가 자동 선택됨
        const activeKubeCluster = this.dependencies.activeKubernetesCluster?.get();
        if (!activeKubeCluster) {
          // Home 화면: 클러스터 선택 해제 (이전에 선택된 것이 있다면)
          if (this.selectedClusterIds.size > 0) {
            this.selectedClusterIds.clear();
          }
          return;
        }

        // 이미 선택된 클러스터가 있으면 무시
        if (this.selectedClusterIds.size > 0) {
          return;
        }

        // 📝 활성 클러스터가 연결된 목록에 있으면 자동 선택
        const activeInConnected = clusters.find((c) => c.id === activeKubeCluster.id);
        if (activeInConnected) {
          this.selectSingleCluster(activeInConnected.id);
        }
      },
      { fireImmediately: true },
    );

    // 🎯 2026-01-18: Issue 2 - activeKubernetesCluster 변경 감지
    // 사용자가 왼쪽 사이드바에서 다른 클러스터를 선택하면 DAIVE Assistant도 자동 선택
    reaction(
      () => this.dependencies.activeKubernetesCluster?.get(),
      (activeCluster, prevActiveCluster) => {
        // 자동 선택이 비활성화되어 있으면 무시
        if (!this.autoSelectEnabled) {
          return;
        }

        // 📝 Issue 3: Home 화면으로 돌아온 경우 (activeCluster가 undefined)
        if (!activeCluster) {
          // 클러스터 선택 해제
          if (this.selectedClusterIds.size > 0) {
            this.selectedClusterIds.clear();
          }
          return;
        }

        // 📝 Issue 2: 클러스터가 변경된 경우 자동 선택
        // - 연결된 클러스터 목록에 있는지 확인
        // - 이미 같은 클러스터가 선택되어 있으면 무시
        if (this.selectedClusterIds.has(activeCluster.id)) {
          return; // 이미 선택됨
        }

        const isConnected = this.connectedClusters.some((c) => c.id === activeCluster.id);
        if (isConnected) {
          this.selectSingleCluster(activeCluster.id);
        }
      },
      { fireImmediately: true },
    );
  }

  /**
   * 🎯 Extension Host: Agent 스트림 이벤트 구독
   *
   * Main Process의 AgentHost에서 전송되는 스트림 이벤트를 처리합니다.
   * - message-chunk: AI 응답 청크 축적
   * - message-complete: 메시지 완료 처리
   * - interrupt: HITL/Clarify 프롬프트 표시
   * - tool-execution: Tool 실행 상태
   * - complete: Agent 실행 완료
   * - error: 에러 처리
   */
  private subscribeToAgentStream(): void {
    this.unsubscribeFromStream = this.dependencies.agentIPCClient.onStreamEvent((event) => {
      this.handleAgentStreamEvent(event);
    });
  }

  /**
   * 🎯 Extension Host: 스트림 이벤트 핸들러
   *
   * 📝 2026-01-12: Auto Plan Tracker 이벤트 추가
   */
  private handleAgentStreamEvent(event: AgentStreamEvent): void {
    switch (event.type) {
      case "message-chunk":
        this.handleMessageChunk(event.chunk, event.messageId);
        break;

      case "message-complete":
        this.handleMessageComplete(event.content, event.messageId);
        break;

      case "interrupt":
        this.handleInterrupt(event.interruptType, event.payload, event.threadId);
        break;

      case "tool-execution":
        this.handleToolExecution(event.toolName, event.status, event.input, event.result, event.error);
        break;

      case "complete":
        this.handleAgentComplete(event.threadId);
        break;

      case "error":
        this.handleAgentError(event.error, event.threadId);
        break;

      case "debate-start":
        expertDebateStore.handleDebateStart(event.experts, event.roundNumber);
        break;

      case "debate-expert-response":
        expertDebateStore.handleExpertResponse(event.expertId, event.expertName, event.content, event.status);
        break;

      case "debate-consensus":
        expertDebateStore.handleConsensus(event.consensus);
        break;

      case "plan-step-update":
        this.handlePlanStepUpdate(event.stepIndex, event.status, event.toolName, event.result, event.error);
        break;
    }
  }

  /**
   * 🎯 Extension Host: 메시지 청크 처리
   *
   * 📝 <think> 태그 처리: 스트리밍 중에도 <think> 태그를 제거하여 표시
   */
  @action
  private handleMessageChunk(chunk: string, messageId: string): void {
    // 🎯 첫 청크 수신 시 LLM 응답 대기 플래그 유지
    // - 기존: 첫 청크에서 해제 → 프리앰블 후 스켈레톤 사라짐
    // - 수정: message-complete에서 해제 → 전체 응답 완료까지 진행 표시 유지
    // (isWaitingForLLMResponse는 handleMessageComplete에서 해제)

    // 🎯 첫 message-chunk 수신 시 activityPhase를 "processing"으로 전환
    if (this.activityPhase === "preparing") {
      this.activityPhase = "processing";
      this.clearActivityTimeout();
    }

    // NodeProgressCard 숨김 (Tool 실행 완료 후 LLM 응답 출력 시)
    if (this.nodeProgress.currentStep?.status !== "running") {
      this.nodeProgress.isActive = false;
    }

    const index = this.messages.findIndex((m) => m.id === messageId || m.id === this.currentAssistantMessageId);

    if (index < 0) return;

    const current = this.messages[index];
    // 🎯 <think> 태그 제거 (Ollama DeepSeek, Qwen 등의 reasoning 출력 숨김)
    const rawContent = current.content + chunk;
    this.messages[index] = {
      ...current,
      content: stripThinkingTags(rawContent),
    };
  }

  /**
   * 🎯 Extension Host: 메시지 완료 처리
   *
   * 📝 <think> 태그 처리: 최종 콘텐츠에서도 <think> 태그 제거
   */
  @action
  private handleMessageComplete(content: string, messageId: string): void {
    // 🎯 메시지 완료 시 LLM 응답 대기 플래그 해제
    // - 전체 응답 생성이 완료되어야 스켈레톤이 사라짐
    if (this.isWaitingForLLMResponse) {
      this.isWaitingForLLMResponse = false;
    }

    const index = this.messages.findIndex((m) => m.id === messageId || m.id === this.currentAssistantMessageId);
    if (index < 0) return;

    // 🎯 <think> 태그 제거 (Ollama DeepSeek, Qwen 등의 reasoning 출력 숨김)
    // isFinal=true로 최종 trim 적용
    this.messages[index] = {
      ...this.messages[index],
      content: stripThinkingTags(content, true),
      status: "complete",
    };
  }

  /**
   * 🎯 Extension Host: Interrupt 처리 (HITL/Clarify)
   */
  @action
  /**
   * 🎯 Interrupt 이벤트 처리
   *
   * 📝 2026-01-10: 수정 - recursion_limit 타입 추가
   * 📝 2026-01-12: Auto Plan Tracker - plan_approval 타입 추가
   */
  private handleInterrupt(
    interruptType: "hitl" | "clarify" | "recursion_limit" | "plan_approval",
    payload: unknown,
    threadId: string,
  ): void {
    // 현재 대화의 interrupt인지 확인
    if (threadId !== this.conversationId) return;

    if (interruptType === "clarify") {
      // Clarify 프롬프트 설정
      const clarifyPayload = payload as {
        prompt?: string;
        suggestions?: ClarifySuggestion[];
        missingSlots?: string[];
        slotDetails?: Record<string, SlotDetail>;
        collectedValues?: Record<string, string>;
      };

      this.clarifyPrompt = {
        prompt: clarifyPayload.prompt ?? CLARIFY_GENERIC_PROMPT,
        suggestions: clarifyPayload.suggestions ?? [],
        missingSlots: clarifyPayload.missingSlots ?? [],
        attempts: 0,
        slotDetails: clarifyPayload.slotDetails,
        collectedValues: clarifyPayload.collectedValues,
      };
    } else if (interruptType === "hitl") {
      // HITL 프롬프트 설정
      const hitlPayload = payload as {
        question?: string;
        options?: string[];
        requestString?: string;
        actionSummary?: string;
        stdin?: string;
        // 🎯 2026-01-06: Diff 정보를 포함한 승인 요청 (Cursor AI 스타일)
        approval?: import("../../../features/ai-assistant/common/tool-approval-types").ToolApprovalWithDiff;
        // 🎯 2026-01-13: Tool 이름 (실행 결과 연결용) - Problem 1 해결
        toolName?: string;
      };

      if (hitlPayload.options) {
        // Tool Approval 프롬프트
        this.toolApprovalPrompt = {
          question: hitlPayload.question ?? "Proceed with this operation?",
          options: hitlPayload.options,
          requestString: hitlPayload.requestString,
          actionSummary: hitlPayload.actionSummary,
          stdin: hitlPayload.stdin,
          // 🎯 2026-01-06: approval 정보 전달 (Diff 표시용)
          approval: hitlPayload.approval,
          // 🎯 2026-01-13: toolName 전달 (실행 결과 연결용)
          toolName: hitlPayload.toolName,
        };
      } else {
        // 일반 HITL 프롬프트
        this.hitlPrompt = {
          question: hitlPayload.question ?? SUPERVISOR_HITL_PROMPT_TEXT.QUESTION,
          approveLabel: SUPERVISOR_HITL_OPTIONS.APPROVE,
          rejectLabel: SUPERVISOR_HITL_OPTIONS.REJECT,
        };
      }
    } else if (interruptType === "recursion_limit") {
      // 🎯 RecursionLimit 도달 시 계속/중단 선택 프롬프트
      const recursionPayload = payload as {
        hitlSessionId?: string;
        currentLimit?: number;
        nextLimit?: number;
        message?: string;
        description?: string;
        options?: string[];
        optionLabels?: {
          continue?: string;
          stop?: string;
        };
      };

      // toolApprovalPrompt를 재사용하여 옵션 선택 UI 표시
      this.toolApprovalPrompt = {
        question: recursionPayload.message ?? `⚠️ Reached ${recursionPayload.currentLimit ?? 15} steps`,
        options: recursionPayload.options ?? ["continue", "stop"],
        requestString: recursionPayload.description,
        actionSummary:
          recursionPayload.optionLabels?.continue ??
          `Continue (+${(recursionPayload.nextLimit ?? 30) - (recursionPayload.currentLimit ?? 15)} steps)`,
      };
    } else if (interruptType === "plan_approval") {
      // Plan 승인 요청: interrupt payload에서 plan data를 꺼내 planState 초기화
      const planPayload = payload as {
        planTitle?: string;
        planSummary?: string;
        planSteps?: Array<{ title: string; command?: string; description?: string }>;
      };
      if (planPayload.planSteps?.length) {
        planState.initializeFromPlanEvent(
          planPayload.planTitle ?? "Execution Plan",
          planPayload.planSummary ?? "",
          planPayload.planSteps,
          this.conversationId,
        );

        // plan-viewer 메시지를 messages에 추가하여 PlanViewer가 렌더링되도록 함
        const snapshot = createPlanSnapshot(planState);
        this.messages.push({
          id: uuid(),
          role: "system",
          content: "",
          status: "complete",
          presentation: "plan-viewer",
          planSnapshot: snapshot,
        });
      }
      // PlanViewer가 자체 승인/거부 버튼을 제공하므로
      // toolApprovalPrompt를 설정하지 않음 (중복 버튼 방지)
      // PlanViewer의 onApprove/onReject → submitPlanApproval() 사용
    }

    // 🎯 Interrupt 발생 시 현재 스트리밍 메시지의 status를 "complete"로 변경
    // 이렇게 해야 StreamingText의 커서(█)가 사라짐
    // Interrupt 상태에서는 더 이상 토큰이 오지 않으므로 "complete"로 처리하는 것이 맞음
    if (this.currentAssistantMessageId) {
      const index = this.messages.findIndex((m) => m.id === this.currentAssistantMessageId);
      if (index >= 0 && this.messages[index].status === "streaming") {
        this.messages[index] = {
          ...this.messages[index],
          status: "complete",
        };
      }
    }

    this.isProcessing = false;
  }

  /**
   * 🎯 Plan Step 진행 이벤트 처리
   *
   * Plan 승인 후 각 step의 실행 상태를 planState와 plan-viewer 메시지에 반영합니다.
   */
  @action
  private handlePlanStepUpdate(
    stepIndex: number,
    status: "in_progress" | "completed" | "failed" | "skipped",
    toolName: string,
    result?: string,
    error?: string,
  ): void {
    if (stepIndex === -1) {
      // Plan-level status update
      if (status === "in_progress") {
        planState.approvePlan();
      } else if (status === "completed") {
        planState.setStatus("completed");
      } else if (status === "failed") {
        planState.setStatus("partial");
      }
    } else {
      // Step-level update
      if (status === "in_progress") {
        planState.startStep(stepIndex);
      } else if (status === "completed") {
        planState.completeStep(stepIndex, result);
      } else if (status === "failed") {
        planState.failStep(stepIndex, error);
      } else if (status === "skipped") {
        planState.skipStep(stepIndex);
      }
    }

    // Update the plan-viewer message's snapshot so it reflects current state
    const planViewerIdx = this.messages.findLastIndex((m) => m.presentation === "plan-viewer");
    if (planViewerIdx >= 0) {
      this.messages[planViewerIdx] = {
        ...this.messages[planViewerIdx],
        planSnapshot: createPlanSnapshot(planState),
      };
    }
  }

  /**
   * 🎯 Extension Host: Tool 실행 상태 처리
   *
   * 📝 2026-01-13: Tool 실행 완료 시 결과를 Tool Approval Result 메시지에 연결
   * - 승인된 Tool 실행이 완료되면 해당 결과를 접힌 상태로 표시
   */
  /**
   * 🎯 Tool 실행 이벤트 처리 (tool-execution)
   *
   * 📝 FIX (BUG-A): Tool별 Map으로 message ID 관리
   * - 여러 Tool이 연속 승인될 때 각각의 output이 올바른 메시지에 연결됨
   * - Tool 이름을 Key로 사용하여 정확한 매칭
   *
   * 📝 흐름:
   * 1. 승인 시: pendingToolApprovalResultMessageId에 message ID 저장
   * 2. started: pendingToolApprovalResultMessageId를 toolName과 함께 Map에 등록
   * 3. completed/error: Map에서 toolName으로 message ID 조회하여 output 연결
   *
   * @param toolName - Tool 이름
   * @param status - 실행 상태 (started, completed, error)
   * @param input - 입력 데이터 (started 시)
   * @param result - 실행 결과 (completed 시)
   * @param error - 에러 메시지 (error 시)
   */
  @action
  private handleToolExecution(
    toolName: string,
    status: "started" | "completed" | "error",
    input?: unknown,
    result?: unknown,
    error?: string,
  ): void {
    // 첫 tool-execution 이벤트 수신 시 activityPhase를 "processing"으로 전환
    if (status === "started" && this.activityPhase === "preparing") {
      this.activityPhase = "processing";
      this.clearActivityTimeout();
    }

    // started 시 Queue에서 shift하여 Tool 이름과 매핑 (다중 Tool 연속 승인 지원)
    if (status === "started" && this.pendingToolApprovalResultMessageIds.length > 0) {
      const pendingId = this.pendingToolApprovalResultMessageIds.shift()!;

      this.toolApprovalResultMessageIds.set(toolName, pendingId);
    }

    // Tool 이름으로 해당 메시지 ID 조회
    const messageId = this.toolApprovalResultMessageIds.get(toolName);

    if ((status === "completed" || status === "error") && messageId) {
      const messageIndex = this.messages.findIndex((msg) => msg.id === messageId);

      if (messageIndex >= 0) {
        const message = this.messages[messageIndex];
        if (message.toolApprovalResult) {
          // 결과를 문자열로 변환
          let outputText = "";
          if (status === "completed" && result !== undefined) {
            outputText = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          } else if (status === "error" && error) {
            outputText = `Error: ${error}`;
          }

          // output이 있을 때만 업데이트
          if (outputText) {
            this.messages[messageIndex] = {
              ...message,
              toolApprovalResult: {
                ...message.toolApprovalResult,
                output: outputText,
              },
            };
          }
        }
      }

      // 🎯 FIX: 업데이트 완료 후 해당 Tool의 ID만 삭제
      this.toolApprovalResultMessageIds.delete(toolName);
    }
  }

  /**
   * 🎯 Extension Host: Agent 완료 처리
   */
  @action
  private handleAgentComplete(threadId: string): void {
    if (threadId !== this.conversationId) return;

    this.isProcessing = false;
    this.currentAssistantMessageId = null;
    // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋
    this.isWaitingForLLMResponse = false;

    // 🎯 2026-01-29: Reset activityPhase to idle on completion
    this.activityPhase = "idle";
    this.clearActivityTimeout();

    // 🎯 비정상 종료 방어 - streamingState가 남아있으면 정리
    if (streamingState.isStreaming) {
      streamingState.finalizeStreaming();
    }

    // 진행 상황 카드 비활성화
    if (this.nodeProgress.currentStep) {
      this.nodeProgress.completedSteps.push({
        ...this.nodeProgress.currentStep,
        status: "completed",
      });
      this.nodeProgress.currentStep = null;
    }
    this.nodeProgress.isActive = false;

    // Expert Debate 패널 리셋
    expertDebateStore.reset();
  }

  /**
   * 🎯 Extension Host: Agent 에러 처리
   *
   * 📝 수정 (2026-01-08):
   * - nodeProgress도 비활성화하여 UI가 "Processing..." 상태에서 멈추지 않도록 함
   * - 에러 발생 시에도 UI 상태가 완전히 리셋되어야 함
   */
  @action
  private handleAgentError(error: string, threadId?: string): void {
    if (threadId && threadId !== this.conversationId) return;

    // 현재 assistant 메시지에 에러 표시
    if (this.currentAssistantMessageId) {
      const index = this.messages.findIndex((m) => m.id === this.currentAssistantMessageId);
      if (index >= 0) {
        this.messages[index] = {
          ...this.messages[index],
          status: "error",
          content: `⚠️ Error: ${error}`,
        };
      }
    }

    this.isProcessing = false;
    this.currentAssistantMessageId = null;
    // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋
    this.isWaitingForLLMResponse = false;
    this.agentStatus = "error";
    this.agentError = error;

    // 🎯 스트리밍 중 에러 발생 시 streamingState 리셋
    if (streamingState.isStreaming) {
      streamingState.handleStreamingError(new Error(error));
    }

    // 🎯 에러 후에도 입력 가능하도록 agentStatus 복구
    // agentError에 에러 메시지가 보존되므로 UI 에러 표시는 유지됨
    if (this.hasApiKey) {
      this.agentStatus = "ready";
    }

    // 🆕 에러 시에도 nodeProgress 비활성화 (2026-01-08)
    // 이 코드가 없으면 UI가 "Processing..." 상태로 멈춤
    this.nodeProgress.isActive = false;
    this.nodeProgress.currentStep = null;

    // 🎯 2026-01-29: Reset activityPhase to idle on error
    this.activityPhase = "idle";
    this.clearActivityTimeout();
  }

  /**
   * 🎯 목적: 최근 5분 이내 모니터 알림이 있으면 컨텍스트로 전달
   *
   * 📝 2026-02-27: 모니터 알림 → AI 에이전트 컨텍스트 연동
   * - 오래된 알림(5분 초과)은 무시하여 불필요한 컨텍스트 오염 방지
   * - findings는 최대 5개까지만 전달 (IPC 페이로드 크기 제한)
   */
  private getRecentMonitorAlert(): AgentContext["monitorAlert"] {
    const alert = monitorState.latestAlert;

    if (!alert) return null;

    // 5분 이내 알림만 전달 (오래된 알림은 무시)
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (Date.now() - alert.timestamp > FIVE_MINUTES) return null;

    // 📝 MobX observable → plain object 변환 (IPC structured clone 호환)
    // MobX Proxy 객체는 Electron IPC를 통과하지 못하므로 모든 값을 plain으로 추출
    return {
      severity: alert.severity ?? "warning",
      summary: String(alert.summary ?? ""),
      findings: (alert.findings ?? []).slice(0, 5).map((f) => ({
        severity: String(f.severity ?? "warning"),
        category: String(f.category ?? "unknown"),
        title: String(f.title ?? ""),
        description: String(f.description ?? ""),
        suggestedCommands: [...(f.suggestedCommands ?? [])],
      })),
      timestamp: alert.timestamp,
    };
  }

  // 🎯 목적: 패널 너비의 최소/최대 범위 정의
  readonly minWidth = 300; // 최소 300px
  readonly maxWidth = 800; // 최대 800px
  readonly defaultWidth = 400; // 기본 400px

  /**
   * 🎯 목적: LangGraph 에이전트 준비 상태 추적
   */
  @observable
  agentStatus: "not-initialized" | "initializing" | "ready" | "error" = "not-initialized";

  /**
   * 🎯 목적: LangGraph 요청 처리 중 여부 추적 (중복 실행 방지)
   */
  @observable
  isProcessing = false;

  /**
   * 🎯 목적: 에이전트 초기화 실패 시 사용자 안내 메시지
   */
  @observable
  agentError: string | null = null;

  /**
   * 🎯 목적: LangGraph thread_id – 채팅 세션 식별자
   */
  @observable
  conversationId = uuid();

  /**
   * 🎯 목적: 채팅 메시지 타임라인 (사용자/AI)
   */
  @observable.shallow
  messages: ChatMessage[] = [];

  /**
   * 🎯 목적: Clarify 상호작용 상태
   */
  @observable.ref
  clarifyPrompt: ClarifyPromptState | null = null;

  @observable
  clarifySubmissionPending = false;

  /**
   * 🎯 목적: HITL 승인 상호작용 상태
   */
  @observable.ref
  hitlPrompt: HitlPromptState | null = null;

  @observable
  hitlSubmissionPending = false;

  /**
   * 🎯 목적: Tool 실행 승인 상호작용 상태
   */
  @observable.ref
  toolApprovalPrompt: ToolApprovalPromptState | null = null;

  @observable
  toolApprovalSubmissionPending = false;

  /**
   * 🎯 목적: HITL 승인 수준 설정
   * - "always_approve": 모든 작업 승인 필요 (디폴트, 가장 안전)
   * - "read_only": 읽기만 자동 실행
   * - "allow_all": 전체 자동 실행
   */
  @observable
  hitlLevel: HitlLevel = "always_approve";

  /**
   * 🎯 목적: 노드 진행 상황 추적 (Collapsible Progress Card)
   */
  @observable
  nodeProgress: NodeProgressState = {
    isActive: false,
    currentStep: null,
    completedSteps: [],
    isExpanded: false,
  };

  /**
   * 🎯 목적: Activity Phase (즉각적 UI 피드백용)
   *
   * 📝 2026-01-29: AI Activity Indicator 개선 - 즉각적 UI 피드백
   * - "idle": 대기 상태
   * - "preparing": sendMessage 호출 직후 (IPC 요청 전송 중)
   * - "processing": 첫 node-progress 이벤트 수신 후
   *
   * 📝 Nielsen Norman Group UX 가이드라인 (100ms 내 피드백)
   * - nodeProgress와 독립적으로 동작하여 기존 로직에 영향 없음
   * - sendMessage() 호출 시 즉시 "preparing"으로 전환
   * - node-progress 이벤트 수신 시 "processing"으로 전환
   * - complete/error 시 "idle"로 리셋
   */
  @observable
  activityPhase: ActivityPhase = "idle";

  /**
   * 🎯 목적: LLM 응답 대기 중 여부 (Tool/Clarify/HITL 승인 후)
   *
   * 📝 사용 시나리오:
   * - Tool 승인 후 LLM 재호출 대기 중
   * - Clarify 제출 후 LLM 응답 대기 중
   * - HITL 승인 후 LLM 응답 대기 중
   *
   * 📝 상태 전이:
   * - true: submit*Approval() 호출 시
   * - false: handleMessageChunk() 첫 청크 수신 시
   *
   * 📝 UI 용도:
   * - Footer에 skeleton dots (...) 표시
   * - 사용자에게 "LLM이 작업 중"임을 알림
   */
  @observable
  isWaitingForLLMResponse = false;

  // ============================================
  // 🎯 Past Chats 관련 Observable (2025-12-26)
  // ============================================

  /**
   * 🎯 목적: Past Chats 목록 (Thread 정보)
   */
  @observable.shallow
  pastChats: ThreadInfo[] = [];

  /**
   * 🎯 목적: Past Chats 로딩 상태
   */
  @observable
  isPastChatsLoading = false;

  /**
   * 🎯 목적: Past Chats 패널 표시 여부
   */
  @observable
  showPastChats = false;

  // ============================================
  // 🆕 다중 클러스터 지원 Computed (2026-01-17)
  // DAIVE Root Frame Migration
  // ============================================

  /**
   * 🎯 목적: 연결된 클러스터 목록 반환
   *
   * 📝 AC3: connectedClusters 의존성 주입 구조
   * 📝 의존성이 주입되지 않은 경우 빈 배열 반환
   */
  @computed
  get connectedClusters(): ClusterInfo[] {
    return this.dependencies.connectedClusters?.get() ?? [];
  }

  /**
   * 🎯 목적: 선택된 클러스터 객체 목록 반환
   *
   * 📝 selectedClusterIds와 connectedClusters를 조합
   * 📝 연결된 클러스터 중 선택된 것만 반환
   */
  @computed
  get selectedClusters(): ClusterInfo[] {
    return this.connectedClusters.filter((cluster) => this.selectedClusterIds.has(cluster.id));
  }

  /**
   * 🎯 목적: 클러스터 선택이 필요한지 여부
   *
   * 📝 AC4: needsClusterSelection computed 속성 동작
   * 📝 연결된 클러스터가 있지만 선택된 것이 없을 때 true
   */
  @computed
  get needsClusterSelection(): boolean {
    return this.selectedClusterIds.size === 0 && this.connectedClusters.length > 0;
  }

  /**
   * 🎯 목적: 현재 활성 클러스터 정보 반환
   *
   * 📝 AC3: activeKubernetesCluster 의존성 주입 구조
   */
  @computed
  get activeCluster(): ClusterInfo | undefined {
    return this.dependencies.activeKubernetesCluster?.get();
  }

  // ============================================
  // 🆕 다중 클러스터 지원 Actions (2026-01-17)
  // DAIVE Root Frame Migration
  // ============================================

  /**
   * 🎯 목적: 클러스터 선택 추가
   *
   * 📝 AC5: @action 데코레이터 적용
   * 📝 MAX_CONCURRENT_CLUSTERS 제한 적용
   *
   * @param clusterId - 선택할 클러스터 ID
   */
  @action
  selectCluster(clusterId: string): void {
    // 📝 Edge Case: 유효하지 않은 clusterId 검증
    if (!clusterId || clusterId.trim() === "") {
      console.warn("[AIChatPanelStore] 유효하지 않은 clusterId입니다.");
      return;
    }

    // 📝 Edge Case: 이미 선택된 클러스터 중복 방지
    if (this.selectedClusterIds.has(clusterId)) {
      console.debug(`[AIChatPanelStore] 클러스터 ${clusterId}는 이미 선택되어 있습니다.`);
      return;
    }

    if (this.selectedClusterIds.size >= AIChatPanelStore.MAX_CONCURRENT_CLUSTERS) {
      console.warn(`[AIChatPanelStore] 최대 ${AIChatPanelStore.MAX_CONCURRENT_CLUSTERS}개 클러스터만 선택 가능합니다.`);
      return;
    }
    this.selectedClusterIds.add(clusterId);
  }

  /**
   * 🎯 목적: 클러스터 선택 해제
   *
   * 📝 AC5: @action 데코레이터 적용
   * 📝 클러스터 선택 해제 시 자동 abort
   *
   * @param clusterId - 선택 해제할 클러스터 ID
   */
  @action
  deselectCluster(clusterId: string): void {
    // 📝 선택 해제 시 진행 중인 스트리밍 중단
    this.stopStreamingForCluster(clusterId);
    this.selectedClusterIds.delete(clusterId);
  }

  /**
   * 🎯 목적: 클러스터 선택 토글
   *
   * 📝 AC5: @action 데코레이터 적용
   * 📝 선택되어 있으면 해제, 없으면 추가
   *
   * @param clusterId - 토글할 클러스터 ID
   */
  @action
  toggleClusterSelection(clusterId: string): void {
    if (this.selectedClusterIds.has(clusterId)) {
      this.deselectCluster(clusterId);
    } else {
      this.selectCluster(clusterId);
    }
  }

  /**
   * 🎯 목적: 단일 클러스터만 선택 (다른 선택 해제)
   *
   * 📝 AC5: @action 데코레이터 적용
   * 📝 기존 선택을 모두 해제하고 지정된 클러스터만 선택
   * 📝 기존 클러스터 스트리밍 중단 후 선택 해제
   *
   * @param clusterId - 선택할 클러스터 ID
   */
  @action
  selectSingleCluster(clusterId: string): void {
    // 📝 기존 선택된 클러스터들의 스트리밍을 먼저 중단
    // - 리소스 누수 방지를 위해 clear() 전에 각 클러스터 스트리밍 중단
    this.selectedClusterIds.forEach((existingClusterId) => {
      if (existingClusterId !== clusterId) {
        this.stopStreamingForCluster(existingClusterId);
      }
    });
    this.selectedClusterIds.clear();
    this.selectedClusterIds.add(clusterId);
  }

  /**
   * 🎯 목적: 자동 선택 활성화/비활성화
   *
   * 📝 AC5: @action 데코레이터 적용
   *
   * @param enabled - 활성화 여부
   */
  @action
  setAutoSelectEnabled(enabled: boolean): void {
    this.autoSelectEnabled = enabled;
  }

  /**
   * 🎯 목적: 클러스터별 대화 상태 가져오기
   *
   * 📝 클러스터 ID로 대화 상태 조회 가능
   *
   * @param clusterId - 클러스터 ID
   * @returns 해당 클러스터의 대화 상태 또는 undefined
   */
  getConversationForCluster(clusterId: string): ConversationState | undefined {
    return this.conversationsByCluster.get(clusterId);
  }

  /**
   * 🎯 목적: 클러스터별 대화 상태 가져오기 (없으면 생성)
   *
   * 📝 새 클러스터 선택 시 빈 대화 상태 생성
   * 📝 클러스터 전환 시 이전 대화 보존 (Map에 저장됨)
   *
   * @param clusterId - 클러스터 ID
   * @returns 해당 클러스터의 대화 상태 (없으면 새로 생성)
   */
  getOrCreateConversation(clusterId: string): ConversationState {
    let conversation = this.conversationsByCluster.get(clusterId);

    if (!conversation) {
      // 📝 AC4: 새 클러스터 선택 시 빈 대화 상태 생성
      conversation = {
        messages: [],
        conversationId: uuid(),
        lastUpdated: Date.now(),
      };
      this.conversationsByCluster.set(clusterId, conversation);
    }

    return conversation;
  }

  /**
   * 🎯 목적: 클러스터별 대화 상태 저장
   *
   * @param clusterId - 클러스터 ID
   * @param state - 저장할 대화 상태
   */
  @action
  setConversationForCluster(clusterId: string, state: ConversationState): void {
    this.conversationsByCluster.set(clusterId, state);
  }

  /**
   * 🎯 목적: 현재 선택된 클러스터들의 대화 상태
   *
   * 📝 다중 클러스터 선택 시 각 클러스터의 대화를 조회
   *
   * @returns 선택된 클러스터별 대화 상태 Map
   */
  @computed
  get activeConversations(): Map<string, ConversationState> {
    const result = new Map<string, ConversationState>();

    for (const clusterId of this.selectedClusterIds) {
      const conversation = this.getOrCreateConversation(clusterId);
      result.set(clusterId, conversation);
    }

    return result;
  }

  /**
   * 🎯 목적: 대화 히스토리가 있는 클러스터 목록 조회
   *
   * 📝 연결 해제된 클러스터의 대화도 유지
   *
   * @returns 대화 히스토리가 있는 클러스터 ID 배열
   */
  @computed
  get clustersWithHistory(): string[] {
    return Array.from(this.conversationsByCluster.keys());
  }

  /**
   * 🎯 목적: 특정 클러스터의 대화 삭제
   *
   * @param clusterId - 클러스터 ID
   */
  @action
  clearConversationForCluster(clusterId: string): void {
    this.conversationsByCluster.delete(clusterId);
  }

  /**
   * 🎯 목적: 모든 대화 삭제
   */
  @action
  clearAllConversations(): void {
    this.conversationsByCluster.clear();
  }

  // ============================================
  // 🆕 AbortController 통합 메서드 (2026-01-17)
  // ============================================

  /**
   * 🎯 목적: 클러스터별 스트리밍 시작 및 AbortSignal 반환
   *
   * 📝 startStreaming() 호출 시 AbortSignal 반환
   * 📝 동일 클러스터 재요청 시 이전 요청 중단
   *
   * @param clusterId - 스트리밍을 시작할 클러스터 ID
   * @returns AbortSignal - 스트리밍 취소에 사용
   */
  startStreamingForCluster(clusterId: string): AbortSignal {
    // 📝 AC5: 기존 진행 중인 요청 중단
    this.stopStreamingForCluster(clusterId);

    const controller = new AbortController();
    this.abortControllers.set(clusterId, controller);

    return controller.signal;
  }

  /**
   * 🎯 목적: 클러스터별 스트리밍 중단
   *
   * 📝 스트리밍 중단 및 AbortController 정리
   *
   * @param clusterId - 스트리밍을 중단할 클러스터 ID
   */
  stopStreamingForCluster(clusterId: string): void {
    const controller = this.abortControllers.get(clusterId);

    if (controller) {
      controller.abort();
      this.abortControllers.delete(clusterId);
      // 🎯 2026-01-29: Reset activityPhase on streaming cancellation
      this.activityPhase = "idle";
    }
  }

  /**
   * 🎯 목적: 클러스터 스트리밍 중인지 확인
   *
   * @param clusterId - 확인할 클러스터 ID
   * @returns 스트리밍 중이면 true
   */
  isStreamingForCluster(clusterId: string): boolean {
    return this.abortControllers.has(clusterId);
  }

  /**
   * 🎯 목적: 모든 클러스터의 스트리밍 중단
   *
   * 📝 패널 닫기 시 모든 진행 중인 요청 중단
   */
  stopAllStreaming(): void {
    for (const clusterId of this.abortControllers.keys()) {
      this.stopStreamingForCluster(clusterId);
    }
  }

  /**
   * 🎯 목적: Activity 타임아웃 취소
   *
   * 📝 2026-01-29: PHASE 3 - Timeout fallback
   * - node-progress 이벤트 수신 시 호출
   * - complete/error 시 호출
   */
  private clearActivityTimeout(): void {
    if (this.activityTimeoutId) {
      clearTimeout(this.activityTimeoutId);
      this.activityTimeoutId = null;
    }
  }

  /**
   * 🎯 목적: 현재 스트리밍 중인 클러스터 ID 목록
   *
   * @returns 스트리밍 중인 클러스터 ID 배열
   */
  get streamingClusterIds(): string[] {
    return Array.from(this.abortControllers.keys());
  }

  // 🎯 목적: 패널 열림/닫힘 상태 (localStorage와 연동)
  @computed
  get isOpen(): boolean {
    return this.dependencies.storage.get().isOpen;
  }

  set isOpen(isOpen: boolean) {
    this.dependencies.storage.merge({ isOpen });
  }

  // 🎯 목적: 패널 너비 (localStorage와 연동, 범위 제한 적용)
  @computed
  get width(): number {
    return this.dependencies.storage.get().width;
  }

  set width(width: number) {
    // ⚠️ 중요: 너비를 minWidth ~ maxWidth 범위로 제한
    const clampedWidth = Math.max(this.minWidth, Math.min(width, this.maxWidth));
    this.dependencies.storage.merge({ width: clampedWidth });
  }

  // 🎯 목적: 패널 열기
  // 📝 2026-01-18: Issue 1 - Home 화면에서 클러스터 자동 선택 방지
  @action
  open() {
    this.isOpen = true;

    // 🎯 2026-01-18: 패널 열릴 때 활성 클러스터 자동 선택 (Home 화면 체크 추가)
    // 조건: 현재 선택된 클러스터가 없고, 활성 클러스터가 있으면 자동 선택
    // ⚠️ Home 화면(activeKubernetesCluster === undefined)에서는 클러스터 선택 안함
    if (this.selectedClusterIds.size === 0) {
      const activeKubeCluster = this.dependencies.activeKubernetesCluster?.get();
      const activeEntityId = this.dependencies.activeEntityId.get();

      // 📝 Home 화면 체크 - 둘 다 없으면 Home 화면으로 간주
      const isHomeScreen = !activeKubeCluster && !activeEntityId;
      if (isHomeScreen) {
        // Home 화면에서는 클러스터 선택하지 않음 (fallback도 실행 안함)
        return;
      }

      // 1순위: activeKubernetesCluster (클러스터 프레임 진입 시 활성화된 클러스터)
      if (activeKubeCluster && this.connectedClusters.some((c) => c.id === activeKubeCluster.id)) {
        this.selectSingleCluster(activeKubeCluster.id);
      }
      // 2순위: activeEntityId (catalog entity 기반)
      else if (activeEntityId && this.connectedClusters.some((c) => c.id === activeEntityId)) {
        this.selectSingleCluster(activeEntityId);
      }
      // 📝 3순위 fallback 제거
      // Home 화면이 아닌 경우에도 강제 선택하지 않음 (위의 조건에 해당 없으면 선택 안함)
      // 이전: else if (this.connectedClusters.length > 0) { selectSingleCluster(connectedClusters[0].id) }
    }
  }

  // 🎯 목적: 패널 닫기
  // 📝 패널 닫기 시 모든 진행 중인 요청 중단
  @action
  close() {
    this.stopAllStreaming(); // 📝 AC4: 모든 스트리밍 중단
    this.isOpen = false;
  }

  // 🎯 목적: 패널 열림/닫힘 토글
  @action
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 🎯 목적: Alert 분석을 위해 패널 열기 + 해당 threadId로 전환
   *
   * 📝 2026-03-12: Alert-Triggered AI Agent Phase 1
   * ClusterAlertsPopover에서 "AI Analyze" 버튼 클릭 시 호출.
   * 새 threadId로 전환하고 패널을 열어 스트리밍 결과를 표시합니다.
   */
  @action
  openForAlertAnalysis(threadId: string): void {
    // 상태 초기화 (startNewChat과 동일)
    this.messages = [];
    this.clarifyPrompt = null;
    this.clarifySubmissionPending = false;
    this.hitlPrompt = null;
    this.hitlSubmissionPending = false;
    this.toolApprovalPrompt = null;
    this.toolApprovalSubmissionPending = false;
    this.currentAssistantMessageId = null;
    this.agentError = null;
    this.nodeProgress = {
      isActive: false,
      currentStep: null,
      completedSteps: [],
      isExpanded: false,
    };

    // Alert threadId로 전환
    this.conversationId = threadId;
    // 에이전트가 이미 실행 중이므로 processing 상태로 표시
    this.isProcessing = true;

    // 패널 열기
    this.isOpen = true;
  }

  // 🎯 목적: 패널 너비 설정
  @action
  setWidth(width: number) {
    this.width = width;
  }

  // 🎯 목적: 스토리지 초기화 (테스트 또는 리셋 용도)
  @action
  reset() {
    this.dependencies.storage?.reset();
  }

  /**
   * 🎯 목적: Store 정리 (앱 종료 시 호출)
   *
   * 📝 Extension Host 패턴:
   * - IPC 이벤트 구독 해제
   */
  dispose(): void {
    // 📝 Edge Case: 중복 dispose 방지
    if (this.isDisposed) {
      console.warn("[AIChatPanelStore] 이미 dispose된 Store입니다.");
      return;
    }
    this.isDisposed = true;

    // 📝 모든 진행 중인 스트리밍 중단
    this.stopAllStreaming();

    if (this.unsubscribeFromStream) {
      this.unsubscribeFromStream();
      this.unsubscribeFromStream = null;
    }
  }

  /**
   * 🎯 목적: 현재 실행 중인 Agent 작업 취소
   *
   * ESC 키 또는 Stop 버튼으로 호출됩니다.
   * Main Process의 Agent 실행을 중단하고 isProcessing을 false로 설정합니다.
   */
  @action
  async cancelCurrentExecution(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    if (streamingState.isStreaming) {
      streamingState.cancelStreaming();
    }

    // 📝 클러스터별 AbortController도 정리
    this.stopAllStreaming();

    try {
      await this.dependencies.agentIPCClient.cancelExecution(this.conversationId);
    } catch (error) {
      console.error("[AIChatPanelStore] 작업 취소 실패:", error);
    }

    // IPC 응답과 관계없이 로컬 상태 정리
    runInAction(() => {
      this.isProcessing = false;
      this.currentAssistantMessageId = null;
      // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋
      this.isWaitingForLLMResponse = false;
      this.clarifyPrompt = null;
      this.hitlPrompt = null;
      this.toolApprovalPrompt = null;
      this.nodeProgress.isActive = false;
      this.nodeProgress.currentStep = null;
    });
  }

  /**
   * 🎯 목적: DAIVE fix 세션 시작 전 이전 세션 상태 강제 초기화
   *
   * plan_approval interrupt가 isProcessing=false인 채로 Main Process에 남아있을 때 사용.
   * cancelCurrentExecution의 isProcessing 가드를 우회하여 IPC 취소 요청을 직접 전송.
   *
   * 🔄 변경이력: 2026-03-24 - 초기 생성 (단일 취약점 fix 재시도 크래시 수정)
   */
  @action
  async resetSessionForNewFix(): Promise<void> {
    try {
      // isProcessing 가드 없이 직접 IPC 취소 요청
      await this.dependencies.agentIPCClient.cancelExecution(this.conversationId);
    } catch {
      // 이전 세션 없으면 무시
    }
    // 이전 fix가 allow_all 상태에서 크래시/강제 종료된 경우 안전하게 복원
    await this.setHitlLevelAsync("always_approve");
    runInAction(() => {
      this.isProcessing = false;
      this.hitlPrompt = null;
      this.toolApprovalPrompt = null;
    });
  }

  /**
   * 🎯 HITL 레벨을 Main Process에 동기적으로 설정 (await 가능)
   *
   * runInAction(() => hitlLevel = ...) 은 MobX reaction을 트리거해 IPC를 비동기로 보내는데,
   * sendMessage 호출 타이밍과 경쟁(race)이 발생해 ReActLoop Iteration 1이
   * hitlLevel 적용 전에 시작될 수 있음.
   * 이 메서드는 IPC 완료를 await해서 sendMessage 이전에 hitlLevel이 확실히 반영되도록 함.
   */
  async setHitlLevelAsync(level: HitlLevel): Promise<void> {
    runInAction(() => {
      this.hitlLevel = level;
    });
    await this.dependencies.agentIPCClient.setHitlLevel(level);
  }

  // 🎯 목적: 노드 진행 상황 카드 펼치기/접기 토글
  @action
  toggleNodeProgress() {
    this.nodeProgress.isExpanded = !this.nodeProgress.isExpanded;
  }

  // ============================================
  // 🎯 Past Chats 관련 Actions (2025-12-26)
  // ============================================

  /**
   * 🎯 목적: Past Chats 패널 토글
   */
  @action
  togglePastChats() {
    this.showPastChats = !this.showPastChats;
    if (this.showPastChats) {
      this.loadPastChats();
    }
  }

  /**
   * 🎯 목적: Past Chats 목록 로드
   */
  @action
  async loadPastChats(): Promise<void> {
    if (this.isPastChatsLoading) return;

    this.isPastChatsLoading = true;

    try {
      const threads = await this.dependencies.agentIPCClient.listThreads(50);

      runInAction(() => {
        this.pastChats = threads;
        this.isPastChatsLoading = false;
      });
    } catch (error) {
      console.error("[AIChatPanelStore] Past Chats 로드 실패:", error);
      runInAction(() => {
        this.isPastChatsLoading = false;
        this.pastChats = [];
      });
    }
  }

  /**
   * 🎯 목적: Past Chat 선택 및 로드
   *
   * 선택한 Thread의 메시지를 로드하고 현재 대화로 전환합니다.
   *
   * @param threadId - 선택한 Thread ID
   */
  @action
  async selectPastChat(threadId: string): Promise<void> {
    if (this.isProcessing) return;

    try {
      const result = await this.dependencies.agentIPCClient.loadThread(threadId);

      if (!result.success) {
        throw new Error(result.error ?? "대화 로드에 실패했습니다.");
      }

      runInAction(() => {
        // 🎯 대화 ID를 선택한 Thread ID로 변경
        this.conversationId = threadId;

        // 🎯 메시지 변환 및 로드
        // 📝 2026-01-13: 해결 - 확장 속성 복원
        this.messages = result.messages.map((msg, index) => {
          const message: ChatMessage = {
            id: `${threadId}-${index}`,
            role: msg.role as ChatMessageRole,
            content: msg.content,
            status: "complete" as const,
          };

          // 확장 속성 복원
          if (msg.presentation) {
            message.presentation = msg.presentation;
          }
          if (msg.toolApprovalResult) {
            message.toolApprovalResult = msg.toolApprovalResult;
          }
          if (msg.planSnapshot) {
            message.planSnapshot = msg.planSnapshot;
          }
          if (msg.planStatusMessageData) {
            message.planStatusMessage = msg.planStatusMessageData;
          }

          return message;
        });

        // 🎯 Past Chats 패널 닫기
        this.showPastChats = false;

        // 🎯 수정: startNewChat()과 동일한 수준의 상태 초기화
        // === Clarify 상태 ===
        this.clarifyPrompt = null;
        this.clarifySubmissionPending = false;

        // === HITL 상태 ===
        this.hitlPrompt = null;
        this.hitlSubmissionPending = false;

        // === Tool Approval 상태 ===
        this.toolApprovalPrompt = null;
        this.toolApprovalSubmissionPending = false;

        // === 처리 상태 (핵심!) ===
        this.isProcessing = false;
        this.currentAssistantMessageId = null;

        // === Agent 상태 (핵심!) ===
        if (this.hasApiKey) {
          this.agentStatus = "ready";
        }
        this.agentError = null;

        // === 노드 진행 상황 (완전 초기화) ===
        this.nodeProgress = {
          isActive: false,
          currentStep: null,
          completedSteps: [],
          isExpanded: false,
        };
      });
    } catch (error) {
      console.error("[AIChatPanelStore] Past Chat 로드 실패:", error);
      // 에러 알림 (TODO: 토스트 메시지)
    }
  }

  /**
   * 🎯 목적: 새 채팅 세션 시작
   *
   * 현재 대화를 초기화하고 새로운 Thread ID로 시작합니다.
   */
  @action
  startNewChat(): void {
    // 🎯 새 대화 ID 생성
    this.conversationId = uuid();

    // 🎯 메시지 초기화
    this.messages = [];

    // 🎯 상태 초기화
    this.clarifyPrompt = null;
    this.clarifySubmissionPending = false;
    this.hitlPrompt = null;
    this.hitlSubmissionPending = false;
    this.toolApprovalPrompt = null;
    this.toolApprovalSubmissionPending = false;
    this.isProcessing = false;
    this.currentAssistantMessageId = null;

    // 🎯 수정: Agent 상태 초기화 추가 (2026-01-12)
    // 에러 발생 후 새 대화 시작 시에도 agentStatus를 "ready"로 복원해야 함
    if (this.hasApiKey) {
      this.agentStatus = "ready";
    }
    this.agentError = null;

    // 🎯 노드 진행 상황 초기화
    this.nodeProgress = {
      isActive: false,
      currentStep: null,
      completedSteps: [],
      isExpanded: false,
    };
  }

  /**
   * 🎯 목적: 현재 대화방 메시지만 클리어 (Thread ID 유지)
   *
   * 📝 2026-01-29: /clear 명령어용
   * - /new: 새 Thread ID 생성 (startNewChat)
   * - /clear: 현재 Thread ID 유지, 메시지만 클리어 (이 메서드)
   */
  @action
  clearMessages(): void {
    // 🎯 메시지만 초기화 (Thread ID는 유지)
    this.messages = [];

    // 🎯 상태 초기화 (startNewChat과 동일)
    this.clarifyPrompt = null;
    this.clarifySubmissionPending = false;
    this.hitlPrompt = null;
    this.hitlSubmissionPending = false;
    this.toolApprovalPrompt = null;
    this.toolApprovalSubmissionPending = false;
    this.isProcessing = false;
    this.currentAssistantMessageId = null;

    if (this.hasApiKey) {
      this.agentStatus = "ready";
    }
    this.agentError = null;

    // 🎯 노드 진행 상황 초기화
    this.nodeProgress = {
      isActive: false,
      currentStep: null,
      completedSteps: [],
      isExpanded: false,
    };
  }

  /**
   * 🎯 목적: 로컬 Assistant 메시지 추가 (AI 응답 없이)
   *
   * 📝 2026-01-29: 슬래시 명령어 처리용
   * - /help, /new, /clear 같은 특수 명령어에서 사용
   * - AI에게 전송하지 않고 로컬에서 메시지만 추가
   *
   * @param content - 메시지 내용
   */
  @action
  addLocalAssistantMessage(content: string): void {
    const messageId = uuid();
    this.messages.push({
      id: messageId,
      role: "assistant",
      content,
      status: "complete",
      presentation: "chat",
    });
  }

  /**
   * 목적: Chat / Alerts 탭 전환
   */
  @action
  selectTab(tab: "chat" | "alerts"): void {
    this.activeTab = tab;
  }

  /**
   * 목적: Monitor finding 분석 요청 → Chat 탭 전환 후 분석 프롬프트 전송
   */
  @action
  async sendMonitorAnalysis(finding: {
    clusterId: string;
    title: string;
    description: string;
    suggestedCommands: string[];
  }): Promise<void> {
    this.selectTab("chat");
    this.selectSingleCluster(finding.clusterId);

    const commands = (finding.suggestedCommands ?? []).map((cmd) => `\`${cmd}\``).join("\n");
    const prompt = `Please analyze the following Kubernetes issue:\n\n**${finding.title}**\n${finding.description}\n\nSuggested commands:\n${commands}\n\nExplain the root cause and resolution in detail.`;

    try {
      await this.sendMessage(prompt);
    } catch (error) {
      console.error("[AIChatPanelStore] sendMonitorAnalysis 에러:", error);
    }
  }

  /**
   * 🎯 목적: Past Chat 삭제
   *
   * @param threadId - 삭제할 Thread ID
   */
  @action
  async deletePastChat(threadId: string): Promise<void> {
    try {
      const result = await this.dependencies.agentIPCClient.deleteThread(threadId);

      if (!result.success) {
        throw new Error(result.error ?? "대화 삭제에 실패했습니다.");
      }

      runInAction(() => {
        // 🎯 목록에서 제거
        this.pastChats = this.pastChats.filter((chat) => chat.threadId !== threadId);
      });
    } catch (error) {
      console.error("[AIChatPanelStore] Past Chat 삭제 실패:", error);
    }
  }

  // 🎯 목적: API key 존재 여부 확인
  // 어떤 provider든 API 키가 있으면 true 반환 (채팅 UI 표시용)
  // Ollama는 API 키가 필요 없으므로 명시적으로 활성화(=== true) + 모델 설정 시 사용 가능
  @computed
  get hasApiKey(): boolean {
    const aiApiKeys = this.dependencies.userPreferencesState.aiApiKeys || {};
    const providers = ["openai", "anthropic", "google", "openrouter"];

    // 🎯 Ollama 체크: API 키 불필요, 명시적 활성화(=== true) + 모델 설정 시 사용 가능
    // 기본값이 undefined이면 비활성화로 처리 (명시적으로 켜야만 활성화)
    const ollamaEnabled = this.dependencies.userPreferencesState.aiProviderEnabled?.["ollama"] === true;
    const ollamaModel = this.dependencies.userPreferencesState.ollamaModel;
    const hasOllama = ollamaEnabled && !!ollamaModel && ollamaModel.trim().length > 0;

    if (hasOllama) {
      return true;
    }

    return providers.some((provider) => {
      const encryptedKey = aiApiKeys[provider];

      return !!encryptedKey && encryptedKey.length > 0;
    });
  }

  // 목적: 저장된 AI API 키 목록 반환 (드롭다운용)
  @computed
  get aiApiKeys(): Record<string, string | undefined> {
    return this.dependencies.userPreferencesState.aiApiKeys || {};
  }

  // 목적: 현재 선택된 AI Provider 반환
  @computed
  get aiProvider(): string {
    return this.dependencies.userPreferencesState.aiProvider;
  }

  // 목적: AI Provider 설정
  set aiProvider(provider: string) {
    this.dependencies.userPreferencesState.aiProvider = provider;
  }

  // 🎯 목적: AI Provider별 활성화 상태 반환 (스위치 ON/OFF)
  // 기본값: 모든 Provider 활성화 (true)
  @computed
  get aiProviderEnabled(): Record<string, boolean> {
    return this.dependencies.userPreferencesState.aiProviderEnabled || {};
  }

  // 🎯 목적: 개별 모델 활성화 상태 반환 (스위치 ON/OFF)
  // 기본값: 모든 모델 활성화 (true)
  @computed
  get aiModelEnabled(): Record<string, boolean> {
    return this.dependencies.userPreferencesState.aiModelEnabled || {};
  }

  // 🎯 목적: 현재 선택된 AI 모델 반환 (기본값: 빈 문자열 - 사용자가 선택해야 함)
  @computed
  get aiModel(): string {
    return this.dependencies.userPreferencesState.aiModel || "";
  }

  // 🎯 목적: AI 모델 설정 및 Provider 자동 동기화
  set aiModel(model: string) {
    // 모델 설정
    this.dependencies.userPreferencesState.aiModel = model;

    // 모델에서 Provider 추출하여 자동 동기화
    const provider = getProviderByModel(model);

    if (provider) {
      this.dependencies.userPreferencesState.aiProvider = provider;

      // 최근 사용 모델 기록
      this.dependencies.userPreferencesState.aiRecentModels = {
        ...this.dependencies.userPreferencesState.aiRecentModels,
        [provider]: model,
      };
    }

    // 🎯 Ollama 모델 선택 시 Provider와 ollamaModel 동기화
    // Ollama 모델은 "Ollama: modelname" 형식으로 표시되지 않고 사용자가 설정한 그대로 사용
    if (this.dependencies.userPreferencesState.ollamaModel === model) {
      this.dependencies.userPreferencesState.aiProvider = "ollama";
    }
  }

  // 🎯 목적: Provider별 최근 사용 모델 기록 반환
  @computed
  get aiRecentModels(): Record<string, string> {
    return this.dependencies.userPreferencesState.aiRecentModels || {};
  }

  // 🎯 목적: Ollama Base URL getter
  @computed
  get ollamaBaseUrl(): string {
    return this.dependencies.userPreferencesState.ollamaBaseUrl || "http://localhost:11434";
  }

  // 🎯 목적: Ollama Model getter
  @computed
  get ollamaModel(): string {
    return this.dependencies.userPreferencesState.ollamaModel || "gemma3:4b";
  }

  // 🎯 목적: OpenRouter Custom Model getter
  @computed
  get openrouterCustomModel(): string | undefined {
    return this.dependencies.userPreferencesState.openrouterCustomModel;
  }

  // 🎯 목적: 현재 클러스터 ID getter (멘션 리소스 조회용)
  @computed
  get currentClusterId(): string | undefined {
    return this.dependencies.activeEntityId.get();
  }

  // 🎯 목적: 선택된 네임스페이스 getter (멘션 리소스 조회용)
  @computed
  get selectedNamespace(): string | undefined {
    const namespaces = this.dependencies.selectedNamespacesStorage.get();
    return namespaces.length > 0 ? namespaces[0] : undefined;
  }

  // 목적: API key 저장 (암호화)
  @action
  async saveApiKey(provider: string, apiKey: string): Promise<void> {
    try {
      // 1. API 키 암호화
      const encryptedKey = await this.dependencies.encryptService.encryptApiKey(provider as AIProvider, apiKey);

      // 2. User Preferences 저장
      this.dependencies.userPreferencesState.aiProvider = provider;
      this.dependencies.userPreferencesState.aiApiKeys = {
        ...this.dependencies.userPreferencesState.aiApiKeys,
        [provider]: encryptedKey,
      };
    } finally {
      // 🎯 Extension Host: Main Process의 AgentHost 리셋
      await this.dependencies.agentIPCClient.reset(this.conversationId);

      runInAction(() => {
        this.agentStatus = "not-initialized";
        this.agentError = null;
        this.conversationId = uuid();
      });
    }
  }

  /**
   * 🎯 목적: 패널이 열릴 때 Agent 상태를 초기화
   *
   * 📝 Extension Host 패턴 (2025-12-16):
   * - Agent는 Main Process에서 실행되므로 별도 초기화 불필요
   * - API 키만 확인하고 ready 상태로 설정
   *
   * ⚠️ 중요: API 키가 없는 경우에는 초기화하지 않는다.
   */
  @action
  async initializeAgent(): Promise<void> {
    if (!this.hasApiKey) {
      return;
    }

    if (this.agentStatus === "initializing" || this.agentStatus === "ready") {
      return;
    }

    this.agentStatus = "initializing";
    this.agentError = null;

    try {
      // 🎯 Extension Host: Agent는 Main Process에서 실행
      // API 키가 있으면 바로 ready 상태로 설정
      // 실제 LLM 모델 생성은 Main Process에서 요청 시 수행

      runInAction(() => {
        this.agentStatus = "ready";
      });
    } catch (error) {
      runInAction(() => {
        this.agentStatus = "error";
        this.agentError = error instanceof Error ? error.message : "AI Agent 초기화에 실패했습니다.";
      });
    }
  }

  /**
   * 🎯 목적: Clarify 카드에서 받은 값을 interrupt 재개로 전달
   *
   * 📝 Extension Host 패턴 (2025-12-16):
   * - AgentIPCClient.resumeInterrupt로 Main Process에 재개 요청
   * - 결과는 IPC 스트림 이벤트로 수신
   */
  async submitClarifyAnswer(payload: ClarifySubmissionPayload): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    const sanitizedPayload = sanitizeClarifySubmissionPayload(payload);

    if (!hasClarifySubmissionContent(sanitizedPayload)) {
      return;
    }

    runInAction(() => {
      this.clarifySubmissionPending = true;
      this.clarifyPrompt = null;
    });

    this.isProcessing = true;
    // 🎯 2026-01-30: LLM 응답 대기 플래그 설정 (skeleton dots 표시용)
    this.isWaitingForLLMResponse = true;
    const assistantMessageId = uuid();
    this.currentAssistantMessageId = assistantMessageId;

    runInAction(() => {
      this.clearProgressLogs();
      this.messages.push({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      });
    });

    try {
      // 🎯 Extension Host: Main Process로 interrupt 재개 요청
      const response = await this.dependencies.agentIPCClient.resumeInterrupt({
        threadId: this.conversationId,
        response: sanitizedPayload,
        provider: this.aiProvider as AIProvider,
      });

      if (!response.accepted) {
        throw new Error(response.error ?? "Clarify 재개 요청이 거부되었습니다.");
      }

      // 결과는 IPC 스트림 이벤트로 수신됨
    } catch (error) {
      const assistantIndex = this.messages.findIndex((entry) => entry.id === assistantMessageId);

      if (assistantIndex >= 0) {
        this.updateMessageAt(assistantIndex, {
          status: "error",
          content: error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ An unknown error occurred.",
        });
      }

      runInAction(() => {
        this.clarifySubmissionPending = false;
        this.isProcessing = false;
        this.currentAssistantMessageId = null;
        // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋
        this.isWaitingForLLMResponse = false;
      });

      throw error;
    } finally {
      runInAction(() => {
        this.clarifySubmissionPending = false;
      });
    }
  }

  /**
   * 🎯 목적: HITL 승인/거절 응답 제출
   *
   * 📝 Extension Host 패턴 (2025-12-16):
   * - AgentIPCClient.resumeInterrupt로 Main Process에 재개 요청
   * - 결과는 IPC 스트림 이벤트로 수신
   */
  async submitHitlDecision(decision: string): Promise<void> {
    const trimmed = decision.trim();

    if (!trimmed || this.hitlSubmissionPending) {
      return;
    }

    runInAction(() => {
      this.hitlSubmissionPending = true;
      this.hitlPrompt = null;
    });

    this.isProcessing = true;
    // 🎯 2026-01-30: LLM 응답 대기 플래그 설정 (skeleton dots 표시용)
    this.isWaitingForLLMResponse = true;
    const assistantMessageId = uuid();
    this.currentAssistantMessageId = assistantMessageId;

    runInAction(() => {
      this.clearProgressLogs();
      this.messages.push({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      });
    });

    try {
      // 🎯 Extension Host: Main Process로 interrupt 재개 요청
      const response = await this.dependencies.agentIPCClient.resumeInterrupt({
        threadId: this.conversationId,
        response: trimmed,
        provider: this.aiProvider as AIProvider,
      });

      if (!response.accepted) {
        throw new Error(response.error ?? "HITL 재개 요청이 거부되었습니다.");
      }

      // 결과는 IPC 스트림 이벤트로 수신됨
    } catch (error) {
      console.error("[HITL DEBUG ERROR]", error);
      const assistantIndex = this.messages.findIndex((entry) => entry.id === assistantMessageId);

      if (assistantIndex >= 0) {
        this.updateMessageAt(assistantIndex, {
          status: "error",
          content: error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ An unknown error occurred.",
        });
      }

      runInAction(() => {
        this.hitlSubmissionPending = false;
        this.isProcessing = false;
        this.currentAssistantMessageId = null;
        // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋
        this.isWaitingForLLMResponse = false;
      });

      throw error;
    } finally {
      runInAction(() => {
        this.hitlSubmissionPending = false;
      });
    }
  }

  /**
   * 🎯 목적: 사용자 메시지를 Main Process의 Agent로 전달
   *
   * 📝 Extension Host 패턴 (2025-12-16):
   * - AgentIPCClient.sendMessage로 Main Process에 요청
   * - 결과는 IPC 스트림 이벤트로 수신
   *
   * 📝 2026-01-07: 수정
   * - attachedContexts: 사용자가 멘션(@)으로 선택한 리소스 목록
   * - slashCommand: 슬래시 명령어 정보 및 행동 지침
   *
   * @param text - 사용자 입력 메시지
   * @param attachedContexts - 선택된 컨텍스트 리소스 목록 (선택적)
   * @param slashCommand - 슬래시 명령어 정보 (선택적)
   */
  async sendMessage(
    text: string,
    attachedContexts?: Array<{ id: string; type: string; name: string; namespace?: string }>,
    slashCommand?: SlashCommandInfo,
  ): Promise<void> {
    if (!text.trim()) {
      return;
    }

    if (this.clarifyPrompt || this.clarifySubmissionPending) {
      return;
    }

    if (this.agentStatus !== "ready") {
      throw new Error("AI Agent가 준비되지 않았습니다.");
    }

    // 🎯 Plan 종료 상태에서 isProcessing이 true로 남아있는 경우 방어
    // - Plan이 failed/completed/rejected/idle 상태인데 isProcessing이 true면 강제 리셋
    // - 이벤트 처리 타이밍 이슈나 예외 상황에서의 방어적 코드
    if (this.isProcessing) {
      const currentPlanStatus = planState.status;
      if (
        currentPlanStatus === "failed" ||
        currentPlanStatus === "completed" ||
        currentPlanStatus === "rejected" ||
        currentPlanStatus === "idle"
      ) {
        console.warn("[AIChatPanelStore] 방어 코드 발동: Plan 종료 상태에서 isProcessing이 true - 강제 리셋", {
          planStatus: currentPlanStatus,
          isProcessing: this.isProcessing,
        });
        this.isProcessing = false;
        this.currentAssistantMessageId = null;
        this.nodeProgress.isActive = false;
      } else {
        // Plan이 아직 실행 중(drafting/executing)이면 입력 차단
        return;
      }
    }

    let trimmed = text.trim();

    // Security 그룹 채팅: 보류 중인 컨텍스트가 있으면 첫 메시지에 합침
    const pendingCtx = (this as any).__pendingGroupContext as string | undefined;
    const originalUserText = trimmed;
    if (pendingCtx) {
      trimmed = `${pendingCtx}\n\n---\nUser question: ${trimmed}`;
      delete (this as any).__pendingGroupContext;
    }

    const userMessage: ChatMessage = {
      id: uuid(),
      role: "user",
      // UI에는 원래 질문만 표시, LLM에는 컨텍스트+질문 전체 전달
      content: pendingCtx ? originalUserText : trimmed,
      status: "complete",
    };
    const assistantMessageId = uuid();
    this.currentAssistantMessageId = assistantMessageId;

    runInAction(() => {
      this.clearProgressLogs();
      this.toolApprovalPrompt = null;
      this.toolApprovalSubmissionPending = false;

      // 🎯 새 질문 시 노드 진행 상황 리셋
      this.nodeProgress.completedSteps = [];
      this.nodeProgress.currentStep = null;
      this.nodeProgress.isActive = false;

      this.messages.push(userMessage);
      this.messages.push({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      });
    });

    this.isProcessing = true;
    // 🎯 2026-01-30: LLM 응답 대기 플래그 설정 (skeleton dots 표시용)
    // - 모든 LLM 호출 케이스를 통합 (sendMessage, submitToolApproval, submitClarify, submitHitl)
    this.isWaitingForLLMResponse = true;

    // 🎯 2026-01-29: Immediate UI feedback (Nielsen Norman Group 100ms rule)
    // IPC 요청 전에 즉시 "preparing" 상태로 전환하여 사용자에게 피드백 제공
    this.activityPhase = "preparing";

    // 🎯 2026-01-29: PHASE 3 - Timeout fallback
    // Clear any existing timeout and set new one
    this.clearActivityTimeout();
    this.activityTimeoutId = setTimeout(() => {
      if (this.activityPhase === "preparing") {
        console.warn("[AIChatPanelStore] Activity timeout: No response received within 10s");
        // Don't reset activityPhase here - let it continue if processing eventually starts
        // This is just a warning for debugging
      }
    }, AIChatPanelStore.ACTIVITY_TIMEOUT_MS);

    try {
      // 🎯 Extension Host: Main Process로 메시지 전송 요청
      // 현재 컨텍스트 구성 (클러스터, 네임스페이스 등)
      // 📝 2025-12-17: 실제 clusterId, namespace 주입 (Main Tools에서 사용)
      // 📝 2026-01-07: 수정 - attachedContexts 추가
      // 📝 2026-01-18: Issue 3 - selectedClusterIds 우선 사용
      const selectedNamespaces = this.dependencies.selectedNamespacesStorage.get();

      // 🎯 2026-01-18: AI Panel에서 선택한 클러스터 우선 사용
      // selectedClusterIds가 있으면 첫 번째 선택된 클러스터 사용
      // 없으면 activeEntityId (카탈로그 활성 엔티티) 사용
      const selectedClusterId =
        this.selectedClusterIds.size > 0
          ? Array.from(this.selectedClusterIds)[0]
          : this.dependencies.activeEntityId.get();

      // 🆕 2026-01-29: AI File System 통합 - 클러스터 이름 조회
      const selectedCluster = selectedClusterId
        ? this.connectedClusters.find((c) => c.id === selectedClusterId)
        : undefined;

      const context: AgentContext = {
        clusterId: selectedClusterId ?? null,
        // 🆕 AI File System에서 폴더명으로 사용됨 (예: kubernetes-admin@my-cluster)
        clusterName: selectedCluster?.name ?? null,
        namespace: selectedNamespaces.length > 0 ? selectedNamespaces[0] : null,
        openedResource: null,
        // 🆕 사용자가 선택한 컨텍스트 리소스 목록
        attachedContexts: attachedContexts ?? [],
        // 🎯 FIX: Safe Zone 기본 경로 전달 (Settings > File Explorer > Default folder path)
        // Main Process에서 userPreferencesState가 제대로 로드되지 않는 문제 대응
        basePath: this.dependencies.userPreferencesState.fileExplorerDefaultPath || null,
        // 🆕 2026-02-27: 모니터 알림 컨텍스트 주입
        monitorAlert: this.getRecentMonitorAlert(),
      };

      // 📝 클러스터별 AbortController 관리
      // - 이전 동일 클러스터 요청 중단 및 새 AbortSignal 생성
      if (context.clusterId) {
        this.startStreamingForCluster(context.clusterId);
      }

      // 🎯 디버그 로그 - 선택된 컨텍스트 확인

      const response = await this.dependencies.agentIPCClient.sendMessage({
        threadId: this.conversationId,
        message: trimmed,
        provider: this.aiProvider as AIProvider,
        modelId: this.aiModel,
        context,
        assistantMessageId,
        // 🆕 슬래시 명령어 정보 전달
        slashCommand,
      });

      if (!response.accepted) {
        throw new Error(response.error ?? "메시지 전송 요청이 거부되었습니다.");
      }

      // 결과는 IPC 스트림 이벤트로 수신됨
    } catch (error) {
      console.error("[AIChatPanelStore] sendMessage 에러:", error);

      const assistantIndex = this.messages.findIndex((entry) => entry.id === assistantMessageId);

      if (assistantIndex >= 0) {
        this.updateMessageAt(assistantIndex, {
          status: "error",
          content: error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ An unknown error occurred.",
        });
      }

      runInAction(() => {
        this.isProcessing = false;
        this.currentAssistantMessageId = null;
        // 🎯 2026-01-29: Reset activityPhase on sendMessage error
        this.activityPhase = "idle";
        // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋 (안전 조치)
        this.isWaitingForLLMResponse = false;
      });

      throw error;
    }
  }

  // ============================================
  // 🎯 Extension Host 패턴: 레거시 메서드들 제거됨 (2025-12-16)
  //
  // 스트림 처리: IPC 이벤트 핸들러에서 수행
  // - handleMessageChunk, handleMessageComplete, handleInterrupt
  // - handleNodeProgress, handleAgentComplete, handleAgentError
  //
  // 인터럽트 상태: IPC 이벤트로 수신
  // - checkPendingToolApproval, syncPromptsFromLatestState
  //
  // 내부 노드 필터링: Main Process에서 처리
  // - isInternalAgentNode, isInternalAgentMessage
  //
  // HITL 질문 구성: Main Process에서 처리
  // - composeHitlQuestion, renderPlanSummary
  //
  // 유틸리티 메서드: Main Process에서 사용
  // - asRecord, toStringArray, safePick, normalizeNodeIdentifier
  // - isNodeCommitted, getNodeDisplayInfo (snapshot 버전)
  //
  // 노드 정보: IPC 이벤트 기반
  // ============================================

  logClarifySubmit(_payload: ClarifySubmissionPayload) {
    // no-op: debug logging removed
  }

  /**
   * 🎯 목적: 진행 로그 메시지를 모두 제거
   */
  @action
  private clearProgressLogs() {
    const remaining = this.messages.filter((entry) => entry.presentation !== "log");

    this.messages.splice(0, this.messages.length, ...remaining);
  }

  /**
   * 🎯 목적: 특정 메시지를 새 객체로 교체하여 반응성을 유지
   */
  @action
  private updateMessageAt(index: number, patch: Partial<ChatMessage>) {
    const current = this.messages[index];

    if (!current) {
      return;
    }

    this.messages[index] = {
      ...current,
      ...patch,
    };
  }

  // 📝 2026-01-13: - addPlanStatusMessage 함수 제거
  // - 기존: Plan 상태를 박스형 UI로 표시 (PlanStatusMessage 컴포넌트)
  // - 수정: PlanViewer에서 이미 상태 표시, LLM 응답은 일반 메시지로 표시
  // - 불필요한 중복 UI 제거로 심플화

  // ============================================
  // 🎯 Extension Host 패턴: 레거시 Tool Approval 파싱 메서드 제거됨
  // - extractToolApprovalInterrupt: Main Process에서 처리
  // - composeActionSummary: Main Process에서 처리
  // - findInterruptPayload: Main Process에서 처리
  //
  // Tool Approval 정보는 IPC interrupt 이벤트 payload로 수신됨
  // ============================================

  /**
   * 🎯 목적: Tool 승인 응답 제출
   *
   * 📝 Extension Host 패턴 (2025-12-16):
   * - AgentIPCClient.resumeInterrupt로 Main Process에 재개 요청
   * - 결과는 IPC 스트림 이벤트로 수신
   *
   * 📝 2026-01-06: 승인 결과 메시지 추가
   * - 승인/거절 시 결과를 메시지로 표시
   * - Cursor AI 스타일의 인라인 결과 표시
   */
  async submitToolApproval(answer: string): Promise<void> {
    const trimmed = answer.trim();

    if (!trimmed || this.isProcessing) {
      return;
    }

    // 🎯 승인 전 정보 저장 (결과 표시용)
    // 🔄 변경이력: 2026-01-06 - "approve" 패턴 추가 (버그 수정 - "yes"만 인식하던 문제)
    // 📝 2026-01-07: 해결 - yamlContent(stdin) 추가
    // 📝 2026-01-13: toolName 추가 (Problem 1 해결 - 실행 결과 직접 연결)
    const normalizedAnswer = trimmed.toLowerCase();
    const isApprovedAnswer = normalizedAnswer === "yes" || normalizedAnswer === "approve";
    const approvalInfo = this.toolApprovalPrompt
      ? {
          command:
            this.toolApprovalPrompt.requestString ??
            this.toolApprovalPrompt.actionSummary ??
            this.toolApprovalPrompt.question,
          isApproved: isApprovedAnswer,
          // 🆕 YAML 내용 저장 (kubectl 명령어의 stdin)
          yamlContent: this.toolApprovalPrompt.stdin,
          // 🆕 Diff 승인 정보 (파일 수정 시) - approval 필드 사용
          approval: this.toolApprovalPrompt.approval,
          // 🆕 2026-01-13: Tool 이름 저장 (Problem 1 해결)
          toolName: this.toolApprovalPrompt.toolName,
        }
      : null;

    runInAction(() => {
      this.toolApprovalSubmissionPending = true;
      this.toolApprovalPrompt = null;
    });

    this.isProcessing = true;
    // 🎯 2026-01-30: LLM 응답 대기 플래그 설정 (skeleton dots 표시용)
    this.isWaitingForLLMResponse = true;
    const assistantMessageId = uuid();
    this.currentAssistantMessageId = assistantMessageId;

    runInAction(() => {
      this.clearProgressLogs();

      // 🎯 승인 결과 메시지 먼저 추가 (채팅 영역에 표시)
      // 📝 2026-01-07: 해결 - yamlContent, diffStats, filePath 추가
      // 📝 2026-01-13: 승인 시 메시지 ID 저장 (실행 결과 연결용)
      if (approvalInfo) {
        const resultMessageId = uuid();

        // 🆕 Diff 승인 정보에서 통계 및 파일 경로 추출
        const diffStats = approvalInfo.approval?.diff ? this.extractDiffStats(approvalInfo.approval.diff) : undefined;
        const filePath = approvalInfo.approval?.filePath;

        const toolApprovalResultData = {
          approved: approvalInfo.isApproved,
          command: approvalInfo.command,
          timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
          // 🆕 YAML 내용 및 Diff 정보 추가
          yamlContent: approvalInfo.isApproved ? approvalInfo.yamlContent : undefined,
          diffStats,
          filePath,
        };

        this.messages.push({
          id: resultMessageId,
          role: "system",
          content: "", // content는 비워두고 toolApprovalResult로 표시
          status: "complete",
          presentation: "tool-approval-result",
          toolApprovalResult: toolApprovalResultData,
        });

        // 📝 2026-01-13: 해결 - UI 메시지를 ConversationLogger에 저장
        this.dependencies.agentIPCClient
          .logUIMessage({
            threadId: this.conversationId,
            role: "system",
            content: "",
            presentation: "tool-approval-result",
            toolApprovalResult: toolApprovalResultData,
          })
          .catch((error) => {
            console.warn("[AIChatPanelStore] tool-approval-result 로깅 실패:", error);
          });

        // 🆕 2026-01-13: 승인된 경우 메시지 ID를 Tool 이름과 매핑 (실행 결과 연결용)
        // 📝 Problem 1 해결: toolName이 있으면 즉시 매핑, 없으면 Queue 사용 (fallback)
        if (approvalInfo.isApproved) {
          if (approvalInfo.toolName) {
            // 🎯 직접 매핑 (권장): Main Process에서 toolName을 전달받은 경우
            this.toolApprovalResultMessageIds.set(approvalInfo.toolName, resultMessageId);
          } else {
            // Fallback: toolName 없으면 Queue 사용 (on_tool_start 이벤트에서 매핑)
            this.pendingToolApprovalResultMessageIds.push(resultMessageId);
          }
        }
      }

      // 🎯 AI 응답 메시지 추가
      this.messages.push({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      });
    });

    try {
      const response = await this.dependencies.agentIPCClient.resumeInterrupt({
        threadId: this.conversationId,
        response: trimmed,
        provider: this.aiProvider as AIProvider,
      });

      if (!response.accepted) {
        throw new Error(response.error ?? "Tool 승인 재개 요청이 거부되었습니다.");
      }
    } catch (error) {
      console.error("[ToolApproval Submit ERROR]", error);

      const assistantIndex = this.messages.findIndex((entry) => entry.id === assistantMessageId);
      if (assistantIndex >= 0) {
        this.updateMessageAt(assistantIndex, {
          status: "error",
          content: error instanceof Error ? `⚠️ Error: ${error.message}` : "⚠️ An unknown error occurred.",
        });
      }

      runInAction(() => {
        this.toolApprovalSubmissionPending = false;
        this.isProcessing = false;
        this.currentAssistantMessageId = null;
        // 🎯 2026-01-30: LLM 응답 대기 플래그 리셋
        this.isWaitingForLLMResponse = false;
      });

      throw error;
    } finally {
      runInAction(() => {
        this.toolApprovalSubmissionPending = false;
      });
    }
  }

  /**
   * 🎯 목적: Plan 승인/거부 응답 제출
   *
   * 📝 주요 기능:
   * - 사용자의 Plan 승인/거부를 Main Process로 전송
   * - toolApprovalPrompt UI와 통합되어 동작
   * - "approve" → Plan 실행 시작
   * - "reject" → Plan 취소
   *
   * 📝 2026-01-12: Auto Plan Tracker 추가
   *
   * @param decision - "approve" 또는 "reject"
   */
  async submitPlanApproval(decision: "approve" | "reject"): Promise<void> {
    // toolApprovalPrompt가 있으면 일반 Tool Approval 로직 사용
    // Plan 승인도 동일한 interrupt resume 메커니즘 사용
    await this.submitToolApproval(decision);

    // 로컬 planState 업데이트 (실제 상태는 Main Process에서 IPC 이벤트로 전달됨)
    if (decision === "reject") {
      planState.rejectPlan();
    }
  }

  /**
   * 🎯 목적: Diff 문자열에서 추가/삭제 라인 수 추출
   *
   * 📝 주의사항:
   * - Unified Diff 형식에서 + / - 로 시작하는 라인 카운트
   * - @@ 헤더 라인은 제외
   *
   * 🔄 변경이력: 2026-01-07 - 해결용 추가
   */
  /**
   * 🎯 피드백 제출
   *
   * 유저의 응답 평가를 Main Process로 전송합니다.
   * IPC 핸들러가 등록되면 UserProfileStore에 저장됩니다.
   */
  submitFeedback(
    messageId: string,
    threadId: string,
    rating: "positive" | "negative",
    category?: FeedbackCategory,
    detail?: string,
  ): void {
    // IPC로 Main Process에 피드백 전송
    this.dependencies.agentIPCClient.sendFeedback(threadId, rating, category, detail);
  }

  private extractDiffStats(diff: string): { additions: number; deletions: number } {
    const lines = diff.split("\n");
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      // Unified Diff 헤더(@@ ... @@) 및 파일 헤더(--- +++), No newline 메시지 제외
      if (
        line.startsWith("@@") ||
        line.startsWith("---") ||
        line.startsWith("+++") ||
        line.startsWith("\\ No newline")
      ) {
        continue;
      }

      if (line.startsWith("+")) {
        additions++;
      } else if (line.startsWith("-")) {
        deletions++;
      }
    }

    return { additions, deletions };
  }
}
