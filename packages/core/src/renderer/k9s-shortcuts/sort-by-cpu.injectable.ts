import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import orderByUrlParamInjectable from "../components/table/order-by-url-param.injectable";
import sortByUrlParamInjectable from "../components/table/sort-by-url-param.injectable";

/**
 * `Shift+C` — Sort table by CPU usage column.
 * Mirrors k9s `Shift+C` for CPU sort.
 */
const sortByCpuInjectable = getInjectable({
  id: "k9s-sort-by-cpu",

  instantiate: (di) => {
    const sortByUrlParam = di.inject(sortByUrlParamInjectable);
    const orderByUrlParam = di.inject(orderByUrlParamInjectable);

    return {
      binding: { code: "KeyC", shift: true },
      invoke: () => {
        const currentSort = sortByUrlParam.get();
        const currentOrder = orderByUrlParam.get();

        if (currentSort === "cpu") {
          orderByUrlParam.set(currentOrder === "asc" ? "desc" : "asc");
        } else {
          sortByUrlParam.set("cpu");
          orderByUrlParam.set("desc"); // Highest first by default
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default sortByCpuInjectable;
