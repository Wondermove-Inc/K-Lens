/**
 * 🎯 목적: ToolCallDisplay 컴포넌트 테스트
 * 02: 도구 호출 표시 UI
 *
 * 📝 테스트 범위:
 * - 도구 호출 목록 표시
 * - 진행 중/완료 상태 표시
 * - 결과 미리보기
 * - 에러 표시
 * - 접기/펼치기 기능
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ToolCallDisplay, ToolCallItem } from "../tool-call-display";

import type { ToolCallRecord } from "../../../../features/ai-assistant/common/thinking-state";

// ============================================
// 🎯 테스트 설정
// ============================================

/**
 * 테스트용 도구 호출 레코드 생성
 */
function createToolCall(name: string, args: Record<string, unknown> = {}, result?: unknown): ToolCallRecord {
  return {
    name,
    args,
    result,
    timestamp: new Date(),
  };
}

describe("ToolCallDisplay 컴포넌트", () => {
  // ============================================
  // 🔹 ToolCallItem 테스트
  // ============================================

  describe("ToolCallItem", () => {
    it("도구 이름 표시", () => {
      const toolCall = createToolCall("kubectl_get", { resource: "pods" });

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      expect(screen.getByText("kubectl_get")).toBeInTheDocument();
    });

    it("인자 표시 (JSON 형식)", () => {
      const toolCall = createToolCall("kubectl_get", {
        resource: "pods",
        namespace: "default",
      });

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      expect(screen.getByText(/resource/)).toBeInTheDocument();
      expect(screen.getByText(/pods/)).toBeInTheDocument();
    });

    it("결과 없으면 로딩 표시", () => {
      const toolCall = createToolCall("kubectl_get", {});

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      expect(screen.getByTestId("tool-loading-0")).toBeInTheDocument();
    });

    it("결과 있으면 결과 표시", () => {
      const toolCall = createToolCall("kubectl_get", {}, { count: 5 });

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      expect(screen.getByText(/count/)).toBeInTheDocument();
    });

    it("에러 결과 표시", () => {
      const toolCall = createToolCall(
        "kubectl_get",
        {},
        {
          error: true,
          message: "Connection refused",
        },
      );

      render(<ToolCallItem toolCall={toolCall} index={0} showError />);

      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
    });

    it("타임스탬프 표시", () => {
      const toolCall = createToolCall("kubectl_get", {});

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      expect(screen.getByTestId("timestamp-tool-0")).toBeInTheDocument();
    });

    it("긴 인자는 truncate", () => {
      const longArgs = { data: "a".repeat(100) };
      const toolCall = createToolCall("test_tool", longArgs);

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      // 50자 이상은 ...으로 truncate - 인자 영역 확인
      const argsText = screen.getByText(/{"data":"a+\.\.\./);
      expect(argsText).toBeInTheDocument();
    });

    it("긴 결과는 truncate", () => {
      const longResult = { data: "a".repeat(100) };
      const toolCall = createToolCall("test_tool", {}, longResult);

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      // 30자 이상은 ...으로 truncate - 결과에 → 기호가 있음
      const resultText = screen.getByText(/→.*\.\.\./);
      expect(resultText).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 ToolCallDisplay 테스트
  // ============================================

  describe("ToolCallDisplay", () => {
    it("도구 호출이 없으면 렌더링 안함", () => {
      const { container } = render(<ToolCallDisplay toolCalls={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it("도구 호출 목록 표시", () => {
      const toolCalls = [createToolCall("tool1", {}), createToolCall("tool2", {}), createToolCall("tool3", {})];

      render(<ToolCallDisplay toolCalls={toolCalls} />);

      expect(screen.getByText("tool1")).toBeInTheDocument();
      expect(screen.getByText("tool2")).toBeInTheDocument();
      expect(screen.getByText("tool3")).toBeInTheDocument();
    });

    it("도구 호출 개수 표시", () => {
      const toolCalls = [createToolCall("tool1", {}), createToolCall("tool2", {})];

      render(<ToolCallDisplay toolCalls={toolCalls} />);

      expect(screen.getByText(/도구 호출 \(2\)/)).toBeInTheDocument();
    });

    it("진행 중인 호출 개수 표시", () => {
      const toolCalls = [
        createToolCall("tool1", {}, { done: true }), // 완료
        createToolCall("tool2", {}), // 진행 중
        createToolCall("tool3", {}), // 진행 중
      ];

      render(<ToolCallDisplay toolCalls={toolCalls} showPendingCount />);

      expect(screen.getByText(/2개 진행 중/)).toBeInTheDocument();
    });

    it("접기/펼치기 토글", () => {
      const toolCalls = [createToolCall("tool1", {})];

      render(<ToolCallDisplay toolCalls={toolCalls} />);

      // 기본 펼침
      expect(screen.getByTestId("tool-call-0")).toBeVisible();

      // 접기
      const toggleButton = screen.getByTestId("toggle-tools");
      fireEvent.click(toggleButton);

      expect(screen.queryByTestId("tool-call-0")).not.toBeInTheDocument();
    });

    it("접힌 상태에서 요약 표시", () => {
      const toolCalls = [createToolCall("tool1", {}, { done: true }), createToolCall("tool2", {})];

      render(<ToolCallDisplay toolCalls={toolCalls} defaultExpanded={false} />);

      expect(screen.getByText(/2개 도구 호출/)).toBeInTheDocument();
    });

    it("compact 모드", () => {
      const toolCalls = [
        createToolCall("tool1", {}, { result: "data" }),
        createToolCall("tool2", {}, { result: "data" }),
      ];

      render(<ToolCallDisplay toolCalls={toolCalls} compact />);

      // compact 모드에서는 간략하게 표시
      expect(screen.getByTestId("tool-calls-compact")).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 에러 처리 테스트
  // ============================================

  describe("에러 처리", () => {
    it("에러 도구 호출은 빨간색 스타일", () => {
      const toolCall = createToolCall(
        "failing_tool",
        {},
        {
          error: true,
          message: "Failed",
        },
      );

      render(<ToolCallItem toolCall={toolCall} index={0} showError />);

      const item = screen.getByTestId("tool-call-0");
      expect(item).toHaveClass("error");
    });

    it("일반 도구 호출은 정상 스타일", () => {
      const toolCall = createToolCall("normal_tool", {}, { success: true });

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      const item = screen.getByTestId("tool-call-0");
      expect(item).not.toHaveClass("error");
    });
  });

  // ============================================
  // 🔹 접근성 테스트
  // ============================================

  describe("접근성", () => {
    it("도구 호출에 aria-label 설정", () => {
      const toolCall = createToolCall("kubectl_get", {});

      render(<ToolCallItem toolCall={toolCall} index={0} />);

      expect(screen.getByTestId("tool-call-0")).toHaveAttribute("aria-label");
    });

    it("토글 버튼에 aria-expanded 설정", () => {
      const toolCalls = [createToolCall("tool1", {})];

      render(<ToolCallDisplay toolCalls={toolCalls} />);

      const toggleButton = screen.getByTestId("toggle-tools");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });
});
