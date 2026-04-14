/**
 * Root Frame IPC listener: Cluster Frame에서 AI 채팅 패널 열기 요청을 수신.
 *
 * Cluster Frame → Main Process → Root Frame 순서로 전달된
 * panelSyncChannels.toggleAiChat 메시지를 받아 aiChatPanelStore.open() 호출.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ipcRenderer } from "electron";
import { runInAction } from "mobx";
import { panelSyncChannels } from "../../../common/ipc/panel-sync";
import { beforeFrameStartsSecondInjectionToken } from "../../before-frame-starts/tokens";
import aiChatPanelStoreInjectable from "./ai-chat-panel-store.injectable";

import type { ChatMessage } from "./ai-chat-panel-store";

interface ToggleAiChatPayload {
  message?: string;
  /** 그룹 ID — 제공 시 그룹별 세션 캐시 사용 */
  groupId?: string;
  /** 모든 세션 캐시 클리어 */
  clearSessions?: boolean;
  /** 패널 닫기 */
  closePanel?: boolean;
}

interface SessionSnapshot {
  conversationId: string;
  messages: ChatMessage[];
  /** 그룹 컨텍스트 (buildGroupAssistantContext 결과) — 세션 복구 시 재주입용 */
  groupContext: string;
}

/**
 * 대화 기록에서 유저가 write 명령을 Accept했는지 감지.
 * toolApprovalResult.approved === true인 메시지가 있으면 applied로 판단.
 */
function detectAppliedFromMessages(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.presentation === "tool-approval-result" && m.toolApprovalResult?.approved === true);
}

const aiChatPanelIpcListenerInjectable = getInjectable({
  id: "ai-chat-panel-ipc-listener",

  instantiate: (di) => ({
    run: () => {
      const store = di.inject(aiChatPanelStoreInjectable);

      // 그룹별 세션 캐시 (Root Frame 메모리에 유지)
      const groupSessionCache = new Map<string, SessionSnapshot>();
      let activeGroupId: string | null = null;
      /** 현재 활성 그룹의 컨텍스트 (세션 저장 시 사용) */
      let activeGroupContext: string | null = null;

      ipcRenderer.on(panelSyncChannels.toggleAiChat, async (_event, payload?: ToggleAiChatPayload) => {
        // 패널 닫기 요청
        if (payload?.closePanel) {
          if (store.isOpen) store.close();
          return;
        }

        // 세션 클리어 요청
        if (payload?.clearSessions) {
          groupSessionCache.clear();
          activeGroupId = null;
          activeGroupContext = null;
          store.startNewChat();
          return;
        }

        // 패널 열기
        if (!store.isOpen) {
          store.open();
        }

        if (payload?.groupId && payload?.message) {
          // ── 그룹별 채팅: 세션 캐시 사용 ──────────────────────
          const { groupId, message } = payload;

          // 현재 그룹 세션 저장 (다른 그룹으로 전환할 때만)
          if (activeGroupId && activeGroupId !== groupId) {
            const snapshot: SessionSnapshot = {
              conversationId: (store as any).conversationId,
              messages: [...(store as any).messages],
              groupContext: activeGroupContext ?? "",
            };
            groupSessionCache.set(activeGroupId, snapshot);

            // kubectl write 성공 감지 → Main Process 경유 → Cluster Frame에 상태 변경 알림
            const isApplied = detectAppliedFromMessages(snapshot.messages);
            ipcRenderer.send(panelSyncChannels.groupStatusChanged, {
              groupId: activeGroupId,
              status: isApplied ? "applied" : "conversing",
            });
          }

          // 이 그룹의 저장된 세션 복구 or 새 채팅
          const saved = groupSessionCache.get(groupId);
          if (saved) {
            // 저장된 대화 복구 (Root Frame store 직접 조작 — 같은 프레임이라 안정)
            runInAction(() => {
              (store as any).conversationId = saved.conversationId;
              (store as any).messages = [...saved.messages];
              (store as any).isProcessing = false;
              (store as any).currentAssistantMessageId = null;
            });

            // 그룹 컨텍스트 재주입 — AI가 복귀한 그룹을 명확히 인지하도록
            // 최신 컨텍스트(message)를 사용하여 그룹 정보가 변경되었을 경우에도 대응
            const restoredContext = message;
            (store as any).__pendingGroupContext = restoredContext;
            activeGroupContext = restoredContext;
          } else {
            // 새 그룹 채팅 — 컨텍스트를 pendingGroupContext에 저장
            // 유저가 첫 질문을 보낼 때 컨텍스트를 합쳐서 sendMessage로 전달
            store.startNewChat();
            await store.initializeAgent();
            await store.setHitlLevelAsync("read_only");
            (store as any).__pendingGroupContext = message;
            activeGroupContext = message;

            // 채팅 가이드 메시지 — 유저가 뭘 물어볼 수 있는지 안내
            runInAction(() => {
              (store as any).messages.push({
                id: `guide-${Date.now()}`,
                role: "assistant",
                content: [
                  `I'm ready to help with this vulnerability group. Try asking:`,
                  ``,
                  `- \`What is this vulnerability?\``,
                  `- \`Can it be fixed by upgrading the image?\``,
                  `- \`How do I fix this?\``,
                  `- \`Is there a patch available?\``,
                ].join("\n"),
                status: "complete",
                timestamp: Date.now(),
              });
            });
          }
          activeGroupId = groupId;
        } else if (payload?.message) {
          // ── Review Results: 새 세션 + 이전 그룹 대화 기록 첨부 ──
          // 현재 그룹 세션 저장 + applied 감지
          if (activeGroupId) {
            const snapshot: SessionSnapshot = {
              conversationId: (store as any).conversationId,
              messages: [...(store as any).messages],
              groupContext: activeGroupContext ?? "",
            };
            groupSessionCache.set(activeGroupId, snapshot);

            const isApplied = detectAppliedFromMessages(snapshot.messages);
            ipcRenderer.send(panelSyncChannels.groupStatusChanged, {
              groupId: activeGroupId,
              status: isApplied ? "applied" : "conversing",
            });
            activeGroupId = null;
            activeGroupContext = null;
          }

          // 모든 그룹 대화 기록을 요약해서 리포트 프롬프트에 첨부
          // + 유저가 사용한 언어 감지
          let detectedLanguageHint = "";
          let conversationHistory = "";
          if (groupSessionCache.size > 0) {
            const historyLines: string[] = [
              "",
              "=== CONVERSATION HISTORY FROM GROUP SESSIONS ===",
              `(${groupSessionCache.size} group sessions recorded)`,
              "",
            ];
            for (const [gId, session] of groupSessionCache.entries()) {
              const userMsgs = session.messages.filter((m) => m.role === "user");
              const assistantMsgs = session.messages.filter((m) => m.role === "assistant");
              if (userMsgs.length === 0 && assistantMsgs.length === 0) continue;

              historyLines.push(`--- Group: ${gId} ---`);
              // 대화 요약: 각 메시지의 처음 200자만 포함 (토큰 절약)
              for (const msg of session.messages.slice(0, 10)) {
                const preview = msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content;
                historyLines.push(`[${msg.role}]: ${preview}`);
              }
              if (session.messages.length > 10) {
                historyLines.push(`... (${session.messages.length - 10} more messages)`);
              }
              historyLines.push("");
            }
            conversationHistory = historyLines.join("\n");

            // 유저 메시지에서 언어 힌트 추출 (한글이 포함되면 한국어)
            const allUserText = Array.from(groupSessionCache.values())
              .flatMap((s) => s.messages.filter((m) => m.role === "user"))
              .map((m) => m.content)
              .join(" ");
            const hasKorean = /[가-힣]/.test(allUserText);
            const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(allUserText);
            if (hasKorean)
              detectedLanguageHint =
                "\n\nIMPORTANT: The administrator has been writing in Korean. Write the entire report in Korean.";
            else if (hasJapanese)
              detectedLanguageHint =
                "\n\nIMPORTANT: The administrator has been writing in Japanese. Write the entire report in Japanese.";
          }

          // 컨텍스트는 system 메시지로 숨김 주입 (유저에게 안 보임)
          const systemContext = payload.message + conversationHistory + detectedLanguageHint;

          store.startNewChat();
          await store.initializeAgent();
          await store.setHitlLevelAsync("read_only");

          // 컨텍스트를 pendingGroupContext에 저장 → sendMessage 시 합쳐서 Main Process에 전달
          (store as any).__pendingGroupContext = systemContext;
          await store.sendMessage("Generate the security remediation report.");
        }
        // payload 없음 → 패널만 열기 (위에서 처리됨)
      });
    },
  }),

  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default aiChatPanelIpcListenerInjectable;
