/**
 * 🎯 목적: SlashCommandPalette 컴포넌트 단위 테스트
 * 01: SlashCommandPalette UI 구현
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SlashCommandCategory, SlashCommandId } from "../../../../features/ai-assistant/common/slash-commands";
import { SlashCommandPalette } from "../slash-command-palette";

describe("SlashCommandPalette 컴포넌트", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    searchQuery: "",
    onSearchChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("기본 렌더링", () => {
    it("AC1: isOpen=true일 때 팔레트가 렌더링되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} isOpen={true} />);
      expect(screen.getByTestId("slash-command-palette")).toBeInTheDocument();
    });

    it("isOpen=false일 때 팔레트가 렌더링되지 않아야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId("slash-command-palette")).not.toBeInTheDocument();
    });

    it("AC2: 기본 명령어 목록이 표시되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} />);

      // 최소 10개 이상의 명령어가 있어야 함
      const commandItems = screen.getAllByTestId("slash-command-item");
      expect(commandItems.length).toBeGreaterThanOrEqual(10);
    });

    it("AC3: 카테고리별로 그룹화되어 표시되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} />);

      // 카테고리 헤더 확인
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Kubernetes")).toBeInTheDocument();
      expect(screen.getByText("Diagnostics")).toBeInTheDocument();
    });

    it("AC4: 각 명령어에 아이콘, 이름, 설명이 표시되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} />);

      // /clear 명령어 확인
      expect(screen.getByText("/clear")).toBeInTheDocument();
      expect(screen.getByText("Clear all conversation messages")).toBeInTheDocument();
    });
  });

  describe("검색 기능", () => {
    it("AC5: 검색어가 있으면 필터링된 결과만 표시되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} searchQuery="pod" />);

      // pod 관련 명령어만 표시
      expect(screen.getByText("/pods")).toBeInTheDocument();
      // clear는 표시되지 않아야 함
      expect(screen.queryByText("/clear")).not.toBeInTheDocument();
    });

    it("AC6: 검색 결과가 없으면 빈 상태 메시지가 표시되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} searchQuery="zzzznotfound" />);

      expect(screen.getByText(/No results found/i)).toBeInTheDocument();
    });

    it("검색어 입력 시 onSearchChange가 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onSearchChange = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSearchChange={onSearchChange} />);

      const searchInput = screen.getByPlaceholderText(/Search commands/i);
      await user.type(searchInput, "logs");

      expect(onSearchChange).toHaveBeenCalled();
    });
  });

  describe("명령어 선택", () => {
    it("AC7: 명령어 클릭 시 onSelect가 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} />);

      const clearCommand = screen.getByText("/clear");
      await user.click(clearCommand);

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: SlashCommandId.CLEAR }));
    });

    it("AC8: Enter 키로 하이라이트된 명령어를 선택할 수 있어야 한다", () => {
      const onSelect = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} />);

      // 검색 입력에서 Enter 키 이벤트 발생
      const searchInput = screen.getByPlaceholderText(/Search commands/i);
      fireEvent.keyDown(searchInput, { key: "Enter" });

      // 첫 번째 명령어가 선택되어야 함
      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe("키보드 네비게이션", () => {
    it("AC9: 화살표 위/아래로 명령어를 탐색할 수 있어야 한다", async () => {
      render(<SlashCommandPalette {...defaultProps} />);

      // 첫 번째 항목이 기본 하이라이트 - 초기 상태 확인
      const initialItems = screen.getAllByTestId("slash-command-item");
      expect(initialItems[0]).toHaveAttribute("data-highlighted", "true");
      expect(initialItems[1]).toHaveAttribute("data-highlighted", "false");

      // 아래 화살표로 다음 항목으로 이동 - 검색 입력에서 키 이벤트 발생
      const searchInput = screen.getByPlaceholderText(/Search commands/i);

      // fireEvent는 동기적으로 이벤트를 처리함
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      // 상태 업데이트 후 다시 쿼리
      const items = screen.getAllByTestId("slash-command-item");
      expect(items[0]).toHaveAttribute("data-highlighted", "false");
      expect(items[1]).toHaveAttribute("data-highlighted", "true");
    });

    it("AC10: Escape 키로 팔레트를 닫을 수 있어야 한다", async () => {
      const onClose = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onClose={onClose} />);

      // 검색 입력에서 ESC 키
      const searchInput = screen.getByPlaceholderText(/Search commands/i);
      fireEvent.keyDown(searchInput, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("스크롤 및 가시성", () => {
    it("선택된 항목이 뷰포트 내에 있어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/Search commands/i);

      // 여러 번 아래로 이동
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      }

      // 현재 하이라이트된 항목이 visible
      const highlighted = screen
        .getAllByTestId("slash-command-item")
        .find((item) => item.getAttribute("data-highlighted") === "true");

      expect(highlighted).toBeInTheDocument();
    });
  });

  describe("접근성", () => {
    it("키보드로만 조작이 가능해야 한다", () => {
      const onSelect = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} />);

      const searchInput = screen.getByPlaceholderText(/Search commands/i);

      // Arrow, Enter로 선택
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "Enter" });

      expect(onSelect).toHaveBeenCalled();
    });

    it("role과 aria 속성이 있어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} />);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  /**
   * 🎯 2026-01-28: Tab과 Enter 동작 분리 테스트
   */
  describe("Tab/Enter 동작 분리", () => {
    it("Tab 키로 onAutoComplete가 호출되어야 한다 (onAutoComplete 제공 시)", () => {
      const onSelect = jest.fn();
      const onAutoComplete = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} onAutoComplete={onAutoComplete} />);

      const searchInput = screen.getByPlaceholderText(/Search commands/i);
      fireEvent.keyDown(searchInput, { key: "Tab" });

      // Tab 시 onAutoComplete만 호출
      expect(onAutoComplete).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Tab 키로 onSelect가 호출되어야 한다 (onAutoComplete 미제공 시 fallback)", () => {
      const onSelect = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} />);

      const searchInput = screen.getByPlaceholderText(/Search commands/i);
      fireEvent.keyDown(searchInput, { key: "Tab" });

      // onAutoComplete 없으면 onSelect로 fallback
      expect(onSelect).toHaveBeenCalled();
    });

    it("Enter 키로 onSelect가 호출되어야 한다 (onAutoComplete 제공 여부와 무관)", () => {
      const onSelect = jest.fn();
      const onAutoComplete = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} onAutoComplete={onAutoComplete} />);

      const searchInput = screen.getByPlaceholderText(/Search commands/i);
      fireEvent.keyDown(searchInput, { key: "Enter" });

      // Enter 시 onSelect만 호출
      expect(onSelect).toHaveBeenCalled();
      expect(onAutoComplete).not.toHaveBeenCalled();
    });

    it("클릭 시 onSelect가 호출되어야 한다 (onAutoComplete 제공 여부와 무관)", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      const onAutoComplete = jest.fn();

      render(<SlashCommandPalette {...defaultProps} onSelect={onSelect} onAutoComplete={onAutoComplete} />);

      const clearCommand = screen.getByText("/clear");
      await user.click(clearCommand);

      // 클릭 시 onSelect만 호출
      expect(onSelect).toHaveBeenCalled();
      expect(onAutoComplete).not.toHaveBeenCalled();
    });
  });

  describe("영문 라벨", () => {
    it("명령어에 영문 라벨이 표시되어야 한다", () => {
      render(<SlashCommandPalette {...defaultProps} />);

      // 영문 라벨 확인
      expect(screen.getByText("Clear Chat")).toBeInTheDocument();
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });
});
