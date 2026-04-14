/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * 🎯 목적: AI 응답 피드백 버튼 (👍👎)
 *
 * Assistant 메시지 완료 후 표시되는 피드백 버튼입니다.
 * 👍: 즉시 긍정 피드백 전송
 * 👎: 카테고리 선택 패널 + 선택적 텍스트 입력
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 * - 2026-03-23: 카테고리 선택 UI 추가
 */

import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "../../../features/ai-assistant/common/user-profile-types";

// ============================================
// 🎯 타입 정의
// ============================================

export type FeedbackRating = "positive" | "negative" | null;

export interface FeedbackButtonsProps {
  /** 메시지 ID */
  messageId: string;
  /** 대화 threadId */
  threadId: string;
  /** 피드백 제출 콜백 */
  onFeedback: (
    messageId: string,
    threadId: string,
    rating: "positive" | "negative",
    category?: FeedbackCategory,
    detail?: string,
  ) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

// ============================================
// 🎯 FeedbackButtons 컴포넌트
// ============================================

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = React.memo(
  ({ messageId, threadId, onFeedback, disabled = false }) => {
    const [rating, setRating] = useState<FeedbackRating>(null);
    const [showCategoryPanel, setShowCategoryPanel] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null);
    const [detail, setDetail] = useState("");
    const detailRef = useRef<HTMLTextAreaElement>(null);

    const handlePositive = useCallback(() => {
      if (rating === "positive") return;

      setRating("positive");
      setShowCategoryPanel(false);
      onFeedback(messageId, threadId, "positive");
    }, [messageId, threadId, rating, onFeedback]);

    const handleNegative = useCallback(() => {
      if (rating === "negative") return;

      // 👎 클릭 → 카테고리 패널 열기
      setShowCategoryPanel(true);
    }, [rating]);

    const handleCategorySelect = useCallback(
      (category: FeedbackCategory) => {
        setSelectedCategory(category);

        // "기타"가 아니면 즉시 제출
        if (category !== "other") {
          setRating("negative");
          setShowCategoryPanel(false);
          onFeedback(messageId, threadId, "negative", category);
        } else {
          // "기타" → 텍스트 입력에 포커스
          setTimeout(() => detailRef.current?.focus(), 50);
        }
      },
      [messageId, threadId, onFeedback],
    );

    const handleSubmitWithDetail = useCallback(() => {
      setRating("negative");
      setShowCategoryPanel(false);
      onFeedback(messageId, threadId, "negative", selectedCategory ?? "other", detail.trim() || undefined);
    }, [messageId, threadId, selectedCategory, detail, onFeedback]);

    const handleCancel = useCallback(() => {
      setShowCategoryPanel(false);
      setSelectedCategory(null);
      setDetail("");
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmitWithDetail();
        }

        if (e.key === "Escape") {
          handleCancel();
        }
      },
      [handleSubmitWithDetail, handleCancel],
    );

    return (
      <div className="relative">
        {/* 👍👎 버튼 */}
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 shrink-0 p-0 rounded-md transition-colors ${
              rating === "positive"
                ? "text-foreground bg-accent opacity-100"
                : "text-muted-foreground opacity-50 hover:opacity-100 hover:bg-accent"
            } ${rating !== null && rating !== "positive" ? "opacity-30 cursor-default" : ""}`}
            onClick={handlePositive}
            disabled={disabled || (rating !== null && rating !== "positive")}
            aria-label="Good response"
            title="Good response"
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${rating === "positive" ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 shrink-0 p-0 rounded-md transition-colors ${
              rating === "negative"
                ? "text-foreground bg-accent opacity-100"
                : "text-muted-foreground opacity-50 hover:opacity-100 hover:bg-accent"
            } ${rating !== null && rating !== "negative" ? "opacity-30 cursor-default" : ""}`}
            onClick={handleNegative}
            disabled={disabled || rating !== null}
            aria-label="Bad response"
            title="Bad response"
          >
            <ThumbsDown className={`h-3.5 w-3.5 ${rating === "negative" ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* 🎯 카테고리 선택 패널 */}
        {showCategoryPanel && (
          <div className="absolute right-0 bottom-full mb-2 z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">What went wrong?</span>
              <button
                type="button"
                className="inline-flex items-center justify-center h-5 w-5 rounded-sm opacity-50 hover:opacity-100"
                onClick={handleCancel}
                aria-label="닫기"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(Object.entries(FEEDBACK_CATEGORIES) as [FeedbackCategory, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    selectedCategory === key
                      ? "border-foreground/30 bg-accent text-foreground"
                      : "border-border hover:bg-accent text-muted-foreground"
                  }`}
                  onClick={() => handleCategorySelect(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* "기타" 선택 시 텍스트 입력 */}
            {selectedCategory === "other" && (
              <div className="mt-2">
                <textarea
                  ref={detailRef}
                  className="w-full h-16 px-2 py-1.5 text-xs rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Additional feedback (optional)"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={200}
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleSubmitWithDetail}
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

FeedbackButtons.displayName = "FeedbackButtons";
