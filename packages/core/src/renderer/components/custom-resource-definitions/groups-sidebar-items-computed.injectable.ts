/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { buildURL, computedAnd, noop } from "@skuberplus/utilities";
import { matches } from "lodash";
import { Briefcase } from "lucide-react";
import { computed } from "mobx";
import React from "react";
import customResourcesRouteInjectable from "../../../common/front-end-routing/routes/cluster/custom-resources/custom-resources-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import routePathParametersInjectable from "../../routes/route-path-parameters.injectable";
import customResourcesSidebarItemInjectable from "../custom-resources/sidebar-item.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import customResourceDefinitionsInjectable from "./definitions.injectable";

import type { SidebarItemRegistration } from "@skuberplus/cluster-sidebar";
import type { CustomResourceDefinition } from "@skuberplus/kube-object";

const titleCaseSplitRegex = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;

const formatResourceKind = (resourceKind: string) => resourceKind.split(titleCaseSplitRegex).join(" ");

/**
 * 🎯 목적: 동적으로 생성되는 Custom Resource Groups 사이드바 메뉴 아이템과 탭 생성 기능
 *
 * @description
 * - 클러스터에 존재하는 CustomResourceDefinition들을 그룹별로 사이드바에 표시
 * - 각 CRD 항목 클릭 시 해당 Custom Resource 목록 탭 생성
 * - 기존 탭이 있으면 활성화, 없으면 새로 생성
 * - Custom Resources 섹션 하위에 동적으로 메뉴 생성
 *
 * 🔄 변경이력: 2025-09-29 - 탭 생성 기능 추가
 */

const customResourceDefinitionGroupsSidebarItemsComputedInjectable = getInjectable({
  id: "custom-resource-definition-groups-sidebar-items-computed",
  instantiate: (di) => {
    const customResourceDefinitions = di.inject(customResourceDefinitionsInjectable);
    const createMainTab = di.inject(createMainTabInjectable);
    const customResourcesRoute = di.inject(customResourcesRouteInjectable);
    const pathParameters = di.inject(routePathParametersInjectable, customResourcesRoute);

    const toCustomResourceGroupToSidebarItems = (
      [group, definitions]: [string, CustomResourceDefinition[]],
      index: number,
    ) => {
      const customResourceGroupSidebarItem = getInjectable({
        id: `sidebar-item-custom-resource-group-${group}`,
        instantiate: (): SidebarItemRegistration => ({
          parentId: customResourcesSidebarItemInjectable.id,
          onClick: noop,
          title: group.replaceAll(".", "\u200b."), // Replace dots with zero-width spaces to allow line breaks
          getIcon: () => React.createElement(Briefcase, { className: "h-4 w-4" }),
          orderNumber: index + 1,
        }),
        injectionToken: sidebarItemInjectionToken,
      });
      const customResourceSidebarItems = definitions.map((definition, index) => {
        const parameters = {
          group: definition.getGroup(),
          name: definition.getPluralName(),
        };
        const routePath = buildURL(customResourcesRoute.path, { params: parameters });

        return getInjectable({
          id: `sidebar-item-custom-resource-group-${group}/${definition.getPluralName()}`,
          instantiate: (di): SidebarItemRegistration => ({
            parentId: customResourceGroupSidebarItem.id,
            onClick: () => {
              // 🎯 탭 생성 및 활성화 - Custom Resource 목록 탭 생성
              const resourceKind = formatResourceKind(definition.getResourceKind());
              createMainTab({
                title: resourceKind,
                route: routePath,
              });
            },
            title: formatResourceKind(definition.getResourceKind()),
            getIcon: () => React.createElement(Briefcase, { className: "h-4 w-4" }),
            isActive: computedAnd(
              di.inject(routeIsActiveInjectable, customResourcesRoute),
              computed(() => matches(parameters)(pathParameters.get())),
            ),
            // ✅ CRD 리소스는 항상 표시
            // 📝 이유: 새 CRD가 동적으로 생성될 때 cluster.resourcesToShow가 즉시 업데이트되지 않음
            // shouldShowResourceInjectionToken은 resourcesToShow를 체크하므로 새 CRD에 대해 false 반환
            // CRD가 존재한다면 (definition이 있다면) 사용자에게 표시되어야 함
            isVisible: computed(() => true),
            orderNumber: index,
          }),
          injectionToken: sidebarItemInjectionToken,
        });
      });

      return [customResourceGroupSidebarItem, ...customResourceSidebarItems];
    };

    return computed(() => {
      const definitions = customResourceDefinitions.get();

      // ✅ MobX 반응성 보장: iter.chain().toMap() 대신 plain JavaScript 사용
      // iter.chain()은 lazy evaluation으로 MobX가 배열 변경을 추적하지 못함
      // 명시적으로 배열을 순회하여 MobX가 observable 접근을 추적하도록 함
      const customResourceDefinitionGroups = new Map<string, CustomResourceDefinition[]>();

      for (const crd of definitions) {
        const group = crd.getGroup();

        if (!customResourceDefinitionGroups.has(group)) {
          customResourceDefinitionGroups.set(group, []);
        }
        customResourceDefinitionGroups.get(group)!.push(crd);
      }

      return Array.from(customResourceDefinitionGroups.entries(), toCustomResourceGroupToSidebarItems).flat();
    });
  },
});

export default customResourceDefinitionGroupsSidebarItemsComputedInjectable;
