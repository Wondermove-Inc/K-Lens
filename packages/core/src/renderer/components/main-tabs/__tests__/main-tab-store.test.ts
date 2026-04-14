/**
 * 🎯 목적: MainTabStore의 Close Others 동작 검증
 */

import cloneDeep from "lodash/cloneDeep";
import { defaultMainTabStorageState } from "../main-tab-storage.injectable";
import { MainTabStore } from "../main-tab-store";

import type { StorageLayer } from "../../../utils/storage-helper";
import type { MainTabStorageStateV1, MainTabStorageStateV2 } from "../main-tab.model";

type StorageState = MainTabStorageStateV1 | MainTabStorageStateV2;

const createTestStorage = (): StorageLayer<StorageState> => {
  let state: StorageState = cloneDeep(defaultMainTabStorageState);

  return {
    isDefaultValue: () => false,
    get: () => state,
    set: (value) => {
      state = value;
    },
    reset: () => {
      state = cloneDeep(defaultMainTabStorageState);
    },
    merge: (value) => {
      if (typeof value === "function") {
        const draft = cloneDeep(state);
        const result = value(draft);

        if (result && typeof result === "object") {
          Object.assign(draft, result);
        }

        state = draft;
        return;
      }

      if (value) {
        state = {
          ...cloneDeep(state),
          ...value,
        };
      }
    },
  };
};

const createStore = () => new MainTabStore(createTestStorage());

describe("MainTabStore.closeOtherTabs", () => {
  it("removes every other tab within a single group", () => {
    const store = createStore();

    store.createTab({ id: "pods", title: "Pods", route: "/pods" });
    store.createTab({ id: "services", title: "Services", route: "/services" });
    store.createTab({ id: "nodes", title: "Nodes", route: "/nodes" });

    store.closeOtherTabs("services");

    expect(store.allTabs.map((tab) => tab.id)).toEqual(["services"]);
    expect(store.activeTabId).toBe("services");
  });

  it("removes tabs from other groups as well", () => {
    const store = createStore();

    store.createTab({ id: "left-1", title: "Left 1", route: "/left-1" });
    store.createGroup("right");
    store.createTab({ id: "right-1", title: "Right 1", route: "/right-1" }, "right");

    store.closeOtherTabs("right-1");

    expect(store.allTabs.map((tab) => tab.id)).toEqual(["right-1"]);
    expect(store.activeTabId).toBe("right-1");
  });

  it("warns when target tab does not exist", () => {
    const store = createStore();
    store.createTab({ id: "only", title: "Only", route: "/only" });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    store.closeOtherTabs("missing-tab");

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Close Others 대상 탭을 찾을 수 없습니다"));
    expect(store.allTabs.map((tab) => tab.id)).toEqual(["only"]);

    warnSpy.mockRestore();
  });
});
