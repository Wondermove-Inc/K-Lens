import { getInjectable } from "@ogre-tools/injectable";
import { keyboardShortcutInjectionToken } from "@skuberplus/keyboard-shortcuts";
import mainTabStoreInjectable from "../components/main-tabs/main-tab-store.injectable";

/**
 * `Cmd+Shift+V` (Mac) / `Ctrl+Shift+V` (Win/Linux) — Toggle markdown preview mode.
 *
 * - Active tab must be a markdown file (type === "file" && language === "markdown")
 * - Toggles between "edit" and "preview" modes
 */
const toggleMarkdownPreviewInjectable = getInjectable({
  id: "toggle-markdown-preview",

  instantiate: (di) => {
    const mainTabStore = di.inject(mainTabStoreInjectable);

    return {
      binding: { code: "KeyV", ctrlOrCommand: true, shift: true },
      invoke: () => {
        const activeTab = mainTabStore.activeTab;

        if (!activeTab || activeTab.type !== "file" || activeTab.language !== "markdown") {
          return;
        }

        const current = activeTab.markdownViewMode || "edit";
        const next = current === "preview" ? "edit" : "preview";

        mainTabStore.updateMarkdownViewMode(activeTab.id, next);
      },
    };
  },

  injectionToken: keyboardShortcutInjectionToken,
});

export default toggleMarkdownPreviewInjectable;
