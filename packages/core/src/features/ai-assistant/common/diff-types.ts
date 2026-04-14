/**
 * 🎯 목적: DiffViewer 타입 정의
 * 01: DiffViewer UI 구현
 *
 * 📝 주요 타입:
 * - DiffLineType: Diff 라인 유형
 * - DiffLine: 개별 라인 정보
 * - DiffHunk: Hunk(변경 블록) 정보
 * - ParsedDiff: 파싱된 Diff 전체 정보
 * - DiffViewerProps: DiffViewer 컴포넌트 Props
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 Diff 라인 유형 열거형
// ============================================

/**
 * Diff 라인 유형
 *
 * 📝 각 라인이 어떤 종류인지 나타냄
 */
export enum DiffLineType {
  /** 추가된 라인 (+) */
  ADDED = "added",

  /** 삭제된 라인 (-) */
  REMOVED = "removed",

  /** 변경 없는 라인 (컨텍스트) */
  UNCHANGED = "unchanged",

  /** 파일 헤더 라인 (--- / +++) */
  HEADER = "header",

  /** Hunk 헤더 라인 (@@ ... @@) */
  HUNK_HEADER = "hunk_header",
}

// ============================================
// 🎯 라인 번호 인터페이스
// ============================================

/**
 * 라인 번호 정보
 *
 * 📝 old: 원본 파일의 라인 번호 (삭제된 경우 null)
 *    new: 새 파일의 라인 번호 (추가된 경우 old가 null)
 */
export interface LineNumber {
  /** 원본 파일 라인 번호 (null = 새로 추가된 라인) */
  old: number | null;

  /** 새 파일 라인 번호 (null = 삭제된 라인) */
  new: number | null;
}

// ============================================
// 🎯 Diff 라인 인터페이스
// ============================================

/**
 * Diff의 개별 라인 정보
 *
 * 📝 하나의 라인에 대한 모든 정보를 포함
 */
export interface DiffLine {
  /** 라인 유형 */
  type: DiffLineType;

  /** 라인 내용 (접두사 제외) */
  content: string;

  /** 라인 번호 정보 */
  lineNumber: LineNumber;
}

// ============================================
// 🎯 Hunk(변경 블록) 인터페이스
// ============================================

/**
 * Hunk(변경 블록) 정보
 *
 * 📝 @@ -oldStart,oldCount +newStart,newCount @@ 형식의 블록
 */
export interface DiffHunk {
  /** 원본 파일 시작 라인 */
  oldStart: number;

  /** 원본 파일에서 변경된 라인 수 */
  oldCount: number;

  /** 새 파일 시작 라인 */
  newStart: number;

  /** 새 파일에서 변경된 라인 수 */
  newCount: number;

  /** Hunk 헤더 문자열 */
  header: string;

  /** Hunk 내의 라인들 */
  lines: DiffLine[];
}

// ============================================
// 🎯 파싱된 Diff 인터페이스
// ============================================

/**
 * 파싱된 Diff 전체 정보
 *
 * 📝 하나의 파일에 대한 전체 Diff 정보
 */
export interface ParsedDiff {
  /** 원본 파일 이름 */
  oldFileName: string;

  /** 새 파일 이름 */
  newFileName: string;

  /** Hunk 목록 */
  hunks: DiffHunk[];

  /** 추가된 라인 수 */
  additions: number;

  /** 삭제된 라인 수 */
  deletions: number;

  /** 새 파일 생성 여부 */
  isNewFile?: boolean;

  /** 파일 삭제 여부 */
  isDeleted?: boolean;

  /** 파일 이름 변경 여부 */
  isRenamed?: boolean;

  /** Binary 파일 여부 */
  isBinary?: boolean;
}

// ============================================
// 🎯 Diff 통계 인터페이스
// ============================================

/**
 * Diff 통계 정보
 *
 * 📝 전체 변경 사항에 대한 통계
 */
export interface DiffStatistics {
  /** 추가된 라인 수 */
  additions: number;

  /** 삭제된 라인 수 */
  deletions: number;

  /** 총 변경 라인 수 */
  totalChanges: number;

  /** 변경된 파일 수 */
  filesChanged: number;
}

// ============================================
// 🎯 DiffViewer Props 인터페이스
// ============================================

/**
 * DiffViewer 컴포넌트 Props
 *
 * 📝 Diff를 시각적으로 표시하는 컴포넌트의 속성
 */
export interface DiffViewerProps {
  /** Unified Diff 문자열 */
  diff: string;

  /** 파일 이름 */
  fileName: string;

  /** 프로그래밍 언어 (구문 강조용) */
  language?: string;

  /** 라인 번호 표시 여부 (기본: true) */
  showLineNumbers?: boolean;

  /** 통계 표시 여부 (기본: true) */
  showStatistics?: boolean;

  /** 최대 높이 (CSS 값) */
  maxHeight?: string;

  /** 추가 CSS 클래스 */
  className?: string;

  /** 초기 펼침 상태 */
  defaultExpanded?: boolean;

  /** 펼침 상태 변경 콜백 */
  onExpandChange?: (expanded: boolean) => void;
}

// ============================================
// 🎯 DiffLineRenderer Props 인터페이스
// ============================================

/**
 * DiffLineRenderer 컴포넌트 Props
 *
 * 📝 개별 Diff 라인을 렌더링하는 컴포넌트의 속성
 */
export interface DiffLineRendererProps {
  /** Diff 라인 정보 */
  line: DiffLine;

  /** 라인 번호 표시 여부 */
  showLineNumbers?: boolean;

  /** 프로그래밍 언어 (구문 강조용) */
  language?: string;
}

// ============================================
// 🎯 DiffHunkRenderer Props 인터페이스
// ============================================

/**
 * DiffHunkRenderer 컴포넌트 Props
 *
 * 📝 Hunk(변경 블록)를 렌더링하는 컴포넌트의 속성
 */
export interface DiffHunkRendererProps {
  /** Hunk 정보 */
  hunk: DiffHunk;

  /** 라인 번호 표시 여부 */
  showLineNumbers?: boolean;

  /** 프로그래밍 언어 (구문 강조용) */
  language?: string;

  /** Hunk 인덱스 */
  hunkIndex: number;
}

// ============================================
// 🎯 Diff 파서 옵션 인터페이스
// ============================================

/**
 * Diff 파서 옵션
 *
 * 📝 parseDiff 함수의 옵션
 */
export interface DiffParserOptions {
  /** 파일 이름 추출 시 접두사 제거 (a/, b/) */
  removeFilePrefix?: boolean;

  /** 빈 라인 유지 여부 */
  keepEmptyLines?: boolean;
}

// ============================================
// 🎯 useDiffParser 훅 반환 타입
// ============================================

/**
 * useDiffParser 훅 반환 타입
 *
 * 📝 파싱된 Diff 정보와 관련 유틸리티
 */
export interface UseDiffParserResult {
  /** 파싱된 Diff */
  parsedDiff: ParsedDiff | null;

  /** 파싱 중 여부 */
  isLoading: boolean;

  /** 파싱 에러 */
  error: Error | null;

  /** 통계 정보 */
  statistics: DiffStatistics | null;

  /** 재파싱 함수 */
  reparse: () => void;
}
