/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { iter } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { useCallback, useState } from "react";
import { isKubernetesCluster } from "../../../common/catalog-entities/kubernetes-cluster";
import { broadcastMessage } from "../../../common/ipc";
import { IpcRendererNavigationEvents } from "../../../common/ipc/navigation-events";
import { getAllResourceEntries } from "../../../common/k8s-resources/resource-abbreviations";
import activeEntityInjectable from "../../api/catalog/entity/active.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import navigateInjectable from "../../navigation/navigate.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import namespaceStoreInjectable from "../namespaces/store.injectable";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../shadcn-ui/command";
import commandOverlayInjectable from "./command-overlay.injectable";
import registeredCommandsInjectable from "./registered-commands/registered-commands.injectable";

import type { IComputedValue } from "mobx";

import type { CatalogEntity } from "../../../common/catalog";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { Navigate } from "../../navigation/navigate.injectable";
import type { CreateMainTab } from "../main-tabs/create-main-tab.injectable";
import type { NamespaceStore } from "../namespaces/store";
import type { RegisteredCommand } from "./registered-commands/commands";

interface Dependencies {
  commands: IComputedValue<Map<string, RegisteredCommand>>;
  activeEntity: IComputedValue<CatalogEntity | undefined>;
  closeCommandOverlay: () => void;
  navigate: Navigate;
  createMainTab: CreateMainTab;
  catalogEntityRegistry: CatalogEntityRegistry;
  namespaceStore: NamespaceStore;
}

const NonInjectedCommandDialog = observer(
  ({
    commands,
    activeEntity,
    closeCommandOverlay,
    navigate,
    createMainTab,
    catalogEntityRegistry,
    namespaceStore,
    initialValue = "",
  }: Dependencies & { initialValue?: string }) => {
    const [searchValue, setSearchValue] = useState(initialValue);
    const entity = activeEntity.get();

    if (!entity) {
      return null;
    }

    const context = { entity };

    const executeCommand = useCallback(
      (command: RegisteredCommand) => {
        try {
          closeCommandOverlay();
          command.action({
            ...context,
            navigate: (url, opts = {}) => {
              const { forceRootFrame = false } = opts;

              if (forceRootFrame) {
                broadcastMessage(IpcRendererNavigationEvents.NAVIGATE_IN_APP, url);
              } else {
                navigate(url);
              }
            },
          });
        } catch (error) {
          console.error("[COMMAND-DIALOG] failed to execute command", command.id, error);
        }
      },
      [context, closeCommandOverlay, navigate],
    );

    const activeCommands = iter
      .chain(commands.get().values())
      .filter((command) => {
        try {
          return command.isActive(context);
        } catch (error) {
          return void console.error(
            `[COMMAND-DIALOG]: isActive for ${command.id} threw an error, defaulting to false`,
            error,
          );
        }
      })
      .collect((items) => Array.from(items));

    // Group commands by category prefix (e.g., "Cluster:", "Hotbar:", etc.)
    const actionCommands = activeCommands.filter((cmd) => !cmd.id.startsWith("cluster.view"));
    const viewCommands = activeCommands.filter((cmd) => cmd.id.startsWith("cluster.view"));

    // Resource abbreviation entries for k9s-style navigation
    const resourceEntries = getAllResourceEntries();

    // Check if we're in command mode (started with `:`)
    const isCommandMode = searchValue.startsWith(":");

    // Parse command mode input for special commands and NS arguments
    // e.g., ":ctx", ":ns", ":pod my-ns"
    const commandText = isCommandMode ? searchValue.slice(1).trim() : "";
    const commandParts = commandText.split(/\s+/);
    const commandName = commandParts[0]?.toLowerCase() ?? "";
    const commandArg = commandParts.slice(1).join(" ");

    // Special mode: `:ctx` shows cluster list
    const isCtxMode = isCommandMode && (commandName === "ctx" || commandName === "context");
    // Special mode: `:ns` shows namespace switcher alongside resources
    const showNsSwitcher = isCommandMode && commandName === "ns";

    // Derive command mode key to force cmdk re-mount on mode transitions
    const commandMode = isCtxMode ? "ctx" : isCommandMode ? "cmd" : "default";

    // Get cluster entities for :ctx mode
    const clusterEntities = isCtxMode ? catalogEntityRegistry.items.get().filter(isKubernetesCluster) : [];

    // Get available namespaces for :ns mode
    const availableNamespaces = showNsSwitcher ? namespaceStore.allowedNamespaces : [];

    /** Navigate to resource view via tab system, optionally selecting a namespace first */
    const navigateToResource = useCallback(
      (routePath: string, title: string, nsArg?: string) => {
        closeCommandOverlay();
        if (nsArg) {
          namespaceStore.selectNamespaces(nsArg);
        }
        createMainTab({ title, route: routePath });
      },
      [closeCommandOverlay, namespaceStore, createMainTab],
    );

    return (
      <Command
        key={commandMode}
        shouldFilter={true}
        filter={(value, search) => {
          if (!search.startsWith(":")) {
            // Default mode: fuzzy sequential character matching
            const v = value.toLowerCase();
            const s = search.toLowerCase();
            let si = 0;

            for (let vi = 0; vi < v.length && si < s.length; vi++) {
              if (v[vi] === s[si]) si++;
            }

            return si === s.length ? 1 : 0;
          }

          // Command mode: parse text after `:`
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
        }}
      >
        <CommandInput
          autoFocus
          placeholder={
            isCtxMode
              ? "Select cluster context..."
              : isCommandMode
                ? "Type resource name (e.g., pod, deploy, svc)..."
                : "Type a command or search..."
          }
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* :ctx mode — Cluster/Context list */}
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

          {/* Resource Navigation (k9s-style) - shown in command mode (not :ctx) */}
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
          {showNsSwitcher && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Switch Namespace">
                <CommandItem
                  key="ns-all"
                  value="ns-switch:All Namespaces"
                  onSelect={() => {
                    closeCommandOverlay();
                    namespaceStore.selectNamespaces([]);
                  }}
                >
                  <span className={namespaceStore.areAllSelectedImplicitly ? "font-bold" : ""}>All Namespaces</span>
                  {namespaceStore.areAllSelectedImplicitly && <CommandShortcut>active</CommandShortcut>}
                </CommandItem>
                {availableNamespaces.map((ns) => {
                  const isSelected = namespaceStore.selectedNames.has(ns);

                  return (
                    <CommandItem
                      key={`ns-${ns}`}
                      value={`ns-switch:${ns}`}
                      onSelect={() => {
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

          {/* Default mode: show views and actions */}
          {!isCommandMode && (
            <>
              {/* Resource Navigation also shown when no search */}
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

              {/* View Commands */}
              {viewCommands.length > 0 && (
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
                            ({ mapping }) => commandSuffix === mapping.displayName.toLowerCase().replace(/\s+/g, ""),
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

              {/* Action Commands */}
              {actionCommands.length > 0 && (
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
      </Command>
    );
  },
);

export const CommandDialog = withInjectables<Dependencies>(NonInjectedCommandDialog, {
  getProps: (di) => ({
    commands: di.inject(registeredCommandsInjectable),
    activeEntity: di.inject(activeEntityInjectable),
    closeCommandOverlay: di.inject(commandOverlayInjectable).close,
    navigate: di.inject(navigateInjectable),
    createMainTab: di.inject(createMainTabInjectable),
    catalogEntityRegistry: di.inject(catalogEntityRegistryInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
  }),
});
