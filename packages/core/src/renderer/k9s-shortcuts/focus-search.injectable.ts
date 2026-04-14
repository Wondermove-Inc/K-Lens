import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";

/**
 * `/` key focuses the search input in the resource table layout.
 */
const focusSearchShortcutInjectable = getInjectable({
  id: "k9s-focus-search",

  instantiate: () => ({
    binding: "Slash",
    invoke: () => {
      const searchInput = document.querySelector("[data-search-input]") as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
  }),

  injectionToken: keyboardShortcutInjectionToken,
});

export default focusSearchShortcutInjectable;
