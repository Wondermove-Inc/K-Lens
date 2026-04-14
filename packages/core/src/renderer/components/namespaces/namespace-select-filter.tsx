/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./namespace-select-filter.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { components } from "react-select";
import { Select } from "../select";
import namespaceSelectFilterModelInjectable from "./namespace-select-filter-model/namespace-select-filter-model.injectable";
import namespaceStoreInjectable from "./store.injectable";

import type { PlaceholderProps } from "react-select";

import type {
  NamespaceSelectFilterModel,
  NamespaceSelectFilterOption,
  SelectAllNamespaces,
} from "./namespace-select-filter-model/namespace-select-filter-model";
import type { NamespaceStore } from "./store";

interface NamespaceSelectFilterProps {
  id: string;
}

interface Dependencies {
  model: NamespaceSelectFilterModel;
}

const NonInjectedNamespaceSelectFilter = observer(({ model, id }: Dependencies & NamespaceSelectFilterProps) => (
  <div
    onKeyUp={model.onKeyUp}
    onKeyDown={model.onKeyDown}
    onClick={model.onClick}
    className="NamespaceSelectFilterParent"
    data-testid="namespace-select-filter"
  >
    <Select<string | SelectAllNamespaces, NamespaceSelectFilterOption, true>
      id={id}
      isMulti={true}
      isClearable={false}
      menuIsOpen={model.menu.isOpen.get()}
      components={{ Placeholder }}
      closeMenuOnSelect={false}
      controlShouldRenderValue={false}
      value={model.selectedValues.get() as any}
      onChange={model.onChange}
      onBlur={model.reset}
      formatOptionLabel={model.formatOptionLabel}
      options={model.options.get() as any}
      className="NamespaceSelect NamespaceSelectFilter"
      menuClass="NamespaceSelectFilterMenu"
      isOptionSelected={model.isOptionSelected}
      hideSelectedOptions={false}
    />
  </div>
));

export const NamespaceSelectFilter = withInjectables<Dependencies, NamespaceSelectFilterProps>(
  NonInjectedNamespaceSelectFilter,
  {
    getProps: (di, props) => ({
      model: di.inject(namespaceSelectFilterModelInjectable),
      ...props,
    }),
  },
);

export interface CustomPlaceholderProps extends PlaceholderProps<NamespaceSelectFilterOption, true> {}

interface PlaceholderDependencies {
  namespaceStore: NamespaceStore;
}

/**
 * 🎯 목적: 네임스페이스 셀렉터 Placeholder 표시
 *
 * 📝 주의사항:
 *   - selectedNames.size로 실제 선택된 개수 확인
 *   - contextNamespaces는 사용하지 않음 (모든 네임스페이스 반환할 수 있음)
 *   - MobX observer로 storage 변경 시 즉시 재렌더링
 *   - ⚠️ MobX 반응성 추적을 위해 render 최상위에서 observable 읽기 필수
 *
 * 🔄 변경이력:
 *   - 2025-11-03: selectedNames.size 기반으로 변경 (정확한 선택 상태 반영)
 *   - 2025-11-03: MobX 반응성 수정 (render 최상위에서 observable 직접 읽기)
 */
const NonInjectedPlaceholder = observer(
  ({ namespaceStore, ...props }: CustomPlaceholderProps & PlaceholderDependencies) => {
    // 🔥 중요: MobX 반응성 추적을 위해 render 최상위에서 observable 읽기
    const selectedCount = namespaceStore.selectedNames.size;
    const selectedNamespaces = Array.from(namespaceStore.selectedNames);

    // "All namespaces" 선택 (storage가 빈 배열)
    if (selectedCount === 0) {
      return <components.Placeholder {...props}>All namespaces</components.Placeholder>;
    }

    // 선택된 네임스페이스 목록 표시
    const prefix = selectedCount === 1 ? "Namespace" : "Namespaces";
    const placeholderText = `${prefix}: ${selectedNamespaces.join(", ")}`;

    return <components.Placeholder {...props}>{placeholderText}</components.Placeholder>;
  },
);

const Placeholder = withInjectables<PlaceholderDependencies, CustomPlaceholderProps>(NonInjectedPlaceholder, {
  getProps: (di, props) => ({
    namespaceStore: di.inject(namespaceStoreInjectable),
    ...props,
  }),
});
