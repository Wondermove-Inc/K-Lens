/**
 * 🎯 목적: ContextPill 컴포넌트 단위 테스트
 *
 * 02: ContextPill 단일 컴포넌트 구현
 *
 * 테스트 범위:
 * - 기본 렌더링 검증
 * - 타입별 아이콘 표시 검증
 * - 삭제 버튼 동작 검증
 * - 접근성 검증
 *
 * @packageDocumentation
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ContextType } from "../../../common/context-types";
import { ContextPill } from "../context-pill";

import type { ContextItem } from "../../../common/context-types";

// 테스트용 ContextItem 생성 헬퍼
function createTestContextItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: "test-id-1",
    type: ContextType.POD,
    name: "nginx-pod",
    namespace: "default",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("ContextPill 컴포넌트", () => {
  describe("기본 렌더링", () => {
    it("AC1: 컨텍스트 이름이 표시되어야 한다", () => {
      const item = createTestContextItem({ name: "my-deployment" });

      render(<ContextPill item={item} />);

      expect(screen.getByText("my-deployment")).toBeInTheDocument();
    });

    it("AC2: displayName이 있으면 displayName을 표시해야 한다", () => {
      const item = createTestContextItem({
        name: "nginx-deploy-abc123",
        displayName: "Nginx App",
      });

      render(<ContextPill item={item} />);

      expect(screen.getByText("Nginx App")).toBeInTheDocument();
      expect(screen.queryByText("nginx-deploy-abc123")).not.toBeInTheDocument();
    });

    it("네임스페이스가 있으면 함께 표시해야 한다", () => {
      const item = createTestContextItem({
        name: "my-service",
        namespace: "production",
      });

      render(<ContextPill item={item} showNamespace />);

      expect(screen.getByText(/production/)).toBeInTheDocument();
    });
  });

  describe("타입별 아이콘", () => {
    it("AC3: Pod 타입에 맞는 아이콘이 표시되어야 한다", () => {
      const item = createTestContextItem({ type: ContextType.POD });

      render(<ContextPill item={item} />);

      // data-testid로 아이콘 확인
      expect(screen.getByTestId("context-icon-pod")).toBeInTheDocument();
    });

    it("Deployment 타입에 맞는 아이콘이 표시되어야 한다", () => {
      const item = createTestContextItem({ type: ContextType.DEPLOYMENT });

      render(<ContextPill item={item} />);

      expect(screen.getByTestId("context-icon-deployment")).toBeInTheDocument();
    });

    it("Cluster 타입에 맞는 아이콘이 표시되어야 한다", () => {
      const item = createTestContextItem({ type: ContextType.CLUSTER });

      render(<ContextPill item={item} />);

      expect(screen.getByTestId("context-icon-cluster")).toBeInTheDocument();
    });
  });

  describe("삭제 버튼", () => {
    it("AC4: onRemove가 제공되면 삭제 버튼이 표시되어야 한다", () => {
      const item = createTestContextItem();
      const onRemove = jest.fn();

      render(<ContextPill item={item} onRemove={onRemove} />);

      expect(screen.getByRole("button", { name: /삭제|제거|remove/i })).toBeInTheDocument();
    });

    it("삭제 버튼 클릭 시 onRemove 콜백이 호출되어야 한다", () => {
      const item = createTestContextItem();
      const onRemove = jest.fn();

      render(<ContextPill item={item} onRemove={onRemove} />);

      const removeButton = screen.getByRole("button", { name: /삭제|제거|remove/i });
      fireEvent.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith(item.id);
    });

    it("onRemove가 없으면 삭제 버튼이 표시되지 않아야 한다", () => {
      const item = createTestContextItem();

      render(<ContextPill item={item} />);

      expect(screen.queryByRole("button", { name: /삭제|제거|remove/i })).not.toBeInTheDocument();
    });
  });

  describe("클릭 동작", () => {
    it("onClick이 제공되면 클릭 가능해야 한다", () => {
      const item = createTestContextItem();
      const onClick = jest.fn();

      render(<ContextPill item={item} onClick={onClick} />);

      const pill = screen.getByTestId("context-pill");
      fireEvent.click(pill);

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(item);
    });

    it("onClick이 없으면 클릭 시 아무 동작도 하지 않아야 한다", () => {
      const item = createTestContextItem();

      render(<ContextPill item={item} />);

      const pill = screen.getByTestId("context-pill");
      // 에러 없이 클릭 가능해야 함
      expect(() => fireEvent.click(pill)).not.toThrow();
    });
  });

  describe("접근성", () => {
    it("aria-label이 적절하게 설정되어야 한다", () => {
      const item = createTestContextItem({
        type: ContextType.POD,
        name: "nginx-pod",
      });

      render(<ContextPill item={item} />);

      const pill = screen.getByTestId("context-pill");
      expect(pill).toHaveAttribute("aria-label");
    });

    it("키보드로 삭제 버튼에 접근할 수 있어야 한다", () => {
      const item = createTestContextItem();
      const onRemove = jest.fn();

      render(<ContextPill item={item} onRemove={onRemove} />);

      const removeButton = screen.getByRole("button", { name: /삭제|제거|remove/i });
      removeButton.focus();
      fireEvent.keyDown(removeButton, { key: "Enter" });

      expect(onRemove).toHaveBeenCalled();
    });
  });

  describe("스타일 변형", () => {
    it("size prop에 따라 크기가 변경되어야 한다", () => {
      const item = createTestContextItem();

      const { rerender } = render(<ContextPill item={item} size="sm" />);
      // sm 사이즈: text-xs
      expect(screen.getByTestId("context-pill")).toHaveClass("text-xs");

      rerender(<ContextPill item={item} size="md" />);
      // md 사이즈: text-sm
      expect(screen.getByTestId("context-pill")).toHaveClass("text-sm");
    });

    it("variant prop에 따라 스타일이 변경되어야 한다", () => {
      const item = createTestContextItem();

      render(<ContextPill item={item} variant="secondary" />);

      expect(screen.getByTestId("context-pill")).toHaveClass("bg-secondary");
    });

    it("disabled 상태에서 시각적으로 비활성화되어야 한다", () => {
      const item = createTestContextItem();

      render(<ContextPill item={item} disabled />);

      const pill = screen.getByTestId("context-pill");
      expect(pill).toHaveClass("opacity-50");
    });
  });
});
