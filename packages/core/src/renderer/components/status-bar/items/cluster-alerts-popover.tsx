/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 모든 클러스터 경고를 표시하는 Popover 컴포넌트
 *
 * 상태바 Alerts 아이템 클릭 시 표시되며,
 * 모든 연결된 클러스터의 경고를 요약해서 보여줍니다.
 *
 * 주요 기능:
 * - 클러스터별 경고 요약 표시
 * - 최근 경고 미리보기
 * - 클러스터 클릭 시 해당 클러스터로 이동 + 알럿 dismiss
 * - 세션 기반 dismiss (앱 재시작 시 초기화)
 *
 * 🔄 변경이력:
 * - 2025-12-10 - 초기 생성 (상태바 Alerts Popover 기능)
 * - 2025-12-22 - Dismiss 기능 추가 (클러스터 클릭 시 알럿 숨김)
 */

import { ipcRenderer } from "electron";
import { CircleAlert, CircleCheck, RefreshCw, ServerOff } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { clusterGetAllAlertsChannel } from "../../../../common/ipc/cluster";
import { cn } from "../../../lib/utils";
import { Badge } from "../../shadcn-ui/badge";
import { Button } from "../../shadcn-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../shadcn-ui/popover";
import { ScrollArea } from "../../shadcn-ui/scroll-area";
import { Separator } from "../../shadcn-ui/separator";
import { Spinner } from "../../shadcn-ui/spinner";
import { ClusterAlertItem } from "./cluster-alert-item";

import type { AlertAgentTriggerRequest } from "../../../../features/ai-assistant/common/alert-agent-channels";
import type { AllClusterAlertsResponse } from "../../../../main/cluster/get-all-cluster-alerts.injectable";

/**
 * 🎯 목적: Dismiss된 클러스터 ID 저장소 (세션 기반)
 *
 * 📝 주의사항:
 * - 컴포넌트 외부에 선언하여 리렌더링 시에도 유지
 * - 앱 재시작 시 초기화됨 (세션 기반)
 * - 클러스터 클릭 시 해당 클러스터 전체를 dismiss
 */
const dismissedClusterIds = new Set<string>();

export interface ClusterAlertsPopoverProps {
  /**
   * 🎯 목적: 클러스터 클릭 시 호출되는 콜백
   * @param clusterId - 이동할 클러스터 ID
   */
  onNavigateToCluster: (clusterId: string) => void;
  /** AI alert analysis trigger callback */
  onAnalyzeAlert?: (request: AlertAgentTriggerRequest) => void;
  /** Current AI provider from user preferences */
  aiProvider?: string;
}

/**
 * 🎯 목적: 모든 클러스터 경고 Popover 컴포넌트
 */
export const ClusterAlertsPopover: React.FC<ClusterAlertsPopoverProps> = observer(
  ({ onNavigateToCluster, onAnalyzeAlert, aiProvider }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AllClusterAlertsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    // 🎯 dismiss 상태 변경 시 useMemo 재계산 트리거용 카운터
    const [dismissCount, setDismissCount] = useState(0);

    /**
     * 🎯 목적: 경고 데이터 조회
     */
    const fetchAlerts = useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await ipcRenderer.invoke(clusterGetAllAlertsChannel);
        setData(response);
      } catch (err) {
        console.error("[ClusterAlertsPopover] Failed to fetch alerts:", err);
        setError("Failed to fetch cluster alerts");
      } finally {
        setLoading(false);
      }
    }, []);

    /**
     * 🎯 목적: 컴포넌트 마운트 시 초기 데이터 로딩
     * 상태바에 알럿 개수를 즉시 표시하기 위해 필요
     *
     * 📝 주의사항:
     * - 앱 시작 시 IPC 핸들러가 준비되지 않을 수 있어 지연 필요
     * - 클러스터 연결 완료 후 다시 fetch하도록 재시도 로직 포함
     */
    useEffect(() => {
      // 🎯 초기 로딩: 앱 시작 후 IPC 핸들러가 준비될 시간 확보
      const initialDelay = setTimeout(() => {
        fetchAlerts();
      }, 2000);

      // 🎯 재시도: 초기 fetch 실패 시 5초 후 재시도
      const retryDelay = setTimeout(() => {
        fetchAlerts();
      }, 5000);

      return () => {
        clearTimeout(initialDelay);
        clearTimeout(retryDelay);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * 🎯 목적: 주기적 폴링 (30초 간격)
     * 백그라운드에서 알럿 상태 자동 갱신
     */
    useEffect(() => {
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    }, [fetchAlerts]);

    /**
     * 🎯 목적: Popover 열릴 때 데이터 새로고침
     */
    useEffect(() => {
      if (open) {
        fetchAlerts();
      }
    }, [open, fetchAlerts]);

    /**
     * 🎯 목적: 외부 클릭 시 Popover 닫기 (iframe 포함)
     *
     * 📝 주의사항:
     * - 클러스터 화면은 iframe 내부에 렌더링됨
     * - iframe 내부 클릭은 메인 document의 Radix UI가 감지할 수 없음
     * - 따라서 iframe의 contentWindow에도 클릭 리스너 추가 필요
     */
    useEffect(() => {
      if (!open) return;

      // 🎯 메인 document 클릭 감지
      const handleGlobalClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const popoverContent = document.querySelector('[data-slot="popover-content"]');
        const popoverTrigger = document.querySelector('[data-slot="popover-trigger"]');

        // Popover 트리거나 내용 영역 클릭은 무시
        if (popoverContent?.contains(target) || popoverTrigger?.contains(target)) {
          return;
        }
        setOpen(false);
      };

      // 🎯 iframe 내부 클릭 감지
      const handleIframeClick = () => {
        setOpen(false);
      };

      // 메인 document에 리스너 추가
      document.addEventListener("mousedown", handleGlobalClick);

      // 모든 iframe에 리스너 추가
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          iframe.contentWindow?.addEventListener("mousedown", handleIframeClick);
        } catch {
          // cross-origin iframe은 무시
        }
      });

      return () => {
        document.removeEventListener("mousedown", handleGlobalClick);
        iframes.forEach((iframe) => {
          try {
            iframe.contentWindow?.removeEventListener("mousedown", handleIframeClick);
          } catch {
            // cross-origin iframe은 무시
          }
        });
      };
    }, [open]);

    /**
     * 🎯 목적: 클러스터 이동 핸들러 (dismiss 처리 포함)
     *
     * 📝 주의사항:
     * - 클러스터 클릭 시 해당 클러스터 전체를 dismiss
     * - dismiss된 클러스터 ID는 세션 동안 유지됨
     */
    const handleNavigate = useCallback(
      (clusterId: string) => {
        // 🔄 클러스터 ID를 dismiss Set에 추가 (클러스터 전체 숨김)
        dismissedClusterIds.add(clusterId);
        // 🎯 useMemo 재계산 트리거 (점 표시 업데이트)
        setDismissCount((prev) => prev + 1);
        onNavigateToCluster(clusterId);
        setOpen(false);
      },
      [onNavigateToCluster],
    );

    /**
     * 🎯 목적: Dismiss 필터링이 적용된 클러스터 데이터 계산
     *
     * 📝 주의사항:
     * - dismiss된 클러스터는 목록에서 완전히 제외
     * - 클러스터 단위로 dismiss하므로 "+N more" 문제 없음
     */
    const { filteredClusters, visibleTotalCount } = useMemo(() => {
      const clusters = data?.clusters ?? [];

      // dismiss된 클러스터 제외
      const filtered = clusters.filter((cluster) => !dismissedClusterIds.has(cluster.clusterId));

      // 전체 카운트 계산
      const total = filtered.reduce((sum, c) => sum + c.totalCount, 0);

      return {
        filteredClusters: filtered,
        visibleTotalCount: total,
      };
    }, [data, dismissCount]);

    // 🎯 경고 표시 여부
    const hasWarnings = visibleTotalCount > 0;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        {/* 🎯 트리거 버튼 */}
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-sm transition-colors cursor-pointer",
              "hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring",
              // 🎯 THEME-024: Semantic color for warning indicator
              hasWarnings ? "text-status-warning" : "text-muted-foreground",
            )}
            aria-label={`Alerts: ${visibleTotalCount} warnings`}
          >
            <CircleAlert className="h-4 w-4" />
            <span className="text-xs">Alerts</span>
            {hasWarnings && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
        </PopoverTrigger>

        {/* 🎯 Popover 내용 */}
        <PopoverContent align="end" sideOffset={8} className="w-[420px] p-0 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">All Cluster Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 총 경고 배지 */}
              {hasWarnings && (
                <Badge variant="outline" className="text-xs">
                  {visibleTotalCount} total
                </Badge>
              )}
              {/* 새로고침 버튼 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchAlerts}
                disabled={loading}
                aria-label="Refresh alerts"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* 본문 */}
          <ScrollArea className="max-h-[280px]">
            {/* 로딩 상태 */}
            {loading && !data && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <Spinner className="h-6 w-6 mb-2" />
                <span className="text-sm">Loading alerts...</span>
              </div>
            )}

            {/* 에러 상태 */}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <ServerOff className="h-8 w-8 mb-2 text-destructive" />
                <span className="text-sm">{error}</span>
                <Button variant="outline" size="sm" className="mt-2" onClick={fetchAlerts}>
                  Retry
                </Button>
              </div>
            )}

            {/* 클러스터 없음 */}
            {!loading && !error && filteredClusters.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <ServerOff className="h-8 w-8 mb-2" />
                <span className="text-sm">No clusters connected</span>
              </div>
            )}

            {/* 경고 없음 */}
            {!loading && !error && filteredClusters.length > 0 && !hasWarnings && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                {/* 🎯 THEME-024: Semantic color for no alerts indicator */}
                <CircleCheck className="h-8 w-8 mb-2 text-status-success" />
                <span className="text-sm font-medium">No Alerts</span>
              </div>
            )}

            {/* 클러스터별 경고 목록 (알럿이 있는 클러스터만 표시) */}
            {!loading && !error && hasWarnings && (
              <div>
                {filteredClusters
                  .filter((c) => c.totalCount > 0)
                  .sort((a, b) => b.totalCount - a.totalCount)
                  .map((cluster) => (
                    <ClusterAlertItem
                      key={cluster.clusterId}
                      cluster={cluster}
                      onNavigate={() => handleNavigate(cluster.clusterId)}
                      onAnalyzeAlert={onAnalyzeAlert}
                      aiProvider={aiProvider}
                    />
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* 푸터 (알럿이 있을 때만 표시) */}
          {!loading && hasWarnings && (
            <>
              <Separator />
              <div className="px-3 py-1.5 text-xs text-muted-foreground text-center">
                Click a cluster to view details
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);

ClusterAlertsPopover.displayName = "ClusterAlertsPopover";
