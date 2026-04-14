/**
 * 🎯 목적: 세션 복원 UI 타입 정의
 * 02: 세션 복원 UI
 *
 * 📝 주요 기능:
 * - 세션 복원 패널 Props 타입
 * - 세션 항목 표시 Props 타입
 * - 세션 복원 훅 타입
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 *
 * @packageDocumentation
 */

import type { SessionSummary } from "./session-types";

// ============================================
// 🎯 세션 복원 패널 타입
// ============================================

/**
 * 세션 목록 정렬 옵션
 */
export type SessionSortOption = "newest" | "oldest" | "alphabetical";

/**
 * 세션 복원 패널 Props
 *
 * 📝 주의사항:
 * - 패널 표시 여부 및 콜백 정의
 * - 세션 선택/삭제/복원 기능 포함
 *
 * 🔄 변경이력:
 * - 2026-01-06: sessions prop 추가 (외부 데이터 연동)
 */
export interface SessionRestorePanelProps {
  /** 패널 표시 여부 */
  isOpen: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 세션 선택 콜백 */
  onSelectSession: (session: SessionSummary) => void;
  /** 🆕 세션 목록 (외부에서 제공) */
  sessions?: SessionSummary[];
  /** 🆕 로딩 상태 */
  isLoading?: boolean;
  /** 세션 삭제 콜백 (선택) */
  onDeleteSession?: (sessionId: string) => void;
  /** 새 세션 생성 콜백 (선택) */
  onCreateNewSession?: () => void;
  /** 세션 내보내기 콜백 (선택) */
  onExportSession?: (sessionId: string) => void;
  /** 세션 가져오기 콜백 (선택) */
  onImportSession?: (jsonData: string) => void;
  /** 커스텀 타이틀 (선택) */
  title?: string;
}

/**
 * 세션 항목 액션 타입
 */
export type SessionItemAction = "select" | "delete" | "export" | "rename";

/**
 * 세션 항목 Props
 *
 * 📝 주의사항:
 * - 개별 세션 표시 및 액션 처리
 */
export interface SessionRestoreItemProps {
  /** 세션 요약 정보 */
  session: SessionSummary;
  /** 선택 상태 */
  isSelected?: boolean;
  /** 하이라이트 상태 (키보드 네비게이션) */
  isHighlighted?: boolean;
  /** 세션 선택 핸들러 */
  onSelect: (session: SessionSummary) => void;
  /** 세션 삭제 핸들러 (선택) */
  onDelete?: (sessionId: string) => void;
  /** 세션 내보내기 핸들러 (선택) */
  onExport?: (sessionId: string) => void;
  /** 액션 메뉴 표시 여부 */
  showActions?: boolean;
}

// ============================================
// 🎯 세션 복원 훅 타입
// ============================================

/**
 * 세션 복원 훅 옵션
 */
export interface UseSessionRestoreOptions {
  /** 자동 로드 여부 (기본: true) */
  autoLoad?: boolean;
  /** 초기 정렬 옵션 */
  initialSort?: SessionSortOption;
  /** 페이지 크기 (기본: 20) */
  pageSize?: number;
}

/**
 * 세션 복원 훅 반환 타입
 *
 * 📝 주의사항:
 * - 세션 목록 및 상태 관리
 * - 검색/필터/정렬 기능
 * - 페이지네이션 지원
 */
export interface UseSessionRestoreReturn {
  /** 세션 목록 */
  sessions: SessionSummary[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 객체 */
  error: Error | null;
  /** 전체 세션 수 */
  totalCount: number;
  /** 더 있는지 여부 */
  hasMore: boolean;
  /** 검색어 */
  searchQuery: string;
  /** 현재 정렬 옵션 */
  sortOption: SessionSortOption;
  /** 선택된 세션 ID */
  selectedSessionId: string | null;
  /** 하이라이트된 인덱스 */
  highlightedIndex: number;
  /** 검색어 설정 */
  setSearchQuery: (query: string) => void;
  /** 정렬 옵션 설정 */
  setSortOption: (option: SessionSortOption) => void;
  /** 세션 선택 */
  selectSession: (sessionId: string) => void;
  /** 세션 삭제 */
  deleteSession: (sessionId: string) => Promise<void>;
  /** 세션 내보내기 */
  exportSession: (sessionId: string) => Promise<string | undefined>;
  /** 세션 가져오기 */
  importSession: (jsonData: string) => Promise<void>;
  /** 새 세션 생성 */
  createNewSession: (title?: string) => Promise<void>;
  /** 더 보기 (페이지네이션) */
  loadMore: () => Promise<void>;
  /** 새로고침 */
  refresh: () => Promise<void>;
  /** 하이라이트 위로 이동 */
  moveHighlightUp: () => void;
  /** 하이라이트 아래로 이동 */
  moveHighlightDown: () => void;
  /** 하이라이트된 세션 선택 */
  selectHighlighted: () => void;
  /** 에러 초기화 */
  clearError: () => void;
}

// ============================================
// 🎯 세션 정렬/필터 유틸리티 타입
// ============================================

/**
 * 세션 필터 옵션
 */
export interface SessionFilterOptions {
  /** 검색어 */
  searchQuery?: string;
  /** 상태 필터 */
  status?: string[];
  /** 클러스터 ID 필터 */
  clusterId?: string;
  /** 날짜 범위 필터 (시작) */
  startDate?: Date;
  /** 날짜 범위 필터 (종료) */
  endDate?: Date;
}

/**
 * 정렬 옵션 정보
 */
export interface SortOptionInfo {
  /** 정렬 옵션 값 */
  value: SessionSortOption;
  /** 표시 레이블 */
  label: string;
  /** 아이콘 (선택) */
  icon?: string;
}

/**
 * 정렬 옵션 목록
 */
export const SORT_OPTIONS: SortOptionInfo[] = [
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "alphabetical", label: "이름순" },
];

// ============================================
// 🎯 세션 복원 이벤트 타입
// ============================================

/**
 * 세션 복원 이벤트 타입
 */
export type SessionRestoreEventType =
  | "session:selected"
  | "session:deleted"
  | "session:exported"
  | "session:imported"
  | "session:created"
  | "panel:opened"
  | "panel:closed";

/**
 * 세션 복원 이벤트
 */
export interface SessionRestoreEvent {
  /** 이벤트 타입 */
  type: SessionRestoreEventType;
  /** 관련 세션 ID (선택) */
  sessionId?: string;
  /** 타임스탬프 */
  timestamp: string;
  /** 추가 데이터 (선택) */
  data?: Record<string, unknown>;
}
