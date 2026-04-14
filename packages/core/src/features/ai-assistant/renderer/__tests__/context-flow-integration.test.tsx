/**
 * 🎯 목적: Context 전체 플로우 통합 테스트 - 사용자 플로우 + 에러 처리
 * 01: Context Pills 통합 테스트
 *
 * 📝 테스트 범위:
 * - 전체 사용자 플로우: 모달 열기 → 검색 → 선택 → Pills 추가 → 삭제
 * - 에러 상황 처리 및 복구
 *
 * 📁 파일 분할:
 * - context-pills-integration.test.tsx: Store + Pills 기본 동작
 * - context-picker-integration.test.tsx: Modal 기본 동작
 * - context-flow-integration.test.tsx: 전체 플로우 + 에러 처리 (현재 파일)
 * - context-mobx-integration.test.tsx: MobX 반응성 + 고급 기능
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { observer } from "mobx-react-lite";
import React from "react";
import { ContextType } from "../../common/context-types";
import { ContextPickerModal } from "../components/context-picker-modal";
import { ContextPills } from "../components/context-pills";
import { ContextStore, createContextStore } from "../store/context-store";

import type { ContextItem } from "../../common/context-types";

// ============================================
// 🎯 테스트 헬퍼
// ============================================

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

function createMockResources(count: number): ContextItem[] {
  return Array.from({ length: count }, (_, i) =>
    createTestContextItem(`resource-${i + 1}`, {
      name: `resource-${i + 1}`,
      type: i % 3 === 0 ? ContextType.POD : i % 3 === 1 ? ContextType.DEPLOYMENT : ContextType.SERVICE,
      namespace: i % 2 === 0 ? "default" : "kube-system",
    }),
  );
}

// ============================================
// 🎯 통합 테스트용 래퍼 컴포넌트
// ============================================

interface FlowWrapperProps {
  store: ContextStore;
  fetcher: () => Promise<ContextItem[]>;
}

const FlowWrapper = observer(function FlowWrapper({ store, fetcher }: FlowWrapperProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (itemOrItems: ContextItem | ContextItem[]) => {
      const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      items.forEach((item) => store.addContext(item));
      setIsModalOpen(false);
    },
    [store],
  );

  return (
    <div data-testid="flow-wrapper">
      <ContextPills
        items={store.attachedContexts}
        onAdd={() => setIsModalOpen(true)}
        onRemove={(id) => store.removeContext(id)}
      />
      <ContextPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
        fetcher={fetcher}
      />
      <div data-testid="context-count">{store.contextCount}</div>
    </div>
  );
});

// ============================================
// 🎯 전체 플로우 통합 테스트
// ============================================

describe("Context 전체 플로우 통합 테스트", () => {
  let store: ContextStore;
  let mockFetcher: jest.Mock;

  beforeEach(() => {
    store = createContextStore();
    mockFetcher = jest.fn().mockResolvedValue(createMockResources(10));
    jest.clearAllMocks();
  });

  describe("전체 사용자 플로우", () => {
    it("AC12: 모달 열기 → 검색 → 선택 → Pills 표시 전체 플로우", async () => {
      const user = userEvent.setup();
      const searchableFetcher = jest.fn().mockResolvedValue(createMockResources(20));

      render(<FlowWrapper store={store} fetcher={searchableFetcher} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("0");

      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("resource-1")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search/i);
      await user.type(searchInput, "resource");
      await user.click(screen.getByText("resource-5"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
      expect(store.attachedContexts[0].id).toBe("resource-5");
    });

    it("AC13: 여러 리소스 추가 후 개별 삭제 플로우", async () => {
      const user = userEvent.setup();

      render(<FlowWrapper store={store} fetcher={mockFetcher} />);

      // 첫 번째 리소스 추가
      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));
      await waitFor(() => expect(screen.getByText("resource-1")).toBeInTheDocument());
      await user.click(screen.getByText("resource-1"));

      // 두 번째 리소스 추가
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText("resource-2")).toBeInTheDocument());
      await user.click(screen.getByText("resource-2"));

      await waitFor(() => {
        expect(store.contextCount).toBe(2);
      });

      // 첫 번째 삭제
      const removeButtons = screen.getAllByRole("button", { name: /삭제|제거|remove/i });
      await user.click(removeButtons[0]);

      expect(store.contextCount).toBe(1);
      expect(store.getContextById("resource-1")).toBeUndefined();
      expect(store.getContextById("resource-2")).toBeDefined();
    });

    it("AC14: 최대 개수 도달 시 추가 동작 검증", async () => {
      const user = userEvent.setup();
      act(() => store.setMaxContexts(2));

      render(<FlowWrapper store={store} fetcher={mockFetcher} />);

      for (let i = 1; i <= 3; i++) {
        await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
        await waitFor(() => expect(screen.getByText(`resource-${i}`)).toBeInTheDocument());
        await user.click(screen.getByText(`resource-${i}`));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      }

      expect(store.contextCount).toBe(2);
      expect(store.getContextById("resource-1")).toBeUndefined();
      expect(store.getContextById("resource-2")).toBeDefined();
      expect(store.getContextById("resource-3")).toBeDefined();
    });
  });

  describe("에러 상황 처리", () => {
    it("AC16: API 에러 시 Pills 상태 유지", async () => {
      const user = userEvent.setup();

      act(() => {
        store.addContext(createTestContextItem("existing", { name: "Existing Item" }));
      });

      const errorFetcher = jest.fn().mockRejectedValue(new Error("API Error"));

      render(<FlowWrapper store={store} fetcher={errorFetcher} />);

      expect(screen.getByText("Existing Item")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });

      const overlay = screen.getByTestId("modal-overlay");
      fireEvent.keyDown(overlay, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Existing Item")).toBeInTheDocument();
      expect(store.contextCount).toBe(1);
    });

    it("AC17: 재시도 버튼 동작 확인", async () => {
      const user = userEvent.setup();

      let callCount = 0;
      const retryFetcher = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("First Error"));
        }
        return Promise.resolve(createMockResources(5));
      });

      render(<FlowWrapper store={store} fetcher={retryFetcher} />);

      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /Try again/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("resource-1")).toBeInTheDocument();
      });
    });
  });
});
