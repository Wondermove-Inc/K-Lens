/**
 * 🎯 목적: Unified Diff 파싱 훅
 * 01: DiffViewer UI 구현
 *
 * 📝 주요 기능:
 * - Unified Diff 문자열 파싱
 * - Hunk(변경 블록) 추출
 * - 라인 번호 계산
 * - 추가/삭제 통계 계산
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from "react";
import {
  type DiffHunk,
  type DiffLine,
  DiffLineType,
  type DiffStatistics,
  type ParsedDiff,
  type UseDiffParserResult,
} from "../../common/diff-types";

// ============================================
// 🎯 정규식 패턴
// ============================================

/**
 * Hunk 헤더 패턴
 * 예: @@ -1,10 +1,12 @@
 */
const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * 파일 헤더 패턴 (old file)
 * 예: --- a/src/index.ts
 */
const OLD_FILE_PATTERN = /^--- (.+)$/;

/**
 * 파일 헤더 패턴 (new file)
 * 예: +++ b/src/index.ts
 */
const NEW_FILE_PATTERN = /^\+\+\+ (.+)$/;

// ============================================
// 🎯 라인 번호 상태 타입
// ============================================

/**
 * 라인 번호 추적 상태
 */
interface LineNumberState {
  oldLine: number;
  newLine: number;
}

// ============================================
// 🎯 개별 라인 파싱 함수
// ============================================

/**
 * 단일 Diff 라인 파싱
 *
 * 📝 라인 접두사에 따라 타입 결정:
 * - '+': 추가된 라인
 * - '-': 삭제된 라인
 * - ' ': 변경 없는 라인 (컨텍스트)
 * - '@@': Hunk 헤더
 *
 * @param line - 파싱할 라인 문자열
 * @param lineNumbers - 현재 라인 번호 상태
 * @returns 파싱된 DiffLine 객체
 */
export function parseDiffLine(line: string, lineNumbers: LineNumberState): DiffLine {
  // Hunk 헤더 체크
  if (line.startsWith("@@")) {
    return {
      type: DiffLineType.HUNK_HEADER,
      content: line,
      lineNumber: { old: null, new: null },
    };
  }

  // 추가된 라인 (+)
  if (line.startsWith("+")) {
    return {
      type: DiffLineType.ADDED,
      content: line.substring(1),
      lineNumber: { old: null, new: lineNumbers.newLine },
    };
  }

  // 삭제된 라인 (-)
  if (line.startsWith("-")) {
    return {
      type: DiffLineType.REMOVED,
      content: line.substring(1),
      lineNumber: { old: lineNumbers.oldLine, new: null },
    };
  }

  // 변경 없는 라인 (공백으로 시작 또는 빈 컨텍스트 라인)
  return {
    type: DiffLineType.UNCHANGED,
    content: line.startsWith(" ") ? line.substring(1) : line,
    lineNumber: { old: lineNumbers.oldLine, new: lineNumbers.newLine },
  };
}

// ============================================
// 🎯 Hunk 파싱 함수
// ============================================

/**
 * Hunk 헤더에서 라인 정보 추출
 *
 * @param header - Hunk 헤더 문자열 (예: "@@ -1,10 +1,12 @@")
 * @returns Hunk 시작/카운트 정보 또는 null
 */
function parseHunkHeader(header: string): {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
} | null {
  const match = header.match(HUNK_HEADER_PATTERN);

  if (!match) {
    return null;
  }

  return {
    oldStart: parseInt(match[1], 10),
    oldCount: match[2] ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3], 10),
    newCount: match[4] ? parseInt(match[4], 10) : 1,
  };
}

/**
 * Hunk 내의 라인들을 파싱
 *
 * @param lines - Hunk에 속하는 라인 배열
 * @param hunkInfo - Hunk 시작 정보
 * @returns 파싱된 DiffLine 배열과 추가/삭제 카운트
 */
function parseHunkLines(
  lines: string[],
  hunkInfo: { oldStart: number; newStart: number },
): { parsedLines: DiffLine[]; additions: number; deletions: number } {
  const parsedLines: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  const lineNumbers: LineNumberState = {
    oldLine: hunkInfo.oldStart,
    newLine: hunkInfo.newStart,
  };

  for (const line of lines) {
    const parsedLine = parseDiffLine(line, lineNumbers);
    parsedLines.push(parsedLine);

    // 라인 번호 업데이트 및 카운트
    switch (parsedLine.type) {
      case DiffLineType.ADDED:
        additions++;
        lineNumbers.newLine++;
        break;
      case DiffLineType.REMOVED:
        deletions++;
        lineNumbers.oldLine++;
        break;
      case DiffLineType.UNCHANGED:
        lineNumbers.oldLine++;
        lineNumbers.newLine++;
        break;
      default:
        // HUNK_HEADER 등은 라인 번호 변경 없음
        break;
    }
  }

  return { parsedLines, additions, deletions };
}

// ============================================
// 🎯 전체 Diff 파싱 함수
// ============================================

/**
 * Unified Diff 문자열 파싱
 *
 * 📝 Git diff 출력 형식을 파싱하여 구조화된 객체로 변환
 *
 * @param diffText - Unified Diff 문자열
 * @returns 파싱된 ParsedDiff 객체
 */
export function parseDiff(diffText: string): ParsedDiff {
  // 빈 Diff 처리
  if (!diffText || diffText.trim() === "") {
    return {
      oldFileName: "",
      newFileName: "",
      hunks: [],
      additions: 0,
      deletions: 0,
    };
  }

  const lines = diffText.split("\n");
  let oldFileName = "";
  let newFileName = "";
  const hunks: DiffHunk[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  let currentHunkLines: string[] = [];
  let currentHunkInfo: { oldStart: number; oldCount: number; newStart: number; newCount: number } | null = null;
  let currentHunkHeader = "";

  // 각 라인 처리
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 파일 헤더 (old file)
    const oldMatch = line.match(OLD_FILE_PATTERN);

    if (oldMatch) {
      oldFileName = oldMatch[1];
      continue;
    }

    // 파일 헤더 (new file)
    const newMatch = line.match(NEW_FILE_PATTERN);

    if (newMatch) {
      newFileName = newMatch[1];
      continue;
    }

    // Hunk 헤더
    const hunkInfo = parseHunkHeader(line);

    if (hunkInfo) {
      // 이전 Hunk 저장
      if (currentHunkInfo) {
        const { parsedLines, additions, deletions } = parseHunkLines(currentHunkLines, currentHunkInfo);
        hunks.push({
          ...currentHunkInfo,
          header: currentHunkHeader,
          lines: parsedLines,
        });
        totalAdditions += additions;
        totalDeletions += deletions;
      }

      // 새 Hunk 시작
      currentHunkInfo = hunkInfo;
      currentHunkHeader = line;
      currentHunkLines = [];
      continue;
    }

    // Hunk 내 라인
    if (currentHunkInfo) {
      currentHunkLines.push(line);
    }
  }

  // 마지막 Hunk 저장
  if (currentHunkInfo) {
    const { parsedLines, additions, deletions } = parseHunkLines(currentHunkLines, currentHunkInfo);
    hunks.push({
      ...currentHunkInfo,
      header: currentHunkHeader,
      lines: parsedLines,
    });
    totalAdditions += additions;
    totalDeletions += deletions;
  }

  // 특수 케이스 감지
  const isNewFile = oldFileName === "/dev/null";
  const isDeleted = newFileName === "/dev/null";

  return {
    oldFileName,
    newFileName,
    hunks,
    additions: totalAdditions,
    deletions: totalDeletions,
    isNewFile,
    isDeleted,
  };
}

// ============================================
// 🎯 useDiffParser 훅
// ============================================

/**
 * Diff 파싱 훅
 *
 * 📝 Unified Diff 문자열을 파싱하여 구조화된 데이터와 통계 제공
 *
 * @param diff - Unified Diff 문자열
 * @returns 파싱 결과, 통계, 에러 상태
 *
 * @example
 * ```tsx
 * const { parsedDiff, statistics, error } = useDiffParser(diffString);
 *
 * if (parsedDiff) {
 *   console.log(`+${statistics?.additions} -${statistics?.deletions}`);
 * }
 * ```
 */
export function useDiffParser(diff: string | null | undefined): UseDiffParserResult {
  // 파싱 카운터 (reparse 트리거용)
  const [parseCount, setParseCount] = useState(0);

  // 파싱 결과 메모이제이션
  const parsedDiff = useMemo(() => {
    // null/undefined는 null 반환
    if (diff === null || diff === undefined) {
      return null;
    }

    // 빈 문자열은 빈 ParsedDiff 반환
    return parseDiff(diff);
    // parseCount를 의존성에 포함하여 reparse 시 재계산
  }, [diff, parseCount]);

  // 통계 계산 메모이제이션
  const statistics = useMemo<DiffStatistics | null>(() => {
    if (!parsedDiff) {
      return null;
    }

    return {
      additions: parsedDiff.additions,
      deletions: parsedDiff.deletions,
      totalChanges: parsedDiff.additions + parsedDiff.deletions,
      filesChanged: 1, // 단일 파일 Diff
    };
  }, [parsedDiff]);

  // 재파싱 함수
  const reparse = useCallback(() => {
    setParseCount((prev) => prev + 1);
  }, []);

  return {
    parsedDiff,
    isLoading: false, // 동기 파싱이므로 항상 false
    error: null,
    statistics,
    reparse,
  };
}

export default useDiffParser;
