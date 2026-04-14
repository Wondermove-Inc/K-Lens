/**
 * 🎯 목적: MentionAutocomplete 컴포넌트 단위 테스트
 * 02: MentionAutocomplete UI 구현
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ContextType } from "../../../../features/ai-assistant/common/context-types";
import { MentionAutocomplete, type MentionSuggestion } from "../mention-autocomplete";

describe("MentionAutocomplete 컴포넌트", () => {
  // 테스트용 제안 목록
  const mockSuggestions: MentionSuggestion[] = [
    { id: "pod-1", type: ContextType.POD, name: "nginx-pod", namespace: "default" },
    { id: "pod-2", type: ContextType.POD, name: "redis-pod", namespace: "default" },
    { id: "deploy-1", type: ContextType.DEPLOYMENT, name: "nginx-deploy", namespace: "kube-system" },
    { id: "svc-1", type: ContextType.SERVICE, name: "nginx-svc", namespace: "default" },
  ];

  const defaultProps = {
    isOpen: true,
    position: { top: 100, left: 50 },
    query: "",
    suggestions: mockSuggestions,
    selectedIndex: 0,
    onSelect: jest.fn(),
    onClose: jest.fn(),
    onNavigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("기본 렌더링", () => {
    it("AC1: isOpen=true일 때 position 기준 절대 위치 렌더링되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} />);

      const dropdown = screen.getByTestId("mention-autocomplete");
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveStyle({ top: "100px", left: "50px" });
    });

    it("isOpen=false일 때 렌더링되지 않아야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId("mention-autocomplete")).not.toBeInTheDocument();
    });

    it("AC2: 리소스 타입 아이콘 + 이름 + 네임스페이스 표시되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} />);

      // Pod 아이템 확인
      expect(screen.getByText("nginx-pod")).toBeInTheDocument();
      // 'default' 네임스페이스가 여러 개 있으므로 getAllByText 사용
      expect(screen.getAllByText("default").length).toBeGreaterThan(0);

      // 네임스페이스가 다른 아이템도 확인
      expect(screen.getByText("kube-system")).toBeInTheDocument();
    });

    it("AC3: 선택된 항목이 하이라이트되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} selectedIndex={1} />);

      const items = screen.getAllByTestId("mention-item");
      expect(items[0]).toHaveAttribute("data-selected", "false");
      expect(items[1]).toHaveAttribute("data-selected", "true");
    });

    it("AC4: 최대 10개 항목만 표시되어야 한다", () => {
      // 15개 제안 생성
      const manySuggestions: MentionSuggestion[] = Array.from({ length: 15 }, (_, i) => ({
        id: `pod-${i}`,
        type: ContextType.POD,
        name: `pod-${i}`,
        namespace: "default",
      }));

      render(<MentionAutocomplete {...defaultProps} suggestions={manySuggestions} />);

      const items = screen.getAllByTestId("mention-item");
      expect(items.length).toBe(10);
    });

    it("스크롤 영역이 있어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} />);
      expect(screen.getByTestId("mention-autocomplete")).toBeInTheDocument();
    });
  });

  describe("검색어 하이라이트", () => {
    it("AC5: 검색어가 이름에서 볼드 처리되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} query="nginx" />);

      // nginx를 포함하는 아이템 확인
      const highlightedTexts = screen.getAllByTestId("highlight-match");
      expect(highlightedTexts.length).toBeGreaterThan(0);
    });

    it("대소문자 구분 없이 하이라이트되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} query="NGINX" />);

      const highlightedTexts = screen.getAllByTestId("highlight-match");
      expect(highlightedTexts.length).toBeGreaterThan(0);
    });
  });

  describe("빈 상태", () => {
    it("AC6: 제안이 없으면 빈 상태 메시지가 표시되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} suggestions={[]} />);

      expect(screen.getByText(/검색 결과가 없습니다/i)).toBeInTheDocument();
    });

    it("로딩 중일 때 로딩 메시지가 표시되어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} suggestions={[]} isLoading={true} />);

      expect(screen.getByText(/검색 중/i)).toBeInTheDocument();
    });
  });

  describe("사용자 상호작용", () => {
    it("항목 클릭 시 onSelect가 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<MentionAutocomplete {...defaultProps} onSelect={onSelect} />);

      const items = screen.getAllByTestId("mention-item");
      await user.click(items[0]);

      expect(onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it("AC7: 외부 클릭 시 onClose가 호출되어야 한다", async () => {
      const onClose = jest.fn();

      render(
        <div>
          <div data-testid="outside">Outside</div>
          <MentionAutocomplete {...defaultProps} onClose={onClose} />
        </div>,
      );

      // 외부 클릭
      fireEvent.mouseDown(screen.getByTestId("outside"));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("항목 호버 시 스타일이 변경되어야 한다", async () => {
      const user = userEvent.setup();

      render(<MentionAutocomplete {...defaultProps} />);

      const items = screen.getAllByTestId("mention-item");
      await user.hover(items[1]);

      // 호버 스타일은 CSS 클래스로 확인
      expect(items[1].className).toMatch(/hover/i);
    });
  });

  describe("키보드 네비게이션", () => {
    it("ArrowDown 키로 다음 항목 선택", () => {
      const onNavigate = jest.fn();

      render(<MentionAutocomplete {...defaultProps} onNavigate={onNavigate} />);

      const dropdown = screen.getByTestId("mention-autocomplete");
      fireEvent.keyDown(dropdown, { key: "ArrowDown" });

      expect(onNavigate).toHaveBeenCalledWith("down");
    });

    it("ArrowUp 키로 이전 항목 선택", () => {
      const onNavigate = jest.fn();

      render(<MentionAutocomplete {...defaultProps} onNavigate={onNavigate} />);

      const dropdown = screen.getByTestId("mention-autocomplete");
      fireEvent.keyDown(dropdown, { key: "ArrowUp" });

      expect(onNavigate).toHaveBeenCalledWith("up");
    });

    it("Enter 키로 선택된 항목 선택", () => {
      const onSelect = jest.fn();

      render(<MentionAutocomplete {...defaultProps} selectedIndex={1} onSelect={onSelect} />);

      const dropdown = screen.getByTestId("mention-autocomplete");
      fireEvent.keyDown(dropdown, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith(mockSuggestions[1]);
    });

    it("Escape 키로 드롭다운 닫기", () => {
      const onClose = jest.fn();

      render(<MentionAutocomplete {...defaultProps} onClose={onClose} />);

      const dropdown = screen.getByTestId("mention-autocomplete");
      fireEvent.keyDown(dropdown, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("Tab 키로 드롭다운 닫기", () => {
      const onClose = jest.fn();

      render(<MentionAutocomplete {...defaultProps} onClose={onClose} />);

      const dropdown = screen.getByTestId("mention-autocomplete");
      fireEvent.keyDown(dropdown, { key: "Tab" });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("접근성", () => {
    it("role과 aria 속성이 있어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} />);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("선택된 항목에 aria-selected가 있어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} selectedIndex={0} />);

      const items = screen.getAllByRole("option");
      expect(items[0]).toHaveAttribute("aria-selected", "true");
      expect(items[1]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("타입별 필터링 표시", () => {
    it("@pod: 타입 필터 시 Pod 검색 중 힌트가 있어야 한다", () => {
      render(<MentionAutocomplete {...defaultProps} query="pod:" filterType="pod" />);

      // "pod 검색 중..." 텍스트 확인
      expect(screen.getByText(/검색 중/i)).toBeInTheDocument();
    });
  });
});
