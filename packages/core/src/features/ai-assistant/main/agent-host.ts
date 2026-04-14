/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Main Process Agent Host (Extension Host)
 *
 * Main Process에서 AI Agent를 실행하고 관리합니다.
 * - LLM API 호출 (API 키 보호)
 * - ReAct Loop Agent 실행 (단일 while-loop)
 * - Tool 실행 및 HITL Promise 관리
 * - IPC 스트리밍
 */

import { getHitlLevel } from "./agent/main-tools";
import { resolveHITLApproval, runReactLoop } from "./agent/react-loop";
import { buildSystemPrompt } from "./agent/react-prompts";
import { createReactTools } from "./agent/react-tools";

import type { Logger } from "@skuberplus/logger";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type {
  AgentContext,
  AgentRequest,
  AgentRequestResponse,
  AgentStreamEvent,
  SlashCommandInfo,
} from "../common/agent-ipc-channels";
import type { AgentRegistry } from "./agent/agent-registry";
import type { ConversationLogger } from "./conversation-logger";
import type { LLMModelFactory } from "./llm-model-factory";
import type { AgentSessionManager } from "./session/agent-session-manager";
import type { SkillRouter } from "./skills/skill-router";
import type { ProfileExtractor } from "./user-profile/profile-extractor";
import type { UserProfileStore } from "./user-profile/user-profile-store";

// ============================================
// Agent Session 타입
// ============================================

export interface AgentSession {
  threadId: string;
  createdAt: number;
  lastActivityAt: number;
  status: "idle" | "running" | "interrupted" | "completed" | "error";
  context: AgentContext;
  provider?: AIProvider;
  modelId?: string;
  /** 현재 maxIterations (동적 증가 지원) */
  maxIterations?: number;
  pendingInterrupt?: {
    type: "hitl" | "clarify" | "recursion_limit" | "plan_approval" | "save_report";
    payload: unknown;
  };
}

// ============================================
// Agent Host 의존성
// ============================================

export interface AgentHostDependencies {
  readonly llmModelFactory: LLMModelFactory;
  readonly logger: Logger;
  readonly sessionManager: AgentSessionManager;
  readonly conversationLogger: ConversationLogger;
  readonly executeKubectl: (
    clusterId: string,
    command: string,
    args: string[],
  ) => Promise<{ success: boolean; stdout?: string; stderr?: string }>;
  readonly executeShell: (
    clusterId: string,
    command: string,
  ) => Promise<{ success: boolean; stdout?: string; stderr?: string }>;
  readonly executeHelm?: (
    clusterId: string,
    command: string,
    args: string[],
    stdin?: string,
  ) => Promise<{ success: boolean; stdout?: string; stderr?: string }>;
  readonly agentRegistry: AgentRegistry;
  readonly skillRouter: SkillRouter;
  readonly userProfileStore?: UserProfileStore;
  readonly profileExtractor?: ProfileExtractor;
}

// ============================================
// Agent Host 클래스
// ============================================

export class AgentHost {
  private sessions: Map<string, AgentSession> = new Map();
  private streamListeners: Set<(event: AgentStreamEvent) => void> = new Set();

  /** Per-thread message history for ReAct loop continuity */
  private threadMessages: Map<string, import("@langchain/core/messages").BaseMessage[]> = new Map();

  /** AbortController per thread for cancellation */
  private abortControllers: Map<string, AbortController> = new Map();

  /** 🎯 진행 중인 프로필 추출 Promise 추적 (graceful shutdown용) */
  private pendingExtractions: Set<Promise<void>> = new Set();

  constructor(private readonly dependencies: AgentHostDependencies) {}

  // ============================================
  // 공개 API
  // ============================================

  async handleRequest(request: AgentRequest): Promise<AgentRequestResponse> {
    this.dependencies.logger.info("[AgentHost] 요청 수신:", request.type);

    try {
      switch (request.type) {
        case "send-message":
          return this.handleSendMessage(request);
        case "resume-interrupt":
          return this.handleResumeInterrupt(request);
        case "reset":
          return this.handleReset(request);
        case "cancel":
          return this.handleCancel(request);
        default:
          return { accepted: false, threadId: "", error: "알 수 없는 요청 타입입니다" };
      }
    } catch (error) {
      this.dependencies.logger.error("[AgentHost] 요청 처리 실패:", error);
      return {
        accepted: false,
        threadId: (request as any).threadId ?? "",
        error: error instanceof Error ? error.message : "An unknown error occurred",
      };
    }
  }

  subscribeToStream(listener: (event: AgentStreamEvent) => void): () => void {
    this.streamListeners.add(listener);
    return () => {
      this.streamListeners.delete(listener);
    };
  }

  getSession(threadId: string): AgentSession | undefined {
    return this.sessions.get(threadId);
  }

  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  // ============================================
  // 내부 핸들러
  // ============================================

  private async handleSendMessage(
    request: Extract<AgentRequest, { type: "send-message" }>,
  ): Promise<AgentRequestResponse> {
    const { threadId, message, provider, modelId, context, assistantMessageId, slashCommand } = request;

    // 세션 생성 또는 업데이트
    let session = this.sessions.get(threadId);
    const isNewThread = !session;

    if (!session) {
      session = {
        threadId,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        status: "idle",
        context,
        provider,
        modelId,
      };
      this.sessions.set(threadId, session);
    }

    // ConversationLogger 기록
    try {
      if (isNewThread) {
        await this.dependencies.conversationLogger.createThread(threadId, {
          clusterId: context.clusterId ?? undefined,
          namespace: context.namespace ?? undefined,
        });
      }
      await this.dependencies.conversationLogger.logMessage(threadId, "user", message);
    } catch (logError) {
      this.dependencies.logger.warn("[AgentHost] 대화 로깅 실패:", logError);
    }

    // 이미 실행 중인 경우 거부
    if (session.status === "running") {
      return { accepted: false, threadId, error: "Agent is already running" };
    }

    // HITL 대기 중인 경우 거부
    if (session.status === "interrupted") {
      return {
        accepted: false,
        threadId,
        error: "There is a pending approval request. Please approve or reject first.",
      };
    }

    // 세션 상태 업데이트
    session.status = "running";
    session.lastActivityAt = Date.now();
    session.provider = provider;
    session.modelId = modelId;
    session.context = context;

    // 비동기로 Agent 실행 시작 (기존 대화 히스토리 전달)
    const existingMessages = this.threadMessages.get(threadId);
    this.runAgentAsync(
      threadId,
      message,
      provider,
      modelId,
      context,
      assistantMessageId,
      slashCommand,
      existingMessages,
    );

    return { accepted: true, threadId };
  }

  private async handleResumeInterrupt(
    request: Extract<AgentRequest, { type: "resume-interrupt" }>,
  ): Promise<AgentRequestResponse> {
    const { threadId, response } = request;

    const session = this.sessions.get(threadId);
    if (!session) {
      return { accepted: false, threadId, error: "Session not found" };
    }

    if (session.status !== "interrupted") {
      return { accepted: false, threadId, error: "Not in interrupt state" };
    }

    // HITL 세션 조회 (resolve는 resolveHITLApproval에서 처리 — 여기서 하면 Promise가 resolve 안 됨)
    const hitlSession = this.dependencies.sessionManager.getPendingHitlSession(threadId);

    // recursion_limit: stop/continue 처리
    if (hitlSession?.interruptType === "recursion_limit") {
      const normalizedResponse = typeof response === "string" ? response.toLowerCase() : "";

      if (normalizedResponse === "stop" || normalizedResponse === "no") {
        session.status = "completed";
        session.lastActivityAt = Date.now();
        session.pendingInterrupt = undefined;

        const messageId = `stop-${Date.now()}`;
        const stopMessage = "✅ Task stopped. Please check the results so far.";

        this.emitStreamEvent({ type: "message-chunk", chunk: stopMessage, messageId });
        this.emitStreamEvent({ type: "message-complete", content: stopMessage, messageId });
        this.emitStreamEvent({ type: "complete", threadId, finalState: { stoppedByUser: true } });

        return { accepted: true, threadId };
      }

      // "continue" - increase maxIterations and re-run
      const currentMax = session.maxIterations ?? 25;
      session.maxIterations = currentMax + 15;
    }

    // Resolve HITL Promise (for tool approvals)
    const normalizedResp = typeof response === "string" ? response.toLowerCase() : "";
    const isApproved = normalizedResp === "yes" || normalizedResp === "approve" || normalizedResp === "continue";

    const resolved = resolveHITLApproval(this.dependencies.sessionManager, threadId, isApproved);

    if (resolved) {
      // Promise was resolved - the runReactLoop will continue automatically
      session.status = "running";
      session.lastActivityAt = Date.now();
      session.pendingInterrupt = undefined;
    } else if (hitlSession?.interruptType === "recursion_limit") {
      // recursion_limit "continue" - re-run with increased maxIterations
      session.status = "running";
      session.lastActivityAt = Date.now();
      session.pendingInterrupt = undefined;

      // Re-run with existing messages
      const existingMessages = this.threadMessages.get(threadId);
      if (existingMessages && session.provider) {
        this.runAgentAsync(
          threadId,
          "", // No new user message
          session.provider,
          session.modelId,
          session.context,
          `resume-${Date.now()}`,
          undefined,
          existingMessages,
        );
      }
    } else {
      // Fallback: update status
      session.status = "running";
      session.lastActivityAt = Date.now();
      session.pendingInterrupt = undefined;
    }

    return { accepted: true, threadId };
  }

  private async handleReset(request: Extract<AgentRequest, { type: "reset" }>): Promise<AgentRequestResponse> {
    const { threadId } = request;

    if (threadId) {
      this.sessions.delete(threadId);
      this.threadMessages.delete(threadId);
      this.abortControllers.get(threadId)?.abort();
      this.abortControllers.delete(threadId);

      const hitlSession = this.dependencies.sessionManager.getPendingHitlSession(threadId);
      if (hitlSession) {
        this.dependencies.sessionManager.deleteHitlSession(hitlSession.id);
      }
      this.dependencies.sessionManager.releaseThreadLock(threadId);

      this.dependencies.logger.info("[AgentHost] 세션 리셋:", threadId);
    } else {
      this.sessions.clear();
      this.threadMessages.clear();
      for (const ctrl of this.abortControllers.values()) ctrl.abort();
      this.abortControllers.clear();
      this.dependencies.sessionManager.reset();

      this.dependencies.logger.info("[AgentHost] 전체 세션 리셋");
    }

    return { accepted: true, threadId: threadId ?? "" };
  }

  private async handleCancel(request: Extract<AgentRequest, { type: "cancel" }>): Promise<AgentRequestResponse> {
    const { threadId } = request;

    const session = this.sessions.get(threadId);
    if (!session) {
      return { accepted: false, threadId, error: "Session not found" };
    }

    if (session.status !== "running" && session.status !== "interrupted") {
      return { accepted: false, threadId, error: "No running task" };
    }

    this.dependencies.logger.info("[AgentHost] 작업 취소:", threadId);

    // Abort the running loop
    this.abortControllers.get(threadId)?.abort();
    this.abortControllers.delete(threadId);

    session.status = "idle";
    session.pendingInterrupt = undefined;

    const hitlSession = this.dependencies.sessionManager.getPendingHitlSession(threadId);
    if (hitlSession) {
      this.dependencies.sessionManager.deleteHitlSession(hitlSession.id);
    }

    this.emitStreamEvent({ type: "complete", threadId, finalState: { cancelled: true } });

    return { accepted: true, threadId };
  }

  // ============================================
  // Agent 실행
  // ============================================

  private async runAgentAsync(
    threadId: string,
    message: string,
    provider: AIProvider,
    modelId: string | undefined,
    context: AgentContext,
    assistantMessageId: string,
    slashCommand?: SlashCommandInfo,
    existingMessages?: import("@langchain/core/messages").BaseMessage[],
  ): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session) return;

    try {
      // Create LLM model
      const resolvedModelId = modelId ?? this.getDefaultModelId(provider);
      const model = this.dependencies.llmModelFactory.createModel(provider, resolvedModelId, {
        maxTokens: 16384,
      });
      if (!model) {
        throw new Error(`모델을 생성할 수 없습니다: ${provider}`);
      }

      // Create tools
      const tools = createReactTools({
        executeKubectl: this.dependencies.executeKubectl,
        executeShell: this.dependencies.executeShell,
        executeHelm: this.dependencies.executeHelm,
        logger: this.dependencies.logger,
        context,
        userProfileStore: this.dependencies.userProfileStore,
      });

      // ============================================
      // Skill Routing — try skill first, fallback to existing path
      // ============================================
      const skill = slashCommand ? this.dependencies.skillRouter.resolve(slashCommand.commandName) : undefined;

      if (skill) {
        this.dependencies.logger.info("[AgentHost] Skill resolved:", {
          skillId: skill.manifest.id,
          commandName: slashCommand?.commandName,
        });

        const abortController = new AbortController();
        this.abortControllers.set(threadId, abortController);

        const result = await skill.execute({
          threadId,
          userMessage: message,
          assistantMessageId,
          model: model as any,
          tools,
          context,
          provider,
          logger: this.dependencies.logger,
          sessionManager: this.dependencies.sessionManager,
          conversationLogger: this.dependencies.conversationLogger,
          agentRegistry: this.dependencies.agentRegistry,
          emitStreamEvent: (e) => this.emitStreamEvent(e),
          getHitlLevel,
          onInterrupt: () => {
            session.status = "interrupted";
            const pendingHitl = this.dependencies.sessionManager.getPendingHitlSession(threadId);
            if (pendingHitl) {
              session.pendingInterrupt = {
                type: pendingHitl.interruptType as any,
                payload: pendingHitl.payload,
              };
            }
          },
          getAutoApprovalRules: (() => {
            const store = this.dependencies.userProfileStore;
            return store ? () => store.getAutoApprovalRules() : undefined;
          })(),
          existingMessages,
          maxIterations: session.maxIterations ?? 25,
        });

        // Store messages for resume
        this.threadMessages.set(threadId, result.messages);

        // Check if we're in interrupted state (HITL waiting)
        const pendingHitl = this.dependencies.sessionManager.getPendingHitlSession(threadId);
        if (pendingHitl) {
          session.status = "interrupted";
          session.pendingInterrupt = {
            type: pendingHitl.interruptType as any,
            payload: pendingHitl.payload,
          };
          return;
        }

        // Log assistant response
        if (result.content) {
          try {
            await this.dependencies.conversationLogger.logMessage(threadId, "assistant", result.content);
          } catch (logError) {
            this.dependencies.logger.warn("[AgentHost] Assistant 응답 로깅 실패:", logError);
          }
        }

        // Skill completed
        this.emitStreamEvent({
          type: "complete",
          threadId,
          finalState: { messageCount: result.messages.length },
        });

        session.status = "completed";
        return;
      }

      // ============================================
      // Existing path (no skill matched)
      // ============================================

      // Build system prompt (🎯 개인화 컨텍스트 포함)
      // 개인화 OFF면 프로필을 프롬프트에 주입하지 않음 (수집도 안 하고 활용도 안 함)
      const profileStore = this.dependencies.userProfileStore;
      const isPersonalizationOn = profileStore ? await profileStore.isAutoLearnEnabled() : false;
      const userProfile = isPersonalizationOn ? await profileStore?.getProfileAsync() : undefined;
      // 현재 클러스터의 워크스페이스 컨텍스트 로드
      const clusterContext =
        isPersonalizationOn && context.clusterId ? await profileStore?.getClusterContext(context.clusterId) : undefined;
      const systemPrompt = await buildSystemPrompt(threadId, context, {
        slashCommand,
        conversationLogger: this.dependencies.conversationLogger,
        userProfile,
        clusterContext,
      });

      // Set up abort controller
      const abortController = new AbortController();
      this.abortControllers.set(threadId, abortController);

      // Run ReAct loop
      const result = await runReactLoop(
        {
          logger: this.dependencies.logger,
          sessionManager: this.dependencies.sessionManager,
          emitStreamEvent: (event) => this.emitStreamEvent(event),
          getHitlLevel,
          getAutoApprovalRules: profileStore ? () => profileStore.getAutoApprovalRules() : undefined,
          onInterrupt: () => {
            // Set session status to "interrupted" immediately when HITL is requested
            // This runs synchronously before the interrupt event reaches the UI
            session.status = "interrupted";
            const pendingHitl = this.dependencies.sessionManager.getPendingHitlSession(threadId);
            if (pendingHitl) {
              session.pendingInterrupt = {
                type: pendingHitl.interruptType as any,
                payload: pendingHitl.payload,
              };
            }
          },
        },
        {
          threadId,
          model: model as any,
          tools,
          systemPrompt,
          userMessage: message,
          assistantMessageId,
          context,
          provider,
          maxIterations: session.maxIterations ?? 25,
          existingMessages,
        },
      );

      // Store messages for resume
      this.threadMessages.set(threadId, result.messages);

      // Check if we're in interrupted state (HITL waiting)
      const pendingHitl = this.dependencies.sessionManager.getPendingHitlSession(threadId);
      if (pendingHitl) {
        session.status = "interrupted";
        session.pendingInterrupt = {
          type: pendingHitl.interruptType as any,
          payload: pendingHitl.payload,
        };
        // Don't emit complete - we're waiting for user response
        return;
      }

      // Log assistant response
      if (result.content) {
        try {
          await this.dependencies.conversationLogger.logMessage(threadId, "assistant", result.content);
        } catch (logError) {
          this.dependencies.logger.warn("[AgentHost] Assistant 응답 로깅 실패:", logError);
        }
      }

      // Agent completed
      this.emitStreamEvent({
        type: "complete",
        threadId,
        finalState: { messageCount: result.messages.length },
      });

      session.status = "completed";

      // 🎯 세션 완료 후 유저 프로필 자동 추출 (비동기, 실패해도 무시)
      const extractionPromise = this.triggerProfileExtraction(threadId, context.clusterId ?? undefined).catch((err) => {
        this.dependencies.logger.warn("[AgentHost] 프로필 추출 실패 (무시):", err);
      });

      this.pendingExtractions.add(extractionPromise);
      void extractionPromise.then(
        () => this.pendingExtractions.delete(extractionPromise),
        () => this.pendingExtractions.delete(extractionPromise),
      );
    } catch (error: any) {
      // Check if this is an abort
      if (error?.name === "AbortError") {
        return;
      }

      this.dependencies.logger.error("[AgentHost] Agent 실행 실패:", error);

      this.emitStreamEvent({
        type: "error",
        error: error instanceof Error ? error.message : "An error occurred while running agent",
        threadId,
      });

      session.status = "error";
    } finally {
      this.abortControllers.delete(threadId);
    }
  }

  // ============================================
  // 🎯 유저 프로필 자동 추출
  // ============================================

  /**
   * 세션 완료 후 대화 로그에서 유저 프로필 자동 추출
   * 비동기로 실행되며, 실패해도 메인 흐름에 영향 없음
   */
  private async triggerProfileExtraction(threadId: string, clusterId?: string): Promise<void> {
    const { userProfileStore, profileExtractor, conversationLogger, llmModelFactory } = this.dependencies;

    if (!userProfileStore || !profileExtractor) {
      return; // 개인화 기능이 비활성화된 경우
    }

    // 🎯 race condition 방지: 추출 시작 시점 기록
    const extractionStartedAt = Date.now();

    try {
      // 🎯 Phase 1: 자동 학습 비활성화 시 추출 스킵
      const autoLearnEnabled = await userProfileStore.isAutoLearnEnabled();

      if (!autoLearnEnabled) {
        return;
      }

      // 대화 메시지 가져오기
      const messages = await conversationLogger.getThreadMessages(threadId);

      if (messages.length < 2) {
        return; // 너무 짧은 대화는 추출 스킵
      }

      // 하위 tier 모델로 추출 (비용 절약)
      const model = llmModelFactory.createLightModel();

      if (!model) {
        return;
      }

      const existingProfile = userProfileStore.getProfile();
      const result = await profileExtractor.extract(messages, model, existingProfile);

      if (result) {
        await userProfileStore.mergeExtractionResult(result, extractionStartedAt);

        // Record issue scenarios to WorkspaceContext
        if (result.issueScenarios && result.issueScenarios.length > 0) {
          // 🎯 LLM 퍼지 매칭 — 기존 이슈와 동일하면 기존 패턴명으로 카운트 증가
          const existingIssues = existingProfile?.workspaceContext?.recurringIssues ?? [];

          for (const scenario of result.issueScenarios) {
            let patternToRecord = scenario.pattern;

            if (
              scenario.matchedExistingIndex != null &&
              scenario.matchedExistingIndex >= 0 &&
              scenario.matchedExistingIndex < existingIssues.length
            ) {
              // LLM이 기존 이슈와 동일하다고 판단 → 기존 패턴명 사용
              patternToRecord = existingIssues[scenario.matchedExistingIndex].pattern;
            }

            await userProfileStore.recordRecurringIssue(
              patternToRecord,
              scenario.context,
              scenario.relatedResources,
              clusterId,
            );
          }
        }
        this.dependencies.logger.info("[AgentHost] 유저 프로필 업데이트 완료:", {
          threadId,
          totalConversations: userProfileStore.getProfile().totalConversations,
        });
      }
    } catch (error) {
      this.dependencies.logger.warn("[AgentHost] 프로필 추출 중 오류:", error);
    }
  }

  /**
   * 🎯 Graceful shutdown — 진행 중인 프로필 추출 완료 대기
   *
   * 앱 종료 시 호출하여 추출이 완료될 때까지 최대 timeoutMs 동안 대기합니다.
   */
  async waitForPendingExtractions(timeoutMs = 5000): Promise<void> {
    if (this.pendingExtractions.size === 0) return;

    this.dependencies.logger.info(`[AgentHost] ${this.pendingExtractions.size}개 프로필 추출 완료 대기 중...`);

    await Promise.race([
      Promise.allSettled([...this.pendingExtractions]),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  // ============================================
  // 유틸리티
  // ============================================

  private emitStreamEvent(event: AgentStreamEvent): void {
    this.streamListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.dependencies.logger.error("[AgentHost] 스트림 리스너 에러:", error);
      }
    });
  }

  /**
   * 🎯 기본 모델 ID 반환
   */
  private getDefaultModelId(provider: AIProvider): string {
    switch (provider) {
      case "openai":
        return "gpt-5.2";
      case "anthropic":
        return "claude-sonnet-4-5-20250929";
      case "google":
        return "";
      case "openrouter":
        // Free 모델은 수시로 변경되므로 유료 모델 사용
        return "xiaomi/mimo-v2-pro";
      default:
        return "";
    }
  }
}
