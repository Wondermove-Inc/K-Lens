/**
 * Provides DOM focus utilities for panel navigation.
 * Used by toggle-dock shortcut to move focus between contents and dock panels.
 */

export type PanelId = "contents" | "dock";

const PANEL_SELECTORS: Record<PanelId, string> = {
  contents: "[data-panel-id='contents']",
  dock: "[data-panel-id='dock']",
};

export class FocusPanelManager {
  focusContents = () => {
    this.focusPanel("contents");
  };

  focusDock = () => {
    // Focus the active content inside the dock (terminal or editor) directly
    // so the user gets immediate visual feedback (blinking cursor, etc.)
    const dockSelector = PANEL_SELECTORS.dock;
    const activeContent =
      (document.querySelector(`${dockSelector} .xterm-helper-textarea`) as HTMLElement) ??
      (document.querySelector(`${dockSelector} .monaco-editor textarea`) as HTMLElement);

    if (activeContent) {
      activeContent.focus();
      return;
    }

    this.focusPanel("dock");
  };

  getActivePanelId(): PanelId | null {
    const el = document.activeElement?.closest("[data-panel-id]") as HTMLElement | null;
    const id = el?.dataset.panelId;
    return id === "contents" || id === "dock" ? id : null;
  }

  private focusPanel(panel: PanelId) {
    const element = document.querySelector(PANEL_SELECTORS[panel]) as HTMLElement | null;
    element?.focus({ preventScroll: true });
  }
}
