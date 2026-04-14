import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import orderByUrlParamInjectable from "../components/table/order-by-url-param.injectable";
import sortByUrlParamInjectable from "../components/table/sort-by-url-param.injectable";

/**
 * `Shift+S` — Sort table by Status column.
 * Mirrors k9s `Shift+S` for status sort.
 */
const sortByStatusInjectable = getInjectable({
  id: "k9s-sort-by-status",

  instantiate: (di) => {
    const sortByUrlParam = di.inject(sortByUrlParamInjectable);
    const orderByUrlParam = di.inject(orderByUrlParamInjectable);

    return {
      binding: { code: "KeyS", shift: true },
      invoke: () => {
        const currentSort = sortByUrlParam.get();
        const currentOrder = orderByUrlParam.get();

        if (currentSort === "status") {
          orderByUrlParam.set(currentOrder === "asc" ? "desc" : "asc");
        } else {
          sortByUrlParam.set("status");
          orderByUrlParam.set("asc");
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default sortByStatusInjectable;
