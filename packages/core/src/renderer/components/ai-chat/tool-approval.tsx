import yaml from "js-yaml";
import { ChevronRight } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { type ToolApprovalWithDiff } from "../../../features/ai-assistant/common/tool-approval-types";
import { Button } from "../shadcn-ui/button";
import { Card } from "../shadcn-ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../shadcn-ui/collapsible";
import { ScrollArea } from "../shadcn-ui/scroll-area";
import { ToolApprovalDiff } from "./tool-approval-diff";

// ============================================
// 🎯 Props 인터페이스
// ============================================

/**
 * ToolApprovalPrompt 컴포넌트 Props
 *
 * 📝 주의사항:
 * - approval이 있으면 새로운 Diff 통합 UI 사용
 * - approval이 없으면 기존 UI 사용 (stdin, requestString)
 */
interface ToolApprovalPromptProps {
  /** 질문 텍스트 */
  question: string;

  /** 옵션 목록 (Yes, No 등) */
  options: string[];

  /** 요청 문자열 (기존 방식) */
  requestString?: string;

  /** 액션 요약 */
  actionSummary?: string;

  /** kubectl apply -f - 등에서 stdin으로 전달할 YAML 내용 (기존 방식) */
  stdin?: string;

  /** 🆕 Diff 정보를 포함한 승인 요청 (새로운 방식) */
  approval?: ToolApprovalWithDiff;

  /** 제출 중 여부 */
  isSubmitting?: boolean;

  /** 옵션 선택 콜백 */
  onSelect(option: string): void;
}

/**
 * 🎯 목적: YAML에서 주요 필드 추출
 *
 * @param yamlContent - YAML 문자열
 * @returns 주요 필드 객체 또는 null
 */
function parseYamlKeyFields(yamlContent: string): {
  kind?: string;
  name?: string;
  namespace?: string;
  image?: string;
  replicas?: number;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = yaml.load(yamlContent) as any;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      kind: parsed.kind,
      name: parsed.metadata?.name,
      namespace: parsed.metadata?.namespace,
      image: parsed.spec?.containers?.[0]?.image ?? parsed.spec?.template?.spec?.containers?.[0]?.image,
      replicas: parsed.spec?.replicas,
    };
  } catch {
    return null;
  }
}

/**
 * 🎯 목적: Tool 실행 시 사용자 승인 여부를 묻는 UI 컴포넌트
 *
 * 📝 주의사항:
 * - approval이 있으면 새로운 Diff 통합 UI 사용 (ToolApprovalDiff)
 * - stdin(YAML)이 있으면 하이브리드 UI 표시 (주요 필드 + 접히는 YAML)
 * - 없으면 기존 requestString 표시
 *
 * 🔄 변경이력:
 * - 2026-01-05: approval 속성 추가 - Diff 통합 UI 지원
 * - 2025-12-23: stdin 하이브리드 UI 추가 (주요 필드 표시 + 접히는 YAML)
 */
export const ToolApprovalPrompt: React.FC<ToolApprovalPromptProps> = ({
  question,
  options,
  requestString,
  actionSummary,
  stdin,
  approval,
  isSubmitting = false,
  onSelect,
}) => {
  const [isYamlOpen, setIsYamlOpen] = useState(false);

  // 🎯 YAML 파싱 및 주요 필드 추출
  const keyFields = useMemo(() => {
    if (!stdin) {
      return null;
    }

    return parseYamlKeyFields(stdin);
  }, [stdin]);

  // 🎯 옵션 클릭 핸들러 (기존 방식)
  const handleClick = (option: string) => {
    if (isSubmitting) {
      return;
    }

    onSelect(option);
  };

  /**
   * 🎯 승인 핸들러 (새로운 Diff 방식)
   *
   * 📝 주의사항:
   * - "Yes", "Approve" 등 다양한 승인 옵션 지원
   *
   * 🔄 변경이력:
   * - 2026-01-06: "approve" 패턴 추가 (버그 수정)
   */
  const handleApprove = useCallback(() => {
    if (!isSubmitting) {
      // "yes" 또는 "approve" 패턴 검색
      const approveOption =
        options.find((opt) => {
          const lower = opt.toLowerCase();
          return lower === "yes" || lower === "approve";
        }) ?? options[0];
      onSelect(approveOption);
    }
  }, [isSubmitting, options, onSelect]);

  /**
   * 🎯 거부 핸들러 (새로운 Diff 방식)
   *
   * 📝 주의사항:
   * - "No", "Reject" 등 다양한 거절 옵션 지원
   * - ⚠️ options[0]으로 fallback 금지!
   *
   * 🔄 변경이력:
   * - 2026-01-06: "reject" 패턴 추가 및 fallback 로직 수정 (버그 수정)
   */
  const handleReject = useCallback(() => {
    if (!isSubmitting) {
      // "no" 또는 "reject" 패턴 검색
      const rejectOption = options.find((opt) => {
        const lower = opt.toLowerCase();
        return lower === "no" || lower === "reject";
      });
      // 🚨 중요: options[0]으로 fallback 금지!
      const finalOption = rejectOption ?? options[1] ?? "Reject";
      onSelect(finalOption);
    }
  }, [isSubmitting, options, onSelect]);

  // 🎯 approval이 있으면 새로운 ToolApprovalDiff 사용
  if (approval) {
    return (
      <ToolApprovalDiff
        approval={approval}
        onApprove={handleApprove}
        onReject={handleReject}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <Card className="border-border bg-background flex flex-col gap-4 border p-4 min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">Tool approval required</span>
        <h4 className="text-foreground text-sm font-semibold leading-5 whitespace-pre-wrap">{question}</h4>
        {actionSummary && <span className="text-muted-foreground text-xs font-medium leading-4">{actionSummary}</span>}
      </div>

      {/* 🎯 stdin(YAML)이 있으면 하이브리드 UI 표시 */}
      {stdin && keyFields && (
        <div className="flex flex-col gap-3">
          {/* 주요 필드 표시 */}
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              {keyFields.kind && (
                <>
                  <span className="text-muted-foreground font-medium">Kind:</span>
                  <span className="text-foreground font-mono">{keyFields.kind}</span>
                </>
              )}
              {keyFields.name && (
                <>
                  <span className="text-muted-foreground font-medium">Name:</span>
                  <span className="text-foreground font-mono">{keyFields.name}</span>
                </>
              )}
              {keyFields.namespace && (
                <>
                  <span className="text-muted-foreground font-medium">Namespace:</span>
                  <span className="text-foreground font-mono">{keyFields.namespace}</span>
                </>
              )}
              {keyFields.image && (
                <>
                  <span className="text-muted-foreground font-medium">Image:</span>
                  <span className="text-foreground font-mono">{keyFields.image}</span>
                </>
              )}
              {keyFields.replicas !== undefined && (
                <>
                  <span className="text-muted-foreground font-medium">Replicas:</span>
                  <span className="text-foreground font-mono">{keyFields.replicas}</span>
                </>
              )}
            </div>
          </div>

          {/* 접히는 전체 YAML 섹션 */}
          <Collapsible open={isYamlOpen} onOpenChange={setIsYamlOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className={`h-3.5 w-3.5 mr-1 transition-transform ${isYamlOpen ? "rotate-90" : ""}`} />
                View Full YAML
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* 🎯 max-h-80 (320px) + overflow-y-auto로 스크롤 보장 */}
              <div className="max-h-80 overflow-y-auto rounded-md border border-dashed border-border bg-secondary/40 p-2 mt-2">
                <pre className="text-foreground/90 text-xs whitespace-pre font-mono">{stdin}</pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* 🎯 stdin이 없으면 기존 requestString 표시 */}
      {!stdin && requestString && (
        <ScrollArea className="max-h-48 rounded-md border border-dashed border-border bg-secondary/40 p-2 text-xs">
          <pre className="text-foreground/90 whitespace-pre-wrap break-all overflow-x-auto">{requestString}</pre>
        </ScrollArea>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option.toLowerCase() === "no" ? "outline" : "default"}
            disabled={isSubmitting}
            onClick={() => handleClick(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </Card>
  );
};
