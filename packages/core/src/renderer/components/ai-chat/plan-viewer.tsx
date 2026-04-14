/**
 * 🎯 목적: PlanViewer UI 컴포넌트 (ShadCN/UI 기반)
 * 01: PlanViewer UI 구현
 *
 * 📝 주요 기능:
 * - 계획 제목 및 상태 표시
 * - 단계 목록 시각화 (Collapsible)
 * - 승인/거부 버튼 (Button)
 * - 진행률 표시 (Progress)
 *
 * 📝 2026-01-12: ShadCN/UI 컴포넌트 기반으로 재구현
 * - Card, Badge, Progress, Button, Collapsible 사용
 * - 다크모드 호환 색상 적용
 *
 * @packageDocumentation
 */

import { ChevronDown, ChevronRight, ClipboardList, Loader2, Play, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { planState, StepStatus } from "../../../features/ai-assistant/common/plan-state";
import { PlanSnapshot, PlanStatus } from "../../../features/ai-assistant/common/plan-types";
import { cn } from "../../lib/utils";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../shadcn-ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../shadcn-ui/collapsible";
import { Progress } from "../shadcn-ui/progress";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * PlanViewer Props
 *
 * 📝 2026-01-13: 해결
 * - conversationId prop 추가하여 대화방 구분
 *
 * 📝 2026-01-13: 해결
 * - planSnapshot prop 추가하여 Plan 독립성 확보
 * - 각 plan-viewer 메시지는 자신만의 스냅샷을 가짐
 */
export interface PlanViewerProps {
  /** 승인 콜백 */
  onApprove?: () => void;
  /** 거부 콜백 */
  onReject?: () => void;
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
  /** 현재 대화방 ID (Plan 스코프 분리용) */
  conversationId?: string;
  /**
   * Plan 스냅샷 (각 메시지가 자체 스냅샷을 보유)
   * 📝 2026-01-13: 해결
   * - planSnapshot이 제공되면 이것을 사용 (완료된 Plan 또는 다른 대화의 Plan)
   * - planSnapshot이 없으면 planState 싱글톤 사용 (현재 활성 Plan)
   */
  planSnapshot?: PlanSnapshot;
}

// ============================================
// 🎯 상태별 설정
// ============================================

/**
 * 상태별 Badge variant
 *
 * 📝 2026-01-13: BUG-E 수정 - partial 상태 추가 (경고 색상)
 * 📝 2026-01-13: - PlanStatus 타입으로 일반화
 */
const getStatusVariant = (status: PlanStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "drafting":
      return "secondary";
    case "executing":
      return "default";
    case "completed":
      return "default";
    case "partial":
      return "secondary"; // 부분 완료는 경고 색상 (destructive는 너무 강함)
    case "rejected":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

/**
 * 상태별 텍스트
 *
 * 📝 2026-01-12: 영문으로 변경 (UI 일관성)
 * 📝 2026-01-13: BUG-E 수정 - partial 상태 추가
 * 📝 2026-01-13: - PlanStatus 타입으로 일반화
 */
const getStatusText = (status: PlanStatus): string => {
  const texts: Record<PlanStatus, string> = {
    idle: "Idle",
    drafting: "Awaiting Approval",
    executing: "Executing",
    completed: "Completed",
    partial: "Partial", // 부분 완료
    rejected: "Rejected",
    failed: "Failed",
  };
  return texts[status];
};

// ============================================
// 🎯 서브 컴포넌트
// ============================================

/**
 * 단계 아이템 컴포넌트
 *
 * 📝 2026-01-13: - 심플한 디자인으로 개선
 * - 번호 원만 사용 (상태 아이콘 제거)
 * - 상태는 배경색/텍스트 색상으로 표현
 * - 명령어와 출력을 하나의 영역으로 통합
 */
interface StepItemProps {
  index: number;
  title: string;
  description?: string;
  status: StepStatus;
  command?: string;
  result?: string;
  error?: string;
  output?: string;
}

const StepItem: React.FC<StepItemProps> = React.memo(({ index, title, status, command, result, error, output }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPending = status === "pending";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isActive = status === "in_progress";
  const hasOutput = Boolean(output && output.trim().length > 0);

  return (
    <div className={cn("flex items-start gap-3 py-2", isPending && "opacity-50")} data-testid={`step-item-${index}`}>
      {/* 번호 - 상태에 따른 색상 - 🎯 THEME-024 */}
      <div
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
          isPending && "bg-muted text-muted-foreground",
          isActive && "bg-primary text-primary-foreground animate-pulse",
          isCompleted && "bg-status-success text-[var(--badge-succeeded-fg)]",
          isFailed && "bg-destructive text-destructive-foreground",
          status === "skipped" && "bg-muted text-muted-foreground",
        )}
      >
        {isCompleted ? "✓" : isFailed ? "✗" : index + 1}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        {/* 제목 */}
        <div className={cn("text-sm", isPending ? "text-muted-foreground" : "text-foreground")}>{title}</div>

        {/* 명령어 (항상 표시, 클릭 시 출력 펼침) */}
        {command && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "text-xs font-mono text-muted-foreground mt-1 text-left",
                  "hover:text-foreground transition-colors",
                  hasOutput && "cursor-pointer",
                )}
                type="button"
                disabled={!hasOutput}
              >
                {command}
                {hasOutput && <span className="ml-2 text-primary">{isExpanded ? "▼" : "▶"}</span>}
              </button>
            </CollapsibleTrigger>
            {hasOutput && (
              <CollapsibleContent>
                <pre className="mt-2 p-2 rounded text-xs font-mono bg-muted/50 overflow-x-auto max-h-40 overflow-y-auto border">
                  {output}
                </pre>
              </CollapsibleContent>
            )}
          </Collapsible>
        )}

        {/* 결과 (간단히) */}
        {result && isCompleted && <div className="text-xs text-muted-foreground mt-1">{result}</div>}

        {/* 에러 */}
        {error && isFailed && <div className="text-xs text-destructive mt-1">{error}</div>}
      </div>
    </div>
  );
});
StepItem.displayName = "StepItem";

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * PlanViewer 컴포넌트
 *
 * ShadCN/UI 기반의 Plan 뷰어
 * - Card: 전체 컨테이너
 * - Badge: 상태 표시
 * - Progress: 진행률 표시
 * - Collapsible: 펼치기/접기
 * - Button: 승인/거부 액션
 *
 * 📝 2026-01-13: 해결
 * - planSnapshot이 제공되면 스냅샷 데이터 사용 (각 Plan의 독립성 확보)
 * - planSnapshot이 없으면 planState 싱글톤 사용 (하위 호환성)
 */
export const PlanViewer: React.FC<PlanViewerProps> = observer(
  ({ onApprove, onReject, defaultExpanded = true, conversationId, planSnapshot }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // 스냅샷 또는 planState에서 상태 값 미리 추출 (useEffect 의존성용)
    const currentStatus = planSnapshot?.status ?? planState.status;

    /**
     * 🎯 2026-01-13: Plan 완료 시 자동 접힘
     *
     * 📝 사용자 요청: "출력이 완료되면 계획이 접혔으면 좋겠다"
     * - completed, partial, failed, rejected 상태가 되면 자동으로 접힘
     * - drafting, executing 상태에서는 펼침 유지
     */
    useEffect(() => {
      const isFinished =
        currentStatus === "completed" ||
        currentStatus === "partial" ||
        currentStatus === "failed" ||
        currentStatus === "rejected";

      if (isFinished) {
        setIsExpanded(false);
      }
    }, [currentStatus]);

    /**
     * 🎯 데이터 소스 결정
     *
     * planSnapshot이 제공되면 스냅샷 사용 (완료된 Plan 또는 다른 대화의 Plan)
     * planSnapshot이 없으면 planState 사용 (현재 활성 Plan)
     *
     * 📝 이렇게 하면:
     * - 각 plan-viewer 메시지가 자신만의 스냅샷을 표시
     * - 새 Plan이 생성되어도 이전 Plan의 UI가 영향받지 않음
     */
    const useSnapshot = !!planSnapshot;

    // 스냅샷 또는 planState에서 값 추출
    const title = useSnapshot ? planSnapshot.title : planState.title;
    const summary = useSnapshot ? planSnapshot.summary : planState.summary;
    const status = useSnapshot ? planSnapshot.status : planState.status;
    const steps = useSnapshot ? planSnapshot.steps : planState.steps;
    const hasSteps = steps.length > 0;
    const totalSteps = steps.length;
    const completedSteps = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    /**
     * 🎯 FIX (2026-01-13): Plan UI 표시 조건 수정
     *
     * 📝 스냅샷 사용 시:
     * - 스냅샷이 있으면 무조건 표시 (각 메시지의 스냅샷)
     *
     * 📝 planState 사용 시 (하위 호환성):
     * - Plan이 생성되었고 (hasSteps), idle 상태가 아니면 표시
     * - conversationId 체크하여 현재 대화방의 Plan만 표시
     */
    if (useSnapshot) {
      // 스냅샷이 있으면 idle 상태가 아닐 때 표시
      if (status === "idle") return null;
    } else {
      // planState 사용 시 기존 로직
      const isCurrentConversationPlan =
        !conversationId || planState.currentConversationId === conversationId || planState.currentConversationId === "";
      const shouldShowPlan = hasSteps && status !== "idle" && isCurrentConversationPlan;
      if (!shouldShowPlan) return null;
    }

    // 📝 2026-01-13: BUG-E 수정 - partial/failed 상태에서도 진행률 표시
    const showProgress =
      status === "executing" || status === "completed" || status === "partial" || status === "failed";
    const showActions = status === "drafting";

    /**
     * 🎯 2026-01-13: 해결
     * 승인 가능 여부 결정:
     * - 스냅샷 사용 시: 스냅샷의 status가 "drafting"이면 승인 가능
     * - planState 사용 시: planState.canApprove 참조
     *
     * 📝 기존 로직에서 스냅샷 사용 시 항상 false로 설정하여 버튼이 안 보이던 문제 해결
     */
    const canApprove = useSnapshot
      ? status === "drafting" // 스냅샷도 drafting 상태면 승인 가능
      : planState.canApprove;

    return (
      <Card
        className="mb-3 shadow-md border-primary/20"
        data-testid="plan-viewer"
        role="region"
        aria-label="Plan Viewer"
      >
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          {/* 헤더 */}
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" />
                <CardTitle className="text-base">{title || "Execution Plan"}</CardTitle>
                <Badge variant={getStatusVariant(status)}>{getStatusText(status)}</Badge>
              </div>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon-sm" data-testid="toggle-button" aria-expanded={isExpanded}>
                  {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* 요약 설명 */}
            {summary && <p className="text-sm text-muted-foreground mt-1">{summary}</p>}

            {/* 진행률 바 */}
            {showProgress && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span data-testid="progress-text">
                    {completedSteps}/{totalSteps} ({Math.round(progressPercentage)}%)
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-3">
              {/* 단계 목록 */}
              {hasSteps ? (
                <div className="space-y-2" data-testid="plan-content">
                  {steps.map((step, index) => (
                    <StepItem
                      key={index}
                      index={index}
                      title={step.title}
                      description={step.description}
                      status={step.status}
                      command={step.command}
                      result={step.result}
                      error={step.error}
                      output={step.output}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
                  <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                  Generating plan...
                </div>
              )}
            </CardContent>

            {/* 🎯 2026-01-13: 해결 - 스냅샷 사용 여부와 관계없이 drafting 상태면 버튼 표시 */}
            {/* 기존: !useSnapshot 조건으로 스냅샷 사용 시 버튼 숨김 → 문제 발생 */}
            {/* 수정: status === "drafting" (showActions)이면 버튼 표시 */}
            {showActions && hasSteps && (
              <CardFooter className="pt-0 px-4 pb-4 gap-2">
                <Button onClick={onApprove} disabled={!canApprove} className="flex-1" data-testid="approve-button">
                  <Play className="size-4" />
                  Approve & Execute
                </Button>
                <Button onClick={onReject} variant="outline" className="flex-1" data-testid="reject-button">
                  <X className="size-4" />
                  Reject
                </Button>
              </CardFooter>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  },
);

PlanViewer.displayName = "PlanViewer";
export default PlanViewer;
