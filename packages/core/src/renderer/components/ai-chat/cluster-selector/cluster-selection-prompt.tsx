/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 클러스터 미선택 상태에서 표시되는 안내 프롬프트
 *
 * 📝 주요 기능:
 * - 클러스터가 선택되지 않았을 때 사용자에게 안내
 * - 클러스터 선택 UI 포함
 * - FR-009: ClusterFrame 비활성 시 클러스터 선택 유도
 *
 * 🔄 변경이력:
 * - 2026-01-17: 초기 생성 (Root Frame 마이그레이션)
 * - 2026-01-19: - 단일 선택으로 변경 (다중 선택 문구 제거)
 */

import { AlertCircle, Server } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { cn } from "../../../lib/utils";

import type { ClusterInfo } from "../ai-chat-panel-store";

/**
 * 🎯 ClusterSelectionPrompt Props
 * 📝 2026-01-19: - 단일 선택으로 변경
 */
export interface ClusterSelectionPromptProps {
  /** 연결된 클러스터 목록 */
  connectedClusters: ClusterInfo[];
  /** 선택된 클러스터 ID Set */
  selectedClusterIds: Set<string>;
  /** @deprecated 다중 선택 제거됨 - 하위 호환성을 위해 유지 */
  onToggleCluster: (clusterId: string) => void;
  /** 단일 클러스터 선택 콜백 */
  onSelectSingle: (clusterId: string) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 🎯 ClusterSelectionPrompt 컴포넌트
 *
 * 클러스터가 선택되지 않았을 때 표시되는 안내 메시지입니다.
 * 연결된 클러스터가 있으면 빠른 선택 UI를 제공하고,
 * 없으면 클러스터 연결 안내를 표시합니다.
 */
export const ClusterSelectionPrompt = observer(
  ({
    connectedClusters,
    selectedClusterIds,
    onToggleCluster: _onToggleCluster, // @deprecated - 하위 호환성 유지
    onSelectSingle,
    className,
  }: ClusterSelectionPromptProps) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _onToggleCluster; // 하위 호환성을 위해 prop 유지하나 사용 안 함
    // 이미 클러스터가 선택된 경우 렌더링하지 않음
    if (selectedClusterIds.size > 0) {
      return null;
    }

    // 연결된 클러스터가 없는 경우
    if (connectedClusters.length === 0) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center p-6 text-center",
            "bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30",
            className,
          )}
        >
          <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h4 className="text-sm font-medium text-foreground mb-2">No connected clusters</h4>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Connect a cluster first to use the AI Assistant. You can connect from the left cluster panel.
          </p>
        </div>
      );
    }

    /**
     * 🎯 빠른 클러스터 선택 핸들러
     */
    const handleQuickSelect = (clusterId: string) => {
      onSelectSingle(clusterId);
    };

    // 연결된 클러스터가 있지만 선택되지 않은 경우
    return (
      <div
        className={cn(
          "flex flex-col p-4",
          "bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30",
          className,
        )}
      >
        {/* 🎯 THEME-024: Semantic color for cluster selection alert */}
        {/* 안내 헤더 */}
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-status-warning" />
          <span className="text-sm font-medium text-foreground">Please select a cluster</span>
        </div>

        {/* 설명 - 📝 2026-01-19: - 단일 선택 문구로 변경 */}
        <p className="text-xs text-muted-foreground mb-4">Select a cluster for the AI Assistant to work with.</p>

        {/* 빠른 선택 버튼들 */}
        <div className="flex flex-wrap gap-2">
          {connectedClusters.slice(0, 4).map((cluster) => (
            <button
              key={cluster.id}
              onClick={() => handleQuickSelect(cluster.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                "text-xs font-medium",
                "bg-background hover:bg-accent",
                "border border-border hover:border-primary",
                "transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
              )}
            >
              <Server className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{cluster.name}</span>
              {/* 🎯 THEME-024: CSS 변수 기반 유틸리티 */}
              {cluster.status === "connected" && <span className="w-1.5 h-1.5 rounded-full bg-status-success" />}
            </button>
          ))}

          {/* 더 많은 클러스터가 있는 경우 */}
          {connectedClusters.length > 4 && (
            <span className="text-xs text-muted-foreground self-center px-2">+{connectedClusters.length - 4} more</span>
          )}
        </div>

        {/* 힌트 - 📝 2026-01-19: - Shift+클릭 힌트 제거 */}
      </div>
    );
  },
);

export default ClusterSelectionPrompt;
