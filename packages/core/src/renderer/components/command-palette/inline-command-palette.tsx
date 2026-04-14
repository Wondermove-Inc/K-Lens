/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import { iter } from "@skuberplus/utilities";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isKubernetesCluster } from "../../../common/catalog-entities/kubernetes-cluster";
import { broadcastMessage } from "../../../common/ipc";
import { IpcRendererNavigationEvents } from "../../../common/ipc/navigation-events";
import { getAllResourceEntries } from "../../../common/k8s-resources/resource-abbreviations";
import activeEntityInjectable from "../../api/catalog/entity/active.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import { cn } from "../../lib/utils";
import { Kbd } from "../kbd/kbd";
import namespaceStoreInjectable from "../namespaces/store.injectable";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../shadcn-ui/command";
import { InputGroup, InputGroupAddon } from "../shadcn-ui/input-group";
import commandOverlayInjectable from "./command-overlay.injectable";
import styles from "./inline-command-palette.module.scss";
import inlineCommandPaletteStoreInjectable from "./inline-command-palette-store.injectable";
import registeredCommandsInjectable from "./registered-commands/registered-commands.injectable";

import type { IComputedValue } from "mobx";

import type { CatalogEntity } from "../../../common/catalog";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { NamespaceStore } from "../namespaces/store";
import type { InlineCommandPaletteStore } from "./inline-command-palette-store.injectable";
import type { RegisteredCommand } from "./registered-commands/commands";

interface Dependencies {
  commands: IComputedValue<Map<string, RegisteredCommand>>;
  activeEntity: IComputedValue<CatalogEntity | undefined>;
  closeCommandOverlay: () => void;
  catalogEntityRegistry: CatalogEntityRegistry;
  namespaceStore: NamespaceStore | null;
  store: InlineCommandPaletteStore;
}

const NonInjectedInlineCommandPalette = observer(
  ({ commands, activeEntity, closeCommandOverlay, catalogEntityRegistry, namespaceStore, store }: Dependencies) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

    // Register input element with store
    useEffect(() => {
      const el = inputRef.current;

      if (el) {
        store.setInputElement(el);
      }

      return () => store.setInputElement(null);
    }, [store]);

    // Calculate dropdown position when open
    useEffect(() => {
      if (store.isDropdownOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();

        setDropdownRect(rect);
      }
    }, [store.isDropdownOpen]);

    // Close on outside click
    useEffect(() => {
      if (!store.isDropdownOpen) return;

      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node;

        if (containerRef.current?.contains(target)) return;

        // Check portal dropdown
        const portalEl = document.getElementById("inline-command-dropdown");

        if (portalEl?.contains(target)) return;

        store.closeDropdown();
      };

      document.addEventListener("mousedown", handleClick);

      return () => document.removeEventListener("mousedown", handleClick);
    }, [store, store.isDropdownOpen]);

    // Close on Escape
    useEffect(() => {
      if (!store.isDropdownOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          store.closeDropdown();
        }
      };

      document.addEventListener("keydown", handleKeyDown, true);

      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [store, store.isDropdownOpen]);

    const entity = activeEntity.get();
    const searchValue = store.searchValue;

    const context = entity ? { entity } : null;

    const executeCommand = useCallback(
      (command: RegisteredCommand) => {
        if (!context) return;

        try {
          store.closeDropdown();
          closeCommandOverlay();
          command.action({
            ...context,
            navigate: (url, opts = {}) => {
              const { forceRootFrame = false } = opts;

              if (forceRootFrame) {
                broadcastMessage(IpcRendererNavigationEvents.NAVIGATE_IN_APP, url);
              } else {
                // Send to cluster frame via custom IPC channel
                broadcastMessage("inline-command-palette:navigate", url);
              }
            },
          });
        } catch (error) {
          console.error("[INLINE-COMMAND-PALETTE] failed to execute command", command.id, error);
        }
      },
      [context, closeCommandOverlay, store],
    );

    const navigateToResource = useCallback(
      (routePath: string, title: string, _nsArg?: string) => {
        store.closeDropdown();
        closeCommandOverlay();
        // Resource routes (/pods, /deployments, etc.) are cluster-frame routes.
        // Send to cluster frame via custom IPC channel (same pattern as focus).
        // Cluster frame calls createMainTab({ title, route }) which creates tab + navigates.
        broadcastMessage("inline-command-palette:navigate", routePath, title);
      },
      [store, closeCommandOverlay],
    );

    const isCommandMode = searchValue.startsWith(":");
    const commandText = isCommandMode ? searchValue.slice(1).trim() : "";
    const commandParts = commandText.split(/\s+/);
    const commandName = commandParts[0]?.toLowerCase() ?? "";
    const commandArg = commandParts.slice(1).join(" ");

    const isCtxMode = isCommandMode && (commandName === "ctx" || commandName === "context");
    const showNsSwitcher = isCommandMode && commandName === "ns" && !!namespaceStore;

    const clusterEntities = isCtxMode ? catalogEntityRegistry.items.get().filter(isKubernetesCluster) : [];

    const availableNamespaces = showNsSwitcher && namespaceStore ? namespaceStore.allowedNamespaces : [];

    const resourceEntries = getAllResourceEntries();

    const activeCommands = context
      ? iter
          .chain(commands.get().values())
          .filter((command) => {
            try {
              return command.isActive(context);
            } catch (error) {
              return void console.error(
                `[INLINE-COMMAND-PALETTE]: isActive for ${command.id} threw an error, defaulting to false`,
                error,
              );
            }
          })
          .collect((items) => Array.from(items))
      : [];

    const actionCommands = activeCommands.filter((cmd) => !cmd.id.startsWith("cluster.view"));
    const viewCommands = activeCommands.filter((cmd) => cmd.id.startsWith("cluster.view"));

    const handleFocus = () => {
      store.openDropdown();
    };

    const placeholder = isCtxMode
      ? "Select cluster context..."
      : isCommandMode
        ? "Type resource name (e.g., pod, deploy, svc)..."
        : "Type a command or search...";

    // Custom filter for cmdk
    const cmdkFilter = useCallback((value: string, search: string) => {
      if (!search.startsWith(":")) {
        const v = value.toLowerCase();
        const s = search.toLowerCase();
        let si = 0;

        for (let vi = 0; vi < v.length && si < s.length; vi++) {
          if (v[vi] === s[si]) si++;
        }

        return si === s.length ? 1 : 0;
      }

      const parts = search.slice(1).trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase() ?? "";
      const arg = parts.slice(1).join(" ").toLowerCase();

      // :ctx / :context — existing logic
      if (cmd === "ctx" || cmd === "context") {
        if (!arg) return 1;

        return value.toLowerCase().includes(arg) ? 1 : 0;
      }

      // :ns — dual purpose: resource navigation + namespace switching
      if (cmd === "ns") {
        // Namespace switcher items (identified by ns-switch: prefix)
        if (value.startsWith("ns-switch:")) {
          if (!arg) return 1;

          return value.toLowerCase().includes(arg) ? 1 : 0;
        }

        // Resource items — token matching against "ns"
        const tokens = value.toLowerCase().split(" ");

        if (tokens.some((t) => t === cmd)) return 1;
        if (tokens.some((t) => t.startsWith(cmd))) return 0.5;

        return 0;
      }

      // Other resource commands (:po, :deploy, etc.) — token-based matching
      const resourceSearch = search.slice(1).trim().toLowerCase();

      if (!resourceSearch) return 1;

      const tokens = value.toLowerCase().split(" ");

      // Exact token match → highest priority
      if (tokens.some((t) => t === resourceSearch)) return 1;
      // Token starts with search → medium priority
      if (tokens.some((t) => t.startsWith(resourceSearch))) return 0.5;

      return 0;
    }, []);

    return (
      <div className={styles.inlineSearchBar} ref={containerRef}>
        <CommandPrimitive data-inline="true" shouldFilter={true} filter={cmdkFilter} className="relative">
          {/* Search bar - always visible */}
          <InputGroup className="h-8 rounded-lg">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <CommandPrimitive.Input
              ref={inputRef}
              value={searchValue}
              onValueChange={(v) => {
                store.setSearchValue(v);
                if (!store.isDropdownOpen) {
                  store.openDropdown();
                }
              }}
              placeholder={placeholder}
              onFocus={handleFocus}
              data-search-input="true"
              className="text-foreground [color:var(--foreground)] placeholder:text-muted-foreground h-8 w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 text-[13px] shadow-none outline-none focus-visible:ring-0"
            />
            {!store.isDropdownOpen && (
              <InputGroupAddon align="inline-end">
                <Kbd>:</Kbd>
              </InputGroupAddon>
            )}
          </InputGroup>

          {/* Dropdown - portaled to body for z-index/overflow */}
          {store.isDropdownOpen &&
            dropdownRect &&
            createPortal(
              <div
                id="inline-command-dropdown"
                className={cn(
                  "fixed z-[9999] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
                  "animate-in fade-in-0 slide-in-from-top-1 duration-150",
                )}
                style={{
                  top: dropdownRect.bottom + 4,
                  left: dropdownRect.left,
                  width: Math.max(dropdownRect.width, 400),
                  maxHeight: 340,
                }}
              >
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>

                  {/* :ctx mode */}
                  {isCtxMode && (
                    <CommandGroup heading="Clusters">
                      {clusterEntities.map((cluster) => {
                        const name = cluster.getName();
                        const id = cluster.getId();
                        const isActive = catalogEntityRegistry.activeEntity?.getId() === id;

                        return (
                          <CommandItem
                            key={id}
                            value={name}
                            onSelect={() => {
                              store.closeDropdown();
                              closeCommandOverlay();
                              broadcastMessage(IpcRendererNavigationEvents.NAVIGATE_IN_APP, `/cluster/${id}`);
                            }}
                          >
                            <span className={isActive ? "font-bold" : ""}>{name}</span>
                            {isActive && <CommandShortcut>active</CommandShortcut>}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}

                  {/* Resource Navigation in command mode */}
                  {isCommandMode && !isCtxMode && (
                    <CommandGroup heading="Resources">
                      {resourceEntries.map(({ abbreviation, mapping }) => (
                        <CommandItem
                          key={`resource-${abbreviation}`}
                          value={[abbreviation, ...mapping.aliases, mapping.displayName].join(" ")}
                          keywords={[abbreviation, ...mapping.aliases]}
                          onSelect={() => {
                            navigateToResource(mapping.routePath, mapping.displayName, commandArg || undefined);
                          }}
                        >
                          <span className="font-medium">{mapping.displayName}</span>
                          <CommandShortcut>{abbreviation}</CommandShortcut>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* :ns mode — namespace switcher */}
                  {showNsSwitcher && namespaceStore && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Switch Namespace">
                        <CommandItem
                          key="ns-all"
                          value="ns-switch:All Namespaces"
                          onSelect={() => {
                            store.closeDropdown();
                            closeCommandOverlay();
                            namespaceStore.selectNamespaces([]);
                          }}
                        >
                          <span className={namespaceStore.areAllSelectedImplicitly ? "font-bold" : ""}>
                            All Namespaces
                          </span>
                          {namespaceStore.areAllSelectedImplicitly && <CommandShortcut>active</CommandShortcut>}
                        </CommandItem>
                        {availableNamespaces.map((ns) => {
                          const isSelected = namespaceStore.selectedNames.has(ns);

                          return (
                            <CommandItem
                              key={`ns-${ns}`}
                              value={`ns-switch:${ns}`}
                              onSelect={() => {
                                store.closeDropdown();
                                closeCommandOverlay();
                                namespaceStore.selectNamespaces(ns);
                              }}
                            >
                              <span className={isSelected ? "font-bold" : ""}>{ns}</span>
                              {isSelected && <CommandShortcut>active</CommandShortcut>}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}

                  {/* Default mode */}
                  {!isCommandMode && (
                    <>
                      {!searchValue && (
                        <CommandGroup heading="Resources">
                          {resourceEntries.map(({ abbreviation, mapping }) => (
                            <CommandItem
                              key={`resource-default-${abbreviation}`}
                              value={[abbreviation, ...mapping.aliases, mapping.displayName].join(" ")}
                              keywords={[abbreviation, ...mapping.aliases]}
                              onSelect={() => {
                                navigateToResource(mapping.routePath, mapping.displayName);
                              }}
                            >
                              <span className="font-medium">{mapping.displayName}</span>
                              <CommandShortcut>{abbreviation}</CommandShortcut>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      <CommandSeparator />

                      {context && viewCommands.length > 0 && (
                        <CommandGroup heading="Views">
                          {viewCommands.map((command) => {
                            const title = typeof command.title === "string" ? command.title : command.title(context);

                            return (
                              <CommandItem
                                key={command.id}
                                value={title}
                                onSelect={() => {
                                  const commandSuffix = command.id.replace("cluster.view", "").toLowerCase();
                                  const matchingResource = resourceEntries.find(
                                    ({ mapping }) =>
                                      commandSuffix === mapping.displayName.toLowerCase().replace(/\s+/g, ""),
                                  );

                                  if (matchingResource) {
                                    navigateToResource(
                                      matchingResource.mapping.routePath,
                                      matchingResource.mapping.displayName,
                                    );
                                  } else {
                                    executeCommand(command);
                                  }
                                }}
                              >
                                {title}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}

                      {context && actionCommands.length > 0 && (
                        <CommandGroup heading="Actions">
                          {actionCommands.map((command) => {
                            const title = typeof command.title === "string" ? command.title : command.title(context);

                            return (
                              <CommandItem key={command.id} value={title} onSelect={() => executeCommand(command)}>
                                {title}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </div>,
              document.body,
            )}
        </CommandPrimitive>
      </div>
    );
  },
);

export const InlineCommandPalette = withInjectables<Dependencies>(NonInjectedInlineCommandPalette, {
  getProps: (di) => {
    const canCreateStores = di.inject(storesAndApisCanBeCreatedInjectionToken);

    return {
      commands: di.inject(registeredCommandsInjectable),
      activeEntity: di.inject(activeEntityInjectable),
      closeCommandOverlay: di.inject(commandOverlayInjectable).close,
      catalogEntityRegistry: di.inject(catalogEntityRegistryInjectable),
      namespaceStore: canCreateStores ? di.inject(namespaceStoreInjectable) : null,
      store: di.inject(inlineCommandPaletteStoreInjectable),
    };
  },
});
