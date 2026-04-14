/**
 * 🎯 목적: Context MobX 통합 테스트 - MobX 반응성 + 타입 필터링 + computed
 * 01: Context Pills 통합 테스트
 *
 * 📝 테스트 범위:
 * - MobX 반응성 검증 (AC18-AC20)
 * - 타입별 필터링 (AC21)
 * - computed 속성 반응성 (isMaxReached, hasContexts)
 *
 * 📁 파일 분할:
 * - context-pills-integration.test.tsx: Store + Pills 기본 동작
 * - context-picker-integration.test.tsx: Modal 기본 동작
 * - context-flow-integration.test.tsx: 전체 플로우 + 에러 처리
 * - context-mobx-integration.test.tsx: MobX 반응성 + 타입 필터링 + computed (현재 파일)
 * - context-mobx-advanced.test.tsx: 배치/이동/제한 고급 기능
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 * - 2026-01-05: 파일 분할 - 고급 기능을 context-mobx-advanced.test.tsx로 분리
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
 * MobX 반응성 테스트용 래퍼
 */
interface MobXWrapperProps {
  store: ContextStore;
}

const MobXWrapper = observer(function MobXWrapper({ store }: MobXWrapperProps) {
  const handleRemove = React.useCallback((id: string) => store.removeContext(id), [store]);

  return (
    <div data-testid="mobx-wrapper">
      <ContextPills items={store.attachedContexts} onRemove={handleRemove} />
      <div data-testid="context-count">{store.contextCount}</div>
      <div data-testid="has-contexts">{String(store.hasContexts)}</div>
      <div data-testid="is-max-reached">{String(store.isMaxReached)}</div>
    </div>
  );
});

// ============================================
// 🎯 MobX 반응성 통합 테스트
// ============================================

describe("Context MobX 통합 테스트", () => {
  let store: ContextStore;

  beforeEach(() => {
    store = createContextStore();
    jest.clearAllMocks();
  });

  describe("MobX 반응성 검증", () => {
    it("AC18: Store 상태 변경이 UI에 즉시 반영되어야 한다", () => {
      render(<MobXWrapper store={store} />);

      expect(screen.getByTestId("has-contexts")).toHaveTextContent("false");

      act(() => {
        store.addContext(createTestContextItem("1"));
      });

      expect(screen.getByTestId("has-contexts")).toHaveTextContent("true");
      expect(screen.getByTestId("context-count")).toHaveTextContent("1");

      act(() => {
        store.addContext(createTestContextItem("2"));
        store.addContext(createTestContextItem("3"));
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("3");

      act(() => {
        store.removeContext("2");
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("2");
    });

    it("AC19: replaceContexts 호출 시 전체 UI 업데이트", () => {
      act(() => {
        store.addContext(createTestContextItem("old-1", { name: "Old Item 1" }));
        store.addContext(createTestContextItem("old-2", { name: "Old Item 2" }));
      });

      render(<MobXWrapper store={store} />);

      expect(screen.getByText("Old Item 1")).toBeInTheDocument();
      expect(screen.getByText("Old Item 2")).toBeInTheDocument();

      act(() => {
        store.replaceContexts([
          createTestContextItem("new-1", { name: "New Item 1" }),
          createTestContextItem("new-2", { name: "New Item 2" }),
          createTestContextItem("new-3", { name: "New Item 3" }),
        ]);
      });

      expect(screen.queryByText("Old Item 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Old Item 2")).not.toBeInTheDocument();
      expect(screen.getByText("New Item 1")).toBeInTheDocument();
      expect(screen.getByText("New Item 2")).toBeInTheDocument();
      expect(screen.getByText("New Item 3")).toBeInTheDocument();
      expect(screen.getByTestId("context-count")).toHaveTextContent("3");
    });

    it("AC20: updateContext 호출 시 Store 내부 데이터가 업데이트된다", () => {
      act(() => {
        store.addContext(createTestContextItem("update-target", { name: "Original Name" }));
      });

      render(<MobXWrapper store={store} />);

      expect(screen.getByText("Original Name")).toBeInTheDocument();

      act(() => {
        store.updateContext("update-target", { name: "Updated Name" });
      });

      // Store 내부 데이터 업데이트 확인
      expect(store.getContextById("update-target")?.name).toBe("Updated Name");
      expect(store.contextCount).toBe(1);
    });
  });

  describe("타입별 필터링 통합", () => {
    it("AC21: getContextsByType으로 필터링된 데이터 확인", () => {
      act(() => {
        store.addContext(createTestContextItem("pod-1", { type: ContextType.POD, name: "Pod 1" }));
        store.addContext(
          createTestContextItem("deploy-1", {
            type: ContextType.DEPLOYMENT,
            name: "Deploy 1",
          }),
        );
        store.addContext(createTestContextItem("pod-2", { type: ContextType.POD, name: "Pod 2" }));
        store.addContext(
          createTestContextItem("svc-1", {
            type: ContextType.SERVICE,
            name: "Service 1",
          }),
        );
      });

      render(<MobXWrapper store={store} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("4");

      const pods = store.getContextsByType(ContextType.POD);
      const deployments = store.getContextsByType(ContextType.DEPLOYMENT);
      const services = store.getContextsByType(ContextType.SERVICE);

      expect(pods).toHaveLength(2);
      expect(deployments).toHaveLength(1);
      expect(services).toHaveLength(1);
    });

    it("존재하지 않는 타입으로 필터링 시 빈 배열 반환", () => {
      act(() => {
        store.addContext(createTestContextItem("pod-1", { type: ContextType.POD, name: "Pod 1" }));
      });

      render(<MobXWrapper store={store} />);

      const nodes = store.getContextsByType(ContextType.NODE);
      expect(nodes).toHaveLength(0);
    });
  });

  describe("computed 속성 반응성", () => {
    it("isMaxReached가 실시간으로 반영되어야 한다", () => {
      act(() => {
        store.setMaxContexts(3);
      });

      render(<MobXWrapper store={store} />);

      expect(screen.getByTestId("is-max-reached")).toHaveTextContent("false");

      act(() => {
        store.addContext(createTestContextItem("1"));
        store.addContext(createTestContextItem("2"));
      });

      expect(screen.getByTestId("is-max-reached")).toHaveTextContent("false");

      act(() => {
        store.addContext(createTestContextItem("3"));
      });

      expect(screen.getByTestId("is-max-reached")).toHaveTextContent("true");

      act(() => {
        store.removeContext("1");
      });

      expect(screen.getByTestId("is-max-reached")).toHaveTextContent("false");
    });

    it("hasContexts가 실시간으로 반영되어야 한다", () => {
      render(<MobXWrapper store={store} />);

      expect(screen.getByTestId("has-contexts")).toHaveTextContent("false");

      act(() => {
        store.addContext(createTestContextItem("1"));
      });

      expect(screen.getByTestId("has-contexts")).toHaveTextContent("true");

      act(() => {
        store.clearContexts();
      });

      expect(screen.getByTestId("has-contexts")).toHaveTextContent("false");
    });

    it("contextCount가 실시간으로 반영되어야 한다", () => {
      render(<MobXWrapper store={store} />);

      expect(screen.getByTestId("context-count")).toHaveTextContent("0");

      act(() => {
        store.addContext(createTestContextItem("1"));
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("1");

      act(() => {
        store.addContext(createTestContextItem("2"));
        store.addContext(createTestContextItem("3"));
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("3");

      act(() => {
        store.removeContext("2");
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("2");

      act(() => {
        store.clearContexts();
      });

      expect(screen.getByTestId("context-count")).toHaveTextContent("0");
    });
  });
});
