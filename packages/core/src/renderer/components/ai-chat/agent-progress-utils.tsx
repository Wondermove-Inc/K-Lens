/**
 * 🎯 목적: AgentProgress 유틸리티 및 서브 컴포넌트
 * 01: AgentProgress UI 구현 (TDD)
 *
 * 📝 주요 기능:
 * - 상태/타입별 텍스트 및 아이콘 유틸리티
 * - StepItem 서브 컴포넌트
 *
 * @packageDocumentation
 */

import { Brain, Check, FileCode, FilePlus, FileX, MessageSquare, Terminal, Wrench, X } from "lucide-react";
import React from "react";
import {
  AgentModeStatus,
  type AgentStep,
  ApprovalStatus,
  StepType,
} from "../../../features/ai-assistant/common/agent-mode-controller";
import { Button } from "../shadcn-ui/button";

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 상태별 텍스트 반환
 *
 * @param status - Agent 상태
 * @returns 한국어 상태 텍스트
 */
export function getStatusText(status: AgentModeStatus): string {
  const texts: Record<AgentModeStatus, string> = {
    [AgentModeStatus.IDLE]: "대기",
    [AgentModeStatus.RUNNING]: "실행 중",
    [AgentModeStatus.PAUSED]: "일시정지",
    [AgentModeStatus.STOPPED]: "중지됨",
    [AgentModeStatus.COMPLETED]: "완료",
    [AgentModeStatus.ERROR]: "에러",
  };
  return texts[status];
}

/**
 * 단계 타입별 아이콘 반환
 *
 * @param type - 단계 타입
 * @returns React 아이콘 노드
 */
export function getStepIcon(type: StepType): React.ReactNode {
  const icons: Record<StepType, React.ReactNode> = {
    [StepType.THINKING]: <Brain className="h-4 w-4" data-testid="step-icon-thinking" />,
    [StepType.TOOL_CALL]: <Wrench className="h-4 w-4" data-testid="step-icon-tool" />,
    [StepType.CODE_EDIT]: <FileCode className="h-4 w-4" data-testid="step-icon-code" />,
    [StepType.FILE_CREATE]: <FilePlus className="h-4 w-4" data-testid="step-icon-create" />,
    [StepType.FILE_DELETE]: <FileX className="h-4 w-4" data-testid="step-icon-delete" />,
    [StepType.COMMAND]: <Terminal className="h-4 w-4" data-testid="step-icon-command" />,
    [StepType.RESPONSE]: <MessageSquare className="h-4 w-4" data-testid="step-icon-response" />,
  };
  return icons[type];
}

// ============================================
// 🎯 서브 컴포넌트
// ============================================

/**
 * StepItem Props
 */
export interface StepItemProps {
  /** 단계 정보 */
  step: AgentStep;
  /** 승인 핸들러 */
  onApprove: (stepId: string) => void;
  /** 거부 핸들러 */
  onReject: (stepId: string) => void;
}

/**
 * 단계 항목 컴포넌트
 *
 * 📝 각 실행 단계를 표시하고 승인/거부 기능 제공
 */
export const StepItem: React.FC<StepItemProps> = React.memo(({ step, onApprove, onReject }) => {
  const isPending = step.status === ApprovalStatus.PENDING;
  const isApproved = step.status === ApprovalStatus.APPROVED || step.status === ApprovalStatus.AUTO_APPROVED;
  const isRejected = step.status === ApprovalStatus.REJECTED;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        {/* 단계 타입 아이콘 */}
        {getStepIcon(step.type)}

        {/* 설명 */}
        <span className="text-sm">{step.description}</span>

        {/* 🎯 THEME-024: Semantic color for approval/rejection status */}
        {/* 승인/거부 상태 아이콘 */}
        {isApproved && <Check className="h-4 w-4 text-status-success" data-testid="step-approved" />}
        {isRejected && <X className="h-4 w-4 text-status-error" data-testid="step-rejected" />}
      </div>

      {/* Approve/Reject buttons (pending only) */}
      {isPending && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => onApprove(step.id)} aria-label="Approve">
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject(step.id)} aria-label="Reject">
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
});

StepItem.displayName = "StepItem";
