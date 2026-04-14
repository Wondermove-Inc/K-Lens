/**
 * 🎯 목적: ThinkingIndicator UI 컴포넌트
 * 01: ThinkingIndicator UI 구현
 *
 * 📝 주요 기능:
 * - SRE 진단 루프 4단계 시각화 (Observe → Hypothesize → Validate → Mitigate)
 * - 현재 진행 중인 단계 하이라이트 + 애니메이션
 * - 도구 호출 실시간 표시
 * - 접기/펼치기 토글
 * - 타임스탬프 표시
 *
 * @packageDocumentation
 */

import { observer } from "mobx-react-lite";
import React, { useMemo } from "react";
import { ThinkingStep, ToolCallRecord, thinkingState } from "../../../features/ai-assistant/common/thinking-state";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 진단 단계 정의
 */
interface DiagnosisStep {
  step: ThinkingStep;
  icon: string;
  label: string;
}

/**
 * 4단계 진단 루프 정의
 */
const DIAGNOSIS_STEPS: DiagnosisStep[] = [
  { step: "observing", icon: "👁️", label: "관찰" },
  { step: "hypothesizing", icon: "💭", label: "가설" },
  { step: "validating", icon: "✅", label: "검증" },
  { step: "mitigating", icon: "🔧", label: "조치" },
];

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 타임스탬프 포맷팅
 *
 * @param date - Date 객체
 * @returns HH:MM:SS 형식 문자열
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 단계 상태 계산
 *
 * @param step - 확인할 단계
 * @param currentStep - 현재 단계
 * @param completedSteps - 완료된 단계 목록
 * @returns 상태 객체
 */
function getStepStatus(
  step: ThinkingStep,
  currentStep: ThinkingStep,
  completedSteps: ThinkingStep[],
): { isActive: boolean; isCompleted: boolean } {
  const stepOrder: ThinkingStep[] = ["analyzing", "observing", "hypothesizing", "validating", "mitigating", "complete"];

  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(step);

  return {
    isActive: step === currentStep,
    isCompleted: stepIndex < currentIndex || completedSteps.includes(step),
  };
}

/**
 * 인자를 간략하게 표시
 *
 * @param args - 도구 호출 인자
 * @returns 간략화된 문자열
 */
function formatArgs(args: Record<string, unknown>): string {
  const str = JSON.stringify(args);
  if (str.length > 50) {
    return str.substring(0, 47) + "...";
  }
  return str;
}

/**
 * 결과를 간략하게 표시
 *
 * @param result - 도구 호출 결과
 * @returns 간략화된 문자열
 */
function formatResult(result: unknown): string {
  const str = JSON.stringify(result);
  if (str.length > 30) {
    return str.substring(0, 27) + "...";
  }
  return str;
}

// ============================================
// 🎯 서브 컴포넌트
// ============================================

/**
 * 진단 단계 아이콘 컴포넌트
 */
interface StepIconProps {
  diagnosisStep: DiagnosisStep;
  isActive: boolean;
  isCompleted: boolean;
}

const StepIcon: React.FC<StepIconProps> = React.memo(({ diagnosisStep, isActive, isCompleted }) => {
  // 🎯 THEME-024: CSS 변수 기반 유틸리티 클래스
  const className = [
    "flex flex-col items-center p-2 rounded-lg transition-all duration-300",
    isActive && "bg-status-info-muted active animate-pulse",
    isCompleted && "bg-status-success-muted completed",
    !isActive && !isCompleted && "opacity-50",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-testid={`step-${diagnosisStep.step}`}>
      <span className="text-xl" role="img" aria-label={diagnosisStep.label}>
        {diagnosisStep.icon}
      </span>
      <span className="text-xs mt-1 text-muted-foreground">{diagnosisStep.label}</span>
      {isCompleted && !isActive && <span className="text-xs text-status-success">✓</span>}
    </div>
  );
});

StepIcon.displayName = "StepIcon";

/**
 * 도구 호출 항목 컴포넌트
 */
interface ToolCallItemProps {
  toolCall: ToolCallRecord;
  index: number;
}

// 🎯 THEME-024: CSS 변수 기반 색상으로 마이그레이션
const ToolCallItem: React.FC<ToolCallItemProps> = React.memo(({ toolCall, index }) => {
  const hasResult = toolCall.result !== undefined;

  return (
    <div
      className="flex items-start gap-2 p-2 bg-[var(--tw-gray-50)] rounded-md text-sm"
      data-testid={`tool-call-${index}`}
    >
      <span className="text-muted-foreground">🔧</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-status-info">{toolCall.name}</span>
          <span className="text-xs text-muted-foreground/70" data-testid={`timestamp-tool-${index}`}>
            {formatTimestamp(toolCall.timestamp)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{formatArgs(toolCall.args)}</div>
        {hasResult ? (
          <div className="text-xs text-status-success mt-1">→ {formatResult(toolCall.result)}</div>
        ) : (
          <div className="flex items-center gap-1 mt-1" data-testid={`tool-loading-${index}`}>
            <span className="animate-spin text-xs">⏳</span>
            <span className="text-xs text-muted-foreground/70">실행 중...</span>
          </div>
        )}
      </div>
    </div>
  );
});

ToolCallItem.displayName = "ToolCallItem";

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * ThinkingIndicator 컴포넌트
 *
 * 📝 AI 추론 과정을 시각적으로 표시
 * - MobX observer로 thinkingState 구독
 */
export const ThinkingIndicator: React.FC = observer(() => {
  // 완료된 단계 목록 계산 (훅은 조건문 전에 호출되어야 함)
  const completedSteps = useMemo(() => {
    return thinkingState.steps.map((s) => s.step);
  }, [thinkingState.steps]);

  // 마지막 상세 정보 가져오기
  const lastDetails = useMemo(() => {
    const stepsWithDetails = thinkingState.steps.filter((s) => s.details);
    return stepsWithDetails.length > 0 ? stepsWithDetails[stepsWithDetails.length - 1].details : undefined;
  }, [thinkingState.steps]);

  // idle 상태에서는 렌더링하지 않음 (훅 호출 이후에 조건 체크)
  if (thinkingState.currentStep === "idle" && thinkingState.steps.length === 0) {
    return null;
  }

  return (
    <div
      className="border rounded-lg p-3 mb-3 bg-card shadow-sm"
      data-testid="thinking-indicator"
      role="region"
      aria-label="AI 추론 과정"
    >
      {/* 헤더: 현재 상태 + 토글 버튼 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {thinkingState.isThinking && <span className="animate-spin text-sm">🤔</span>}
          <span className="font-medium text-sm">{thinkingState.currentStepLabel}</span>
          {lastDetails && <span className="text-xs text-muted-foreground">- {lastDetails}</span>}
        </div>

        <button
          onClick={() => thinkingState.toggleThinkingExpanded()}
          className="p-1 hover:bg-muted rounded transition-colors"
          data-testid="toggle-expand"
          aria-expanded={thinkingState.isExpanded}
          aria-label={thinkingState.isExpanded ? "접기" : "펼치기"}
        >
          {thinkingState.isExpanded ? "▼" : "▶"}
        </button>
      </div>

      {/* 접힌 상태: 요약만 표시 */}
      {!thinkingState.isExpanded && (
        <div className="text-xs text-muted-foreground">
          {thinkingState.hasToolCalls && <span>{thinkingState.toolCallCount}개 도구 호출</span>}
        </div>
      )}

      {/* 펼친 상태: 상세 내용 */}
      {thinkingState.isExpanded && (
        <div data-testid="thinking-content">
          {/* 4단계 진단 루프 표시 */}
          <div className="flex items-center justify-between gap-2 mb-3 py-2 border-b border-border">
            {DIAGNOSIS_STEPS.map((diagStep, index) => {
              const status = getStepStatus(diagStep.step, thinkingState.currentStep, completedSteps);

              return (
                <React.Fragment key={diagStep.step}>
                  <StepIcon diagnosisStep={diagStep} isActive={status.isActive} isCompleted={status.isCompleted} />
                  {index < DIAGNOSIS_STEPS.length - 1 && <span className="text-border">→</span>}
                </React.Fragment>
              );
            })}
          </div>

          {/* 단계 히스토리 */}
          {thinkingState.steps.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">진행 단계</div>
              <div className="space-y-1">
                {thinkingState.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid={`timestamp-step-${index}`}>{formatTimestamp(step.timestamp)}</span>
                    <span>{step.label}</span>
                    {step.details && <span className="text-muted-foreground/70">({step.details})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 도구 호출 목록 */}
          {thinkingState.hasToolCalls && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                도구 호출 ({thinkingState.toolCallCount})
              </div>
              <div className="space-y-2">
                {thinkingState.toolCalls.map((toolCall, index) => (
                  <ToolCallItem key={index} toolCall={toolCall} index={index} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ThinkingIndicator.displayName = "ThinkingIndicator";

export default ThinkingIndicator;
