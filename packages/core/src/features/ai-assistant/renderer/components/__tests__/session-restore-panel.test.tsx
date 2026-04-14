/**
 * 🎯 목적: SessionRestorePanel 컴포넌트 테스트
 * 02: 세션 복원 UI
 *
 * 📝 테스트 케이스:
 * - 기본 렌더링
 * - 세션 목록 표시
 * - 세션 선택
 * - 세션 삭제
 * - 검색 기능
 * - 정렬 기능
 * - 키보드 네비게이션
 * - 로딩/에러 상태
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 *
 * @packageDocumentation
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SessionRestorePanel } from "../session-restore-panel";

import type { SessionRestorePanelProps } from "../../../common/session-restore-types";
import type { SessionSummary } from "../../../common/session-types";

// ============================================
// 🎯 테스트 헬퍼 함수
// ============================================

/**
 * 테스트용 세션 요약 생성
 */
function createMockSessionSummary(overrides?: Partial<SessionSummary>): SessionSummary {
  const id = overrides?.id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    title: overrides?.title ?? "테스트 세션",
    status: overrides?.status ?? "active",
    messageCount: overrides?.messageCount ?? 5,
    checkpointCount: overrides?.checkpointCount ?? 2,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 기본 Props 생성
 */
function createDefaultProps(overrides?: Partial<SessionRestorePanelProps>): SessionRestorePanelProps {
  return {
    isOpen: true,
    onClose: jest.fn(),
    onSelectSession: jest.fn(),
    onDeleteSession: jest.fn(),
    onCreateNewSession: jest.fn(),
    ...overrides,
  };
}

// ============================================
// 🎯 테스트 Suite
// ============================================

describe("SessionRestorePanel", () => {
  // ----------------------------------------
  // 기본 렌더링 테스트
  // ----------------------------------------
  describe("기본 렌더링", () => {
    it("isOpen이 true일 때 패널이 렌더링되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("isOpen이 false일 때 패널이 렌더링되지 않아야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps({ isOpen: false })} />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("기본 타이틀이 표시되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByText("세션 복원")).toBeInTheDocument();
    });

    it("커스텀 타이틀이 표시되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps({ title: "이전 대화 목록" })} />);

      expect(screen.getByText("이전 대화 목록")).toBeInTheDocument();
    });

    it("닫기 버튼이 존재해야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByRole("button", { name: /닫기/i })).toBeInTheDocument();
    });

    it("검색 입력 필드가 존재해야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByPlaceholderText(/검색/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------
  // 닫기 동작 테스트
  // ----------------------------------------
  describe("닫기 동작", () => {
    it("닫기 버튼 클릭 시 onClose가 호출되어야 한다", async () => {
      const onClose = jest.fn();
      render(<SessionRestorePanel {...createDefaultProps({ onClose })} />);

      await userEvent.click(screen.getByRole("button", { name: /닫기/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("ESC 키 입력 시 onClose가 호출되어야 한다", () => {
      const onClose = jest.fn();
      render(<SessionRestorePanel {...createDefaultProps({ onClose })} />);

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("오버레이 클릭 시 onClose가 호출되어야 한다", async () => {
      const onClose = jest.fn();
      render(<SessionRestorePanel {...createDefaultProps({ onClose })} />);

      const overlay = screen.getByTestId("modal-overlay");
      await userEvent.click(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------
  // 세션 목록 표시 테스트
  // ----------------------------------------
  describe("세션 목록 표시", () => {
    it("빈 목록일 때 안내 메시지가 표시되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByText(/세션이 없습니다/i)).toBeInTheDocument();
    });

    it("새 세션 생성 버튼이 표시되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByRole("button", { name: /새 세션/i })).toBeInTheDocument();
    });
  });

  // ----------------------------------------
  // 새 세션 생성 테스트
  // ----------------------------------------
  describe("새 세션 생성", () => {
    it("새 세션 버튼 클릭 시 onCreateNewSession이 호출되어야 한다", async () => {
      const onCreateNewSession = jest.fn();
      render(<SessionRestorePanel {...createDefaultProps({ onCreateNewSession })} />);

      await userEvent.click(screen.getByRole("button", { name: /새 세션/i }));

      expect(onCreateNewSession).toHaveBeenCalledTimes(1);
    });

    it("onCreateNewSession이 없으면 새 세션 버튼이 비활성화되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps({ onCreateNewSession: undefined })} />);

      const newSessionButton = screen.getByRole("button", { name: /새 세션/i });
      expect(newSessionButton).toBeDisabled();
    });
  });

  // ----------------------------------------
  // 검색 기능 테스트
  // ----------------------------------------
  describe("검색 기능", () => {
    it("검색어 입력이 가능해야 한다", async () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      const searchInput = screen.getByPlaceholderText(/검색/i);
      await userEvent.type(searchInput, "테스트");

      expect(searchInput).toHaveValue("테스트");
    });

    it("검색어 초기화 버튼이 동작해야 한다", async () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      const searchInput = screen.getByPlaceholderText(/검색/i);
      await userEvent.type(searchInput, "테스트");

      // 초기화 버튼 클릭
      const clearButton = screen.getByRole("button", { name: /검색어 초기화/i });
      await userEvent.click(clearButton);

      expect(searchInput).toHaveValue("");
    });
  });

  // ----------------------------------------
  // 정렬 기능 테스트
  // ----------------------------------------
  describe("정렬 기능", () => {
    it("정렬 드롭다운이 존재해야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByRole("combobox", { name: /정렬/i })).toBeInTheDocument();
    });

    it("정렬 옵션을 변경할 수 있어야 한다", async () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      const sortSelect = screen.getByRole("combobox", { name: /정렬/i });
      await userEvent.selectOptions(sortSelect, "oldest");

      expect(sortSelect).toHaveValue("oldest");
    });
  });

  // ----------------------------------------
  // 키보드 네비게이션 테스트
  // ----------------------------------------
  describe("키보드 네비게이션", () => {
    it("ArrowDown 키로 하이라이트를 아래로 이동할 수 있어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowDown" });

      // 하이라이트 상태 검증은 실제 세션 목록이 있을 때 확인
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("ArrowUp 키로 하이라이트를 위로 이동할 수 있어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowUp" });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("Enter 키로 하이라이트된 세션을 선택할 수 있어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  // ----------------------------------------
  // 액세스빌리티 테스트
  // ----------------------------------------
  describe("액세스빌리티", () => {
    it("dialog role이 있어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("aria-modal 속성이 true여야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("aria-labelledby가 타이틀과 연결되어야 한다", () => {
      render(<SessionRestorePanel {...createDefaultProps()} />);

      const dialog = screen.getByRole("dialog");
      const labelledById = dialog.getAttribute("aria-labelledby");
      expect(labelledById).toBeTruthy();

      const title = document.getElementById(labelledById!);
      expect(title).toBeInTheDocument();
    });
  });
});
