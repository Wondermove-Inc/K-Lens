/**
 * 🎯 목적: ContextPills 컨테이너 컴포넌트 단위 테스트
 *
 * 03: ContextPills 컨테이너 컴포넌트 구현
 *
 * 테스트 범위:
 * - 아이템 목록 렌더링
 * - 빈 상태 처리
 * - 추가 버튼 동작
 * - 아이템 삭제 이벤트 전파
 * - 아이템 클릭 이벤트 전파
 * - 최대 개수 제한 및 오버플로우 표시
 * - 접근성 검증
 *
 * @packageDocumentation
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { ContextType } from "../../../common/context-types";
import { ContextPills } from "../context-pills";

import type { ContextItem } from "../../../common/context-types";

// 테스트용 ContextItem 생성 헬퍼
function createTestContextItem(id: string, overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id,
    type: ContextType.POD,
    name: `test-item-${id}`,
    namespace: "default",
    createdAt: new Date(),
    ...overrides,
  };
}

// 다수의 테스트 아이템 생성 헬퍼
function createTestContextItems(count: number): ContextItem[] {
  return Array.from({ length: count }, (_, i) =>
    createTestContextItem(`item-${i + 1}`, {
      name: `item-${i + 1}`,
      type: i % 2 === 0 ? ContextType.POD : ContextType.DEPLOYMENT,
    }),
  );
}

describe("ContextPills 컴포넌트", () => {
  describe("기본 렌더링", () => {
    it("AC1: 아이템 목록이 모두 렌더링되어야 한다", () => {
      const items = createTestContextItems(3);

      render(<ContextPills items={items} />);

      expect(screen.getByText("item-1")).toBeInTheDocument();
      expect(screen.getByText("item-2")).toBeInTheDocument();
      expect(screen.getByText("item-3")).toBeInTheDocument();
    });

    it("AC2: 빈 목록일 때 아무것도 렌더링하지 않아야 한다", () => {
      render(<ContextPills items={[]} />);

      const container = screen.queryByTestId("context-pills");
      // 빈 상태일 때 컨테이너가 없거나 비어있음
      if (container) {
        expect(container.childElementCount).toBe(0);
      }
    });

    it("각 아이템이 ContextPill로 렌더링되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} />);

      // ContextPill의 data-testid 확인
      const pills = screen.getAllByTestId("context-pill");
      expect(pills).toHaveLength(2);
    });
  });

  describe("추가 버튼", () => {
    it("AC3: onAdd가 제공되면 추가 버튼이 표시되어야 한다", () => {
      const items = createTestContextItems(1);
      const onAdd = jest.fn();

      render(<ContextPills items={items} onAdd={onAdd} />);

      expect(screen.getByRole("button", { name: /추가|add|컨텍스트/i })).toBeInTheDocument();
    });

    it("추가 버튼 클릭 시 onAdd 콜백이 호출되어야 한다", () => {
      const items = createTestContextItems(1);
      const onAdd = jest.fn();

      render(<ContextPills items={items} onAdd={onAdd} />);

      const addButton = screen.getByRole("button", { name: /추가|add|컨텍스트/i });
      fireEvent.click(addButton);

      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("onAdd가 없으면 추가 버튼이 표시되지 않아야 한다", () => {
      const items = createTestContextItems(1);

      render(<ContextPills items={items} />);

      expect(screen.queryByRole("button", { name: /추가|add|컨텍스트/i })).not.toBeInTheDocument();
    });

    it("빈 목록 + onAdd 제공 시에도 추가 버튼이 표시되어야 한다", () => {
      const onAdd = jest.fn();

      render(<ContextPills items={[]} onAdd={onAdd} />);

      expect(screen.getByRole("button", { name: /추가|add|컨텍스트/i })).toBeInTheDocument();
    });
  });

  describe("삭제 이벤트", () => {
    it("AC4: onRemove가 제공되면 각 아이템에 삭제 버튼이 표시되어야 한다", () => {
      const items = createTestContextItems(2);
      const onRemove = jest.fn();

      render(<ContextPills items={items} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button", {
        name: /삭제|제거|remove/i,
      });
      expect(removeButtons).toHaveLength(2);
    });

    it("아이템 삭제 시 올바른 ID로 onRemove가 호출되어야 한다", () => {
      const items = createTestContextItems(2);
      const onRemove = jest.fn();

      render(<ContextPills items={items} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button", {
        name: /삭제|제거|remove/i,
      });
      fireEvent.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalledWith("item-1");
    });
  });

  describe("클릭 이벤트", () => {
    it("AC5: onItemClick이 제공되면 아이템 클릭 시 콜백이 호출되어야 한다", () => {
      const items = createTestContextItems(2);
      const onItemClick = jest.fn();

      render(<ContextPills items={items} onItemClick={onItemClick} />);

      const pills = screen.getAllByTestId("context-pill");
      fireEvent.click(pills[0]);

      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledWith(items[0]);
    });
  });

  describe("최대 개수 제한", () => {
    it("AC6: maxItems가 설정되면 해당 개수만큼만 표시해야 한다", () => {
      const items = createTestContextItems(5);

      render(<ContextPills items={items} maxItems={3} />);

      const pills = screen.getAllByTestId("context-pill");
      expect(pills).toHaveLength(3);
    });

    it("AC7: 초과 아이템이 있으면 '+N more' 표시가 있어야 한다", () => {
      const items = createTestContextItems(5);

      render(<ContextPills items={items} maxItems={3} />);

      // "+2 more" 또는 "+2개 더" 형태 확인
      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it("아이템 수가 maxItems 이하면 더보기 표시가 없어야 한다", () => {
      const items = createTestContextItems(3);

      render(<ContextPills items={items} maxItems={5} />);

      expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
    });

    it("더보기 표시 클릭 시 onShowMore 콜백이 호출되어야 한다", () => {
      const items = createTestContextItems(5);
      const onShowMore = jest.fn();

      render(<ContextPills items={items} maxItems={3} onShowMore={onShowMore} />);

      const moreButton = screen.getByText(/\+2/);
      fireEvent.click(moreButton);

      expect(onShowMore).toHaveBeenCalledTimes(1);
    });
  });

  describe("레이아웃", () => {
    it("direction='horizontal'일 때 가로 방향으로 배치되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} direction="horizontal" />);

      const container = screen.getByTestId("context-pills");
      expect(container).toHaveClass("flex-row");
    });

    it("direction='vertical'일 때 세로 방향으로 배치되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} direction="vertical" />);

      const container = screen.getByTestId("context-pills");
      expect(container).toHaveClass("flex-col");
    });

    it("기본 방향은 horizontal이어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} />);

      const container = screen.getByTestId("context-pills");
      expect(container).toHaveClass("flex-row");
    });
  });

  describe("크기 및 스타일", () => {
    it("size prop이 각 ContextPill에 전달되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} size="sm" />);

      const pills = screen.getAllByTestId("context-pill");
      pills.forEach((pill) => {
        expect(pill).toHaveClass("text-xs");
      });
    });

    it("variant prop이 각 ContextPill에 전달되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} variant="secondary" />);

      const pills = screen.getAllByTestId("context-pill");
      pills.forEach((pill) => {
        expect(pill).toHaveClass("bg-secondary");
      });
    });

    it("showNamespace가 true이면 각 pill에 네임스페이스가 표시되어야 한다", () => {
      const items = [
        createTestContextItem("1", { name: "pod-1", namespace: "prod" }),
        createTestContextItem("2", { name: "pod-2", namespace: "dev" }),
      ];

      render(<ContextPills items={items} showNamespace />);

      expect(screen.getByText(/prod/)).toBeInTheDocument();
      expect(screen.getByText(/dev/)).toBeInTheDocument();
    });
  });

  describe("접근성", () => {
    it("컨테이너에 적절한 role이 설정되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} />);

      const container = screen.getByTestId("context-pills");
      expect(container).toHaveAttribute("role", "list");
    });

    it("각 아이템에 listitem role이 설정되어야 한다", () => {
      const items = createTestContextItems(2);

      render(<ContextPills items={items} />);

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(2);
    });

    it("aria-label이 아이템 개수를 포함해야 한다", () => {
      const items = createTestContextItems(3);

      render(<ContextPills items={items} />);

      const container = screen.getByTestId("context-pills");
      expect(container).toHaveAttribute("aria-label");
      expect(container.getAttribute("aria-label")).toMatch(/3/);
    });
  });

  describe("비활성화 상태", () => {
    it("disabled가 true면 모든 아이템이 비활성화되어야 한다", () => {
      const items = createTestContextItems(2);
      const onRemove = jest.fn();

      render(<ContextPills items={items} onRemove={onRemove} disabled />);

      const pills = screen.getAllByTestId("context-pill");
      pills.forEach((pill) => {
        expect(pill).toHaveClass("opacity-50");
      });
    });

    it("disabled가 true면 추가 버튼도 비활성화되어야 한다", () => {
      const items = createTestContextItems(1);
      const onAdd = jest.fn();

      render(<ContextPills items={items} onAdd={onAdd} disabled />);

      const addButton = screen.getByRole("button", { name: /추가|add|컨텍스트/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe("빈 상태 커스터마이징", () => {
    it("emptyMessage가 제공되면 빈 목록일 때 표시되어야 한다", () => {
      render(<ContextPills items={[]} emptyMessage="컨텍스트가 없습니다" />);

      expect(screen.getByText("컨텍스트가 없습니다")).toBeInTheDocument();
    });

    it("emptyMessage와 onAdd가 함께 제공되면 둘 다 표시되어야 한다", () => {
      const onAdd = jest.fn();

      render(<ContextPills items={[]} emptyMessage="컨텍스트가 없습니다" onAdd={onAdd} />);

      expect(screen.getByText("컨텍스트가 없습니다")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /추가|add|컨텍스트/i })).toBeInTheDocument();
    });
  });
});
