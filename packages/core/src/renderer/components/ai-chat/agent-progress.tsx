/**
 * 🎯 목적: AgentProgress UI 컴포넌트
 * 01: AgentProgress UI 구현 (TDD)
 *
 * 📝 주요 기능:
 * - Agent Mode 진행 상태 표시
 * - 단계별 목록 및 상태 표시
 * - 승인/거부 버튼
 * - 자동 실행 토글
 * - 제어 버튼 (일시정지, 재개, 중지)
 *
 * @packageDocumentation
 */

import { Check, Pause, Play, Square } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  AgentModeController,
  AgentModeStatus,
  ApprovalStatus,
} from "../../../features/ai-assistant/common/agent-mode-controller";
import { Button } from "../shadcn-ui/button";
import { Label } from "../shadcn-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shadcn-ui/select";
import { Switch } from "../shadcn-ui/switch";
import { getStatusText, StepItem } from "./agent-progress-utils";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * AgentProgress Props
 */
export interface AgentProgressProps {
  /** Agent Mode 컨트롤러 */
  controller: AgentModeController;
}

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * AgentProgress 컴포넌트
 *
 * 📝 Agent Mode 진행 상태를 표시하는 UI
 */
export const AgentProgress: React.FC<AgentProgressProps> = ({ controller }) => {
  // 컴포넌트 리렌더링을 위한 상태
  const [, forceUpdate] = useState({});

  // 상태 변경 시 리렌더링
  useEffect(() => {
    const unsubscribeStatus = controller.onStatusChange(() => forceUpdate({}));
    const unsubscribeStep = controller.onStepAdded(() => forceUpdate({}));

    return () => {
      unsubscribeStatus();
      unsubscribeStep();
    };
  }, [controller]);

  // 승인 핸들러
  const handleApprove = useCallback(
    (stepId: string) => {
      controller.approveStep(stepId);
      forceUpdate({});
    },
    [controller],
  );

  // 거부 핸들러
  const handleReject = useCallback(
    (stepId: string) => {
      controller.rejectStep(stepId);
      forceUpdate({});
    },
    [controller],
  );

  // 모두 승인 핸들러
  const handleApproveAll = useCallback(() => {
    controller.approveAllPending();
    forceUpdate({});
  }, [controller]);

  // 자동 실행 토글 핸들러
  const handleAutoApproveToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        controller.enableAutoApprove();
      } else {
        controller.disableAutoApprove();
      }
      forceUpdate({});
    },
    [controller],
  );

  // 일시정지/재개 핸들러
  const handlePauseResume = useCallback(() => {
    if (controller.status === AgentModeStatus.RUNNING) {
      controller.pause();
    } else if (controller.status === AgentModeStatus.PAUSED) {
      controller.resume();
    }
    forceUpdate({});
  }, [controller]);

  // 중지 핸들러
  const handleStop = useCallback(() => {
    controller.stop();
    forceUpdate({});
  }, [controller]);

  // IDLE 상태일 때는 렌더링하지 않음
  if (controller.status === AgentModeStatus.IDLE) {
    return null;
  }

  const isRunning = controller.status === AgentModeStatus.RUNNING;
  const isPaused = controller.status === AgentModeStatus.PAUSED;
  const isError = controller.status === AgentModeStatus.ERROR;
  const hasPendingApprovals = controller.hasPendingApprovals;
  const pendingCount = controller.steps.filter((s) => s.status === ApprovalStatus.PENDING).length;

  return (
    <div className="border rounded-lg p-4 bg-card" role="region" aria-label="Agent Mode 진행 상황">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Agent Mode</span>
          <span className="text-sm text-muted-foreground">{getStatusText(controller.status)}</span>
        </div>

        {/* 제어 버튼 */}
        <div className="flex gap-1">
          {(isRunning || isPaused) && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePauseResume}
                aria-label={isRunning ? "일시정지" : "재개"}
              >
                {isRunning ? (
                  <>
                    <Pause className="h-3 w-3 mr-1" />
                    일시정지
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    재개
                  </>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={handleStop} aria-label="중지">
                <Square className="h-3 w-3 mr-1" />
                중지
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 목표 */}
      {controller.goal && <div className="text-sm text-muted-foreground mb-3">목표: {controller.goal}</div>}

      {/* 에러 메시지 - 🎯 THEME-024 */}
      {isError && controller.errorMessage && (
        <div className="p-2 bg-status-error-muted rounded text-sm text-status-error mb-3">
          ⚠️ {controller.errorMessage}
        </div>
      )}

      {/* 진행률 */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>진행률</span>
          <span>{controller.progressPercentage}%</span>
        </div>
        {/* 🎯 THEME-024: CSS 변수 기반 유틸리티 */}
        <div
          className="w-full bg-[var(--tw-gray-200)] rounded-full h-2"
          role="progressbar"
          aria-valuenow={controller.progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-2 rounded-full bg-status-info transition-all"
            style={{ width: `${controller.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 자동 실행 설정 */}
      {/* 🎯 THEME-024: CSS 변수 기반 배경색 */}
      <div className="flex items-center justify-between mb-3 p-2 bg-muted/30 rounded">
        <div className="flex items-center gap-2">
          <Switch
            id="auto-approve"
            checked={controller.isAutoApproveEnabled}
            onCheckedChange={handleAutoApproveToggle}
            role="switch"
            aria-label="자동 실행"
          />
          <Label htmlFor="auto-approve" className="text-sm">
            자동 실행
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="auto-count" className="text-xs text-muted-foreground">
            횟수
          </Label>
          <Select defaultValue="unlimited">
            <SelectTrigger id="auto-count" className="w-24 h-7" aria-label="횟수">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unlimited">무제한</SelectItem>
              <SelectItem value="5">5회</SelectItem>
              <SelectItem value="10">10회</SelectItem>
              <SelectItem value="20">20회</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Approve All button */}
      {hasPendingApprovals && pendingCount > 1 && (
        <div className="mb-3">
          <Button size="sm" variant="default" onClick={handleApproveAll} className="w-full" aria-label="Approve All">
            <Check className="h-3 w-3 mr-1" />
            Approve All ({pendingCount})
          </Button>
        </div>
      )}

      {/* 단계 목록 */}
      {controller.steps.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground mb-2">
            단계 ({controller.completedStepCount}/{controller.totalStepCount})
          </div>
          <div className="max-h-60 overflow-y-auto">
            {controller.steps.map((step) => (
              <StepItem key={step.id} step={step} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

AgentProgress.displayName = "AgentProgress";

export default AgentProgress;
