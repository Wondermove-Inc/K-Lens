import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import orderByUrlParamInjectable from "../components/table/order-by-url-param.injectable";
import sortByUrlParamInjectable from "../components/table/sort-by-url-param.injectable";

/**
 * `Shift+M` — Sort table by Memory usage column.
 * Mirrors k9s `Shift+M` for memory sort.
 */
const sortByMemoryInjectable = getInjectable({
  id: "k9s-sort-by-memory",

  instantiate: (di) => {
    const sortByUrlParam = di.inject(sortByUrlParamInjectable);
    const orderByUrlParam = di.inject(orderByUrlParamInjectable);

    return {
      binding: { code: "KeyM", shift: true },
      invoke: () => {
        const currentSort = sortByUrlParam.get();
        const currentOrder = orderByUrlParam.get();

        if (currentSort === "memory") {
          orderByUrlParam.set(currentOrder === "asc" ? "desc" : "asc");
        } else {
          sortByUrlParam.set("memory");
          orderByUrlParam.set("desc"); // Highest first by default
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default sortByMemoryInjectable;
