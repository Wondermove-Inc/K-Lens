/**
 * Keyboard Layer System for k9s-style shortcuts.
 *
 * Layer 4: Modal     (command palette, dialogs)  - blocks all lower layers
 * Layer 3: Input     (search, Monaco, terminal)  - blocks single-char keys
 * Layer 2: Panel     (table j/k/g/G, sidebar)    - panel-scoped shortcuts
 * Layer 1: Global    (:, ?, Ctrl+1/2/3)          - always active
 */

export enum KeyboardLayer {
  GLOBAL = 1,
  PANEL = 2,
  INPUT = 3,
  MODAL = 4,
}

export type KeyboardMode = "NORMAL" | "COMMAND" | "SEARCH" | "INPUT";

export class KeyboardLayerManager {
  /**
   * Detect the active keyboard layer based on document.activeElement.
   */
  getActiveLayer(): KeyboardLayer {
    const activeElement = document.activeElement;

    if (!activeElement) {
      return KeyboardLayer.GLOBAL;
    }

    // Layer 4: Modal - dialogs, command overlay
    if (this.isModalActive()) {
      return KeyboardLayer.MODAL;
    }

    // Layer 3: Input - text inputs, editors, terminals
    if (this.isInputActive(activeElement)) {
      return KeyboardLayer.INPUT;
    }

    // Layer 2: Panel - within a keyboard shortcut scope
    if (activeElement.closest("[data-keyboard-shortcut-scope]")) {
      return KeyboardLayer.PANEL;
    }

    return KeyboardLayer.GLOBAL;
  }

  /**
   * Get current keyboard mode for status bar display.
   */
  getCurrentMode(): KeyboardMode {
    const layer = this.getActiveLayer();

    switch (layer) {
      case KeyboardLayer.MODAL:
        return "COMMAND";
      case KeyboardLayer.INPUT: {
        const activeElement = document.activeElement;
        if (activeElement?.closest("[data-search-input]")) {
          return "SEARCH";
        }
        return "INPUT";
      }
      default:
        return "NORMAL";
    }
  }

  /**
   * Check if a shortcut should be allowed at the current layer.
   *
   * - Single character keys (j, k, g, :, ?, etc.) are blocked at Layer 3+
   * - Ctrl/Cmd+key shortcuts pass through Layer 3 (for panel switching from editor/terminal)
   * - Everything is blocked at Layer 4 except Escape
   */
  shouldAllowShortcut(event: KeyboardEvent, hasModifier: boolean): boolean {
    const layer = this.getActiveLayer();

    // Layer 4 (Modal): only Escape passes through
    if (layer === KeyboardLayer.MODAL) {
      return event.code === "Escape";
    }

    // Layer 3 (Input): block single-char keys, allow modifier combos
    if (layer === KeyboardLayer.INPUT) {
      if (event.code === "Escape") {
        return true;
      }
      // Function keys (F1-F12) pass through — they are not text input
      if (/^F([1-9]|1[0-2])$/.test(event.code)) {
        return true;
      }
      // Ctrl/Cmd+key combinations pass through (e.g., Ctrl+1/2/3 for panel switching)
      return hasModifier;
    }

    return true;
  }

  private isModalActive(): boolean {
    // Shadcn Dialog content (real modal dialogs — data-slot added by shadcn components)
    if (document.querySelector("[data-slot='dialog-content']")) return true;
    // Shadcn AlertDialog content (confirmation dialogs)
    if (document.querySelector("[data-slot='alert-dialog-content']")) return true;
    // cmdk dialog (exclude inline command palette)
    if (document.querySelector("[cmdk-root]:not([data-inline='true'])")) return true;

    return false;
  }

  private isInputActive(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();

    // Standard form inputs
    if (tagName === "input" || tagName === "textarea") {
      return true;
    }

    // Content editable elements
    if (element.getAttribute("contenteditable") === "true") {
      return true;
    }

    // Monaco editor
    if (element.closest(".monaco-editor")) {
      return true;
    }

    // Terminal (xterm)
    if (element.closest(".xterm")) {
      return true;
    }

    // React Select input
    if (element.closest(".react-select__input")) {
      return true;
    }

    return false;
  }
}
