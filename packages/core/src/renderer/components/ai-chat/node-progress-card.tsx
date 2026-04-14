/**
 * 🎯 목적: AI 작업 진행 상황을 Collapsible Card로 표시
 *
 * 기능:
 * - 현재 작업 단계를 한 줄로 표시 (◯ Running: toolName)
 * - 수행 중일 때 아이콘 깜빡임 애니메이션
 * - 드롭다운 버튼으로 이전 완료된 단계들 표시
 *
 * 🔄 변경이력:
 * - 2026-01-08: 3줄 → 1줄 UI 개선
 */

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";

import type { NodeProgressStep } from "./ai-chat-panel-store";

interface NodeProgressCardProps {
  currentStep: NodeProgressStep | null;
  completedSteps: NodeProgressStep[];
  isExpanded: boolean;
  onToggle: () => void;
  /** 현재 수행 중인지 여부 (깜빡임 애니메이션 제어) */
  isRunning?: boolean;
}

export const NodeProgressCard = observer(
  ({ currentStep, completedSteps, isExpanded, onToggle, isRunning = true }: NodeProgressCardProps) => {
    // 🎯 현재 단계 이름 추출 (displayName에서 tool: 접두사 제거)
    const currentToolName = currentStep?.displayName?.replace(/^tool:/, "") ?? "Processing";

    // 🎯 THEME-014: CSS 변수 기반 테마 적용 (3-Layer Token System)
    const themeStyles: React.CSSProperties = {
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
    };

    return (
      <div data-slot="node-progress-card" className="w-full rounded-md px-2 py-1.5" style={themeStyles}>
        {/* 🎯 2026-01-29: 세련된 컴팩트 디자인 */}
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between hover:opacity-70 transition-opacity"
          type="button"
        >
          <div className="flex items-center gap-1.5">
            {/* 🎯 작은 점 인디케이터 */}
            <span className={`h-1.5 w-1.5 rounded-full bg-primary/80 ${isRunning ? "animate-pulse" : ""}`} />
            <span className="text-xs text-muted-foreground">{currentToolName}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground/60" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
          )}
        </button>

        {/* 🎯 펼쳤을 때: 현재 단계 상세 + 이전 단계들 */}
        {isExpanded && (
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1 border-t border-border/50 pt-2">
            {/* 현재 단계 상세 (summary가 있을 때만) */}
            {currentStep?.summary && (
              <div className="flex items-start gap-1.5 pl-3">
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-primary/80 mt-1 shrink-0 ${isRunning ? "animate-pulse" : ""}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-muted-foreground text-[11px] line-clamp-2">{currentStep.summary}</div>
                </div>
              </div>
            )}

            {/* 이전 완료된 단계들 */}
            {/* 🎯 THEME-024: Semantic color for completed steps */}
            {completedSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-1.5 pl-3">
                <Check className="h-3 w-3 shrink-0 text-status-success/70 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground/70 text-[11px]">
                    {step.displayName?.replace(/^tool:/, "")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
