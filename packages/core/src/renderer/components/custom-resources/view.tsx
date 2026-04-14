/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResources 뷰 - shadcn 마이그레이션 버전
 *
 * 📝 변경사항:
 * - KubeObjectListLayout → CustomResourceCommonTable
 * - SiblingsInTabLayout 사용 (Pod와 동일한 레이아웃 구조)
 * - 동적 컬럼 생성 로직은 custom-resources-columns.tsx로 분리
 *
 * 🔄 변경이력:
 * - 2025-12-17: shadcn 마이그레이션 (KubeDataTable + TanStack Table)
 * - 2026-01-28: TabLayout → SiblingsInTabLayout (페이지네이션 가림 문제 해결)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import customResourceDefinitionStoreInjectable from "../custom-resource-definitions/store.injectable";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { CustomResourceCommonTable } from "./custom-resources-common-table";
import customResourcesRouteParametersInjectable from "./route-parameters.injectable";

import type { IComputedValue } from "mobx";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { CustomResourceDefinitionStore } from "../custom-resource-definitions/store";

interface Dependencies {
  group: IComputedValue<string>;
  name: IComputedValue<string>;
  apiManager: ApiManager;
  customResourceDefinitionStore: CustomResourceDefinitionStore;
}

/**
 * 🎯 목적: CustomResources 뷰 컴포넌트
 *
 * @remarks
 * - CRD 기반으로 동적으로 store와 컬럼 결정
 * - SiblingsInTabLayout 사용 (Pod와 동일한 레이아웃 → 페이지네이션 하단 고정)
 * - CustomResourceCommonTable에서 실제 테이블 렌더링
 */
class NonInjectedCustomResources extends Component<Dependencies> {
  constructor(props: Dependencies) {
    super(props);
    makeObservable(this);
  }

  @computed get crd() {
    return this.props.customResourceDefinitionStore.getByGroup(this.props.group.get(), this.props.name.get());
  }

  @computed get store() {
    return this.props.apiManager.getStore(this.crd?.getResourceApiBase());
  }

  render() {
    const { crd, store } = this;

    if (!crd || !store) {
      return null;
    }

    return (
      <SiblingsInTabLayout>
        <CustomResourceCommonTable key={`crd_resources_${crd.getResourceApiBase()}`} crd={crd} />
      </SiblingsInTabLayout>
    );
  }
}

export const CustomResources = withInjectables<Dependencies>(observer(NonInjectedCustomResources), {
  getProps: (di) => ({
    ...di.inject(customResourcesRouteParametersInjectable),
    apiManager: di.inject(apiManagerInjectable),
    customResourceDefinitionStore: di.inject(customResourceDefinitionStoreInjectable),
  }),
});
