/**
 * 🎯 목적: ContextStore 단위 테스트
 *
 * 01: attachedContexts 상태 및 액션 추가
 *
 * 테스트 범위:
 * - 초기 상태 검증
 * - 컨텍스트 추가/삭제 액션
 * - 컨텍스트 전체 삭제
 * - 중복 추가 방지
 * - 최대 개수 제한
 * - 컨텍스트 순서 유지
 *
 * @packageDocumentation
 */

import { ContextType } from "../../../common/context-types";
import { ContextStore, createContextStore } from "../context-store";

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

describe("ContextStore", () => {
  let store: ContextStore;

  beforeEach(() => {
    store = createContextStore();
  });

  describe("초기 상태", () => {
    it("AC1: 초기 attachedContexts는 빈 배열이어야 한다", () => {
      expect(store.attachedContexts).toEqual([]);
    });

    it("초기 isLoading은 false여야 한다", () => {
      expect(store.isLoading).toBe(false);
    });

    it("초기 maxContexts는 10이어야 한다", () => {
      expect(store.maxContexts).toBe(10);
    });
  });

  describe("addContext 액션", () => {
    it("AC2: 컨텍스트를 추가할 수 있어야 한다", () => {
      const item = createTestContextItem("1");

      store.addContext(item);

      expect(store.attachedContexts).toHaveLength(1);
      expect(store.attachedContexts[0]).toEqual(item);
    });

    it("여러 컨텍스트를 순서대로 추가할 수 있어야 한다", () => {
      const item1 = createTestContextItem("1");
      const item2 = createTestContextItem("2");

      store.addContext(item1);
      store.addContext(item2);

      expect(store.attachedContexts).toHaveLength(2);
      expect(store.attachedContexts[0]).toEqual(item1);
      expect(store.attachedContexts[1]).toEqual(item2);
    });

    it("AC3: 동일 ID의 컨텍스트는 중복 추가되지 않아야 한다", () => {
      const item1 = createTestContextItem("1", { name: "original" });
      const item2 = createTestContextItem("1", { name: "duplicate" });

      store.addContext(item1);
      store.addContext(item2);

      expect(store.attachedContexts).toHaveLength(1);
      expect(store.attachedContexts[0].name).toBe("original");
    });

    it("AC4: maxContexts 초과 시 가장 오래된 컨텍스트가 제거되어야 한다", () => {
      // maxContexts를 3으로 설정
      store.setMaxContexts(3);

      const items = [
        createTestContextItem("1"),
        createTestContextItem("2"),
        createTestContextItem("3"),
        createTestContextItem("4"), // 이것이 추가되면 "1"이 제거됨
      ];

      items.forEach((item) => store.addContext(item));

      expect(store.attachedContexts).toHaveLength(3);
      expect(store.attachedContexts.find((c) => c.id === "1")).toBeUndefined();
      expect(store.attachedContexts.find((c) => c.id === "4")).toBeDefined();
    });
  });

  describe("removeContext 액션", () => {
    it("AC5: ID로 컨텍스트를 삭제할 수 있어야 한다", () => {
      const item1 = createTestContextItem("1");
      const item2 = createTestContextItem("2");

      store.addContext(item1);
      store.addContext(item2);
      store.removeContext("1");

      expect(store.attachedContexts).toHaveLength(1);
      expect(store.attachedContexts[0].id).toBe("2");
    });

    it("존재하지 않는 ID 삭제 시 에러가 발생하지 않아야 한다", () => {
      const item = createTestContextItem("1");
      store.addContext(item);

      expect(() => store.removeContext("non-existent")).not.toThrow();
      expect(store.attachedContexts).toHaveLength(1);
    });
  });

  describe("clearContexts 액션", () => {
    it("AC6: 모든 컨텍스트를 삭제할 수 있어야 한다", () => {
      const items = [createTestContextItem("1"), createTestContextItem("2"), createTestContextItem("3")];

      items.forEach((item) => store.addContext(item));
      expect(store.attachedContexts).toHaveLength(3);

      store.clearContexts();

      expect(store.attachedContexts).toHaveLength(0);
    });
  });

  describe("updateContext 액션", () => {
    it("기존 컨텍스트를 업데이트할 수 있어야 한다", () => {
      const item = createTestContextItem("1", { name: "original" });
      store.addContext(item);

      store.updateContext("1", { name: "updated" });

      expect(store.attachedContexts[0].name).toBe("updated");
    });

    it("존재하지 않는 ID 업데이트 시 무시되어야 한다", () => {
      const item = createTestContextItem("1");
      store.addContext(item);

      store.updateContext("non-existent", { name: "updated" });

      expect(store.attachedContexts).toHaveLength(1);
      expect(store.attachedContexts[0].name).toBe("test-item-1");
    });
  });

  describe("computed 속성", () => {
    it("hasContexts는 컨텍스트 존재 여부를 반환해야 한다", () => {
      expect(store.hasContexts).toBe(false);

      store.addContext(createTestContextItem("1"));

      expect(store.hasContexts).toBe(true);
    });

    it("contextCount는 컨텍스트 개수를 반환해야 한다", () => {
      expect(store.contextCount).toBe(0);

      store.addContext(createTestContextItem("1"));
      store.addContext(createTestContextItem("2"));

      expect(store.contextCount).toBe(2);
    });

    it("isMaxReached는 최대 개수 도달 여부를 반환해야 한다", () => {
      store.setMaxContexts(2);

      expect(store.isMaxReached).toBe(false);

      store.addContext(createTestContextItem("1"));
      store.addContext(createTestContextItem("2"));

      expect(store.isMaxReached).toBe(true);
    });

    it("getContextById는 ID로 컨텍스트를 찾아야 한다", () => {
      const item = createTestContextItem("1");
      store.addContext(item);

      expect(store.getContextById("1")).toEqual(item);
      expect(store.getContextById("non-existent")).toBeUndefined();
    });

    it("getContextsByType은 타입별로 필터링해야 한다", () => {
      store.addContext(createTestContextItem("1", { type: ContextType.POD }));
      store.addContext(createTestContextItem("2", { type: ContextType.DEPLOYMENT }));
      store.addContext(createTestContextItem("3", { type: ContextType.POD }));

      const pods = store.getContextsByType(ContextType.POD);

      expect(pods).toHaveLength(2);
      expect(pods.every((c) => c.type === ContextType.POD)).toBe(true);
    });
  });

  describe("setMaxContexts 액션", () => {
    it("maxContexts 값을 변경할 수 있어야 한다", () => {
      store.setMaxContexts(5);
      expect(store.maxContexts).toBe(5);
    });

    it("maxContexts를 줄이면 초과분이 제거되어야 한다", () => {
      const items = [
        createTestContextItem("1"),
        createTestContextItem("2"),
        createTestContextItem("3"),
        createTestContextItem("4"),
        createTestContextItem("5"),
      ];
      items.forEach((item) => store.addContext(item));

      store.setMaxContexts(3);

      expect(store.attachedContexts).toHaveLength(3);
      // 가장 먼저 추가된 것들이 제거됨
      expect(store.attachedContexts.find((c) => c.id === "1")).toBeUndefined();
      expect(store.attachedContexts.find((c) => c.id === "2")).toBeUndefined();
    });

    it("최소값 1 미만으로 설정할 수 없어야 한다", () => {
      store.setMaxContexts(0);
      expect(store.maxContexts).toBe(1);

      store.setMaxContexts(-5);
      expect(store.maxContexts).toBe(1);
    });
  });

  describe("moveContext 액션", () => {
    it("컨텍스트 순서를 변경할 수 있어야 한다", () => {
      store.addContext(createTestContextItem("1"));
      store.addContext(createTestContextItem("2"));
      store.addContext(createTestContextItem("3"));

      store.moveContext("3", 0); // "3"을 맨 앞으로

      expect(store.attachedContexts[0].id).toBe("3");
      expect(store.attachedContexts[1].id).toBe("1");
      expect(store.attachedContexts[2].id).toBe("2");
    });

    it("잘못된 인덱스는 무시되어야 한다", () => {
      store.addContext(createTestContextItem("1"));
      store.addContext(createTestContextItem("2"));

      store.moveContext("1", -1); // 음수 인덱스
      store.moveContext("1", 100); // 범위 초과

      // 변경 없음
      expect(store.attachedContexts[0].id).toBe("1");
      expect(store.attachedContexts[1].id).toBe("2");
    });
  });

  describe("addContexts 배치 액션", () => {
    it("여러 컨텍스트를 한 번에 추가할 수 있어야 한다", () => {
      const items = [createTestContextItem("1"), createTestContextItem("2"), createTestContextItem("3")];

      store.addContexts(items);

      expect(store.attachedContexts).toHaveLength(3);
    });

    it("중복은 자동으로 필터링되어야 한다", () => {
      store.addContext(createTestContextItem("1"));

      const items = [
        createTestContextItem("1"), // 중복
        createTestContextItem("2"),
      ];

      store.addContexts(items);

      expect(store.attachedContexts).toHaveLength(2);
    });
  });

  describe("replaceContexts 액션", () => {
    it("기존 컨텍스트를 새 목록으로 교체할 수 있어야 한다", () => {
      store.addContext(createTestContextItem("old-1"));
      store.addContext(createTestContextItem("old-2"));

      const newItems = [createTestContextItem("new-1"), createTestContextItem("new-2")];

      store.replaceContexts(newItems);

      expect(store.attachedContexts).toHaveLength(2);
      expect(store.attachedContexts[0].id).toBe("new-1");
      expect(store.attachedContexts[1].id).toBe("new-2");
    });
  });
});
