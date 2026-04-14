/**
 * 🎯 목적: DiffViewer UI 컴포넌트 테스트
 * 01: DiffViewer UI 구현 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - 기본 렌더링
 * - 파일 이름 표시
 * - 라인 렌더링 (추가/삭제/변경없음)
 * - 통계 표시
 * - 접기/펼치기 기능
 * - 접근성
 *
 * @packageDocumentation
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DiffViewer } from "../diff-viewer";

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

/** 새 파일 생성 Diff */
const NEW_FILE_DIFF = `--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function newFunction() {
+  return "new";
+}
`;

/** 파일 삭제 Diff */
const DELETE_FILE_DIFF = `--- a/src/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return "old";
-}
`;

// ============================================
// 🎯 기본 렌더링 테스트
// ============================================

describe("DiffViewer", () => {
  describe("기본 렌더링", () => {
    it("컴포넌트가 렌더링되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="src/index.ts" />);

      expect(screen.getByRole("region", { name: /diff/i })).toBeInTheDocument();
    });

    it("파일 이름을 표시해야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="src/index.ts" />);

      expect(screen.getByText("src/index.ts")).toBeInTheDocument();
    });

    it("빈 Diff도 렌더링해야 함", () => {
      render(<DiffViewer diff="" fileName="empty.ts" />);

      expect(screen.getByText("empty.ts")).toBeInTheDocument();
      expect(screen.getByText(/No changes/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 통계 표시 테스트
  // ============================================

  describe("통계 표시", () => {
    it("추가된 라인 수를 표시해야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" showStatistics />);

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it("삭제된 라인 수를 표시해야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" showStatistics />);

      // 통계 영역에서 삭제 카운트 확인
      const statsElement = screen.getByTestId("diff-statistics");
      expect(statsElement).toHaveTextContent("-1");
    });

    it("showStatistics=false일 때 통계를 숨겨야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" showStatistics={false} />);

      // 통계가 없어야 함
      expect(screen.queryByTestId("diff-statistics")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 라인 렌더링 테스트
  // ============================================

  describe("라인 렌더링", () => {
    it("추가된 라인에 적절한 스타일이 적용되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      const addedLines = screen.getAllByTestId("diff-line-added");
      expect(addedLines.length).toBeGreaterThan(0);
    });

    it("삭제된 라인에 적절한 스타일이 적용되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      const removedLines = screen.getAllByTestId("diff-line-removed");
      expect(removedLines.length).toBeGreaterThan(0);
    });

    it("변경 없는 라인도 렌더링되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      const unchangedLines = screen.getAllByTestId("diff-line-unchanged");
      expect(unchangedLines.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 라인 번호 테스트
  // ============================================

  describe("라인 번호", () => {
    it("라인 번호를 표시해야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" showLineNumbers />);

      // 라인 번호가 표시되어야 함
      expect(screen.getAllByTestId(/line-number/).length).toBeGreaterThan(0);
    });

    it("showLineNumbers=false일 때 라인 번호를 숨겨야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" showLineNumbers={false} />);

      expect(screen.queryByTestId(/line-number/)).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 접기/펼치기 테스트
  // ============================================

  describe("접기/펼치기", () => {
    it("접기 버튼이 있어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      expect(screen.getByRole("button", { name: /접기|펼치기/i })).toBeInTheDocument();
    });

    it("기본적으로 펼쳐져 있어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" defaultExpanded />);

      // 초기에는 펼쳐져 있음
      expect(screen.getByTestId("diff-content")).toBeInTheDocument();
    });

    it("접기 버튼 클릭 시 onExpandChange가 호출되어야 함", async () => {
      const onExpandChange = jest.fn();
      const user = userEvent.setup();

      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" defaultExpanded onExpandChange={onExpandChange} />);

      await user.click(screen.getByRole("button", { name: /접기/i }));

      expect(onExpandChange).toHaveBeenCalledWith(false);
    });

    it("펼치기 버튼 클릭 시 onExpandChange가 호출되어야 함", async () => {
      const onExpandChange = jest.fn();
      const user = userEvent.setup();

      render(
        <DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" defaultExpanded={false} onExpandChange={onExpandChange} />,
      );

      await user.click(screen.getByRole("button", { name: /펼치기/i }));

      expect(onExpandChange).toHaveBeenCalledWith(true);
    });
  });

  // ============================================
  // 특수 케이스 테스트
  // ============================================

  describe("특수 케이스", () => {
    it("새 파일 생성을 표시해야 함", () => {
      render(<DiffViewer diff={NEW_FILE_DIFF} fileName="src/new-file.ts" />);

      expect(screen.getByText(/New File/)).toBeInTheDocument();
    });

    it("파일 삭제를 표시해야 함", () => {
      render(<DiffViewer diff={DELETE_FILE_DIFF} fileName="src/old-file.ts" />);

      expect(screen.getByText(/Deleted/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 스타일링 테스트
  // ============================================

  describe("스타일링", () => {
    it("maxHeight 속성이 적용되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" maxHeight="400px" />);

      const content = screen.getByTestId("diff-scroll-area");
      expect(content).toHaveStyle({ maxHeight: "400px" });
    });

    it("className 속성이 적용되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" className="custom-class" />);

      const container = screen.getByRole("region", { name: /diff/i });
      expect(container).toHaveClass("custom-class");
    });
  });

  // ============================================
  // 접근성 테스트
  // ============================================

  describe("접근성", () => {
    it("적절한 ARIA 레이블이 있어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      expect(screen.getByRole("region", { name: /diff/i })).toBeInTheDocument();
    });

    it("라인에 적절한 role이 있어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      // 코드 라인들
      expect(screen.getAllByRole("row").length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Hunk 헤더 테스트
  // ============================================

  describe("Hunk 헤더", () => {
    it("Hunk 헤더를 표시해야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      expect(screen.getByTestId("hunk-header")).toBeInTheDocument();
    });

    it("Hunk 헤더에 라인 범위가 표시되어야 함", () => {
      render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

      const hunkHeader = screen.getByTestId("hunk-header");
      expect(hunkHeader.textContent).toMatch(/@@ .+ @@/);
    });
  });
});

// ============================================
// 🎯 DiffLineRenderer 테스트
// ============================================

describe("DiffLineRenderer", () => {
  // DiffLineRenderer는 DiffViewer 내부에서 사용되므로 통합 테스트로 대체
  it("DiffViewer 내에서 올바르게 렌더링되어야 함", () => {
    render(<DiffViewer diff={SAMPLE_DIFF} fileName="test.ts" />);

    // 라인 내용이 표시되어야 함
    expect(screen.getByText(/import React/)).toBeInTheDocument();
  });
});
