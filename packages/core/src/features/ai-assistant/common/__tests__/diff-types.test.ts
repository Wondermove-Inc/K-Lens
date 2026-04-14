/**
 * 🎯 목적: DiffViewer 타입 정의 테스트
 * 01: DiffViewer UI 구현 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - DiffLineType 열거형
 * - DiffLine 인터페이스
 * - DiffHunk 인터페이스
 * - ParsedDiff 인터페이스
 * - DiffViewerProps 인터페이스
 *
 * @packageDocumentation
 */

import {
  type DiffHunk,
  type DiffLine,
  DiffLineType,
  type DiffStatistics,
  type DiffViewerProps,
  type ParsedDiff,
} from "../diff-types";

// ============================================
// 🎯 DiffLineType 열거형 테스트
// ============================================

describe("DiffLineType", () => {
  it("추가 라인 타입이 정의되어 있어야 함", () => {
    expect(DiffLineType.ADDED).toBe("added");
  });

  it("삭제 라인 타입이 정의되어 있어야 함", () => {
    expect(DiffLineType.REMOVED).toBe("removed");
  });

  it("변경 없는 라인 타입이 정의되어 있어야 함", () => {
    expect(DiffLineType.UNCHANGED).toBe("unchanged");
  });

  it("헤더 라인 타입이 정의되어 있어야 함", () => {
    expect(DiffLineType.HEADER).toBe("header");
  });

  it("Hunk 헤더 라인 타입이 정의되어 있어야 함", () => {
    expect(DiffLineType.HUNK_HEADER).toBe("hunk_header");
  });
});

// ============================================
// 🎯 DiffLine 인터페이스 테스트
// ============================================

describe("DiffLine", () => {
  it("추가 라인을 올바르게 생성할 수 있어야 함", () => {
    const line: DiffLine = {
      type: DiffLineType.ADDED,
      content: "  const x = 1;",
      lineNumber: {
        old: null,
        new: 10,
      },
    };

    expect(line.type).toBe(DiffLineType.ADDED);
    expect(line.content).toBe("  const x = 1;");
    expect(line.lineNumber.old).toBeNull();
    expect(line.lineNumber.new).toBe(10);
  });

  it("삭제 라인을 올바르게 생성할 수 있어야 함", () => {
    const line: DiffLine = {
      type: DiffLineType.REMOVED,
      content: "  const y = 2;",
      lineNumber: {
        old: 5,
        new: null,
      },
    };

    expect(line.type).toBe(DiffLineType.REMOVED);
    expect(line.lineNumber.old).toBe(5);
    expect(line.lineNumber.new).toBeNull();
  });

  it("변경 없는 라인을 올바르게 생성할 수 있어야 함", () => {
    const line: DiffLine = {
      type: DiffLineType.UNCHANGED,
      content: "  return value;",
      lineNumber: {
        old: 10,
        new: 12,
      },
    };

    expect(line.type).toBe(DiffLineType.UNCHANGED);
    expect(line.lineNumber.old).toBe(10);
    expect(line.lineNumber.new).toBe(12);
  });

  it("Hunk 헤더 라인을 올바르게 생성할 수 있어야 함", () => {
    const line: DiffLine = {
      type: DiffLineType.HUNK_HEADER,
      content: "@@ -1,10 +1,12 @@",
      lineNumber: {
        old: null,
        new: null,
      },
    };

    expect(line.type).toBe(DiffLineType.HUNK_HEADER);
    expect(line.content).toBe("@@ -1,10 +1,12 @@");
  });
});

// ============================================
// 🎯 DiffHunk 인터페이스 테스트
// ============================================

describe("DiffHunk", () => {
  it("Hunk 정보를 올바르게 생성할 수 있어야 함", () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 10,
      newStart: 1,
      newCount: 12,
      header: "@@ -1,10 +1,12 @@",
      lines: [
        {
          type: DiffLineType.UNCHANGED,
          content: "function test() {",
          lineNumber: { old: 1, new: 1 },
        },
        {
          type: DiffLineType.REMOVED,
          content: "  const old = 1;",
          lineNumber: { old: 2, new: null },
        },
        {
          type: DiffLineType.ADDED,
          content: "  const newVar = 2;",
          lineNumber: { old: null, new: 2 },
        },
      ],
    };

    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldCount).toBe(10);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newCount).toBe(12);
    expect(hunk.lines).toHaveLength(3);
  });
});

// ============================================
// 🎯 ParsedDiff 인터페이스 테스트
// ============================================

describe("ParsedDiff", () => {
  it("파싱된 Diff를 올바르게 생성할 수 있어야 함", () => {
    const parsedDiff: ParsedDiff = {
      oldFileName: "a/src/index.ts",
      newFileName: "b/src/index.ts",
      hunks: [
        {
          oldStart: 1,
          oldCount: 5,
          newStart: 1,
          newCount: 7,
          header: "@@ -1,5 +1,7 @@",
          lines: [],
        },
      ],
      additions: 3,
      deletions: 1,
    };

    expect(parsedDiff.oldFileName).toBe("a/src/index.ts");
    expect(parsedDiff.newFileName).toBe("b/src/index.ts");
    expect(parsedDiff.hunks).toHaveLength(1);
    expect(parsedDiff.additions).toBe(3);
    expect(parsedDiff.deletions).toBe(1);
  });

  it("새 파일 생성 Diff를 표현할 수 있어야 함", () => {
    const parsedDiff: ParsedDiff = {
      oldFileName: "/dev/null",
      newFileName: "b/src/new-file.ts",
      hunks: [],
      additions: 10,
      deletions: 0,
      isNewFile: true,
    };

    expect(parsedDiff.isNewFile).toBe(true);
    expect(parsedDiff.oldFileName).toBe("/dev/null");
  });

  it("파일 삭제 Diff를 표현할 수 있어야 함", () => {
    const parsedDiff: ParsedDiff = {
      oldFileName: "a/src/old-file.ts",
      newFileName: "/dev/null",
      hunks: [],
      additions: 0,
      deletions: 15,
      isDeleted: true,
    };

    expect(parsedDiff.isDeleted).toBe(true);
    expect(parsedDiff.newFileName).toBe("/dev/null");
  });
});

// ============================================
// 🎯 DiffStatistics 인터페이스 테스트
// ============================================

describe("DiffStatistics", () => {
  it("Diff 통계를 올바르게 생성할 수 있어야 함", () => {
    const stats: DiffStatistics = {
      additions: 25,
      deletions: 10,
      totalChanges: 35,
      filesChanged: 3,
    };

    expect(stats.additions).toBe(25);
    expect(stats.deletions).toBe(10);
    expect(stats.totalChanges).toBe(35);
    expect(stats.filesChanged).toBe(3);
  });
});

// ============================================
// 🎯 DiffViewerProps 인터페이스 테스트
// ============================================

describe("DiffViewerProps", () => {
  it("기본 Props를 올바르게 생성할 수 있어야 함", () => {
    const props: DiffViewerProps = {
      diff: "--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@",
      fileName: "file.ts",
    };

    expect(props.diff).toBeDefined();
    expect(props.fileName).toBe("file.ts");
  });

  it("선택적 Props를 포함할 수 있어야 함", () => {
    const props: DiffViewerProps = {
      diff: "sample diff",
      fileName: "file.ts",
      language: "typescript",
      showLineNumbers: true,
      showStatistics: true,
      maxHeight: "400px",
      className: "custom-class",
    };

    expect(props.language).toBe("typescript");
    expect(props.showLineNumbers).toBe(true);
    expect(props.showStatistics).toBe(true);
    expect(props.maxHeight).toBe("400px");
    expect(props.className).toBe("custom-class");
  });

  it("접기/펼치기 상태를 포함할 수 있어야 함", () => {
    const props: DiffViewerProps = {
      diff: "sample diff",
      fileName: "file.ts",
      defaultExpanded: false,
      onExpandChange: jest.fn(),
    };

    expect(props.defaultExpanded).toBe(false);
    expect(props.onExpandChange).toBeDefined();
  });
});
