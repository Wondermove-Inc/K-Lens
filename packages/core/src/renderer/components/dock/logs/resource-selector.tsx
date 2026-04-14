/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./resource-selector.scss";

// 🎯 shadcn UI 컴포넌트: 레거시 Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../../shadcn-ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../shadcn-ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../shadcn-ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";
import { ALL_CONTAINERS } from "./tab-store";

import type { Container, Pod } from "@skuberplus/kube-object";

import type { LogTabViewModel } from "./logs-view-model";

export interface LogResourceSelectorProps {
  model: LogTabViewModel;
}

export const LogResourceSelector = observer(({ model }: LogResourceSelectorProps) => {
  const tabData = model.logTabData.get();
  const [podOpen, setPodOpen] = React.useState(false);
  const [containerOpen, setContainerOpen] = React.useState(false);

  if (!tabData) {
    return null;
  }

  const { selectedContainer, owner } = tabData;
  const pods = model.pods.get();
  const pod = model.pod.get();

  if (!pod) {
    return null;
  }

  const podOptions = pods.map((item) => ({
    value: item,
    label: item.getName(),
  }));
  const allContainers = pod.getAllContainers();
  const isAllContainers = selectedContainer === ALL_CONTAINERS;
  const container = isAllContainers ? null : (allContainers.find((item) => item.name === selectedContainer) ?? null);

  /**
   * 🎯 목적: 컨테이너 선택 시 로그 대상 업데이트
   */
  const onContainerChange = (selected: Container) => {
    model.updateLogTabData({
      selectedContainer: selected.name,
    });
    model.reloadLogs();
    setContainerOpen(false);
  };

  const onAllContainersSelect = () => {
    model.updateLogTabData({
      selectedContainer: ALL_CONTAINERS,
    });
    model.reloadLogs();
    setContainerOpen(false);
  };

  /**
   * 🎯 목적: Pod 선택 시 로그 대상 및 탭 이름 동기화
   */
  const onPodChange = (selected: Pod) => {
    model.updateLogTabData({
      selectedPodId: selected.getId(),
      selectedContainer: isAllContainers ? ALL_CONTAINERS : (selected.getAllContainers()[0]?.name ?? ""),
    });
    model.renameTab(`Pod ${selected.getName()}`);
    model.reloadLogs();
    setPodOpen(false);
  };

  const containerGroups = [
    {
      label: "Containers",
      items: pod.getContainers(),
    },
    {
      label: "Init Containers",
      items: pod.getInitContainers(),
    },
  ];

  return (
    <div className="LogResourceSelector flex gaps align-center">
      <span>Namespace</span>{" "}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" data-testid="namespace-badge" className="max-w-[120px]">
            <span className="truncate">{pod.getNs()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{pod.getNs()}</TooltipContent>
      </Tooltip>
      {owner && (
        <>
          <span>Owner</span>{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" data-testid="owner-badge" className="max-w-[200px]">
                <span className="truncate">{`${owner.kind} ${owner.name}`}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent sideOffset={4}>{`${owner.kind} ${owner.name}`}</TooltipContent>
          </Tooltip>
        </>
      )}
      <span>Pod</span>
      <Popover open={podOpen} onOpenChange={setPodOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={podOpen}
            aria-label="Pod"
            data-testid="pod-selector"
            className="w-[180px] justify-between"
          >
            <span className="truncate">{pod ? pod.getName() : "Select pod..."}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 PodLogsPopoverContent z-[150]"
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command>
            <CommandInput placeholder="Search pod..." />
            <CommandList>
              <CommandEmpty>No pod found.</CommandEmpty>
              <CommandGroup>
                {podOptions.map((option) => (
                  <CommandItem
                    key={option.value.getId()}
                    value={option.label}
                    onSelect={() => onPodChange(option.value)}
                  >
                    <span>{option.label}</span>
                    <Check
                      className={cn(
                        "ml-auto size-4",
                        option.value.getId() === pod.getId() ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <span>Container</span>
      <Popover open={containerOpen} onOpenChange={setContainerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={containerOpen}
            aria-label="Container"
            data-testid="container-selector"
            className="w-[200px] justify-between"
          >
            <span className="truncate">
              {isAllContainers ? "All Containers" : (container?.name ?? "Select container...")}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 PodLogsPopoverContent z-[150]"
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command>
            <CommandInput placeholder="Search container..." />
            <CommandList>
              <CommandEmpty>No container found.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="all-containers" onSelect={onAllContainersSelect}>
                  <span>All Containers</span>
                  <Check className={cn("ml-auto size-4", isAllContainers ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              {containerGroups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem key={item.name} value={item.name} onSelect={() => onContainerChange(item)}>
                      <span>{item.name}</span>
                      <Check
                        className={cn(
                          "ml-auto size-4",
                          !isAllContainers && item.name === container?.name ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
});
