/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ChevronDownIcon } from "lucide-react";
import React, { useState } from "react";
import { act } from "react-dom/test-utils";
import { Button } from "../../shadcn-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../shadcn-ui/dropdown-menu";

interface DownloadLogsDropdownProps {
  downloadVisibleLogs: () => void;
  downloadAllLogs: () => Promise<void> | undefined;
  disabled?: boolean;
}

export function DownloadLogsDropdown({ downloadAllLogs, downloadVisibleLogs, disabled }: DownloadLogsDropdownProps) {
  const [waiting, setWaiting] = useState(false);

  const downloadAll = async () => {
    setWaiting(true);

    try {
      await act(async () => {
        await downloadAllLogs();
      });
    } finally {
      setWaiting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="download-logs-dropdown"
          disabled={waiting || disabled}
          className="gap-1.5"
        >
          Download
          <ChevronDownIcon className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="PodLogsDropdownContent z-[150]">
        <DropdownMenuItem onClick={downloadVisibleLogs} data-testid="download-visible-logs">
          Visible logs
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadAll} data-testid="download-all-logs">
          All logs
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
