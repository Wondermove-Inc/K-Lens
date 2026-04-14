/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: General 설정 콘텐츠 컴포넌트 (Storybook 템플릿 기반)
 *
 * 클러스터 일반 설정을 표시합니다:
 * - 클러스터 프로필 이미지 설정 (Avatar)
 * - 클러스터 이름 설정 (Input)
 * - Kubeconfig 파일 정보 (Button)
 *
 * 📝 주의사항:
 * - Storybook 템플릿 UI를 100% 따라서 shadcn 컴포넌트 사용
 * - 기존 비즈니스 로직 보존 (cluster.preferences 바인딩)
 * - DI 패턴 유지 (withInjectables)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Avatar, AvatarFallback, AvatarImage } from "@skuberplus/storybook-shadcn/src/components/ui/avatar";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import { shell } from "electron";
import { RefreshCw } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";

import type { KubernetesCluster } from "../../../../common/catalog-entities";
import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntity } from "../../../api/catalog-entity";

/**
 * GeneralContent Props 인터페이스
 */
export interface GeneralContentProps {
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
 * 🎯 목적: General 설정 UI 컴포넌트 (Storybook 템플릿 기반)
 *
 * Storybook 템플릿과 동일한 UI 구조:
 * - Cluster profile: Avatar (클릭 시 이미지 선택) + Input (클러스터 이름)
 * - Kubeconfig: Button (클릭 시 파일 탐색기에서 표시)
 *
 * 기존 비즈니스 로직 보존:
 * - cluster.preferences.icon (Avatar 이미지)
 * - cluster.preferences.clusterName (클러스터 이름)
 * - cluster.kubeConfigPath.get() (Kubeconfig 경로)
 *
 * @param entity - 카탈로그 엔티티 (클러스터)
 * @param getClusterById - 클러스터 조회 함수 (DI)
 */
const NonInjectedGeneralContent = observer(({ entity, getClusterById }: GeneralContentProps & Dependencies) => {
  // 클러스터 데이터 가져오기
  const cluster = getClusterById(entity.getId());
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [clusterName, setClusterName] = React.useState("");

  // 초기 클러스터 이름 설정
  React.useEffect(() => {
    if (cluster) {
      setClusterName(cluster.preferences.clusterName || entity.getName());
    }
  }, [cluster, entity]);

  if (!cluster) {
    return null;
  }

  // 🎯 Avatar 클릭: 이미지 파일 선택 (OS 파일 탐색기 호출)
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // 🎯 Avatar 이미지 파일 선택 처리
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      // 이미지 파일을 base64로 변환하여 cluster.preferences.icon에 저장
      const buf = Buffer.from(await file.arrayBuffer());

      cluster.preferences.icon = `data:${file.type};base64,${buf.toString("base64")}`;
    } catch (e) {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addError("cluster", "Icon Upload Failed", String(e));
    }
  };

  // 🎯 클러스터 이름 변경 처리
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClusterName(e.target.value);
  };

  // 🎯 클러스터 이름 저장 (onBlur 시)
  const handleNameBlur = () => {
    if (clusterName) {
      cluster.preferences.clusterName = clusterName;
    }
  };

  // 🎯 Kubeconfig 버튼 클릭: 파일 탐색기에서 표시
  const handleKubeconfigClick = () => {
    shell.showItemInFolder(cluster.kubeConfigPath.get());
  };

  // 🎯 Avatar 이미지 소스 계산
  const avatarSrc = cluster.preferences.icon || (entity as KubernetesCluster).spec.icon?.src;

  return (
    <div className="flex flex-col gap-6">
      {/* Cluster profile 섹션: Avatar 클릭 시 이미지 파일 선택 */}
      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Cluster profile</Label>
        <div className="flex items-center gap-2.5">
          {/* Avatar 클릭: OS 파일 선택 창 호출 (이미지 파일) */}
          <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80" onClick={handleAvatarClick}>
            <AvatarImage src={avatarSrc} alt={entity.getName()} />
            <AvatarFallback>{entity.getName().substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <Input
            type="text"
            placeholder="Enter cluster name"
            className="border-border bg-input/30 flex-1"
            value={clusterName}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
          />
        </div>
      </div>

      {/* Kubeconfig 섹션: Button 클릭 시 파일 탐색기에서 표시 */}
      <div className="flex flex-col gap-3">
        <Label className="text-foreground text-sm font-medium">Kubeconfig</Label>
        {/* Button 클릭: OS 파일 탐색기에서 kubeconfig 파일 표시 */}
        <Button
          variant="secondary"
          className="bg-secondary hover:bg-secondary/80 justify-between"
          onClick={handleKubeconfigClick}
        >
          <span className="flex-1 truncate text-left">{cluster.kubeConfigPath.get()}</span>
          <RefreshCw className="h-4 w-4 flex-shrink-0" />
        </Button>
      </div>
    </div>
  );
});

/**
 * DI 패턴 적용된 General Content 컴포넌트
 */
export const GeneralContent = withInjectables<Dependencies, GeneralContentProps>(NonInjectedGeneralContent, {
  getProps: (di, props) => ({
    ...props,
    getClusterById: di.inject(getClusterByIdInjectable),
  }),
});
