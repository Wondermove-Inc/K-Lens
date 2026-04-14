/**
 * 🎯 목적: Context Pills 통합 테스트 - Store + Pills 기본 동작
 * 01: Context Pills 통합 테스트
 *
 * 📝 테스트 범위:
 * - ContextStore + ContextPills 기본 통합 동작
 * - 컨텍스트 추가/삭제/전체삭제
 * - 최대 개수 제한
 * - 중복 방지
 *
 * 📁 파일 분할:
 * - context-pills-integration.test.tsx: Store + Pills 기본 동작 (현재 파일)
 * - context-picker-integration.test.tsx: Modal + 전체 플로우
 * - context-mobx-integration.test.tsx: MobX 반응성 + 고급 기능
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 * - 2026-01-05: 파일 분할 (300줄 제한)
 *
 * @packageDocumentation
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { observer } from "mobx-react-lite";
import React from "react";
import { ContextType } from "../../common/context-types";
import { ContextPills } from "../components/context-pills";
import { ContextStore, createContextStore } from "../store/context-store";

import type { ContextItem } from "../../common/context-types";

// ============================================
// 🎯 테스트 헬퍼 및 Mock 데이터
// ============================================

/**
 * 테스트용 ContextItem 생성 헬퍼
 */
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

// ============================================
// 🎯 통합 테스트용 래퍼 컴포넌트
// ============================================

/**
 * ContextStore + ContextPills 단순 통합 래퍼
 */
interface SimpleWrapperProps {
  store: ContextStore;
  onAdd?: () => void;
}

const SimpleWrapper = observer(function SimpleWrapper({ store, onAdd }: SimpleWrapperProps) {
  const handleRemove = React.useCallback(
    (id: string) => {
      store.removeContext(id);
    },
    [store],
  );

  return (
    <div data-testid="simple-wrapper">
      <ContextPills items={store.attachedContexts} onAdd={onAdd} onRemove={handleRemove} />
      <div data-testid="context-count">{store.contextCount}</div>
      <div data-testid="has-contexts">{String(store.hasContexts)}</div>
    </div>
  );
});

// ============================================
// 🎯 ContextStore + ContextPills 통합 테스트
// ============================================

describe("Context Pills 통합 테스트 - Store + Pills", () => {
  let store: ContextStore;

  beforeEach(() => {
    store = createContextStore();
    jest.clearAllMocks();
  });

  describe("기본 통합 동작", () => {
    it("AC1: Store에 컨텍스트 추가 시 Pills에 즉시 반영되어야 한다", () => {
      render(<SimpleWrapper store={store} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("0");

      act(() => {
        store.addContext(createTestContextItem("test-1", { name: "Test Pod 1" }));
      });

      expect(screen.getByText("Test Pod 1")).toBeInTheDocument();
      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
    });

    it("AC2: Store에 여러 컨텍스트 추가 시 모두 Pills에 표시되어야 한다", () => {
      render(<SimpleWrapper store={store} />);

      act(() => {
        for (let i = 1; i <= 5; i++) {
          store.addContext(createTestContextItem(`item-${i}`, { name: `Item ${i}` }));
        }
      });

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
      expect(screen.getByText("Item 4")).toBeInTheDocument();
      expect(screen.getByText("Item 5")).toBeInTheDocument();
      expect(screen.getByTestId("context-count")).toHaveTextContent("5");
    });

    it("AC3: Pills에서 삭제 시 Store에서도 제거되어야 한다", async () => {
      const user = userEvent.setup();

      act(() => {
        store.addContext(createTestContextItem("item-1", { name: "Item 1" }));
        store.addContext(createTestContextItem("item-2", { name: "Item 2" }));
      });

      render(<SimpleWrapper store={store} />);

      expect(store.contextCount).toBe(2);

      const removeButtons = screen.getAllByRole("button", {
        name: /삭제|제거|remove/i,
      });
      await user.click(removeButtons[0]);

      expect(store.contextCount).toBe(1);
      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("AC4: Store에서 clearContexts 호출 시 모든 Pills가 제거되어야 한다", () => {
      act(() => {
        for (let i = 1; i <= 3; i++) {
          store.addContext(createTestContextItem(`item-${i}`, { name: `Item ${i}` }));
        }
      });

      render(<SimpleWrapper store={store} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("3");

      act(() => {
        store.clearContexts();
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("0");
      expect(screen.getByTestId("has-contexts")).toHaveTextContent("false");
    });
  });

  describe("최대 개수 제한", () => {
    it("AC5: 최대 개수 초과 시 가장 오래된 항목이 제거되어야 한다", () => {
      act(() => {
        store.setMaxContexts(3);
      });

      render(<SimpleWrapper store={store} />);

      act(() => {
        for (let i = 1; i <= 4; i++) {
          store.addContext(createTestContextItem(`item-${i}`, { name: `Item ${i}` }));
        }
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("3");
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
      expect(screen.getByText("Item 4")).toBeInTheDocument();
    });
  });

  describe("중복 방지", () => {
    it("AC6: 중복 ID 추가 시 무시되어야 한다", () => {
      render(<SimpleWrapper store={store} />);

      act(() => {
        store.addContext(createTestContextItem("same-id", { name: "First Add" }));
        store.addContext(createTestContextItem("same-id", { name: "Second Add" }));
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
      expect(screen.getByText("First Add")).toBeInTheDocument();
      expect(screen.queryByText("Second Add")).not.toBeInTheDocument();
    });
  });

  describe("추가 버튼 통합", () => {
    it("onAdd 콜백이 호출되어야 한다", async () => {
      const user = userEvent.setup();
      const onAdd = jest.fn();

      render(<SimpleWrapper store={store} onAdd={onAdd} />);

      const addButton = screen.getByRole("button", { name: /추가|add|컨텍스트/i });
      await user.click(addButton);

      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });
});
