/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 클러스터별 경고 아이템 컴포넌트
 *
 * Alerts Popover 내에서 각 클러스터의 경고를 표시합니다.
 * - 클러스터 이름 및 총 경고 개수
 * - 최근 경고 1-2개 미리보기
 * - [View →] 버튼으로 해당 클러스터로 이동
 * - "AI Analyze" 버튼으로 AI 분석 트리거
 *
 * 🔄 변경이력:
 * - 2025-12-10 - 초기 생성 (상태바 Alerts Popover 기능)
 * - 2026-03-12 - AI 분석 버튼 추가 (Alert-Triggered AI Agent Phase 1)
 */

import { AlertTriangle, Bot, ChevronRight, CircleX, Server } from "lucide-react";
import React, { useCallback, useState } from "react";
import { cn } from "../../../lib/utils";
import { Badge } from "../../shadcn-ui/badge";

import type { AIProvider } from "../../../../common/features/user-preferences/encrypt-api-key-channel";
import type { AlertAgentTriggerRequest } from "../../../../features/ai-assistant/common/alert-agent-channels";
import type {
  ClusterAlertItem as AlertItem,
  ClusterAlertSummary,
} from "../../../../main/cluster/get-all-cluster-alerts.injectable";

export interface ClusterAlertItemProps {
  cluster: ClusterAlertSummary;
  onNavigate: () => void;
  onAnalyzeAlert?: (request: AlertAgentTriggerRequest) => void;
  aiProvider?: string;
}

/**
 * 🎯 목적: 경고 아이콘 반환
 */
// 🎯 THEME-024: Semantic colors for alert icons
function getAlertIcon(type: AlertItem["type"]) {
  if (type === "node") {
    // Node alerts use distinct color for differentiation
    return <Server className="h-3 w-3 text-[var(--status-warning)]" />;
  }
  return <AlertTriangle className="h-3 w-3 text-status-warning" />;
}

/**
 * 🎯 목적: 클러스터별 경고 아이템 컴포넌트
 */
export const ClusterAlertItem: React.FC<ClusterAlertItemProps> = ({
  cluster,
  onNavigate,
  onAnalyzeAlert,
  aiProvider,
}) => {
  const { clusterId, clusterName, connected, totalCount, recentAlerts } = cluster;
  const hasWarnings = totalCount > 0;
  const remainingCount = totalCount - recentAlerts.length;
  const [analyzingAlertId, setAnalyzingAlertId] = useState<string | null>(null);

  const handleAnalyze = useCallback(
    (e: React.MouseEvent, alert: AlertItem) => {
      e.stopPropagation();
      if (!onAnalyzeAlert) return;

      setAnalyzingAlertId(alert.id);

      onAnalyzeAlert({
        alert: {
          id: alert.id,
          clusterId,
          clusterName,
          resource: alert.resource ?? "unknown",
          namespace: undefined,
          message: alert.message,
          alertType: alert.type,
        },
        provider: (aiProvider ?? "anthropic") as AIProvider,
        context: {
          clusterId,
          clusterName,
          namespace: null,
          basePath: null,
        },
        preferredLanguage: navigator.language,
      });

      // Reset analyzing state after a short delay
      setTimeout(() => setAnalyzingAlertId(null), 2000);
    },
    [onAnalyzeAlert, clusterId, clusterName, aiProvider],
  );

  return (
    <div
      className={cn(
        "group px-3 py-2 hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/50 last:border-b-0 overflow-hidden",
        !connected && "opacity-60",
      )}
      onClick={onNavigate}
      onKeyDown={(e) => e.key === "Enter" && onNavigate()}
      role="button"
      tabIndex={0}
    >
      {/* 🎯 클러스터 헤더 */}
      <div className="flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {/* 연결 상태 점 (사이드바 스타일) */}
          {/* 🎯 THEME-024: Semantic color for connection status */}
          <span
            className={cn("h-2 w-2 rounded-full shrink-0", connected ? "bg-status-success" : "bg-muted-foreground/50")}
            aria-label={connected ? "클러스터 연결됨" : "클러스터 연결 끊김"}
          />
          {/* 클러스터 이름 */}
          <span className="font-medium text-sm truncate flex-1 w-0">{clusterName}</span>
        </div>

        {/* 경고 개수 배지 */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {connected ? (
            hasWarnings ? (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {totalCount}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">No warnings</span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">Disconnected</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* 🎯 최근 경고 미리보기 */}
      {connected && hasWarnings && (
        <div className="ml-4 mt-1 space-y-1 overflow-hidden">
          {recentAlerts.map((alert, index) => (
            <div key={`${alert.resource}-${index}`} className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="shrink-0">{getAlertIcon(alert.type)}</span>
              <span className="text-muted-foreground truncate flex-1 w-0">{alert.message}</span>
              <span className="text-muted-foreground/70 shrink-0 text-[11px]">{alert.timestamp}</span>
              {/* AI Analyze button */}
              {onAnalyzeAlert && (
                <button
                  type="button"
                  className={cn(
                    "shrink-0 p-0.5 rounded hover:bg-accent transition-colors",
                    analyzingAlertId === alert.id
                      ? "text-primary animate-pulse"
                      : "text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100",
                  )}
                  onClick={(e) => handleAnalyze(e, alert)}
                  disabled={analyzingAlertId === alert.id}
                  aria-label="AI Analyze"
                  title="AI Analyze"
                >
                  <Bot className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* +N more 텍스트 */}
          {remainingCount > 0 && <div className="text-xs text-muted-foreground/70 ml-4">+{remainingCount} more...</div>}
        </div>
      )}

      {/* 🎯 연결 끊김 상태 메시지 */}
      {!connected && (
        <div className="ml-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleX className="h-3 w-3" />
          <span>Unable to fetch alerts</span>
        </div>
      )}
    </div>
  );
};
