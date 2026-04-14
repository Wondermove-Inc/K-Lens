/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@skuberplus/icon";
import { observableCrate } from "@skuberplus/utilities";
import { action, comparer, computed, observable } from "mobx";
import React from "react";

import type { IComputedValue } from "mobx";
import type { ActionMeta, MultiValue } from "react-select";

import type { ClusterContext } from "../../../cluster-frame-context/cluster-frame-context";
import type { NamespaceFavoritesStore } from "../../../k9s-shortcuts/namespace-favorites-store.injectable";
import type { SelectOption } from "../../select";
import type { NamespaceStore } from "../store";
import type { IsMultiSelectionKey } from "./is-selection-key.injectable";

interface Dependencies {
  context: ClusterContext;
  namespaceStore: NamespaceStore;
  isMultiSelectionKey: IsMultiSelectionKey;
  favoritesStore: NamespaceFavoritesStore;
}

export const selectAllNamespaces = Symbol("all-namespaces-selected");

export type SelectAllNamespaces = typeof selectAllNamespaces;
export type NamespaceSelectFilterOption = SelectOption<string | SelectAllNamespaces>;

export interface NamespaceSelectFilterModel {
  readonly options: IComputedValue<readonly NamespaceSelectFilterOption[]>;
  readonly selectedValues: IComputedValue<readonly NamespaceSelectFilterOption[]>;
  readonly menu: {
    open: () => void;
    close: () => void;
    readonly isOpen: IComputedValue<boolean>;
  };
  onChange: (
    newValue: MultiValue<NamespaceSelectFilterOption>,
    actionMeta: ActionMeta<NamespaceSelectFilterOption>,
  ) => void;
  onClick: () => void;
  onKeyDown: React.KeyboardEventHandler;
  onKeyUp: React.KeyboardEventHandler;
  reset: () => void;
  isOptionSelected: (option: NamespaceSelectFilterOption) => boolean;
  formatOptionLabel: (option: NamespaceSelectFilterOption) => JSX.Element;
}

enum SelectMenuState {
  Close = "close",
  Open = "open",
}

export function namespaceSelectFilterModelFor(dependencies: Dependencies): NamespaceSelectFilterModel {
  const { isMultiSelectionKey, namespaceStore, context, favoritesStore } = dependencies;

  let didToggle = false;
  let isMultiSelection = false;
  const menuState = observableCrate(SelectMenuState.Close, [
    {
      from: SelectMenuState.Close,
      to: SelectMenuState.Open,
      onTransition: () => {
        optionsSortingSelected.replace(selectedNames.get());
        didToggle = false;
      },
    },
  ]);
  /**
   * 🎯 목적: 실제 선택된 네임스페이스만 추적 (UI 체크 상태용)
   *
   * 📝 주의사항:
   *   - namespaceStore의 selectedNames 직접 사용
   *   - context.contextNamespaces는 "All namespaces" 선택 시 모든 네임스페이스 반환
   *   - selectedNames는 storage의 실제 선택값만 반환 (빈 배열이면 빈 Set)
   *
   * 🔄 변경이력:
   *   - 2025-11-03: namespaceStore.selectedNames 직접 사용으로 변경 (체크 상태 오류 수정)
   */
  const selectedNames = computed(() => namespaceStore.selectedNames, {
    equals: comparer.structural,
  });
  const optionsSortingSelected = observable.set(selectedNames.get());
  const sortNamespacesByIfTheyHaveBeenSelected = (left: string, right: string) => {
    // Favorites first, ordered by digit
    const leftDigit = favoritesStore.getDigitForNamespace(left);
    const rightDigit = favoritesStore.getDigitForNamespace(right);
    const leftIsFav = leftDigit !== undefined;
    const rightIsFav = rightDigit !== undefined;

    if (leftIsFav && rightIsFav) {
      return leftDigit - rightDigit;
    }
    if (leftIsFav !== rightIsFav) {
      return leftIsFav ? -1 : 1;
    }

    // Then selected namespaces
    const isLeftSelected = optionsSortingSelected.has(left);
    const isRightSelected = optionsSortingSelected.has(right);

    if (isLeftSelected === isRightSelected) {
      return 0;
    }

    return isRightSelected ? 1 : -1;
  };
  const options = computed((): readonly NamespaceSelectFilterOption[] => [
    {
      value: selectAllNamespaces,
      label: "All Namespaces",
      id: "all-namespaces",
    },
    ...context.allNamespaces.sort(sortNamespacesByIfTheyHaveBeenSelected).map((namespace) => ({
      value: namespace,
      label: namespace,
      id: namespace,
    })),
  ]);
  const menuIsOpen = computed(() => menuState.get() === SelectMenuState.Open);
  const isOptionSelected: NamespaceSelectFilterModel["isOptionSelected"] = (option) => {
    if (option.value === selectAllNamespaces) {
      return false;
    }

    return selectedNames.get().has(option.value);
  };
  /**
   * 🎯 목적: react-select의 value prop에 전달할 현재 선택된 값들
   *
   * 📝 주의사항:
   *   - "All namespaces" 선택 시 빈 배열 반환 (controlShouldRenderValue=false이므로 Placeholder만 표시)
   *   - 특정 네임스페이스 선택 시 해당 옵션들 반환
   *   - react-select을 제어 컴포넌트로 만들어 외부 상태와 동기화
   *
   * 🔄 변경이력:
   *   - 2025-11-03: 초기 생성 (react-select value prop 누락 문제 수정)
   */
  const selectedValues = computed((): readonly NamespaceSelectFilterOption[] => {
    const selected = selectedNames.get();

    // "All namespaces" 선택 시 빈 배열 반환
    if (selected.size === 0) {
      return [];
    }

    // 선택된 네임스페이스들을 옵션 형태로 변환
    return Array.from(selected).map((namespace) => ({
      value: namespace,
      label: namespace,
      id: namespace,
    }));
  });

  const model: NamespaceSelectFilterModel = {
    options,
    selectedValues,
    menu: {
      close: action(() => {
        menuState.set(SelectMenuState.Close);
      }),
      open: action(() => {
        menuState.set(SelectMenuState.Open);
      }),
      isOpen: menuIsOpen,
    },
    onChange: (_, action) => {
      switch (action.action) {
        case "clear":
          namespaceStore.selectAll();
          break;
        case "deselect-option":
        case "select-option":
          if (action.option) {
            didToggle = true;

            if (action.option.value === selectAllNamespaces) {
              namespaceStore.selectAll();
            } else if (isMultiSelection) {
              namespaceStore.toggleSingle(action.option.value);
            } else {
              namespaceStore.selectSingle(action.option.value);
            }
          }
          break;
      }
    },
    onClick: () => {
      if (!menuIsOpen.get()) {
        model.menu.open();
      } else if (!isMultiSelection) {
        model.menu.close();
      }
    },
    onKeyDown: (event) => {
      if (isMultiSelectionKey(event)) {
        isMultiSelection = true;
      }
    },
    onKeyUp: (event) => {
      if (isMultiSelectionKey(event)) {
        isMultiSelection = false;

        if (didToggle) {
          model.menu.close();
        }
      }
    },
    reset: action(() => {
      isMultiSelection = false;
      model.menu.close();
    }),
    isOptionSelected,
    formatOptionLabel: (option) => {
      if (option.value === selectAllNamespaces) {
        return <>All Namespaces</>;
      }

      const ns = option.value as string;
      const isFav = favoritesStore.isFavorite(ns);
      const digit = favoritesStore.getDigitForNamespace(ns);
      const starDisabled = !isFav && !favoritesStore.canAddFavorite;

      return (
        <div className="flex gaps align-center">
          <Icon
            smallest
            material={isFav ? "star" : "star_border"}
            className={starDisabled ? "dimmed" : ""}
            style={{ cursor: starDisabled ? "not-allowed" : "pointer", color: isFav ? "#facc15" : undefined }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!starDisabled) {
                favoritesStore.toggleFavorite(ns);
              }
            }}
          />
          <Icon small material="layers" />
          <span>{ns}</span>
          {digit !== undefined && (
            <span
              style={{
                marginLeft: 4,
                padding: "0 4px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 600,
                background: "var(--bg-muted, rgba(128,128,128,0.15))",
                color: "var(--text-muted, rgba(255,255,255,0.6))",
              }}
            >
              {digit}
            </span>
          )}
          {isOptionSelected(option) && (
            <Icon
              small
              material="check"
              className="box right"
              data-testid={`namespace-select-filter-option-${option.value}-selected`}
            />
          )}
        </div>
      );
    },
  };

  return model;
}
