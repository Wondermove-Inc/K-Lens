/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ResourceTableLayout을 위한 싱글 셀렉 네임스페이스 필터
 *
 * @remarks
 * - shadcn Select 컴포넌트 기반 네임스페이스 필터
 * - namespaceStore.selectSingle()을 통해 단일 namespace 선택
 * - 메뉴 선택 시 자동으로 닫힘
 *
 * 📝 주의사항:
 * - namespaceStore에 의존하므로 Injectable DI 패턴 사용
 * - namespace-scoped 리소스에서만 사용해야 함
 * - cluster-scoped 리소스에서는 사용하지 말 것
 *
 * 🔄 변경이력:
 * - 2025-11-01: 초기 생성 (NamespaceSelectFilter 기반 싱글 셀렉 버전)
 * - 2025-11-01: shadcn Select 컴포넌트로 리팩토링
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skuberplus/storybook-shadcn/src/components/ui/select";
import { observer } from "mobx-react";
import React from "react";
import namespaceStoreInjectable from "./store.injectable";

import type { NamespaceStore } from "./store";

interface NamespaceSelectSingleProps {
  id?: string;
  className?: string;
}

interface Dependencies {
  namespaceStore: NamespaceStore;
}

/**
 * 🎯 목적: 싱글 셀렉 네임스페이스 필터 컴포넌트 (Injectable 전)
 */
const NonInjectedNamespaceSelectSingle = observer(
  ({ namespaceStore, id = "namespace-select-single", className = "" }: Dependencies & NamespaceSelectSingleProps) => {
    // 🔍 현재 선택된 namespace (storage의 실제 값)
    // 📝 주의: contextNamespaces는 "All namespaces" 선택 시 모든 네임스페이스 반환 (확장됨)
    //         selectedNames는 storage의 실제 선택값만 반환 (빈 Set이면 빈 Set)
    const selectedNamespaceList = Array.from(namespaceStore.selectedNames);
    const selectedNamespace = selectedNamespaceList[0];

    // 🎯 Select value: selectedNamespace가 없으면 "all" (All Namespaces 선택 상태)
    const selectedValue = selectedNamespace || "all";

    // 🎯 namespace 선택 핸들러
    const handleValueChange = React.useCallback(
      (value: string) => {
        if (value === "all") {
          // "All Namespaces" 선택 시
          namespaceStore.selectAll();
        } else {
          // 특정 namespace 선택 시
          namespaceStore.selectSingle(value);
        }
      },
      [namespaceStore],
    );

    return (
      <Select value={selectedValue} onValueChange={handleValueChange}>
        <SelectTrigger id={id} className={`w-[180px] bg-input text-foreground border-input ${className}`.trim()}>
          <SelectValue placeholder="Select namespace" />
        </SelectTrigger>
        <SelectContent className="bg-background text-foreground border border-border">
          <SelectItem value="all">All Namespaces</SelectItem>
          {namespaceStore.allowedNamespaces.map((ns) => (
            <SelectItem key={ns} value={ns}>
              {ns}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  },
);

/**
 * 🎯 목적: Injectable DI로 wrapping된 싱글 셀렉 네임스페이스 필터
 *
 * @example
 * ```tsx
 * <NamespaceSelectSingle id="pods-namespace-select" />
 * ```
 */
export const NamespaceSelectSingle = withInjectables<Dependencies, NamespaceSelectSingleProps>(
  NonInjectedNamespaceSelectSingle,
  {
    getProps: (di, props) => ({
      namespaceStore: di.inject(namespaceStoreInjectable),
      ...props,
    }),
  },
);
