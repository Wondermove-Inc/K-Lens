/**
 * 🎯 목적: useDiffParser 훅 테스트
 * 01: DiffViewer UI 구현 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - Unified Diff 파싱
 * - Hunk 추출
 * - 라인 번호 계산
 * - 통계 계산
 * - 에러 처리
 *
 * @packageDocumentation
 */

import { act, renderHook } from "@testing-library/react";
import { DiffLineType } from "../../../common/diff-types";
import { parseDiff, parseDiffLine, useDiffParser } from "../use-diff-parser";

// ============================================
// 🎯 테스트 데이터
// ============================================

/** 기본 Unified Diff 샘플 */
const SAMPLE_DIFF = `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,6 @@
 import React from "react";
-import { useState } from "react";
+import { useState, useEffect } from "react";
+import { useCallback } from "react";

 function App() {
   return <div>Hello</div>;
`;

/** 여러 Hunk가 있는 Diff */
const MULTI_HUNK_DIFF = `--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 function first() {
+  console.log("added");
   return 1;
 }
@@ -10,5 +11,4 @@ function second() {
   const x = 1;
-  const y = 2;
   return x;
 }
`;

/** 새 파일 생성 Diff */
const NEW_FILE_DIFF = `--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,5 @@
+export function newFunction() {
+  return "new";
+}
+
+export default newFunction;
`;

/** 파일 삭제 Diff */
const DELETE_FILE_DIFF = `--- a/src/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return "old";
-}
`;

/** 빈 Diff */
const EMPTY_DIFF = "";

/** 잘못된 형식의 Diff */
const INVALID_DIFF = `This is not a valid diff format
Just some random text`;

// ============================================
// 🎯 parseDiffLine 함수 테스트
// ============================================

describe("parseDiffLine", () => {
  it("추가된 라인(+)을 올바르게 파싱해야 함", () => {
    const result = parseDiffLine("+  const x = 1;", { oldLine: 5, newLine: 6 });

    expect(result.type).toBe(DiffLineType.ADDED);
    expect(result.content).toBe("  const x = 1;");
    expect(result.lineNumber.old).toBeNull();
    expect(result.lineNumber.new).toBe(6);
  });

  it("삭제된 라인(-)을 올바르게 파싱해야 함", () => {
    const result = parseDiffLine("-  const y = 2;", { oldLine: 5, newLine: 6 });

    expect(result.type).toBe(DiffLineType.REMOVED);
    expect(result.content).toBe("  const y = 2;");
    expect(result.lineNumber.old).toBe(5);
    expect(result.lineNumber.new).toBeNull();
  });

  it("변경 없는 라인(공백)을 올바르게 파싱해야 함", () => {
    const result = parseDiffLine(" function test() {", { oldLine: 3, newLine: 4 });

    expect(result.type).toBe(DiffLineType.UNCHANGED);
    expect(result.content).toBe("function test() {");
    expect(result.lineNumber.old).toBe(3);
    expect(result.lineNumber.new).toBe(4);
  });

  it("빈 컨텍스트 라인을 올바르게 파싱해야 함", () => {
    const result = parseDiffLine(" ", { oldLine: 1, newLine: 1 });

    expect(result.type).toBe(DiffLineType.UNCHANGED);
    expect(result.content).toBe("");
  });

  it("Hunk 헤더 라인을 올바르게 파싱해야 함", () => {
    const result = parseDiffLine("@@ -1,10 +1,12 @@", { oldLine: 0, newLine: 0 });

    expect(result.type).toBe(DiffLineType.HUNK_HEADER);
    expect(result.content).toBe("@@ -1,10 +1,12 @@");
  });
});

// ============================================
// 🎯 parseDiff 함수 테스트
// ============================================

describe("parseDiff", () => {
  describe("기본 파싱", () => {
    it("파일 이름을 올바르게 추출해야 함", () => {
      const result = parseDiff(SAMPLE_DIFF);

      expect(result.oldFileName).toBe("a/src/index.ts");
      expect(result.newFileName).toBe("b/src/index.ts");
    });

    it("Hunk를 올바르게 추출해야 함", () => {
      const result = parseDiff(SAMPLE_DIFF);

      expect(result.hunks).toHaveLength(1);
      expect(result.hunks[0].oldStart).toBe(1);
      expect(result.hunks[0].oldCount).toBe(5);
      expect(result.hunks[0].newStart).toBe(1);
      expect(result.hunks[0].newCount).toBe(6);
    });

    it("라인을 올바르게 파싱해야 함", () => {
      const result = parseDiff(SAMPLE_DIFF);
      const lines = result.hunks[0].lines;

      // 첫 번째 라인: 변경 없음
      expect(lines[0].type).toBe(DiffLineType.UNCHANGED);
      expect(lines[0].content).toContain("import React");

      // 두 번째 라인: 삭제
      expect(lines[1].type).toBe(DiffLineType.REMOVED);
      expect(lines[1].content).toContain("useState");

      // 세 번째 라인: 추가
      expect(lines[2].type).toBe(DiffLineType.ADDED);
      expect(lines[2].content).toContain("useEffect");
    });

    it("추가/삭제 카운트를 계산해야 함", () => {
      const result = parseDiff(SAMPLE_DIFF);

      expect(result.additions).toBe(2);
      expect(result.deletions).toBe(1);
    });
  });

  describe("여러 Hunk 처리", () => {
    it("여러 Hunk를 올바르게 파싱해야 함", () => {
      const result = parseDiff(MULTI_HUNK_DIFF);

      expect(result.hunks).toHaveLength(2);
      expect(result.hunks[0].oldStart).toBe(1);
      expect(result.hunks[1].oldStart).toBe(10);
    });

    it("각 Hunk의 라인 번호가 독립적이어야 함", () => {
      const result = parseDiff(MULTI_HUNK_DIFF);

      // 첫 번째 Hunk
      expect(result.hunks[0].lines[0].lineNumber.old).toBe(1);

      // 두 번째 Hunk
      expect(result.hunks[1].lines[0].lineNumber.old).toBe(10);
    });
  });

  describe("특수 케이스", () => {
    it("새 파일 생성을 감지해야 함", () => {
      const result = parseDiff(NEW_FILE_DIFF);

      expect(result.isNewFile).toBe(true);
      expect(result.oldFileName).toBe("/dev/null");
      expect(result.deletions).toBe(0);
      expect(result.additions).toBe(5);
    });

    it("파일 삭제를 감지해야 함", () => {
      const result = parseDiff(DELETE_FILE_DIFF);

      expect(result.isDeleted).toBe(true);
      expect(result.newFileName).toBe("/dev/null");
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(3);
    });

    it("빈 Diff를 처리해야 함", () => {
      const result = parseDiff(EMPTY_DIFF);

      expect(result.hunks).toHaveLength(0);
      expect(result.additions).toBe(0);
      expect(result.deletions).toBe(0);
    });
  });
});

// ============================================
// 🎯 useDiffParser 훅 테스트
// ============================================

describe("useDiffParser", () => {
  describe("기본 동작", () => {
    it("Diff를 파싱하고 결과를 반환해야 함", () => {
      const { result } = renderHook(() => useDiffParser(SAMPLE_DIFF));

      expect(result.current.parsedDiff).not.toBeNull();
      expect(result.current.parsedDiff?.hunks).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("통계를 계산해야 함", () => {
      const { result } = renderHook(() => useDiffParser(SAMPLE_DIFF));

      expect(result.current.statistics).not.toBeNull();
      expect(result.current.statistics?.additions).toBe(2);
      expect(result.current.statistics?.deletions).toBe(1);
      expect(result.current.statistics?.totalChanges).toBe(3);
    });
  });

  describe("Diff 변경 시", () => {
    it("새 Diff로 재파싱해야 함", () => {
      const { result, rerender } = renderHook(({ diff }) => useDiffParser(diff), {
        initialProps: { diff: SAMPLE_DIFF },
      });

      expect(result.current.parsedDiff?.additions).toBe(2);

      rerender({ diff: NEW_FILE_DIFF });

      expect(result.current.parsedDiff?.additions).toBe(5);
      expect(result.current.parsedDiff?.isNewFile).toBe(true);
    });
  });

  describe("reparse 함수", () => {
    it("수동으로 재파싱할 수 있어야 함", () => {
      const { result } = renderHook(() => useDiffParser(SAMPLE_DIFF));

      const initialParsedDiff = result.current.parsedDiff;

      act(() => {
        result.current.reparse();
      });

      // 같은 결과지만 새로 파싱됨
      expect(result.current.parsedDiff).toEqual(initialParsedDiff);
    });
  });

  describe("빈/잘못된 Diff 처리", () => {
    it("빈 Diff를 처리해야 함", () => {
      const { result } = renderHook(() => useDiffParser(EMPTY_DIFF));

      // 빈 문자열은 빈 ParsedDiff 객체 반환
      expect(result.current.parsedDiff).not.toBeNull();
      expect(result.current.parsedDiff?.hunks).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("null/undefined Diff를 처리해야 함", () => {
      const { result } = renderHook(() => useDiffParser(null as unknown as string));

      expect(result.current.parsedDiff).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("라인 번호 계산", () => {
    it("변경 없는 라인의 양쪽 라인 번호가 있어야 함", () => {
      const { result } = renderHook(() => useDiffParser(SAMPLE_DIFF));

      const unchangedLine = result.current.parsedDiff?.hunks[0].lines[0];
      expect(unchangedLine?.lineNumber.old).toBe(1);
      expect(unchangedLine?.lineNumber.new).toBe(1);
    });

    it("추가된 라인은 new 라인 번호만 있어야 함", () => {
      const { result } = renderHook(() => useDiffParser(SAMPLE_DIFF));

      // 세 번째 라인 (추가됨)
      const addedLine = result.current.parsedDiff?.hunks[0].lines.find((l) => l.type === DiffLineType.ADDED);
      expect(addedLine?.lineNumber.old).toBeNull();
      expect(addedLine?.lineNumber.new).toBeGreaterThan(0);
    });

    it("삭제된 라인은 old 라인 번호만 있어야 함", () => {
      const { result } = renderHook(() => useDiffParser(SAMPLE_DIFF));

      const removedLine = result.current.parsedDiff?.hunks[0].lines.find((l) => l.type === DiffLineType.REMOVED);
      expect(removedLine?.lineNumber.old).toBeGreaterThan(0);
      expect(removedLine?.lineNumber.new).toBeNull();
    });
  });
});
