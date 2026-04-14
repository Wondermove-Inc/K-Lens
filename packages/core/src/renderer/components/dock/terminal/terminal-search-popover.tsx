/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ArrowDown, ArrowUp, CaseSensitive, Regex, WholeWord, X } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import { Button } from "../../shadcn-ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../shadcn-ui/input-group";
import { Popover, PopoverAnchor, PopoverContent } from "../../shadcn-ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";

import type { Terminal } from "./terminal";

export const SEARCH_TOOLBAR_WIDTH = 470;

export const TerminalSearchContent = observer(({ terminal }: { terminal: Terminal }) => {
  const resultsLabel = terminal.searchError ?? terminal.searchStatus;
  const hasTerm = terminal.searchTerm.trim().length > 0;
  const canNavigate = terminal.matchCount > 0 && !terminal.searchError;
  const disableNext = !hasTerm || Boolean(terminal.searchError);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      terminal.performSearch(event.shiftKey ? "prev" : "next");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      terminal.closeSearch();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      terminal.navigateSearchHistory("prev");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      terminal.navigateSearchHistory("next");
    }
  };

  return (
    <div
      className={cn(
        "bg-background flex items-center gap-2 rounded-r-lg border py-1.5 pr-2 pl-2.5 shadow-sm",
        terminal.searchError && "ring-1 ring-destructive/50",
      )}
      style={{ width: `${SEARCH_TOOLBAR_WIDTH}px` }}
    >
      <InputGroup style={{ width: "var(--input-group-width, 300px)" }}>
        <InputGroupInput
          placeholder="Find (↑↓ for history)"
          className="text-sm"
          value={terminal.searchTerm}
          autoFocus
          onChange={(event) => terminal.setSearchTerm(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <InputGroupAddon align="inline-end" className="gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton
                variant="ghost"
                size="icon-xs"
                aria-pressed={terminal.matchCase}
                onClick={() => terminal.toggleMatchCase()}
                className={cn(
                  terminal.matchCase
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <CaseSensitive className="h-4 w-4" />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <p>Match Case</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton
                variant="ghost"
                size="icon-xs"
                aria-pressed={terminal.matchWholeWord}
                onClick={() => terminal.toggleMatchWholeWord()}
                className={cn(
                  terminal.matchWholeWord
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <WholeWord className="h-4 w-4" />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <p>Match Whole Word</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton
                variant="ghost"
                size="icon-xs"
                aria-pressed={terminal.useRegex}
                onClick={() => terminal.toggleUseRegex()}
                className={cn(
                  terminal.useRegex
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <Regex className="h-4 w-4" />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <p>Use Regular Expression</p>
            </TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>

      <div
        className={cn(
          "w-[74px] text-sm whitespace-nowrap text-right",
          terminal.searchError ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {resultsLabel}
      </div>

      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canNavigate}
          className="h-8 w-8 p-0 opacity-50 hover:opacity-100"
          onClick={() => terminal.performSearch("prev")}
          title="Previous match"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disableNext}
          className="h-8 w-8 p-0 opacity-50 hover:opacity-100"
          onClick={() => terminal.performSearch("next")}
          title="Next match"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => terminal.closeSearch()}
          title="Close search"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export const TerminalSearchPopover = observer(({ terminal }: { terminal: Terminal }) => {
  const [controlsContainer, setControlsContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const element = document.querySelector<HTMLElement>(".Dock .controls-buttons");
    setControlsContainer(element);
  }, [terminal.searchOpen]);

  const anchorNode = (
    <PopoverAnchor asChild>
      <div className="dock-search-toolbar-anchor" aria-hidden />
    </PopoverAnchor>
  );

  return (
    <Popover open={terminal.searchOpen} modal={false}>
      {controlsContainer ? createPortal(anchorNode, controlsContainer) : anchorNode}
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        collisionPadding={16}
        className="border-0 bg-transparent p-0 shadow-none"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <TerminalSearchContent terminal={terminal} />
      </PopoverContent>
    </Popover>
  );
});
