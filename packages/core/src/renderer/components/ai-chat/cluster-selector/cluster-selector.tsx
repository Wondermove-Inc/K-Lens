/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 연결된 클러스터 목록에서 작업할 클러스터 선택 UI
 *
 * 📝 주요 기능:
 * - 연결된 클러스터 목록 표시
 * - 단일 클러스터 선택 (라디오 버튼 방식)
 * - 클러스터 이름, 컨텍스트명, 상태 표시
 * - 빈 목록 시 안내 메시지
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 * - 2026-01-18: Issue 2 - maxClusters를 실제 클러스터 개수로 동적 설정
 * - 2026-01-19: - ScrollArea max-height 200px → 300px (6개+ 클러스터 스크롤 지원)
 * - 2026-01-19: - data-component 속성 추가 (스크롤 CSS 선택적 적용용)
 * - 2026-01-19: - 단일 선택으로 변경 (백엔드 API가 단일 클러스터만 지원)
 * - 2026-01-19: - 긴 클러스터 이름 Tooltip 추가 (hover 시 전체 이름 표시)
 */

import { CheckCircle, Circle, Server } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback } from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../../shadcn-ui/button";
import { ScrollArea } from "../../shadcn-ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";

import type { ClusterInfo } from "../ai-chat-panel-store";

/**
 * 🎯 ClusterSelector Props
 *
 * 📝 2026-01-19: - 단일 선택으로 변경
 *    onToggleCluster는 하위 호환성을 위해 유지하나 사용되지 않음
 */
export interface ClusterSelectorProps {
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
  /** 컴팩트 모드 (헤더 숨김) */
  compact?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 🎯 ClusterSelector 컴포넌트
 *
 * 연결된 클러스터 목록에서 작업할 클러스터를 선택합니다.
 * 📝 2026-01-19: - 단일 선택만 지원
 *    (백엔드 API가 단일 clusterId만 지원하므로)
 */
export const ClusterSelector = observer(
  ({
    connectedClusters,
    selectedClusterIds,
    onToggleCluster: _onToggleCluster, // @deprecated - 하위 호환성 유지
    onSelectSingle,
    maxClusters: _maxClusters, // @deprecated - 단일 선택만 지원
    compact = false,
    className,
  }: ClusterSelectorProps) => {
    // 📝 2026-01-19: - 단일 선택만 지원
    // maxClusters는 항상 1로 처리
    const effectiveMaxClusters = 1;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _onToggleCluster; // 하위 호환성을 위해 prop 유지하나 사용 안 함
    void _maxClusters;

    /**
     * 🎯 클러스터 클릭 핸들러
     * 📝 2026-01-19: - 단일 선택만 지원
     *    Shift+클릭 다중 선택 로직 제거
     */
    const handleClusterClick = useCallback(
      (_e: React.MouseEvent, clusterId: string) => {
        // 항상 단일 선택 (기존 선택 해제 후 새로 선택)
        onSelectSingle(clusterId);
      },
      [onSelectSingle],
    );

    /**
     * 🎯 아이콘 클릭 핸들러 (이벤트 버블링 방지)
     * 📝 2026-01-19: 단일 선택만 지원
     */
    const handleIconClick = useCallback(
      (e: React.MouseEvent, clusterId: string) => {
        e.stopPropagation();
        onSelectSingle(clusterId);
      },
      [onSelectSingle],
    );

    // 빈 목록 렌더링
    if (connectedClusters.length === 0) {
      return (
        <div className={cn("flex flex-col items-center justify-center p-6 text-center", className)}>
          <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No connected clusters</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Connect a cluster to use the AI Assistant</p>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col", className)} data-component="cluster-selector">
        {/* 헤더 (compact 모드가 아닐 때만) - 📝 2026-01-19: 단일 선택 모드에서 "1/1 selected" 제거 */}
        {!compact && (
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <h4 className="text-sm font-medium">Select Cluster</h4>
          </div>
        )}

        {/*
        클러스터 목록 - 📝 2026-01-19: - 스크롤 근본 해결

        문제: max-h만으로는 Radix ScrollArea가 스크롤 활성화 안 됨
        원인: 부모(PopoverContent)가 무제한 확장되어 ScrollArea도 확장됨
        해결: h-[240px] 고정 높이 + overflow-y-auto 명시

        높이 계산: 6개 × 40px(버튼 높이) = 240px
        7개 이상이면 스크롤 활성화
      */}
        <ScrollArea className="h-[240px]">
          <ul className="p-1">
            {connectedClusters.map((cluster) => {
              const isSelected = selectedClusterIds.has(cluster.id);
              /**
               * 📝 2026-01-19: - isDisabled 로직 수정
               * 단일 선택 모드(effectiveMaxClusters=1)에서는 항상 다른 클러스터 선택 가능해야 함
               * 기존: !isSelected && size >= max → 선택된 게 있으면 다른 건 disabled
               * 수정: 단일 선택 모드에서는 항상 false (모든 클러스터 클릭 가능)
               */
              const isDisabled =
                effectiveMaxClusters === 1
                  ? false // 단일 선택 모드: 항상 클릭 가능 (클릭 시 기존 선택 해제 후 새로 선택)
                  : !isSelected && selectedClusterIds.size >= effectiveMaxClusters;

              return (
                <li key={cluster.id}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-2 h-auto py-2 px-2",
                      isSelected && "bg-accent",
                      isDisabled && "opacity-50 cursor-not-allowed",
                    )}
                    onClick={(e) => !isDisabled && handleClusterClick(e, cluster.id)}
                    disabled={isDisabled}
                  >
                    {/* 선택 상태 아이콘 (라디오 버튼 스타일) */}
                    <div onClick={(e) => !isDisabled && handleIconClick(e, cluster.id)} className="cursor-pointer">
                      {isSelected ? (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* 클러스터 정보 - 📝 2026-01-19: - 긴 이름 Tooltip 추가 */}
                    <div className="flex-1 text-left min-w-0">
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="text-sm font-medium truncate cursor-default">{cluster.name}</div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px] break-all">
                          {cluster.name}
                        </TooltipContent>
                      </Tooltip>
                      {cluster.contextName && (
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div className="text-xs text-muted-foreground truncate cursor-default">
                              {cluster.contextName}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px] break-all">
                            {cluster.contextName}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* 상태 표시 - 🎯 THEME-024: CSS 변수 기반 유틸리티 */}
                    {cluster.status && (
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full",
                          cluster.status === "connected" && "bg-badge-success",
                          cluster.status === "disconnected" && "bg-badge-error",
                          cluster.status === "connecting" && "bg-badge-warning",
                        )}
                      >
                        {cluster.status}
                      </span>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        {/* 하단 힌트 - 📝 2026-01-19: - 단일 선택 안내로 변경 */}
        {!compact && (
          <div className="px-3 py-2 border-t">
            <p className="text-xs text-muted-foreground">Click to select a cluster for the AI Assistant</p>
          </div>
        )}
      </div>
    );
  },
);

export default ClusterSelector;
