/**
 * 🎯 목적: AIChatInputGroup - AI Chat 입력 영역 컴포넌트
 * 02: ai-chat-panel ContextPills 통합
 * 02: ai-chat-panel Slash Command 통합
 *
 * 주요 기능:
 * - Textarea 입력 영역
 * - ContextPills 표시 (attachedContexts)
 * - @ 트리거로 ContextPickerModal 열기
 * - / 트리거로 SlashCommandPalette 열기
 * - 전송/중지 버튼
 *
 * @packageDocumentation
 */

import { ArrowUp, Square } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getSlashCommandByName, parseSlashCommandInput } from "../../../features/ai-assistant/common/slash-commands";
import { ContextPickerModal } from "../../../features/ai-assistant/renderer/components/context-picker-modal";
import { ContextPills } from "../../../features/ai-assistant/renderer/components/context-pills";
import { ScrollArea } from "../shadcn-ui/scroll-area";
import { Textarea } from "../shadcn-ui/textarea";
import { SlashCommandPalette } from "./slash-command-palette";

import type { ContextItem } from "../../../features/ai-assistant/common/context-types";
import type { SlashCommand } from "../../../features/ai-assistant/common/slash-commands";
import type { ResourceFetcher } from "../../../features/ai-assistant/renderer/hooks/use-context-resources";

/** AIChatInputGroup Props */
export interface AIChatInputGroupProps {
  /** 현재 메시지 값 */
  message: string;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 메시지 변경 콜백 */
  onMessageChange: (value: string) => void;
  /** 전송 콜백 */
  onSend: () => void;
  /** 중지 콜백 */
  onStop: () => void;
  /** 처리 중 상태 */
  isProcessing: boolean;
  /** 전송 가능 여부 */
  isSendEnabled: boolean;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 첨부된 컨텍스트 목록 */
  attachedContexts: ContextItem[];
  /** 컨텍스트 추가 콜백 */
  onAddContext: (item: ContextItem) => void;
  /** 컨텍스트 삭제 콜백 */
  onRemoveContext: (id: string) => void;
  /** 리소스 조회 함수 */
  resourceFetcher: ResourceFetcher;
  /** 추가 렌더링 (HITL 드롭다운 등) */
  leftControls?: React.ReactNode;
  /** 슬래시 명령어 실행 콜백 */
  onSlashCommand?: (command: SlashCommand) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * AIChatInputGroup 컴포넌트
 * AI Chat의 입력 영역을 담당하며 ContextPills 통합을 포함
 */
export function AIChatInputGroup({
  message,
  placeholder = "Type a message...",
  onMessageChange,
  onSend,
  onStop,
  isProcessing,
  isSendEnabled,
  disabled = false,
  attachedContexts,
  onAddContext,
  onRemoveContext,
  resourceFetcher,
  leftControls,
  onSlashCommand,
  className,
}: AIChatInputGroupProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [atTriggerActive, setAtTriggerActive] = useState(false);
  const [lastMessage, setLastMessage] = useState(message);
  // 슬래시 명령어 상태
  const [isSlashPaletteOpen, setIsSlashPaletteOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  // 🎯 2026-01-06: 선택된 명령어 상태 저장 (UX 개선 - 명령어 선택 후 프롬프트 입력)
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  // 🎯 2026-01-06: Textarea ref (명령어 선택 후 포커스 이동용)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 🎯 목적: @ 트리거 및 / 트리거 감지 및 처리
   *
   * 📝 슬래시 명령어 파싱 로직 (2026-01-06 UX 개선):
   * - "/" → 팔레트 열기
   * - "/solve" → 팔레트 열기, 검색어: "solve"
   * - "/solve " (공백 포함) → 명령어 확정, 팔레트 닫기, 프롬프트 입력 모드
   * - Enter/Send 시 저장된 명령어 + 프롬프트로 실행
   *
   * 🔄 변경이력:
   * - 2026-01-06 - 공백 이후 즉시 실행 → 프롬프트 입력 모드로 변경
   */
  useEffect(() => {
    // 새 문자 입력 감지
    if (message.length > lastMessage.length) {
      const newChar = message[message.length - 1];

      // @ 트리거
      if (newChar === "@") {
        setIsPickerOpen(true);
        setAtTriggerActive(true);
      }
    }

    // / 트리거 (메시지가 /로 시작하는 경우)
    if (message.startsWith("/")) {
      // 🎯 슬래시 명령어 파싱
      const parsed = parseSlashCommandInput(message);

      if (parsed && parsed.command) {
        // 🎯 2026-01-06 UX 개선: 공백이 있으면 팔레트 닫고 프롬프트 입력 모드
        const hasSpaceAfterCommand = message.includes(" ");

        if (hasSpaceAfterCommand) {
          const foundCommand = getSlashCommandByName(parsed.command);

          if (foundCommand) {
            // 명령어 찾았으면 팔레트 닫고 프롬프트 입력 모드로 전환
            if (isSlashPaletteOpen) {
              setIsSlashPaletteOpen(false);
              setSlashQuery("");
            }
            // 선택된 명령어 저장 (Enter 시 실행됨)
            if (!selectedCommand || selectedCommand.id !== foundCommand.id) {
              setSelectedCommand(foundCommand);
            }
            // 메시지는 그대로 유지 (예: "/solve 문제가...")
          } else {
            // 명령어를 못 찾았으면 첫 단어만 검색어로 사용
            if (!isSlashPaletteOpen) {
              setIsSlashPaletteOpen(true);
            }
            setSlashQuery(parsed.command);
          }
        } else {
          // 공백 없음: 팔레트 열고 검색어 설정
          if (!isSlashPaletteOpen) {
            setIsSlashPaletteOpen(true);
          }
          setSlashQuery(parsed.command);
          // 명령어 선택 해제 (아직 확정되지 않음)
          if (selectedCommand) {
            setSelectedCommand(null);
          }
        }
      } else {
        // "/" 만 입력된 경우
        if (!isSlashPaletteOpen) {
          setIsSlashPaletteOpen(true);
        }
        setSlashQuery("");
        // 명령어 선택 해제
        if (selectedCommand) {
          setSelectedCommand(null);
        }
      }
    } else if (!message.startsWith("/")) {
      // /로 시작하지 않으면 팔레트 닫기
      if (isSlashPaletteOpen) {
        setIsSlashPaletteOpen(false);
        setSlashQuery("");
      }
      // 명령어 선택 해제 (슬래시 없으면 일반 메시지)
      if (selectedCommand) {
        setSelectedCommand(null);
      }
    }

    setLastMessage(message);
  }, [message, lastMessage, isSlashPaletteOpen, selectedCommand]);

  /** 메시지 변경 핸들러 */
  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onMessageChange(e.target.value);
    },
    [onMessageChange],
  );

  /**
   * 🎯 목적: 키보드 핸들러 (Enter 전송)
   *
   * 📝 2026-01-06 UX 개선:
   * - 선택된 명령어가 있으면 명령어 + 프롬프트로 실행
   * - 없으면 일반 메시지로 전송
   *
   * 🔄 변경이력: 2026-01-06 - 슬래시 명령어 실행 로직 추가
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (isSendEnabled && !isProcessing) {
          // 🎯 선택된 명령어가 있으면 명령어 실행
          if (selectedCommand && message.startsWith("/")) {
            // 프롬프트 추출 (명령어 이후 부분)
            const spaceIndex = message.indexOf(" ");
            const promptText = spaceIndex > 0 ? message.slice(spaceIndex + 1).trim() : "";

            // 메시지를 프롬프트로 변경
            onMessageChange(promptText);
            // 명령어 실행
            onSlashCommand?.(selectedCommand);
            // 선택된 명령어 초기화
            setSelectedCommand(null);
          } else {
            // 일반 메시지 전송
            onSend();
          }
        }
      }
    },
    [isSendEnabled, isProcessing, onSend, selectedCommand, message, onMessageChange, onSlashCommand],
  );

  /** 모달 닫기 핸들러 */
  const handlePickerClose = useCallback(() => {
    setIsPickerOpen(false);
    // @ 트리거로 열렸다면 @ 제거
    if (atTriggerActive) {
      const newMessage = message.endsWith("@") ? message.slice(0, -1) : message.replace(/@$/, "");
      onMessageChange(newMessage);
      setAtTriggerActive(false);
    }
  }, [atTriggerActive, message, onMessageChange]);

  /** 리소스 선택 핸들러 */
  const handleSelect = useCallback(
    (selected: ContextItem | ContextItem[]) => {
      const item = Array.isArray(selected) ? selected[0] : selected;
      if (item) {
        onAddContext(item);
      }
      // @ 트리거로 열렸다면 @ 제거
      if (atTriggerActive) {
        const newMessage = message.endsWith("@") ? message.slice(0, -1) : message.replace(/@$/, "");
        onMessageChange(newMessage);
        setAtTriggerActive(false);
      }
      setIsPickerOpen(false);
    },
    [atTriggerActive, message, onMessageChange, onAddContext],
  );

  /** 추가 버튼 클릭 핸들러 */
  const handleAddClick = useCallback(() => {
    setAtTriggerActive(false);
    setIsPickerOpen(true);
  }, []);

  /** 슬래시 팔레트 닫기 핸들러 */
  const handleSlashPaletteClose = useCallback(() => {
    setIsSlashPaletteOpen(false);
    setSlashQuery("");
    // 메시지 초기화
    onMessageChange("");
  }, [onMessageChange]);

  /**
   * 🎯 목적: 슬래시 명령어 선택 핸들러
   *
   * 📝 2026-01-06 UX 개선:
   * - 명령어 즉시 실행 대신 텍스트 완성
   * - 팔레트 닫고 프롬프트 입력 모드로 전환
   * - Enter 시 명령어 + 프롬프트로 실행
   * - Textarea로 포커스 이동하여 바로 프롬프트 입력 가능
   *
   * 🔄 변경이력: 2026-01-06 - 즉시 실행 → 텍스트 완성 + 포커스 이동
   */
  const handleSlashCommandSelect = useCallback(
    (command: SlashCommand) => {
      setIsSlashPaletteOpen(false);
      setSlashQuery("");
      // 🎯 명령어 텍스트 완성 (끝에 공백 추가하여 프롬프트 입력 준비)
      onMessageChange(`${command.name} `);
      // 선택된 명령어 저장 (Enter 시 실행됨)
      setSelectedCommand(command);
      // 🎯 2026-01-06: Textarea로 포커스 이동 (프롬프트 입력 가능하도록)
      setTimeout(() => {
        textareaRef.current?.focus();
        // 커서를 끝으로 이동
        const len = `${command.name} `.length;
        textareaRef.current?.setSelectionRange(len, len);
      }, 0);
    },
    [onMessageChange],
  );

  /**
   * 🎯 목적: 슬래시 팔레트 검색 Input에서 타이핑 시 호출
   *
   * 📝 2026-01-06 UX 개선:
   * - 공백이 없으면: 검색어로 사용
   * - 공백이 있으면: 유효한 명령어면 팔레트 닫고 프롬프트 입력 모드
   *
   * 🔄 변경이력: 2026-01-06 - 즉시 실행 → 프롬프트 입력 모드로 변경
   */
  const handleSlashSearchChange = useCallback(
    (query: string) => {
      // 🎯 공백이 있으면 명령어와 프롬프트 분리 시도
      const spaceIndex = query.indexOf(" ");

      if (spaceIndex > 0) {
        const commandPart = query.slice(0, spaceIndex);
        const foundCommand = getSlashCommandByName(commandPart);

        if (foundCommand) {
          // 🎯 명령어 찾았으면 팔레트 닫고 프롬프트 입력 모드로 전환
          setIsSlashPaletteOpen(false);
          setSlashQuery("");
          // 전체 메시지 유지 (예: "/solve 문제가...")
          onMessageChange(`/${query}`);
          // 선택된 명령어 저장 (Enter 시 실행됨)
          setSelectedCommand(foundCommand);

          return;
        }

        // 명령어를 못 찾았으면 첫 단어만 검색어로 사용
        setSlashQuery(commandPart);
        onMessageChange(`/${commandPart}`);
      } else {
        // 공백 없음: 전체를 검색어로 사용
        setSlashQuery(query);
        onMessageChange(`/${query}`);
      }
    },
    [onMessageChange],
  );

  const hasContexts = attachedContexts.length > 0;

  return (
    <>
      <div
        className={`relative bg-secondary border-border mt-4 flex flex-col rounded-lg border shadow-sm shrink-0 ${className ?? ""}`}
      >
        {/* 🎯 SlashCommandPalette - 입력 영역 위에 표시 */}
        <SlashCommandPalette
          isOpen={isSlashPaletteOpen}
          onClose={handleSlashPaletteClose}
          onSelect={handleSlashCommandSelect}
          searchQuery={slashQuery}
          onSearchChange={handleSlashSearchChange}
        />
        {/* 🎯 ContextPills 영역 - Textarea 위에 표시 */}
        {hasContexts && (
          <div className="px-3 pt-3 pb-1">
            <ContextPills
              items={attachedContexts}
              onAdd={handleAddClick}
              onRemove={onRemoveContext}
              maxItems={5}
              showNamespace={true}
              size="sm"
              disabled={disabled}
            />
          </div>
        )}

        {/* Textarea 영역 with ScrollArea */}
        <ScrollArea className="max-h-96 p-3">
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            className="text-primary placeholder:text-muted-foreground min-h-0 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-5 focus-visible:ring-0"
            rows={1}
            disabled={disabled || isProcessing}
          />
        </ScrollArea>

        {/* InputGroupAddonBlock - 하단 컨트롤 영역 */}
        <div className="flex items-center justify-between px-3 pt-1.5 pb-3">
          {/* 좌측 컨트롤 그룹 */}
          <div className="flex items-center gap-2">
            {/* ContextPills가 없을 때만 추가 버튼 표시 */}
            {!hasContexts && <ContextPills items={[]} onAdd={handleAddClick} disabled={disabled} />}
            {leftControls}
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
                  <ArrowUp
                    className={`h-4 w-4 ${isSendEnabled ? "text-primary-foreground" : "text-muted-foreground"}`}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ContextPickerModal */}
      <ContextPickerModal
        isOpen={isPickerOpen}
        onClose={handlePickerClose}
        onSelect={handleSelect}
        fetcher={resourceFetcher}
        title="Add Context"
      />
    </>
  );
}

AIChatInputGroup.displayName = "AIChatInputGroup";
