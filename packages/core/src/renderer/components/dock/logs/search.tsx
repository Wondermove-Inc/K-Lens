/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./search.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { observer } from "mobx-react";
import React, { useEffect, useRef } from "react";
import isMacInjectable from "../../../../common/vars/is-mac.injectable";
import { Button } from "../../shadcn-ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../shadcn-ui/input-group";

import type { LogTabViewModel } from "./logs-view-model";

export interface PodLogSearchProps {
  onSearch?: (query: string) => void;
  scrollToOverlay: (lineNumber: number | undefined) => void;
  model: LogTabViewModel;
}

interface Dependencies {
  isMac: boolean;
}

const NonInjectedLogSearch = observer(
  ({
    onSearch,
    scrollToOverlay,
    model: { logTabData, searchStore, ...model },
    isMac,
  }: PodLogSearchProps & Dependencies) => {
    const tabData = logTabData.get();
    const inputRef = useRef<HTMLInputElement>(null);

    if (!tabData) {
      return null;
    }

    const logs = tabData.showTimestamps ? model.logs.get() : model.logsWithoutTimestamps.get();
    const { setNextOverlayActive, setPrevOverlayActive, searchQuery, occurrences, activeFind, totalFinds } =
      searchStore;
    const jumpDisabled = !searchQuery || !occurrences.length;

    const setSearch = (query: string) => {
      searchStore.onSearch(logs, query);
      onSearch?.(query);
      scrollToOverlay(searchStore.activeOverlayLine);
    };

    const onPrevOverlay = () => {
      setPrevOverlayActive();
      scrollToOverlay(searchStore.activeOverlayLine);
    };

    const onNextOverlay = () => {
      setNextOverlayActive();
      scrollToOverlay(searchStore.activeOverlayLine);
    };

    const onClear = () => {
      setSearch("");
    };

    const onKeyDown = (evt: React.KeyboardEvent<any>) => {
      if (evt.key === "Enter") {
        if (evt.shiftKey) {
          onPrevOverlay();
        } else {
          onNextOverlay();
        }
      }

      if (evt.key === "Escape") {
        onClear();
      }
    };

    useEffect(() => {
      // Refresh search when logs changed
      searchStore.onSearch(logs);
    }, [logs]);

    useEffect(() => {
      /**
       * 🎯 목적: Cmd/Ctrl+F로 로그 검색 입력에 포커스 이동
       */
      const onGlobalKey = (evt: KeyboardEvent) => {
        if (evt.key === "f" && (isMac ? evt.metaKey : evt.ctrlKey)) {
          inputRef.current?.focus();
        }
      };

      window.addEventListener("keydown", onGlobalKey);

      return () => {
        window.removeEventListener("keydown", onGlobalKey);
      };
    }, [isMac]);

    return (
      <div className="LogSearch flex box grow justify-flex-end gaps align-center">
        <InputGroup className="min-w-[220px]">
          <InputGroupAddon>
            <Icon small material="search" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            placeholder="Search..."
            value={searchQuery}
            onChange={(event) => setSearch(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          {totalFinds > 0 && <InputGroupAddon className="text-xs">{`${activeFind} / ${totalFinds}`}</InputGroupAddon>}
          {searchQuery && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={onClear} aria-label="Clear search">
                <Icon small material="close" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <Button variant="ghost" size="icon-sm" onClick={onPrevOverlay} disabled={jumpDisabled} aria-label="Previous">
          <Icon material="keyboard_arrow_up" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNextOverlay} disabled={jumpDisabled} aria-label="Next">
          <Icon material="keyboard_arrow_down" />
        </Button>
      </div>
    );
  },
);

export const LogSearch = withInjectables<Dependencies, PodLogSearchProps>(NonInjectedLogSearch, {
  getProps: (di, props) => ({
    ...props,
    isMac: di.inject(isMacInjectable),
  }),
});
