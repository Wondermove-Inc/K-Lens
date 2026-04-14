/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: AI Fix entry-point buttons for Security Dashboard
 * AI 자동 해결 버튼 — 단건/bulk/전체 진입점
 *
 * @packageDocumentation
 */

import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import React from "react";

import type { AnySecurityFinding } from "../../../common/security/security-finding";

// ============================================
//  Inline SVG robot icon (lucide-react 미사용 — Jest 호환)
// ============================================

const RobotIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

// ============================================
//  Props
// ============================================

export interface AiFixButtonProps {
  /** findings to fix — empty means "fix all" trigger */
  findings: AnySecurityFinding[];
  /** called when user clicks */
  onFix: (findings: AnySecurityFinding[]) => void;
  /** visual variant */
  variant?: "single" | "bulk" | "all";
  /** override display count (used when findings=[] but actual count is known) */
  displayCount?: number;
  /** disabled state (e.g. scan in progress) */
  disabled?: boolean;
}

// ============================================
//  AiFixButton
// ============================================

export const AiFixButton: React.FC<AiFixButtonProps> = ({
  findings,
  onFix,
  variant = "all",
  disabled = false,
  displayCount,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFix(findings);
  };

  if (variant === "single") {
    // single variant 제거됨 — AI는 assistant 모드로 전환, 행별 Fix 버튼 불필요
    return null;
  }

  if (variant === "bulk") {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="h-8 px-3 text-xs gap-1.5"
        onClick={handleClick}
        disabled={disabled || (displayCount ?? findings.length) === 0}
        aria-label={`AI Assistant — ${displayCount ?? findings.length} selected findings`}
      >
        <RobotIcon className="h-3.5 w-3.5" />
        AI Assistant ({displayCount ?? findings.length})
      </Button>
    );
  }

  // variant === "all"
  return (
    <Button
      variant="default"
      size="sm"
      className="h-8 px-3 text-sm gap-1.5 bg-violet-500 hover:bg-violet-500/85 text-white"
      onClick={handleClick}
      disabled={disabled}
      aria-label="AI Assistant — review all findings"
    >
      <RobotIcon className="h-4 w-4" />
      AI Assistant
    </Button>
  );
};
