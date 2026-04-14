/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemsRefreshTriggerInjectable } from "@skuberplus/cluster-sidebar";
import { comparer, reaction } from "mobx";
import { injectableDifferencingRegistratorWith } from "../../../common/utils/registrator-helper";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../before-frame-starts/tokens";
import customResourceDefinitionGroupsSidebarItemsComputedInjectable from "./groups-sidebar-items-computed.injectable";

const customResourceDefinitionGroupsSidebarItemsRegistratorInjectable = getInjectable({
  id: "custom-resource-definition-groups-sidebar-items-registrator",
  instantiate: (di) => ({
    run: () => {
      const sidebarItems = di.inject(customResourceDefinitionGroupsSidebarItemsComputedInjectable);
      const injectableDifferencingRegistrator = injectableDifferencingRegistratorWith(di);
      const sidebarRefreshTrigger = di.inject(sidebarItemsRefreshTriggerInjectable);

      reaction(
        () => sidebarItems.get(),
        (items, prevItems) => {
          injectableDifferencingRegistrator(items, prevItems);

          // 🔄 라이브러리 타이밍 버그 우회:
          // @ogre-tools/injectable-extension-for-mobx의 deregistrationCallbackToken이
          // 실제 deregister 전에 atom.reportChanged()를 호출하여 MobX가 stale 데이터로 재계산
          // queueMicrotask로 deregister 완료 후 강제 재계산 트리거
          const itemsRemoved = prevItems && items.length < prevItems.length;

          if (itemsRemoved) {
            queueMicrotask(() => {
              sidebarRefreshTrigger.trigger();
            });
          }
        },
        {
          fireImmediately: true,
          equals: comparer.structural, // 구조적 비교로 배열 변경 감지 보장
        },
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default customResourceDefinitionGroupsSidebarItemsRegistratorInjectable;
