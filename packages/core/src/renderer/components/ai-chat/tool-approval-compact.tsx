/**
 * 🎯 목적: Cursor AI 스타일의 컴팩트한 Tool 승인 UI 컴포넌트
 *
 * 📝 주의사항:
 * - 입력창 바로 위에 작은 인라인 배너 형태로 표시
 * - 아이콘 + 짧은 설명 + Approve/Reject 버튼만 표시
 * - 기존 ToolApprovalPrompt의 대체용으로 사용
 *
 * 🔄 변경이력:
 * - 2026-01-06: 초기 생성 (Cursor AI 스타일 승인 UI)
 */

import { Check, ChevronDown, ChevronRight, Terminal, X } from "lucide-react";
import React, { useState } from "react";
import { Button } from "../shadcn-ui/button";
import { Collapsible, CollapsibleContent } from "../shadcn-ui/collapsible";

// ============================================
// 🎯 Props 인터페이스
// ============================================

/**
 * ToolApprovalCompact 컴포넌트 Props
 */
interface ToolApprovalCompactProps {
  /** 질문 텍스트 (짧은 요약) */
  question: string;

  /** 옵션 목록 (Yes, No 등) */
  options: string[];

  /** 요청 문자열 (명령어 등) */
  requestString?: string;

  /** 액션 요약 */
  actionSummary?: string;

  /** stdin YAML 내용 (선택적) */
  stdin?: string;

  /** 제출 중 여부 */
  isSubmitting?: boolean;

  /** 옵션 선택 콜백 */
  onSelect(option: string): void;
}

/**
 * 🎯 목적: Cursor AI 스타일의 컴팩트한 승인 UI
 *
 * 📝 주의사항:
 * - 최소한의 공간만 차지
 * - 클릭 한 번으로 승인/거절 가능
 * - 상세 내용은 접히는 섹션으로 숨김
 */
export const ToolApprovalCompact: React.FC<ToolApprovalCompactProps> = ({
  question,
  options,
  requestString,
  actionSummary,
  stdin,
  isSubmitting = false,
  onSelect,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 🎯 THEME-014: CSS 변수 기반 테마 적용 (3-Layer Token System)
  const themeStyles: React.CSSProperties = {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  };

  // 🎯 명령어 요약 추출 (첫 번째 줄 또는 첫 80자)
  const commandSummary = React.useMemo(() => {
    if (requestString) {
      const firstLine = requestString.split("\n")[0];
      return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
    }
    if (actionSummary) {
      return actionSummary.length > 80 ? `${actionSummary.slice(0, 77)}...` : actionSummary;
    }
    return question;
  }, [requestString, actionSummary, question]);

  // 🎯 상세 내용이 있는지 확인
  const hasDetails = Boolean(stdin || (requestString && requestString.split("\n").length > 1));

  /**
   * 🎯 승인 핸들러
   *
   * 📝 주의사항:
   * - "Yes", "Approve" 등 다양한 승인 옵션 지원
   * - 옵션 배열의 첫 번째 항목을 기본 승인으로 사용
   *
   * 🔄 변경이력:
   * - 2026-01-06: "approve" 패턴 추가 (버그 수정 - "Yes"만 인식하던 문제)
   */
  const handleApprove = () => {
    if (isSubmitting) return;
    // "yes" 또는 "approve" 패턴 검색 (대소문자 무시)
    const approveOption =
      options.find((opt) => {
        const lower = opt.toLowerCase();
        return lower === "yes" || lower === "approve";
      }) ?? options[0]; // 기본: 첫 번째 옵션
    onSelect(approveOption);
  };

  /**
   * 🎯 거절 핸들러
   *
   * 📝 주의사항:
   * - "No", "Reject" 등 다양한 거절 옵션 지원
   * - 옵션 배열의 두 번째 항목을 기본 거절으로 사용
   * - ⚠️ 반드시 승인 옵션과 다른 값을 반환해야 함
   *
   * 🔄 변경이력:
   * - 2026-01-06: "reject" 패턴 추가 및 fallback 로직 수정 (버그 수정 - 거절해도 승인되던 문제)
   */
  const handleReject = () => {
    if (isSubmitting) return;
    // "no" 또는 "reject" 패턴 검색 (대소문자 무시)
    const rejectOption = options.find((opt) => {
      const lower = opt.toLowerCase();
      return lower === "no" || lower === "reject";
    });
    // 🚨 중요: 반드시 두 번째 옵션 사용 (options[0]으로 fallback 금지!)
    // options[1]이 없으면 빈 문자열보다는 명시적 "Reject" 반환
    const finalOption = rejectOption ?? options[1] ?? "Reject";
    onSelect(finalOption);
  };

  return (
    // 🎯 FIX-042: 테마 감지 후 인라인 스타일로 배경색/텍스트색 강제 적용
    <div data-slot="tool-approval-compact" className="border-border rounded-lg border px-3 py-2" style={themeStyles}>
      {/* 🎯 메인 행: 아이콘 + 요약 + 버튼들 */}
      <div className="flex items-center gap-2">
        {/* 터미널 아이콘 - THEME-014: CSS 변수 사용 */}
        <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />

        {/* 명령어 요약 - THEME-014: CSS 변수 기반 (code 토큰) */}
        <div className="flex-1 min-w-0">
          <code
            className="text-xs font-mono truncate block px-2 py-1 rounded border"
            style={{
              color: "var(--code-foreground)",
              backgroundColor: "var(--code)",
              borderColor: "var(--border)",
            }}
          >
            {commandSummary}
          </code>
        </div>

        {/* Detail toggle (when available) */}
        {hasDetails && (
          <button
            type="button"
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label={isDetailOpen ? "Hide details" : "Show details"}
          >
            {isDetailOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}

        {/* 승인/거절 버튼 - THEME-014: CSS 변수 기반 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded-md border transition-colors disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 bg-card text-foreground border-border"
            disabled={isSubmitting}
            onClick={handleReject}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            <span>Reject</span>
          </button>
          <Button
            size="sm"
            variant="default"
            className="h-7 px-2 text-xs"
            disabled={isSubmitting}
            onClick={handleApprove}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>
        </div>
      </div>

      {/* 🎯 상세 내용 (접히는 섹션) */}
      {hasDetails && (
        <Collapsible open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <CollapsibleContent>
            <div className="mt-2 pt-2 border-t border-border/50">
              {/* YAML 또는 전체 명령어 */}
              <div className="max-h-32 overflow-y-auto rounded bg-muted/30 p-2">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {stdin || requestString}
                </pre>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
