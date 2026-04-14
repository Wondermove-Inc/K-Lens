import { Check, StickyNote, X } from "lucide-react";
import React from "react";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";

interface HitlApprovalProps {
  question: string;
  approveLabel: string;
  rejectLabel: string;
  isSubmitting?: boolean;
  onApprove?(): void;
  onReject?(): void;
}

/**
 * 🎯 목적: HITL 승인 요청을 사용자에게 표시하는 UI 컴포넌트 (Storybook 원본 디자인 기반)
 *
 * @param question - LLM이 생성한 승인 요청 텍스트 (전체 내용)
 * @param approveLabel - 승인 버튼 레이블 (예: "Approve")
 * @param rejectLabel - 거부 버튼 레이블 (예: "Reject")
 * @param isSubmitting - 제출 중 상태
 * @param onApprove - 승인 버튼 클릭 핸들러
 * @param onReject - 거부 버튼 클릭 핸들러
 */
export const HitlApproval: React.FC<HitlApprovalProps> = ({
  question,
  approveLabel,
  rejectLabel,
  isSubmitting = false,
  onApprove,
  onReject,
}) => {
  return (
    <div className="border-primary flex h-auto w-full flex-col items-start gap-3 self-stretch rounded-[14px] border p-[10px]">
      <Badge variant="default" className="h-5 gap-1">
        <StickyNote className="h-3.5 w-3.5" />
        Plan
      </Badge>

      <div className="text-foreground self-stretch text-sm leading-5 whitespace-pre-wrap">{question}</div>

      <div className="flex flex-shrink-0 items-start self-stretch">
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={isSubmitting}
          className="flex flex-shrink-0 flex-grow items-center justify-center gap-2 rounded-l-md rounded-r-none"
        >
          <X className="h-4 w-4" />
          <span className="text-sm leading-5 font-medium">{rejectLabel}</span>
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          disabled={isSubmitting}
          className="flex flex-shrink-0 flex-grow items-center justify-center gap-2 rounded-l-none rounded-r-md"
        >
          <Check className="h-4 w-4" />
          <span className="text-sm leading-5 font-medium">{approveLabel}</span>
        </Button>
      </div>
    </div>
  );
};
