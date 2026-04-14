/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Node Shell 설정 콘텐츠 컴포넌트 (Storybook 템플릿 기반)
 *
 * 노드 셸 관련 설정을 표시합니다:
 * - Node Shell 이미지 설정 (Linux)
 * - Node Shell 이미지 설정 (Windows)
 * - Image pull secret 설정
 *
 * 📝 주의사항:
 * - Storybook 템플릿 UI를 100% 따라서 shadcn 컴포넌트 사용
 * - 기존 비즈니스 로직 보존 (cluster.preferences.nodeShellImage)
 * - DI 패턴 유지 (withInjectables)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Field, FieldDescription } from "@skuberplus/storybook-shadcn/src/components/ui/field";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import { observer } from "mobx-react";
import React from "react";
import { initialNodeShellImage, initialNodeShellWindowsImage } from "../../../../common/cluster-types";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";

import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntity } from "../../../api/catalog-entity";

/**
 * NodeShellContent Props 인터페이스
 */
export interface NodeShellContentProps {
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
 * 🎯 목적: Node Shell 설정 UI 컴포넌트 (Storybook 템플릿 기반)
 *
 * Storybook 템플릿과 동일한 UI 구조:
 * - Node shell image for Linux: Field + Label + Input + FieldDescription
 * - Node shell image for Windows: Field + Label + Input + FieldDescription
 * - Image pull secret: Field + Label + Input + FieldDescription
 *
 * 기존 비즈니스 로직 보존:
 * - cluster.preferences.nodeShellImage (Linux용 이미지)
 * - cluster.preferences.nodeShellWindowsImage (Windows용 이미지)
 * - cluster.preferences.imagePullSecret (Pull secret)
 *
 * @param entity - 카탈로그 엔티티 (클러스터)
 * @param getClusterById - 클러스터 조회 함수 (DI)
 */
const NonInjectedNodeShellContent = observer(({ entity, getClusterById }: NodeShellContentProps & Dependencies) => {
  const cluster = getClusterById(entity.getId());
  const [linuxImage, setLinuxImage] = React.useState("");
  const [windowsImage, setWindowsImage] = React.useState("");
  const [pullSecret, setPullSecret] = React.useState("");

  // 초기 값 설정
  React.useEffect(() => {
    if (cluster) {
      setLinuxImage(cluster.preferences.nodeShellImage || "");
      setWindowsImage(cluster.preferences.nodeShellWindowsImage || "");
      setPullSecret(cluster.preferences.imagePullSecret || "");
    }
  }, [cluster]);

  if (!cluster) {
    return null;
  }

  // 🎯 Linux image 변경 처리
  const handleLinuxImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLinuxImage(e.target.value);
  };

  // 🎯 Linux image 저장 (onBlur 시)
  const handleLinuxImageBlur = () => {
    cluster.preferences.nodeShellImage = linuxImage || undefined;
  };

  // 🎯 Windows image 변경 처리
  const handleWindowsImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWindowsImage(e.target.value);
  };

  // 🎯 Windows image 저장 (onBlur 시)
  const handleWindowsImageBlur = () => {
    cluster.preferences.nodeShellWindowsImage = windowsImage || undefined;
  };

  // 🎯 Pull secret 변경 처리
  const handlePullSecretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPullSecret(e.target.value);
  };

  // 🎯 Pull secret 저장 (onBlur 시)
  const handlePullSecretBlur = () => {
    cluster.preferences.imagePullSecret = pullSecret || undefined;
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Node shell image for Linux Field */}
      <Field>
        <Label htmlFor="node-shell-linux" className="text-foreground text-sm font-medium">
          Node shell image for Linux
        </Label>
        <Input
          id="node-shell-linux"
          type="text"
          placeholder={`Default image: ${initialNodeShellImage}`}
          className="bg-input/30 border-border"
          value={linuxImage}
          onChange={handleLinuxImageChange}
          onBlur={handleLinuxImageBlur}
        />
        <FieldDescription>Node shell image. Used for creating node shell pod on Linux nodes.</FieldDescription>
      </Field>

      {/* Node shell image for Windows Field */}
      <Field>
        <Label htmlFor="node-shell-windows" className="text-foreground text-sm font-medium">
          Node shell image for Windows
        </Label>
        <Input
          id="node-shell-windows"
          type="text"
          placeholder={`Default image: ${initialNodeShellWindowsImage}`}
          className="bg-input/30 border-border"
          value={windowsImage}
          onChange={handleWindowsImageChange}
          onBlur={handleWindowsImageBlur}
        />
        <FieldDescription>Node shell image. Used for creating node shell pod on Windows nodes.</FieldDescription>
      </Field>

      {/* Image pull secret Field */}
      <Field>
        <Label htmlFor="image-pull-secret" className="text-foreground text-sm font-medium">
          Image pull secret
        </Label>
        <Input
          id="image-pull-secret"
          type="text"
          placeholder="Specify a secret name..."
          className="bg-input/30 border-border"
          value={pullSecret}
          onChange={handlePullSecretChange}
          onBlur={handlePullSecretBlur}
        />
        <FieldDescription>
          Name of a pre-existing secret in the kube-system namespace. An optional setting. Used for pulling image from a
          private registry.
        </FieldDescription>
      </Field>
    </div>
  );
});

/**
 * DI 패턴 적용된 Node Shell Content 컴포넌트
 */
export const NodeShellContent = withInjectables<Dependencies, NodeShellContentProps>(NonInjectedNodeShellContent, {
  getProps: (di, props) => ({
    ...props,
    getClusterById: di.inject(getClusterByIdInjectable),
  }),
});
