/**
 * 🎯 목적: Context MobX 고급 기능 테스트 - 배치/이동/제한 동작
 * 01: Context Pills 통합 테스트
 *
 * 📝 테스트 범위:
 * - addContexts 배치 동작
 * - moveContext 순서 변경
 * - setMaxContexts 제한 동작
 *
 * 📁 파일 분할:
 * - context-mobx-integration.test.tsx: MobX 반응성 + 타입 필터링 + computed
 * - context-mobx-advanced.test.tsx: 배치/이동/제한 고급 기능 (현재 파일)
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 - context-mobx-integration.test.tsx에서 분할
 *
 * @packageDocumentation
 */

import { act, render, screen } from "@testing-library/react";
import { observer } from "mobx-react-lite";
import React from "react";
import { ContextType } from "../../common/context-types";
import { ContextPills } from "../components/context-pills";
import { ContextStore, createContextStore } from "../store/context-store";

import type { ContextItem } from "../../common/context-types";

// ============================================
// 🎯 테스트 헬퍼
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
 * MobX 고급 기능 테스트용 래퍼
 */
interface AdvancedWrapperProps {
  store: ContextStore;
}

const AdvancedWrapper = observer(function AdvancedWrapper({ store }: AdvancedWrapperProps) {
  const handleRemove = React.useCallback((id: string) => store.removeContext(id), [store]);

  return (
    <div data-testid="advanced-wrapper">
      <ContextPills items={store.attachedContexts} onRemove={handleRemove} />
      <div data-testid="context-count">{store.contextCount}</div>
      <div data-testid="has-contexts">{String(store.hasContexts)}</div>
      <div data-testid="is-max-reached">{String(store.isMaxReached)}</div>
    </div>
  );
});

// ============================================
// 🎯 MobX 고급 기능 테스트
// ============================================

describe("Context MobX 고급 기능 테스트", () => {
  let store: ContextStore;

  beforeEach(() => {
    store = createContextStore();
    jest.clearAllMocks();
  });

  describe("addContexts 배치 동작", () => {
    it("여러 컨텍스트를 한 번에 추가할 수 있어야 한다", () => {
      render(<AdvancedWrapper store={store} />);

      act(() => {
        store.addContexts([
          createTestContextItem("batch-1", { name: "Batch Item 1" }),
          createTestContextItem("batch-2", { name: "Batch Item 2" }),
          createTestContextItem("batch-3", { name: "Batch Item 3" }),
        ]);
      });

      expect(screen.getByText("Batch Item 1")).toBeInTheDocument();
      expect(screen.getByText("Batch Item 2")).toBeInTheDocument();
      expect(screen.getByText("Batch Item 3")).toBeInTheDocument();
      expect(screen.getByTestId("context-count")).toHaveTextContent("3");
    });

    it("배치 추가 시 중복은 무시되어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("existing", { name: "Existing" }));
      });

      render(<AdvancedWrapper store={store} />);

      act(() => {
        store.addContexts([
          createTestContextItem("existing", { name: "Duplicate" }), // 중복
          createTestContextItem("new-1", { name: "New Item 1" }),
        ]);
      });

      expect(screen.getByText("Existing")).toBeInTheDocument();
      expect(screen.queryByText("Duplicate")).not.toBeInTheDocument();
      expect(screen.getByText("New Item 1")).toBeInTheDocument();
      expect(screen.getByTestId("context-count")).toHaveTextContent("2");
    });

    it("빈 배열 추가 시 아무 변화가 없어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("existing", { name: "Existing" }));
      });

      render(<AdvancedWrapper store={store} />);

      act(() => {
        store.addContexts([]);
      });

      expect(screen.getByText("Existing")).toBeInTheDocument();
      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
    });
  });

  describe("moveContext 동작", () => {
    it("컨텍스트 순서를 변경할 수 있어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("1", { name: "First" }));
        store.addContext(createTestContextItem("2", { name: "Second" }));
        store.addContext(createTestContextItem("3", { name: "Third" }));
      });

      render(<AdvancedWrapper store={store} />);

      // 초기 순서 확인
      expect(store.attachedContexts[0].name).toBe("First");
      expect(store.attachedContexts[1].name).toBe("Second");
      expect(store.attachedContexts[2].name).toBe("Third");

      // "Third"를 맨 앞으로 이동
      act(() => {
        store.moveContext("3", 0);
      });

      expect(store.attachedContexts[0].name).toBe("Third");
      expect(store.attachedContexts[1].name).toBe("First");
      expect(store.attachedContexts[2].name).toBe("Second");
    });

    it("동일 위치로 이동 시 순서가 유지되어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("1", { name: "First" }));
        store.addContext(createTestContextItem("2", { name: "Second" }));
      });

      render(<AdvancedWrapper store={store} />);

      // 같은 위치로 이동 시도
      act(() => {
        store.moveContext("1", 0);
      });

      expect(store.attachedContexts[0].name).toBe("First");
      expect(store.attachedContexts[1].name).toBe("Second");
    });

    it("존재하지 않는 ID로 이동 시도 시 무시되어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("1", { name: "First" }));
        store.addContext(createTestContextItem("2", { name: "Second" }));
      });

      render(<AdvancedWrapper store={store} />);

      // 존재하지 않는 ID로 이동 시도
      act(() => {
        store.moveContext("non-existent", 0);
      });

      // 순서 유지 확인
      expect(store.attachedContexts[0].name).toBe("First");
      expect(store.attachedContexts[1].name).toBe("Second");
      expect(screen.getByTestId("context-count")).toHaveTextContent("2");
    });

    it("마지막 위치로 이동할 수 있어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("1", { name: "First" }));
        store.addContext(createTestContextItem("2", { name: "Second" }));
        store.addContext(createTestContextItem("3", { name: "Third" }));
      });

      render(<AdvancedWrapper store={store} />);

      // "First"를 마지막으로 이동
      act(() => {
        store.moveContext("1", 2);
      });

      expect(store.attachedContexts[0].name).toBe("Second");
      expect(store.attachedContexts[1].name).toBe("Third");
      expect(store.attachedContexts[2].name).toBe("First");
    });
  });

  describe("setMaxContexts 동작", () => {
    it("maxContexts 감소 시 초과분이 제거되어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("1", { name: "Item 1" }));
        store.addContext(createTestContextItem("2", { name: "Item 2" }));
        store.addContext(createTestContextItem("3", { name: "Item 3" }));
        store.addContext(createTestContextItem("4", { name: "Item 4" }));
        store.addContext(createTestContextItem("5", { name: "Item 5" }));
      });

      render(<AdvancedWrapper store={store} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("5");

      act(() => {
        store.setMaxContexts(2);
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("2");
      // 가장 먼저 추가된 항목들이 제거됨
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Item 2")).not.toBeInTheDocument();
      expect(screen.queryByText("Item 3")).not.toBeInTheDocument();
      expect(screen.getByText("Item 4")).toBeInTheDocument();
      expect(screen.getByText("Item 5")).toBeInTheDocument();
    });

    it("maxContexts 증가 시 기존 항목이 유지되어야 한다", () => {
      act(() => {
        store.setMaxContexts(2);
        store.addContext(createTestContextItem("1", { name: "Item 1" }));
        store.addContext(createTestContextItem("2", { name: "Item 2" }));
      });

      render(<AdvancedWrapper store={store} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("2");
      expect(screen.getByTestId("is-max-reached")).toHaveTextContent("true");

      act(() => {
        store.setMaxContexts(5);
      });

      expect(screen.getByTestId("is-max-reached")).toHaveTextContent("false");
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("maxContexts를 1로 설정 시 단일 컨텍스트만 유지되어야 한다", () => {
      act(() => {
        store.addContext(createTestContextItem("1", { name: "Item 1" }));
        store.addContext(createTestContextItem("2", { name: "Item 2" }));
        store.addContext(createTestContextItem("3", { name: "Item 3" }));
      });

      render(<AdvancedWrapper store={store} />);

      act(() => {
        store.setMaxContexts(1);
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
      expect(screen.getByText("Item 3")).toBeInTheDocument();
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Item 2")).not.toBeInTheDocument();
    });
  });
});
