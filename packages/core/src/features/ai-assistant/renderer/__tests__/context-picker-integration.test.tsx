/**
 * 🎯 목적: Context Picker Modal 통합 테스트 - Modal + 전체 플로우
 * 01: Context Pills 통합 테스트
 *
 * 📝 테스트 범위:
 * - ContextStore + ContextPickerModal 통합 동작
 * - 전체 플로우: 모달 열기 → 검색 → 선택 → Pills 추가 → 삭제
 * - 키보드 네비게이션 통합
 * - 에러 상황 처리
 *
 * 📁 파일 분할:
 * - context-pills-integration.test.tsx: Store + Pills 기본 동작
 * - context-picker-integration.test.tsx: Modal + 전체 플로우 (현재 파일)
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

/**
 * 대량의 테스트 아이템 생성 헬퍼
 */
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

/**
 * ContextStore + ContextPills + ContextPickerModal 전체 통합 래퍼
 */
interface FullIntegrationWrapperProps {
  store: ContextStore;
  fetcher: () => Promise<ContextItem[]>;
}

const FullIntegrationWrapper = observer(function FullIntegrationWrapper({
  store,
  fetcher,
}: FullIntegrationWrapperProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (itemOrItems: ContextItem | ContextItem[]) => {
      const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      items.forEach((item) => store.addContext(item));
      setIsModalOpen(false);
    },
    [store],
  );

  const handleRemove = React.useCallback((id: string) => store.removeContext(id), [store]);

  return (
    <div data-testid="full-integration-wrapper">
      <ContextPills items={store.attachedContexts} onAdd={() => setIsModalOpen(true)} onRemove={handleRemove} />
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
// 🎯 ContextPickerModal 통합 테스트
// ============================================

describe("Context Picker Modal 통합 테스트", () => {
  let store: ContextStore;
  let mockFetcher: jest.Mock;

  beforeEach(() => {
    store = createContextStore();
    mockFetcher = jest.fn().mockResolvedValue(createMockResources(10));
    jest.clearAllMocks();
  });

  describe("모달 기본 동작", () => {
    it("AC7: 추가 버튼 클릭 시 모달이 열려야 한다", async () => {
      const user = userEvent.setup();

      render(<FullIntegrationWrapper store={store} fetcher={mockFetcher} />);

      const addButton = screen.getByRole("button", { name: /추가|add|컨텍스트/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("AC8: 모달에서 리소스 선택 시 Store에 추가되어야 한다", async () => {
      const user = userEvent.setup();

      render(<FullIntegrationWrapper store={store} fetcher={mockFetcher} />);

      const addButton = screen.getByRole("button", { name: /추가|add|컨텍스트/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText("resource-1")).toBeInTheDocument();
      });

      await user.click(screen.getByText("resource-1"));

      await waitFor(() => {
        expect(store.contextCount).toBe(1);
        expect(store.getContextById("resource-1")).toBeDefined();
      });
    });

    it("AC9: 모달 닫기 후 Pills가 업데이트되어야 한다", async () => {
      const user = userEvent.setup();

      render(<FullIntegrationWrapper store={store} fetcher={mockFetcher} />);

      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByText("resource-1")).toBeInTheDocument();
      });
      await user.click(screen.getByText("resource-1"));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("context-count")).toHaveTextContent("1");
    });

    it("AC10: Escape 키로 모달 닫기 시 선택 취소되어야 한다", async () => {
      const user = userEvent.setup();

      render(<FullIntegrationWrapper store={store} fetcher={mockFetcher} />);

      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const overlay = screen.getByTestId("modal-overlay");
      fireEvent.keyDown(overlay, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(store.contextCount).toBe(0);
    });

    it("AC11: 모달 오버레이 클릭 시 닫기 및 선택 취소", async () => {
      const user = userEvent.setup();

      render(<FullIntegrationWrapper store={store} fetcher={mockFetcher} />);

      await user.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const overlay = screen.getByTestId("modal-overlay");
      await user.click(overlay);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(store.contextCount).toBe(0);
    });
  });

  describe("키보드 네비게이션", () => {
    it("AC15: 모달에서 화살표 키 + Enter로 리소스 선택", async () => {
      render(<FullIntegrationWrapper store={store} fetcher={mockFetcher} />);

      fireEvent.click(screen.getByRole("button", { name: /추가|add|컨텍스트/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("resource-1")).toBeInTheDocument();
      });

      const modal = screen.getByRole("dialog");
      fireEvent.keyDown(modal, { key: "ArrowDown" });
      fireEvent.keyDown(modal, { key: "ArrowDown" });
      fireEvent.keyDown(modal, { key: "Enter" });

      await waitFor(() => {
        expect(store.contextCount).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
