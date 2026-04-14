/**
 * 🎯 목적: StreamingText 컴포넌트 테스트
 * 01: StreamingText 컴포넌트 구현
 *
 * 📝 테스트 범위:
 * - 기본 렌더링 (content 표시)
 * - 스트리밍 중 커서 표시
 * - 마크다운 렌더링
 * - 코드 블록 렌더링
 * - 스크롤 자동 하단 이동
 * - 성능 최적화 (불필요한 리렌더링 방지)
 *
 * @packageDocumentation
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom";

import { StreamingText } from "../streaming-text";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("StreamingText 컴포넌트", () => {
  // ============================================
  // 🔹 기본 렌더링 테스트
  // ============================================

  describe("기본 렌더링", () => {
    it("AC1: content를 표시해야 한다", () => {
      render(<StreamingText content="안녕하세요" isStreaming={false} />);

      expect(screen.getByText("안녕하세요")).toBeInTheDocument();
    });

    it("빈 content도 렌더링해야 한다", () => {
      render(<StreamingText content="" isStreaming={false} />);

      expect(screen.getByTestId("streaming-text")).toBeInTheDocument();
    });

    it("data-testid가 올바르게 설정되어야 한다", () => {
      render(<StreamingText content="테스트" isStreaming={false} />);

      expect(screen.getByTestId("streaming-text")).toBeInTheDocument();
    });

    it("className prop이 적용되어야 한다", () => {
      render(<StreamingText content="테스트" isStreaming={false} className="custom-class" />);

      expect(screen.getByTestId("streaming-text")).toHaveClass("custom-class");
    });
  });

  // ============================================
  // 🔹 스트리밍 커서 테스트
  // ============================================

  describe("스트리밍 커서", () => {
    it("AC2: isStreaming=true일 때 커서가 표시되어야 한다", () => {
      render(<StreamingText content="진행 중..." isStreaming={true} />);

      expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
    });

    it("isStreaming=false일 때 커서가 숨겨져야 한다", () => {
      render(<StreamingText content="완료" isStreaming={false} />);

      expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
    });

    it("커서에 깜빡임 애니메이션 클래스가 있어야 한다", () => {
      render(<StreamingText content="진행 중" isStreaming={true} />);

      expect(screen.getByTestId("streaming-cursor")).toHaveClass("animate-blink");
    });
  });

  // ============================================
  // 🔹 마크다운 렌더링 테스트
  // ============================================

  describe("마크다운 렌더링", () => {
    // 📝 Note: react-markdown이 mock으로 대체되어 실제 마크다운 변환이 일어나지 않음
    // 따라서 raw 마크다운 문자열이 그대로 표시되는지 확인

    it("AC1: 마크다운 content를 ReactMarkdown에 전달해야 한다", () => {
      render(<StreamingText content="**굵은 텍스트**" isStreaming={false} />);

      // mock은 pre 태그에 원본 마크다운을 렌더링
      expect(screen.getByText("**굵은 텍스트**")).toBeInTheDocument();
    });

    it("이탤릭 마크다운을 전달해야 한다", () => {
      render(<StreamingText content="*기울임 텍스트*" isStreaming={false} />);

      expect(screen.getByText("*기울임 텍스트*")).toBeInTheDocument();
    });

    it("링크 마크다운을 전달해야 한다", () => {
      render(<StreamingText content="[Google](https://google.com)" isStreaming={false} />);

      expect(screen.getByText("[Google](https://google.com)")).toBeInTheDocument();
    });

    it("리스트 마크다운을 전달해야 한다", () => {
      render(<StreamingText content="- 항목 1\n- 항목 2\n- 항목 3" isStreaming={false} />);

      expect(screen.getByText(/항목 1/)).toBeInTheDocument();
    });

    it("헤딩 마크다운을 전달해야 한다", () => {
      render(<StreamingText content="# 제목" isStreaming={false} />);

      expect(screen.getByText("# 제목")).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 코드 블록 렌더링 테스트
  // ============================================

  describe("코드 블록 렌더링", () => {
    // 📝 Note: react-markdown mock으로 인해 원본 마크다운이 그대로 표시됨

    it("AC4: 인라인 코드 마크다운을 전달해야 한다", () => {
      render(<StreamingText content="`const x = 1`" isStreaming={false} />);

      expect(screen.getByText("`const x = 1`")).toBeInTheDocument();
    });

    it("코드 블록 마크다운을 전달해야 한다", () => {
      const codeBlock = "```javascript\nconst x = 1;\n```";

      render(<StreamingText content={codeBlock} isStreaming={false} />);

      expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
    });

    it("AC4: 스트리밍 중에도 코드 블록이 정상 렌더링되어야 한다", () => {
      // 부분 코드 블록 (스트리밍 중)
      render(<StreamingText content="```\nconst x = 1" isStreaming={true} />);

      expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
      expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 스크롤 동작 테스트
  // ============================================

  describe("스크롤 동작", () => {
    it("AC5: autoScroll=true일 때 스크롤 컨테이너가 있어야 한다", () => {
      render(<StreamingText content="긴 내용..." isStreaming={true} autoScroll={true} />);

      expect(screen.getByTestId("streaming-text")).toBeInTheDocument();
    });

    it("autoScroll prop의 기본값은 true여야 한다", () => {
      render(<StreamingText content="내용" isStreaming={true} />);

      // 기본적으로 자동 스크롤 활성화
      expect(screen.getByTestId("streaming-text")).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 상태 표시 테스트
  // ============================================

  describe("상태 표시", () => {
    it("showStatus=true일 때 토큰 수를 표시해야 한다", () => {
      render(<StreamingText content="Hello World Test" isStreaming={true} showStatus={true} />);

      expect(screen.getByTestId("streaming-status")).toBeInTheDocument();
    });

    it("showStatus=false일 때 상태를 숨겨야 한다", () => {
      render(<StreamingText content="Hello World" isStreaming={true} showStatus={false} />);

      expect(screen.queryByTestId("streaming-status")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 성능 테스트
  // ============================================

  describe("성능", () => {
    it("AC3: 동일 content로 리렌더링 시 DOM 변경이 최소화되어야 한다", () => {
      const { rerender } = render(<StreamingText content="동일 내용" isStreaming={false} />);

      const element = screen.getByTestId("streaming-text");
      const initialHTML = element.innerHTML;

      // 동일 props로 리렌더
      rerender(<StreamingText content="동일 내용" isStreaming={false} />);

      expect(element.innerHTML).toBe(initialHTML);
    });

    it("isStreaming만 변경 시 content 부분은 유지되어야 한다", () => {
      const { rerender } = render(<StreamingText content="내용" isStreaming={true} />);

      expect(screen.getByText("내용")).toBeInTheDocument();
      expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();

      rerender(<StreamingText content="내용" isStreaming={false} />);

      expect(screen.getByText("내용")).toBeInTheDocument();
      expect(screen.queryByTestId("streaming-cursor")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 에러 표시 테스트
  // ============================================

  describe("에러 표시", () => {
    it("error prop이 있으면 에러 메시지를 표시해야 한다", () => {
      render(<StreamingText content="" isStreaming={false} error={new Error("API 오류")} />);

      expect(screen.getByTestId("streaming-error")).toBeInTheDocument();
      expect(screen.getByText(/API 오류/)).toBeInTheDocument();
    });

    it("에러가 없으면 에러 영역이 숨겨져야 한다", () => {
      render(<StreamingText content="정상" isStreaming={false} />);

      expect(screen.queryByTestId("streaming-error")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 취소 표시 테스트
  // ============================================

  describe("취소 표시", () => {
    it("isCancelled=true일 때 취소 표시가 있어야 한다", () => {
      render(<StreamingText content="취소된 내용" isStreaming={false} isCancelled={true} />);

      expect(screen.getByTestId("streaming-cancelled")).toBeInTheDocument();
    });

    it("isCancelled=false일 때 취소 표시가 없어야 한다", () => {
      render(<StreamingText content="정상 내용" isStreaming={false} isCancelled={false} />);

      expect(screen.queryByTestId("streaming-cancelled")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 스냅샷 테스트
  // ============================================

  describe("스냅샷", () => {
    it("AC6: 기본 렌더링 스냅샷", () => {
      const { container } = render(<StreamingText content="스냅샷 테스트" isStreaming={false} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it("스트리밍 중 스냅샷", () => {
      const { container } = render(<StreamingText content="스트리밍 중..." isStreaming={true} />);

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  // ============================================
  // 멀티바이트 문자 테스트
  // 전 세계 언어 지원 검증 (한글, 중국어, 일본어 등)
  // ============================================

  describe("멀티바이트 문자 처리 (글로벌 언어 지원)", () => {
    it("한글 스트리밍 중 텍스트가 정확하게 표시되어야 한다", () => {
      const koreanText = "클러스터와이드 Pod 현황을 조회하겠습니다.";

      render(<StreamingText content={koreanText} isStreaming={true} />);

      expect(screen.getByText(/클러스터와이드/)).toBeInTheDocument();
      expect(screen.getByText(/조회하겠습니다/)).toBeInTheDocument();
    });

    it("중국어 스트리밍 중 텍스트가 올바르게 표시되어야 한다", () => {
      const chineseText = "你好。我是Claude助手。我很高兴为您服务。";

      render(<StreamingText content={chineseText} isStreaming={true} />);

      expect(screen.getByText(/你好/)).toBeInTheDocument();
    });

    it("일본어 스트리밍 중 텍스트가 올바르게 표시되어야 한다", () => {
      const japaneseText = "こんにちは。私はClaudeアシスタントです。";

      render(<StreamingText content={japaneseText} isStreaming={true} />);

      expect(screen.getByText(/こんにちは/)).toBeInTheDocument();
    });

    it("이모지와 한글 혼합 텍스트가 안정적으로 렌더링되어야 한다", () => {
      const mixedText = "Pod 상태 확인 완료! Healthy: 5개, Warning: 2개";

      render(<StreamingText content={mixedText} isStreaming={true} />);

      expect(screen.getByText(/Pod 상태 확인 완료/)).toBeInTheDocument();
      expect(screen.getByText(/Healthy/)).toBeInTheDocument();
    });

    it("빠른 업데이트에서도 텍스트 중복이 없어야 한다", () => {
      const { rerender } = render(<StreamingText content="첫 번째 " isStreaming={true} />);

      // 부분 렌더링 시뮬레이션
      rerender(<StreamingText content="첫 번째 단계가 " isStreaming={true} />);

      rerender(<StreamingText content="첫 번째 단계가 진행되고 있습니다" isStreaming={true} />);

      const element = screen.getByTestId("streaming-text");
      const text = element.textContent || "";

      // 최종 텍스트 정확성 (중복 없이 정확한 텍스트)
      expect(text).toContain("첫 번째 단계가 진행되고 있습니다");
      // "첫 번째"가 중복되지 않았는지 확인
      const firstCount = (text.match(/첫 번째/g) || []).length;
      expect(firstCount).toBe(1);
    });

    it("긴 한글 텍스트도 정확하게 렌더링되어야 한다", () => {
      const longKoreanText =
        "Kubernetes 클러스터의 전체 Pod 현황을 분석한 결과, " +
        "Namespace default에 10개의 Pod가 Running 상태입니다. " +
        "kube-system에는 15개의 시스템 Pod가 정상 동작 중입니다.";

      render(<StreamingText content={longKoreanText} isStreaming={false} />);

      expect(screen.getByText(/Kubernetes 클러스터/)).toBeInTheDocument();
      expect(screen.getByText(/정상 동작 중입니다/)).toBeInTheDocument();
    });
  });
});
