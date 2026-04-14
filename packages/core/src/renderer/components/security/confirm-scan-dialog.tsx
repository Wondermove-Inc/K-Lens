/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Purpose: Reusable confirmation dialog for scan-related actions
 * @packageDocumentation
 */

import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ConfirmScanDialogProps {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmScanDialog: React.FC<ConfirmScanDialogProps> = ({
  open,
  title,
  description,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background shadow-xl p-6 mx-4">
        <h2 className="text-base font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
        {detail && (
          <p className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 mb-4 text-muted-foreground break-all">
            {detail}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
ConfirmScanDialog.displayName = "ConfirmScanDialog";
