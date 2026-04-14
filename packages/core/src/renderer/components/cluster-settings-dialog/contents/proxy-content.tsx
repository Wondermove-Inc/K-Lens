/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Proxy 설정 콘텐츠 컴포넌트 (Storybook 템플릿 기반)
 *
 * HTTP Proxy 설정을 표시합니다:
 * - HTTP Proxy 입력 (Label + Input + Description)
 *
 * 📝 주의사항:
 * - Storybook 템플릿 UI를 100% 따라서 shadcn 컴포넌트 사용
 * - 기존 비즈니스 로직 보존 (cluster.preferences.httpsProxy 바인딩)
 * - DI 패턴 유지 (withInjectables)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import { observer } from "mobx-react";
import React from "react";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";

import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntity } from "../../../api/catalog-entity";

/**
 * ProxyContent Props 인터페이스
 */
export interface ProxyContentProps {
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
 * 🎯 목적: Proxy 설정 UI 컴포넌트 (Storybook 템플릿 기반)
 *
 * Storybook 템플릿과 동일한 UI 구조:
 * - HTTP proxy: Label + Input + Description
 *
 * 기존 비즈니스 로직 보존:
 * - cluster.preferences.httpsProxy (HTTP Proxy 주소)
 *
 * @param entity - 카탈로그 엔티티 (클러스터)
 * @param getClusterById - 클러스터 조회 함수 (DI)
 */
const NonInjectedProxyContent = observer(({ entity, getClusterById }: ProxyContentProps & Dependencies) => {
  const cluster = getClusterById(entity.getId());
  const [proxy, setProxy] = React.useState("");

  // 초기 proxy 값 설정
  React.useEffect(() => {
    if (cluster) {
      setProxy(cluster.preferences.httpsProxy || "");
    }
  }, [cluster]);

  if (!cluster) {
    return null;
  }

  // 🎯 Proxy 변경 처리
  const handleProxyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProxy(e.target.value);
  };

  // 🎯 Proxy 저장 (onBlur 시)
  const handleProxyBlur = () => {
    cluster.preferences.httpsProxy = proxy;
  };

  return (
    <div className="flex w-full flex-col gap-3">
      {/* HTTP proxy Field: Label + Input + Description */}
      <Label htmlFor="http-proxy" className="text-foreground text-sm font-medium">
        HTTP proxy
      </Label>
      <Input
        id="http-proxy"
        type="text"
        placeholder="http://<address>:<port>"
        className="border-border bg-input/30"
        value={proxy}
        onChange={handleProxyChange}
        onBlur={handleProxyBlur}
      />
      <p className="text-muted-foreground text-sm">HTTP Proxy server. Used for communicating with Kubernetes API.</p>
    </div>
  );
});

/**
 * DI 패턴 적용된 Proxy Content 컴포넌트
 */
export const ProxyContent = withInjectables<Dependencies, ProxyContentProps>(NonInjectedProxyContent, {
  getProps: (di, props) => ({
    ...props,
    getClusterById: di.inject(getClusterByIdInjectable),
  }),
});
