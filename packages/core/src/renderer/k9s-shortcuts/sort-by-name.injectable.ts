import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import orderByUrlParamInjectable from "../components/table/order-by-url-param.injectable";
import sortByUrlParamInjectable from "../components/table/sort-by-url-param.injectable";

/**
 * `Shift+N` — Sort table by Name column.
 * Mirrors k9s `Shift+N` for name sort.
 */
const sortByNameInjectable = getInjectable({
  id: "k9s-sort-by-name",

  instantiate: (di) => {
    const sortByUrlParam = di.inject(sortByUrlParamInjectable);
    const orderByUrlParam = di.inject(orderByUrlParamInjectable);

    return {
      binding: { code: "KeyN", shift: true },
      invoke: () => {
        const currentSort = sortByUrlParam.get();
        const currentOrder = orderByUrlParam.get();

        // Toggle order if already sorted by this column
        if (currentSort === "name") {
          orderByUrlParam.set(currentOrder === "asc" ? "desc" : "asc");
        } else {
          sortByUrlParam.set("name");
          orderByUrlParam.set("asc");
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default sortByNameInjectable;
