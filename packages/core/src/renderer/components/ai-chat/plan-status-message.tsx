/**
 * 🎯 목적: Plan 상태 메시지 컴포넌트
 *
 * 📝 2026-01-13: Problem 2 해결 - 이모지 대신 lucide-react 아이콘 사용
 * - Plan Approved, Completed, Partial, Failed, Rejected 메시지 렌더링
 * - shadcn/ui 스타일과 일관된 아이콘 및 디자인
 *
 * @packageDocumentation
 */

import { AlertCircle, Ban, CheckCircle2, CircleAlert, Play } from "lucide-react";
import React from "react";

import type { PlanStatusMessageData } from "./ai-chat-panel-store";

/**
 * Props for PlanStatusMessage component
 */
export interface PlanStatusMessageProps {
  /** Plan 상태 메시지 데이터 */
  data: PlanStatusMessageData;
}

/**
 * 상태별 아이콘 및 색상 매핑
 * 🎯 THEME-024: CSS 변수 기반 유틸리티 클래스로 마이그레이션
 */
const STATUS_CONFIG: Record<
  PlanStatusMessageData["statusType"],
  {
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  approved: {
    icon: Play,
    iconClass: "text-status-success",
    bgClass: "bg-status-success-muted",
    borderClass: "border-status-success",
  },
  completed: {
    icon: CheckCircle2,
    iconClass: "text-status-success",
    bgClass: "bg-status-success-muted",
    borderClass: "border-status-success",
  },
  partial: {
    icon: CircleAlert,
    iconClass: "text-status-warning",
    bgClass: "bg-status-warning-muted",
    borderClass: "border-status-warning",
  },
  failed: {
    icon: AlertCircle,
    iconClass: "text-status-error",
    bgClass: "bg-status-error-muted",
    borderClass: "border-status-error",
  },
  rejected: {
    icon: Ban,
    iconClass: "text-status-pending",
    bgClass: "bg-status-pending-muted",
    borderClass: "border-status-pending",
  },
};

/**
 * 🎯 목적: Plan 상태 메시지 렌더링
 *
 * 📝 디자인:
 * - 좌측: 상태별 아이콘
 * - 중앙: 제목, 설명, 상세 내용
 * - shadcn/ui 스타일과 일관된 디자인
 */
export function PlanStatusMessage({ data }: PlanStatusMessageProps): React.ReactElement {
  const config = STATUS_CONFIG[data.statusType];
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${config.bgClass} ${config.borderClass}`}>
      {/* 상태 아이콘 */}
      <div className="shrink-0 pt-0.5">
        <Icon className={`h-5 w-5 ${config.iconClass}`} />
      </div>

      {/* 메시지 내용 */}
      <div className="flex-1 min-w-0">
        {/* 제목 + 설명 */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-sm">{data.title}</span>
          {data.description && <span className="text-muted-foreground text-sm">{data.description}</span>}
        </div>

        {/* 상세 내용 (LLM 생성 요약 등) */}
        {data.details && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{data.details}</p>}
      </div>
    </div>
  );
}

PlanStatusMessage.displayName = "PlanStatusMessage";
