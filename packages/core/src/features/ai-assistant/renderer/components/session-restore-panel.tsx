/**
 * 🎯 목적: SessionRestorePanel - 세션 복원 패널 컴포넌트
 * 02: 세션 복원 UI
 *
 * 📝 주요 기능:
 * - 세션 목록 표시
 * - 검색/정렬 기능
 * - 세션 선택/삭제
 * - 키보드 네비게이션
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 * - 2026-01-06: sessions props로 외부 데이터 연동 지원 추가
 *
 * @packageDocumentation
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { type SessionSortOption, SORT_OPTIONS } from "../../common/session-restore-types";
import { SessionRestoreItem } from "./session-restore-item";

import type { SessionRestorePanelProps } from "../../common/session-restore-types";
import type { SessionSummary } from "../../common/session-types";

// ============================================
// 🎯 아이콘 컴포넌트
// ============================================

/** 닫기 아이콘 */
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/** 검색 아이콘 */
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

/** 플러스 아이콘 */
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

/** 초기화 아이콘 */
const ClearIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * SessionRestorePanel 컴포넌트
 *
 * 📝 주의사항:
 * - 세션 목록 표시 및 관리
 * - 검색/정렬/키보드 네비게이션 지원
 * - SessionState와 연동
 */
export function SessionRestorePanel({
  isOpen,
  onClose,
  onSelectSession,
  onDeleteSession,
  onCreateNewSession,
  onExportSession,
  onImportSession,
  sessions: externalSessions,
  isLoading = false,
  title = "세션 복원",
}: SessionRestorePanelProps) {
  // 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SessionSortOption>("newest");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // 🆕 2026-01-06: 외부 sessions props 지원 (없으면 빈 배열)
  const [internalSessions, _setInternalSessions] = useState<SessionSummary[]>([]);
  const rawSessions = externalSessions ?? internalSessions;

  /**
   * 🎯 목적: 검색 및 정렬이 적용된 세션 목록 계산
   * 📝 주의사항: searchQuery와 sortOption이 변경될 때마다 재계산
   */
  const sessions = React.useMemo(() => {
    let filtered = rawSessions;

    // 검색 필터 적용
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) => s.title.toLowerCase().includes(query) || s.preview?.toLowerCase().includes(query),
      );
    }

    // 정렬 적용
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "oldest":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "alphabetical":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return sorted;
  }, [rawSessions, searchQuery, sortOption]);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalTitleId = useRef(`session-restore-title-${Date.now()}`);

  // 패널 열림 시 검색 입력에 포커스
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, sessions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < sessions.length) {
            onSelectSession(sessions[highlightedIndex]);
            onClose();
          }
          break;
      }
    },
    [isOpen, sessions, highlightedIndex, onClose, onSelectSession],
  );

  // 오버레이 클릭 핸들러
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // 검색어 초기화
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  // 새 세션 생성
  const handleCreateNewSession = useCallback(() => {
    onCreateNewSession?.();
    onClose();
  }, [onCreateNewSession, onClose]);

  // 세션 선택
  const handleSelectSession = useCallback(
    (session: SessionSummary) => {
      onSelectSession(session);
      onClose();
    },
    [onSelectSession, onClose],
  );

  // 렌더링하지 않음
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId.current}
        className="w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 id={modalTitleId.current} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {/* 새 세션 버튼 */}
            <button
              type="button"
              aria-label="새 세션"
              onClick={handleCreateNewSession}
              disabled={!onCreateNewSession}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PlusIcon />
              <span>새 세션</span>
            </button>
            {/* 닫기 버튼 */}
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* 검색 및 정렬 */}
        <div className="flex items-center gap-3 p-4 border-b dark:border-gray-700">
          {/* 검색 입력 */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="세션 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="검색어 초기화"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ClearIcon />
              </button>
            )}
          </div>

          {/* 정렬 드롭다운 */}
          <select
            aria-label="정렬"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SessionSortOption)}
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* 🎯 로딩 상태 표시 */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4" />
              <p className="text-sm">세션을 불러오는 중...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <p className="text-lg mb-2">{searchQuery.trim() ? "검색 결과가 없습니다" : "세션이 없습니다"}</p>
              <p className="text-sm">
                {searchQuery.trim() ? "다른 검색어를 시도해보세요" : "새 세션을 시작하거나 기존 세션을 가져오세요"}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session, index) => (
                <SessionRestoreItem
                  key={session.id}
                  session={session}
                  isHighlighted={highlightedIndex === index}
                  onSelect={handleSelectSession}
                  onDelete={onDeleteSession}
                  onExport={onExportSession}
                  showActions
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
