/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Chat Panel 헤더 컴포넌트
 *
 * 📝 주요 기능:
 * - DAIVE Assistant 타이틀 표시
 * - 히스토리 드롭다운 (Past Chats)
 * - New Chat 버튼
 * - Settings 버튼 (AI 설정)
 * - Close 버튼
 * - 선택된 클러스터 표시 (ClusterSelector와 연동)
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 * - 2026-01-18: - maxClusters 기본값 3 → 동적 계산으로 변경
 * - 2026-01-19: - 단일 선택으로 변경 (다중 선택 칩 제거)
 * - 2026-01-19: - Select Cluster 버튼 내 클러스터 이름 Tooltip 추가
 */

import { ChevronDown, History, Plus, Server, Settings, X } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../../shadcn-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../shadcn-ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../../shadcn-ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";
import { ClusterSelector } from "../cluster-selector";

import type { ClusterInfo } from "../ai-chat-panel-store";

/**
 * 🎯 PastChat 타입 (히스토리 아이템)
 */
export interface PastChat {
  threadId: string;
  title: string;
  lastUpdatedAt: string;
}

/**
 * 🎯 ChatHeader Props
 * 📝 2026-01-19: - 단일 선택으로 변경
 */
export interface ChatHeaderProps {
  /** 연결된 클러스터 목록 */
  connectedClusters: ClusterInfo[];
  /** 선택된 클러스터 ID Set */
  selectedClusterIds: Set<string>;
  /** @deprecated 다중 선택 제거됨 - 하위 호환성을 위해 유지 */
  onToggleCluster: (clusterId: string) => void;
  /** 단일 클러스터 선택 콜백 */
  onSelectSingle: (clusterId: string) => void;
  /** @deprecated 단일 선택만 지원하므로 항상 1로 처리됨 */
  maxClusters?: number;
  /** Past Chats 목록 */
  pastChats: PastChat[];
  /** Past Chats 로딩 중 여부 */
  isPastChatsLoading: boolean;
  /** Past Chats 로드 콜백 */
  onLoadPastChats: () => void;
  /** Past Chat 선택 콜백 */
  onSelectPastChat: (threadId: string) => void;
  /** New Chat 버튼 클릭 콜백 */
  onNewChat: () => void;
  /** Settings 버튼 클릭 콜백 */
  onOpenSettings: () => void;
  /** Close 버튼 클릭 콜백 */
  onClose: () => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 🎯 상대적 시간 포맷팅 유틸리티
 */
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * 🎯 ChatHeader 컴포넌트
 *
 * AI Chat Panel의 헤더 영역을 담당합니다.
 * 클러스터 선택 UI와 채팅 관련 액션 버튼을 포함합니다.
 */
export const ChatHeader = observer(
  ({
    connectedClusters,
    selectedClusterIds,
    onToggleCluster,
    onSelectSingle,
    maxClusters: _maxClusters, // @deprecated - 단일 선택만 지원
    pastChats,
    isPastChatsLoading,
    onLoadPastChats,
    onSelectPastChat,
    onNewChat,
    onOpenSettings,
    onClose,
    className,
  }: ChatHeaderProps) => {
    // 📝 2026-01-19: - 단일 선택만 지원
    // maxClusters는 항상 1로 처리
    const effectiveMaxClusters = 1;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _maxClusters; // 하위 호환성을 위해 prop 유지하나 사용 안 함
    /**
     * 🎯 선택된 클러스터 이름 가져오기
     *
     * 📝 2026-01-18: - connectedClusters에서 찾지 못하면
     * ID의 일부를 이름으로 사용 (fallback)
     * - Home 화면에서 클러스터 선택 후 connectedClusters 필터링으로 매칭 실패 시 대응
     *
     * 📝 2026-01-18: - useMemo 제거
     * - MobX observable.set(selectedClusterIds)의 내부 변경을 React.useMemo가 감지하지 못함
     * - Set.add() 호출 시 참조는 동일하므로 useMemo 의존성 배열이 변경을 감지 못함
     * - observer()가 MobX 반응성을 처리하므로 일반 계산으로 변경
     */
    const selectedClusterNames = Array.from(selectedClusterIds).map((id) => {
      // 1순위: connectedClusters에서 이름 찾기
      const cluster = connectedClusters.find((c) => c.id === id);
      if (cluster?.name) {
        return cluster.name;
      }
      // 2순위: ID에서 이름 추출 (fallback)
      // - ID가 긴 경우 앞 20자만 사용
      // - 'cluster-' 접두사 제거
      const shortId = id.replace(/^cluster-/, "").slice(0, 20);
      return shortId + (id.length > 20 ? "..." : "");
    });

    return (
      <div className={cn("flex shrink-0 flex-col gap-2", className)}>
        {/* 상단 타이틀 바 */}
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-lg leading-7 font-semibold">DAIVE Assistant</h3>

          {/* 📝 2026-01-18: Issue 5 - 버튼 간격 개선 (gap-1 추가) */}
          <div className="flex items-center gap-1">
            {/* History 드롭다운 */}
            <DropdownMenu onOpenChange={(open) => open && onLoadPastChats()}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <History className="h-4 w-4" />
                  <span className="sr-only">History</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                {isPastChatsLoading ? (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground">Loading...</span>
                  </DropdownMenuItem>
                ) : pastChats.length === 0 ? (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground">No past chats</span>
                  </DropdownMenuItem>
                ) : (
                  pastChats.map((chat) => (
                    <DropdownMenuItem
                      key={chat.threadId}
                      onClick={() => onSelectPastChat(chat.threadId)}
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
            <Button variant="ghost" size="icon" onClick={onNewChat} className="h-8 w-8 shrink-0" title="New Chat">
              <Plus className="h-4 w-4" />
              <span className="sr-only">New Chat</span>
            </Button>

            {/* Settings 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              className="h-8 w-8 shrink-0"
              title="AI Settings"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">AI Settings</span>
            </Button>

            {/* Close 버튼 */}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
              <X className="h-4 w-4" />
              <span className="sr-only">Close AI Assistant</span>
            </Button>
          </div>
        </div>

        {/* 클러스터 선택 영역 */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 gap-2 text-xs", selectedClusterIds.size === 0 && "text-muted-foreground")}
              >
                <Server className="h-3.5 w-3.5" />
                {/* 📝 2026-01-19: - 단일 선택만 지원 */}
                {/* 📝 2026-01-19: - 버튼 내 클러스터 이름 Tooltip 추가 */}
                {selectedClusterIds.size === 0 ? (
                  <span>Select Cluster</span>
                ) : (
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <span className="truncate max-w-[150px] cursor-default">{selectedClusterNames[0]}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px] break-all">
                      {selectedClusterNames[0]}
                    </TooltipContent>
                  </Tooltip>
                )}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <ClusterSelector
                connectedClusters={connectedClusters}
                selectedClusterIds={selectedClusterIds}
                onToggleCluster={onToggleCluster}
                onSelectSingle={onSelectSingle}
                maxClusters={effectiveMaxClusters}
              />
            </PopoverContent>
          </Popover>

          {/* 📝 2026-01-19: - 다중 선택 칩 제거 (단일 선택만 지원) */}
        </div>
      </div>
    );
  },
);

export default ChatHeader;
