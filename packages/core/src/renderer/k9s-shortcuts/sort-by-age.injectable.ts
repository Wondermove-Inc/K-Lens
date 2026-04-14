import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import orderByUrlParamInjectable from "../components/table/order-by-url-param.injectable";
import sortByUrlParamInjectable from "../components/table/sort-by-url-param.injectable";

/**
 * `Shift+A` — Sort table by Age (creation time) column.
 * Mirrors k9s `Shift+A` for age sort.
 */
const sortByAgeInjectable = getInjectable({
  id: "k9s-sort-by-age",

  instantiate: (di) => {
    const sortByUrlParam = di.inject(sortByUrlParamInjectable);
    const orderByUrlParam = di.inject(orderByUrlParamInjectable);

    return {
      binding: { code: "KeyA", shift: true },
      invoke: () => {
        const currentSort = sortByUrlParam.get();
        const currentOrder = orderByUrlParam.get();

        if (currentSort === "age") {
          orderByUrlParam.set(currentOrder === "asc" ? "desc" : "asc");
        } else {
          sortByUrlParam.set("age");
          orderByUrlParam.set("desc"); // Newest first by default
        }
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default sortByAgeInjectable;
