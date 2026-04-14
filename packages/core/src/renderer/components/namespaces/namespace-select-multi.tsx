import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/dropdown-menu";
import { ChevronDown, Star } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import namespaceFavoritesStoreInjectable from "../../k9s-shortcuts/namespace-favorites-store.injectable";
import namespaceStoreInjectable from "./store.injectable";

import type { NamespaceFavoritesStore } from "../../k9s-shortcuts/namespace-favorites-store.injectable";
import type { NamespaceStore } from "./store";

interface NamespaceSelectMultiProps {
  id?: string;
  className?: string;
}

interface Dependencies {
  namespaceStore: NamespaceStore;
  favoritesStore: NamespaceFavoritesStore;
}

const NonInjectedNamespaceSelectMulti = observer(
  ({
    namespaceStore,
    favoritesStore,
    id = "namespace-select-multi",
    className = "",
  }: Dependencies & NamespaceSelectMultiProps) => {
    const selectedNames = Array.from(namespaceStore.selectedNames);
    const totalNamespaces = namespaceStore.allowedNamespaces.length;
    const isAllSelectedImplicit = selectedNames.length === 0;
    const isAllSelectedExplicit = selectedNames.length > 0 && selectedNames.length === totalNamespaces;
    const isAllSelected = isAllSelectedImplicit || isAllSelectedExplicit;
    const selectedCount = selectedNames.length;

    const buttonLabel = React.useMemo(() => {
      if (isAllSelected) {
        return "All Namespaces";
      }

      if (selectedCount === 1) {
        return `Namespace: ${selectedNames[0]}`;
      }

      return `${selectedCount} Namespaces selected`;
    }, [isAllSelected, selectedCount, selectedNames]);

    const handleToggleNamespace = (namespace: string) => {
      const next = new Set(namespaceStore.selectedNames);

      if (isAllSelected) {
        // "All" 상태에서 클릭하면 단일 선택으로 전환
        next.clear();
        next.add(namespace);
      } else {
        if (next.has(namespace)) {
          next.delete(namespace);
        } else {
          next.add(namespace);
        }
      }

      if (next.size === 0 || next.size === totalNamespaces) {
        namespaceStore.selectAll();
      } else {
        namespaceStore.selectNamespaces([...next]);
      }
    };

    // Split namespaces into favorites (ordered by digit) and the rest
    const allowed = namespaceStore.allowedNamespaces;
    const favoritesOrdered = favoritesStore.getFavoritesOrdered().filter((f) => allowed.includes(f.namespace));
    const favoriteNames = new Set(favoritesOrdered.map((f) => f.namespace));
    const nonFavorites = allowed.filter((ns) => !favoriteNames.has(ns));

    const renderNamespaceItem = (ns: string) => {
      const checked = isAllSelected || namespaceStore.selectedNames.has(ns);
      const isFav = favoritesStore.isFavorite(ns);
      const digit = favoritesStore.getDigitForNamespace(ns);
      const starDisabled = !isFav && !favoritesStore.canAddFavorite;

      return (
        <DropdownMenuCheckboxItem
          key={ns}
          checked={checked}
          onSelect={(e) => {
            e.preventDefault();
            handleToggleNamespace(ns);
          }}
        >
          <div className="flex w-full items-center gap-1.5">
            <button
              type="button"
              className={`flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer ${starDisabled ? "opacity-30 cursor-not-allowed" : "opacity-60 hover:opacity-100"}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!starDisabled) {
                  favoritesStore.toggleFavorite(ns);
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
              }}
            >
              <Star className={`h-3.5 w-3.5 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
            </button>
            <span className="flex-1 truncate">{ns}</span>
            {digit !== undefined && (
              <span className="flex-shrink-0 ml-auto inline-flex h-4 w-4 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                {digit}
              </span>
            )}
          </div>
        </DropdownMenuCheckboxItem>
      );
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={`inline-flex h-9 w-full min-w-[180px] max-w-none items-center justify-between gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring dark:bg-input/30 dark:border-input dark:hover:bg-input/50 sm:w-auto ${className}`.trim()}
          >
            {buttonLabel}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[260px]">
          <DropdownMenuCheckboxItem
            checked={isAllSelected}
            className="font-medium"
            onSelect={(e) => {
              e.preventDefault();
              namespaceStore.selectAll();
            }}
          >
            All Namespaces
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          {favoritesOrdered.map((f) => renderNamespaceItem(f.namespace))}
          {favoritesOrdered.length > 0 && nonFavorites.length > 0 && <DropdownMenuSeparator />}
          {nonFavorites.map((ns) => renderNamespaceItem(ns))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

export const NamespaceSelectMulti = withInjectables<Dependencies, NamespaceSelectMultiProps>(
  NonInjectedNamespaceSelectMulti,
  {
    getProps: (di, props) => ({
      namespaceStore: di.inject(namespaceStoreInjectable),
      favoritesStore: di.inject(namespaceFavoritesStoreInjectable),
      ...props,
    }),
  },
);
