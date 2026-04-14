/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../shadcn-ui/dialog";

export interface KeyboardHelpOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["j", "\u2193"], description: "Move down" },
      { keys: ["k", "\u2191"], description: "Move up" },
      { keys: ["g"], description: "Go to first row" },
      { keys: ["G"], description: "Go to last row" },
      { keys: ["Ctrl+F"], description: "Page forward" },
      { keys: ["Ctrl+B"], description: "Page backward" },
      { keys: ["Enter"], description: "Open details" },
      { keys: ["Escape"], description: "Close / Go back" },
      { keys: ["Space"], description: "Toggle selection" },
    ],
  },
  {
    title: "Commands",
    shortcuts: [
      { keys: [":"], description: "Command mode (resource navigation)" },
      { keys: [":ctx"], description: "Switch cluster context" },
      { keys: [":ns"], description: "Switch namespace" },
      { keys: ["/"], description: "Search / Filter" },
      { keys: ["?"], description: "Show this help" },
    ],
  },
  {
    title: "Resource Actions",
    shortcuts: [
      { keys: ["c"], description: "Copy resource name" },
      { keys: ["n"], description: "Copy namespace" },
      { keys: ["e"], description: "Edit (YAML editor)" },
      { keys: ["l"], description: "Logs (Pods only)" },
      { keys: ["Shift+L"], description: "Logs in new window (Pods only)" },
      { keys: ["s"], description: "Shell (Pods) / Scale (Deploy/STS)" },
      { keys: ["a"], description: "Attach (Pods only)" },
      { keys: ["Shift+F"], description: "Port forward" },
    ],
  },
  {
    title: "Dock",
    shortcuts: [
      { keys: ["Ctrl+`"], description: "Toggle dock" },
      { keys: ["Ctrl+Tab"], description: "Cycle dock tabs" },
      { keys: ["F6"], description: "Cycle focus (content \u2194 dock)" },
    ],
  },
  {
    title: "Namespace",
    shortcuts: [
      { keys: ["0"], description: "All namespaces" },
      { keys: ["1-3"], description: "Favorite namespace slot" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardHelpOverlay({ open, onOpenChange }: KeyboardHelpOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>k9s-style keyboard shortcuts for fast navigation</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground mb-2">{group.title}</h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.description} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          {i > 0 && <span className="text-muted-foreground text-xs">/</span>}
                          <Kbd>{key}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Shortcuts are disabled when typing in inputs, editors, or terminals. Press <Kbd>Escape</Kbd> to close.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
