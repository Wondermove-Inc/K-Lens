/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespace 설정 콘텐츠 컴포넌트 (Storybook 템플릿 기반)
 *
 * 네임스페이스 관련 설정을 표시합니다:
 * - Accessible namespaces (Field + Label + Input + FieldDescription)
 *
 * 📝 주의사항:
 * - Storybook 템플릿 UI를 100% 따라서 shadcn 컴포넌트 사용
 * - 기존 비즈니스 로직 보존 (cluster.accessibleNamespaces)
 * - DI 패턴 유지 (withInjectables)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Field, FieldDescription } from "@skuberplus/storybook-shadcn/src/components/ui/field";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import { observer } from "mobx-react";
import React from "react";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";

import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntity } from "../../../api/catalog-entity";

/**
 * NamespaceContent Props 인터페이스
 */
export interface NamespaceContentProps {
  /**
   * 카탈로그 엔티티 (클러스터)
   */
  entity: CatalogEntity;
}

/**
 * Dependencies 인터페이스
 */
interface Dependencies {
  getClusterById: GetClusterById;
}

/**
 * 🎯 목적: Namespace 설정 UI 컴포넌트 (Storybook 템플릿 기반)
 *
 * Storybook 템플릿과 동일한 UI 구조:
 * - Accessible namespaces: Field + Label + Input + FieldDescription
 *
 * 기존 비즈니스 로직 보존:
 * - cluster.accessibleNamespaces (접근 가능한 네임스페이스 목록)
 *
 * @param entity - 카탈로그 엔티티 (클러스터)
 * @param getClusterById - 클러스터 조회 함수 (DI)
 */
const NonInjectedNamespaceContent = observer(({ entity, getClusterById }: NamespaceContentProps & Dependencies) => {
  const cluster = getClusterById(entity.getId());
  const [namespaces, setNamespaces] = React.useState("");

  // 초기 값 설정
  React.useEffect(() => {
    if (cluster) {
      setNamespaces(cluster.accessibleNamespaces.join(", "));
    }
  }, [cluster]);

  if (!cluster) {
    return null;
  }

  // 🎯 Accessible namespaces 변경 처리
  const handleNamespacesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNamespaces(e.target.value);
  };

  // 🎯 Accessible namespaces 저장 (onBlur 시)
  const handleNamespacesBlur = () => {
    // comma-separated string을 배열로 변환
    const nsArray = namespaces
      .split(",")
      .map((ns) => ns.trim())
      .filter((ns) => ns.length > 0);

    cluster.accessibleNamespaces.replace(nsArray);
  };

  return (
    <Field>
      <Label htmlFor="accessible-namespaces" className="text-foreground text-sm font-medium">
        Accessible namespaces
      </Label>
      <Input
        id="accessible-namespaces"
        type="text"
        placeholder="Add new namespaces (comma-separated)..."
        className="bg-input/30 border-border"
        value={namespaces}
        onChange={handleNamespacesChange}
        onBlur={handleNamespacesBlur}
      />
      <FieldDescription>
        This setting is useful for manually specifying which namespaces you have access to. This is useful when you do
        not have permissions to list namespaces.
      </FieldDescription>
    </Field>
  );
});

/**
 * DI 패턴 적용된 Namespace Content 컴포넌트
 */
export const NamespaceContent = withInjectables<Dependencies, NamespaceContentProps>(NonInjectedNamespaceContent, {
  getProps: (di, props) => ({
    ...props,
    getClusterById: di.inject(getClusterByIdInjectable),
  }),
});
