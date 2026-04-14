/**
 * 🎯 목적: InputGroup 공통 컴포넌트
 * 새 대화방과 대화 후 입력창 통일
 *
 * 📝 주요 기능:
 * - 메시지 입력 Textarea
 * - SlashCommandPalette (슬래시 명령어)
 * - MentionAutocomplete (@멘션)
 * - ContextPills (컨텍스트 표시)
 * - HITL 레벨 드롭다운
 * - 모델 선택 드롭다운
 * - Send/Stop 버튼
 *
 * 🔄 변경이력:
 * - 2026-01-18: - 공통 컴포넌트 추출
 *   - 새 대화방 (messages.length === 0)과 대화 후 버전 통일
 *   - 대화 후 버전 스타일 기준으로 통일 (h-6, px-2, flex-nowrap gap-2)
 *
 * @packageDocumentation
 */

import { ArrowUp, ChevronDown, Infinity, Square } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { ContextPills } from "../../../features/ai-assistant/renderer/components/context-pills";
import { getAvailableModels, getModelDisplayName } from "../../../features/ai-assistant/renderer/provider/ai-models";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../shadcn-ui/dropdown-menu";
import { ScrollArea } from "../shadcn-ui/scroll-area";
import { Textarea } from "../shadcn-ui/textarea";
import { HITL_LEVEL_OPTIONS } from "./ai-chat-panel-store.injectable";
import { MentionAutocomplete, type MentionSuggestion } from "./mention-autocomplete";
import { SlashCommandPalette } from "./slash-command-palette";

import type { ContextItem } from "../../../features/ai-assistant/common/context-types";
import type { SlashCommand } from "../../../features/ai-assistant/common/slash-commands";
import type { AIChatPanelStore } from "./ai-chat-panel-store";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * InputGroup 컴포넌트 Props
 */
export interface InputGroupProps {
  // 📝 메시지 상태
  /** 현재 입력 메시지 */
  message: string;
  /** Textarea ref (포커스 제어용) */
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  /** 처리 중 여부 (스트리밍 등) */
  isProcessing: boolean;
  /** 전송 가능 여부 */
  isSendEnabled: boolean;
  /** 입력 잠금 여부 (대화 후에만 사용) */
  isUserInputLocked?: boolean;
  /** Placeholder 텍스트 */
  placeholder?: string;

  // 📝 Store 참조
  /** AI Chat Panel Store */
  store: AIChatPanelStore;
  /** 첨부된 컨텍스트 목록 */
  attachedContexts: ContextItem[];

  // 📝 이벤트 핸들러
  /** 입력 변경 핸들러 */
  onInputChange: (value: string) => void;
  /** 키 다운 핸들러 (Enter 전송 등) */
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** 전송 핸들러 */
  onSend: () => void;
  /** 중지 핸들러 */
  onStop: () => void;
  /** 컨텍스트 제거 핸들러 */
  onContextRemove: (id: string) => void;
  /** 컨텍스트 추가 핸들러 */
  onContextAdd: () => void;

  // 📝 슬래시 명령어 상태
  /** 슬래시 팔레트 열림 여부 */
  isSlashPaletteOpen: boolean;
  /** 슬래시 검색어 */
  slashSearchQuery: string;
  /** 슬래시 팔레트 닫기 핸들러 */
  onSlashClose: () => void;
  /** 슬래시 명령어 선택 핸들러 (Enter/클릭 - 실행) */
  onSlashSelect: (command: SlashCommand) => void;
  /**
   * 슬래시 명령어 자동완성 핸들러 (Tab - 입력창에만 채우기)
   * 📝 2026-01-28: Tab과 Enter 동작 분리
   */
  onSlashAutoComplete?: (command: SlashCommand) => void;
  /** 슬래시 검색어 변경 핸들러 */
  onSlashSearchChange: (query: string) => void;

  // 📝 멘션 상태
  /** 멘션 자동완성 열림 여부 */
  isMentionOpen: boolean;
  /** 멘션 팝업 위치 */
  mentionPosition: { top: number; left: number };
  /** 멘션 검색어 */
  mentionQuery: string;
  /** 멘션 추천 목록 */
  mentionSuggestions: MentionSuggestion[];
  /** 멘션 선택 인덱스 */
  mentionSelectedIndex: number;
  /** 멘션 선택 핸들러 */
  onMentionSelect: (suggestion: MentionSuggestion) => void;
  /** 멘션 닫기 핸들러 */
  onMentionClose: () => void;
  /** 멘션 네비게이션 핸들러 */
  onMentionNavigate: (direction: "up" | "down") => void;
}

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * InputGroup 컴포넌트
 *
 * 📝 기능:
 * - 메시지 입력 영역 (Textarea)
 * - 슬래시 명령어 팔레트 (/)
 * - 멘션 자동완성 (@)
 * - 컨텍스트 Pills (첨부 파일/리소스)
 * - HITL 레벨 선택 드롭다운
 * - AI 모델 선택 드롭다운
 * - Send/Stop 버튼
 *
 * 📝 2026-01-18:
 * - 새 대화방과 대화 후 InputGroup 통일
 * - 대화 후 버전 스타일 기준 (h-6, flex-nowrap gap-2)
 */
export const InputGroup = observer(function InputGroup({
  message,
  textareaRef,
  isProcessing,
  isSendEnabled,
  isUserInputLocked = false,
  placeholder = "Ask, Search or Chat...",
  store,
  attachedContexts,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  onContextRemove,
  onContextAdd,
  isSlashPaletteOpen,
  slashSearchQuery,
  onSlashClose,
  onSlashSelect,
  onSlashAutoComplete,
  onSlashSearchChange,
  isMentionOpen,
  mentionPosition,
  mentionQuery,
  mentionSuggestions,
  mentionSelectedIndex,
  onMentionSelect,
  onMentionClose,
  onMentionNavigate,
}: InputGroupProps): React.ReactElement {
  // 🎯 Listen for prefill-chat events (from Settings > Custom Skills > Generate with AI)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;

      if (detail?.text) {
        onInputChange(detail.text);
        setTimeout(() => {
          textareaRef.current?.focus();
          const len = detail.text.length;

          textareaRef.current?.setSelectionRange(len, len);
        }, 100);
      }
    };

    window.addEventListener("daive:prefill-chat", handler);

    return () => window.removeEventListener("daive:prefill-chat", handler);
  }, [onInputChange, textareaRef]);

  return (
    <div className="bg-secondary dark:bg-input/30 border-border flex flex-col rounded-lg border shadow-sm shrink-0 relative">
      {/* 🎯 DAIVE v2.1: 슬래시 명령어 팔레트 */}
      {/* 📝 2026-01-28: Tab과 Enter 동작 분리 - onAutoComplete 추가 */}
      <SlashCommandPalette
        isOpen={isSlashPaletteOpen}
        onClose={onSlashClose}
        onSelect={onSlashSelect}
        onAutoComplete={onSlashAutoComplete}
        searchQuery={slashSearchQuery}
        onSearchChange={onSlashSearchChange}
      />

      {/* 🎯 DAIVE v2.1: 멘션 자동완성 */}
      <MentionAutocomplete
        isOpen={isMentionOpen}
        position={mentionPosition}
        query={mentionQuery}
        suggestions={mentionSuggestions}
        selectedIndex={mentionSelectedIndex}
        onSelect={onMentionSelect}
        onClose={onMentionClose}
        onNavigate={onMentionNavigate}
      />

      {/* 🎯 DAIVE v2.1: ContextPills - 첨부된 컨텍스트 및 [+ 추가] 버튼 항상 표시 */}
      <div className="px-3 pt-2">
        <ContextPills items={attachedContexts} onRemove={onContextRemove} onAdd={onContextAdd} maxItems={5} size="sm" />
      </div>

      {/* Textarea 영역 with ScrollArea */}
      <ScrollArea className="max-h-96 p-3">
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={message}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="text-foreground placeholder:text-muted-foreground min-h-0 resize-none border-0 bg-transparent dark:bg-transparent px-0 py-1 text-sm leading-5 focus-visible:ring-0 shadow-none"
          rows={1}
          disabled={isUserInputLocked || isProcessing}
        />
      </ScrollArea>

      {/* InputGroupAddonBlock - 하단 컨트롤 영역 */}
      {/* 📝 2026-01-18: Issue 2 - 줄바꿈 방지를 위해 flex-wrap: nowrap 강제 */}
      <div className="flex items-center justify-between px-3 pt-1.5 pb-3 flex-nowrap gap-2">
        {/* 좌측 컨트롤 그룹 - flex-nowrap으로 1줄 유지, min-w-0으로 shrink 허용 */}
        <div className="flex items-center gap-2 flex-nowrap min-w-0 flex-shrink overflow-hidden">
          {/* 🎯 HITL 수준 선택 드롭다운 */}
          {/* 📝 2026-01-18: Issue 2 - h-6으로 높이 통일 (Model과 동일) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="bg-background/50 border-border flex h-6 items-center justify-center gap-1 rounded-full border px-2 shadow-sm cursor-pointer hover:bg-muted/50 min-w-0 flex-shrink">
                <Infinity className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-foreground text-xs leading-4 font-medium truncate max-w-[80px]">
                  {HITL_LEVEL_OPTIONS.find((opt) => opt.value === store.hitlLevel)?.label ?? "Agent"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {HITL_LEVEL_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    store.hitlLevel = option.value;
                  }}
                  className={store.hitlLevel === option.value ? "bg-accent" : ""}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-muted-foreground text-xs">{option.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 🎯 모델 선택 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex h-6 items-center justify-center gap-1 rounded-sm bg-transparent px-2 cursor-pointer hover:bg-muted/50 min-w-0 flex-shrink">
                <span className="text-muted-foreground text-sm leading-5 font-medium truncate max-w-[120px]">
                  {getModelDisplayName(store.aiModel)}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {(() => {
                // 🎯 Ollama 설정 추가: baseUrl과 model 정보 전달
                const availableModels = getAvailableModels(
                  store.aiProviderEnabled || {},
                  store.aiApiKeys || {},
                  store.aiModelEnabled || {},
                  { baseUrl: store.ollamaBaseUrl, model: store.ollamaModel },
                  store.openrouterCustomModel,
                );

                if (availableModels.length === 0) {
                  return <DropdownMenuItem disabled>Set API key in Settings</DropdownMenuItem>;
                }

                return availableModels.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => {
                      // 🎯 모델 선택 시 provider도 함께 업데이트
                      store.aiModel = model.id;
                      store.aiProvider = model.provider;
                    }}
                    className={store.aiModel === model.id ? "bg-accent" : ""}
                  >
                    {model.displayName}
                  </DropdownMenuItem>
                ));
              })()}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 우측 전송/중지 버튼 그룹 */}
        <div className="flex items-center gap-2">
          <div className="flex items-start">
            {isProcessing ? (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all bg-destructive hover:bg-destructive/90 cursor-pointer"
                onClick={onStop}
                aria-label="Stop"
              >
                <Square className="h-3 w-3 text-destructive-foreground" />
              </button>
            ) : (
              <button
                type="button"
                className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all ${
                  isSendEnabled
                    ? "bg-primary hover:bg-primary/90 cursor-pointer"
                    : "bg-muted cursor-not-allowed opacity-50"
                }`}
                onClick={onSend}
                disabled={!isSendEnabled}
                aria-label="Send"
              >
                <ArrowUp className={`h-4 w-4 ${isSendEnabled ? "text-primary-foreground" : "text-muted-foreground"}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
// 📝 displayName은 observer(function InputGroup...)에서 함수명으로 자동 설정됨
