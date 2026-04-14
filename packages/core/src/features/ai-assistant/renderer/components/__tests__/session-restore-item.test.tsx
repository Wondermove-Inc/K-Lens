/**
 * 🎯 목적: SessionRestoreItem 컴포넌트 테스트
 * 02: 세션 복원 UI
 *
 * 📝 테스트 케이스:
 * - 기본 렌더링
 * - 세션 정보 표시
 * - 선택/하이라이트 상태
 * - 액션 메뉴
 * - 클릭 이벤트
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 *
 * @packageDocumentation
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SessionRestoreItem } from "../session-restore-item";

import type { SessionRestoreItemProps } from "../../../common/session-restore-types";
import type { SessionSummary } from "../../../common/session-types";

// ============================================
// 🎯 테스트 헬퍼 함수
// ============================================

/**
 * 테스트용 세션 요약 생성
 */
function createMockSessionSummary(overrides?: Partial<SessionSummary>): SessionSummary {
  const id = overrides?.id ?? `session-${Date.now()}`;
  return {
    id,
    title: overrides?.title ?? "테스트 대화",
    status: overrides?.status ?? "active",
    messageCount: overrides?.messageCount ?? 10,
    checkpointCount: overrides?.checkpointCount ?? 3,
    createdAt: overrides?.createdAt ?? "2026-01-05T10:00:00.000Z",
    updatedAt: overrides?.updatedAt ?? "2026-01-05T12:00:00.000Z",
    ...overrides,
  };
}

/**
 * 기본 Props 생성
 */
function createDefaultProps(overrides?: Partial<SessionRestoreItemProps>): SessionRestoreItemProps {
  return {
    session: createMockSessionSummary(),
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    onExport: jest.fn(),
    ...overrides,
  };
}

// ============================================
// 🎯 테스트 Suite
// ============================================

describe("SessionRestoreItem", () => {
  // ----------------------------------------
  // 기본 렌더링 테스트
  // ----------------------------------------
  describe("기본 렌더링", () => {
    it("세션 항목이 렌더링되어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps()} />);

      expect(screen.getByRole("listitem")).toBeInTheDocument();
    });

    it("세션 제목이 표시되어야 한다", () => {
      const session = createMockSessionSummary({ title: "쿠버네티스 디버깅" });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.getByText("쿠버네티스 디버깅")).toBeInTheDocument();
    });

    it("메시지 수가 표시되어야 한다", () => {
      const session = createMockSessionSummary({ messageCount: 15 });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.getAllByText(/15/).length).toBeGreaterThanOrEqual(1);
    });

    it("업데이트 시간이 상대적으로 표시되어야 한다", () => {
      const session = createMockSessionSummary();
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      // 시간 관련 텍스트가 있어야 함 (예: "방금 전", "1분 전" 등)
      expect(screen.getByTestId("session-updated-at")).toBeInTheDocument();
    });
  });

  // ----------------------------------------
  // 상태 표시 테스트
  // ----------------------------------------
  describe("상태 표시", () => {
    it("active 상태가 표시되어야 한다", () => {
      const session = createMockSessionSummary({ status: "active" });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.getByTestId("session-status")).toHaveTextContent(/활성/i);
    });

    it("completed 상태가 표시되어야 한다", () => {
      const session = createMockSessionSummary({ status: "completed" });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.getByTestId("session-status")).toHaveTextContent(/완료/i);
    });

    it("paused 상태가 표시되어야 한다", () => {
      const session = createMockSessionSummary({ status: "paused" });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.getByTestId("session-status")).toHaveTextContent(/일시정지/i);
    });
  });

  // ----------------------------------------
  // 선택/하이라이트 상태 테스트
  // ----------------------------------------
  describe("선택/하이라이트 상태", () => {
    it("isSelected가 true일 때 선택 스타일이 적용되어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ isSelected: true })} />);

      expect(screen.getByRole("listitem")).toHaveClass("selected");
    });

    it("isHighlighted가 true일 때 하이라이트 스타일이 적용되어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ isHighlighted: true })} />);

      expect(screen.getByRole("listitem")).toHaveClass("highlighted");
    });

    it("선택과 하이라이트가 동시에 적용될 수 있어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ isSelected: true, isHighlighted: true })} />);

      const item = screen.getByRole("listitem");
      expect(item).toHaveClass("selected");
      expect(item).toHaveClass("highlighted");
    });
  });

  // ----------------------------------------
  // 클릭 이벤트 테스트
  // ----------------------------------------
  describe("클릭 이벤트", () => {
    it("항목 클릭 시 onSelect가 호출되어야 한다", async () => {
      const onSelect = jest.fn();
      const session = createMockSessionSummary();
      render(<SessionRestoreItem {...createDefaultProps({ session, onSelect })} />);

      await userEvent.click(screen.getByRole("listitem"));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(session);
    });

    it("삭제 버튼 클릭 시 onDelete가 호출되어야 한다", async () => {
      const onDelete = jest.fn();
      const session = createMockSessionSummary({ id: "session-123" });
      render(<SessionRestoreItem {...createDefaultProps({ session, onDelete, showActions: true })} />);

      await userEvent.click(screen.getByRole("button", { name: /삭제/i }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith("session-123");
    });

    it("내보내기 버튼 클릭 시 onExport가 호출되어야 한다", async () => {
      const onExport = jest.fn();
      const session = createMockSessionSummary({ id: "session-456" });
      render(<SessionRestoreItem {...createDefaultProps({ session, onExport, showActions: true })} />);

      await userEvent.click(screen.getByRole("button", { name: /내보내기/i }));

      expect(onExport).toHaveBeenCalledTimes(1);
      expect(onExport).toHaveBeenCalledWith("session-456");
    });

    it("삭제 버튼 클릭이 선택 이벤트로 전파되지 않아야 한다", async () => {
      const onSelect = jest.fn();
      const onDelete = jest.fn();
      render(<SessionRestoreItem {...createDefaultProps({ onSelect, onDelete, showActions: true })} />);

      await userEvent.click(screen.getByRole("button", { name: /삭제/i }));

      expect(onDelete).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------
  // 액션 메뉴 테스트
  // ----------------------------------------
  describe("액션 메뉴", () => {
    it("showActions가 true일 때 액션 버튼들이 표시되어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ showActions: true })} />);

      expect(screen.getByRole("button", { name: /삭제/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /내보내기/i })).toBeInTheDocument();
    });

    it("showActions가 false일 때 액션 버튼들이 숨겨져야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ showActions: false })} />);

      expect(screen.queryByRole("button", { name: /삭제/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /내보내기/i })).not.toBeInTheDocument();
    });

    it("onDelete가 없으면 삭제 버튼이 표시되지 않아야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ showActions: true, onDelete: undefined })} />);

      expect(screen.queryByRole("button", { name: /삭제/i })).not.toBeInTheDocument();
    });

    it("onExport가 없으면 내보내기 버튼이 표시되지 않아야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ showActions: true, onExport: undefined })} />);

      expect(screen.queryByRole("button", { name: /내보내기/i })).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------
  // 체크포인트 표시 테스트
  // ----------------------------------------
  describe("체크포인트 표시", () => {
    it("체크포인트 수가 표시되어야 한다", () => {
      const session = createMockSessionSummary({ checkpointCount: 5 });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.getAllByText(/5/).length).toBeGreaterThanOrEqual(1);
    });

    it("체크포인트가 0개일 때도 표시되어야 한다", () => {
      const session = createMockSessionSummary({ checkpointCount: 0 });
      render(<SessionRestoreItem {...createDefaultProps({ session })} />);

      expect(screen.queryByTestId("checkpoint-count")).not.toBeInTheDocument();
    });
  });

  // ----------------------------------------
  // 액세스빌리티 테스트
  // ----------------------------------------
  describe("액세스빌리티", () => {
    it("listitem role이 있어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps()} />);

      expect(screen.getByRole("listitem")).toBeInTheDocument();
    });

    it("삭제 버튼에 접근성 레이블이 있어야 한다", () => {
      render(<SessionRestoreItem {...createDefaultProps({ showActions: true })} />);

      expect(screen.getByRole("button", { name: /삭제/i })).toBeInTheDocument();
    });
  });
});
