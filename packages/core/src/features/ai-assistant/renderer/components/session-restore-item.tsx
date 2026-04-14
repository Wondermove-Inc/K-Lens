/**
 * 🎯 목적: SessionRestoreItem - 세션 목록 항목 컴포넌트
 * 02: 세션 복원 UI
 *
 * 📝 주요 기능:
 * - 세션 요약 정보 표시
 * - 선택/하이라이트 상태
 * - 삭제/내보내기 액션
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 *
 * @packageDocumentation
 */

import React, { useCallback } from "react";

import type { SessionRestoreItemProps } from "../../common/session-restore-types";

// ============================================
// 🎯 상태 레이블 매핑
// ============================================

/** 세션 상태별 한글 레이블 */
const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  completed: "완료",
  cancelled: "취소됨",
  expired: "만료됨",
};

/** 세션 상태별 스타일 클래스 */
const STATUS_CLASSES: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 상대 시간 포맷팅
 *
 * @param dateString - ISO 날짜 문자열
 * @returns 상대 시간 문자열
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "방금 전";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================
// 🎯 아이콘 컴포넌트
// ============================================

/** 메시지 아이콘 */
const MessageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
    />
  </svg>
);

/** 체크포인트 아이콘 */
const CheckpointIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

/** 삭제 아이콘 */
const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

/** 내보내기 아이콘 */
const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * SessionRestoreItem 컴포넌트
 *
 * 📝 주의사항:
 * - 개별 세션 항목 표시
 * - 선택/하이라이트 상태 지원
 * - 액션 버튼 (삭제/내보내기)
 */
export function SessionRestoreItem({
  session,
  isSelected = false,
  isHighlighted = false,
  onSelect,
  onDelete,
  onExport,
  showActions = false,
}: SessionRestoreItemProps) {
  // 클릭 핸들러
  const handleClick = useCallback(() => {
    onSelect(session);
  }, [session, onSelect]);

  // 삭제 핸들러
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(session.id);
    },
    [session.id, onDelete],
  );

  // 내보내기 핸들러
  const handleExport = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onExport?.(session.id);
    },
    [session.id, onExport],
  );

  // 상태 레이블 및 스타일
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;
  const statusClass = STATUS_CLASSES[session.status] ?? STATUS_CLASSES.active;

  // 컨테이너 스타일 계산
  const containerClasses = [
    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
    isSelected ? "selected bg-blue-100 dark:bg-blue-900/50" : "",
    isHighlighted ? "highlighted bg-blue-50 dark:bg-blue-900/30" : "",
    !isSelected && !isHighlighted ? "hover:bg-gray-100 dark:hover:bg-gray-700" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li role="listitem" className={containerClasses} onClick={handleClick} data-session-id={session.id}>
      {/* 세션 정보 */}
      <div className="flex-1 min-w-0">
        {/* 제목 */}
        <div className="font-medium truncate text-gray-900 dark:text-gray-100">{session.title}</div>

        {/* 메타 정보 */}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          {/* 메시지 수 */}
          <span className="flex items-center gap-1">
            <MessageIcon />
            <span>{session.messageCount}</span>
          </span>

          {/* 체크포인트 수 */}
          {session.checkpointCount !== undefined && session.checkpointCount > 0 && (
            <span className="flex items-center gap-1" data-testid="checkpoint-count">
              <CheckpointIcon />
              <span>{session.checkpointCount}</span>
            </span>
          )}

          {/* 업데이트 시간 */}
          <span data-testid="session-updated-at">{formatRelativeTime(session.updatedAt)}</span>
        </div>
      </div>

      {/* 상태 뱃지 */}
      <span data-testid="session-status" className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusClass}`}>
        {statusLabel}
      </span>

      {/* 액션 버튼 */}
      {showActions && (
        <div className="flex items-center gap-1">
          {onExport && (
            <button
              type="button"
              aria-label="내보내기"
              onClick={handleExport}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <ExportIcon />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="삭제"
              onClick={handleDelete}
              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
