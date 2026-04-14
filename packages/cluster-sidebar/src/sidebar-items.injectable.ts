import { getInjectable, type InjectionInstanceWithMeta } from "@ogre-tools/injectable";
import { computedInjectManyWithMetaInjectable } from "@ogre-tools/injectable-extension-for-mobx";
import { byOrderNumber } from "@skuberplus/utilities";
import { computed } from "mobx";
import sidebarItemsRefreshTriggerInjectable from "./sidebar-items-refresh-trigger.injectable";
import { type SidebarItemDeclaration, type SidebarItemRegistration, sidebarItemInjectionToken } from "./tokens";

const getSidebarItemsHierarchy = (
  registrations: InjectionInstanceWithMeta<SidebarItemRegistration>[],
  parentId: string | null,
): SidebarItemDeclaration[] =>
  registrations
    .filter(({ instance }) => instance.parentId === parentId)
    .map(({ instance: { isActive, isVisible, ...registration }, meta: { id } }) => {
      const children = getSidebarItemsHierarchy(registrations, id);

      return {
        ...registration,
        id,
        children,
        isVisible: computed(() => {
          if (children.length === 0) {
            if (isVisible) {
              return isVisible.get();
            }

            return true;
          }

          return children.some((child) => child.isVisible.get());
        }),
        isActive: computed(() => {
          if (children.length === 0) {
            if (isActive) {
              return isActive.get();
            }

            return false;
          }

          return children.some((child) => child.isActive.get());
        }),
      };
    })
    .sort(byOrderNumber);

const sidebarItemsInjectable = getInjectable({
  id: "sidebar-items",
  instantiate: (di) => {
    const computedInjectManyWithMeta = di.inject(computedInjectManyWithMetaInjectable);
    const sidebarItemRegistrations = computedInjectManyWithMeta(sidebarItemInjectionToken);
    const refreshTrigger = di.inject(sidebarItemsRefreshTriggerInjectable);

    return computed(() => {
      // 🔄 강제 재계산 트리거 의존성 (라이브러리 타이밍 버그 우회)
      // deregister 후 trigger()가 호출되면 이 computed가 재계산됨
      refreshTrigger.get();

      const registrations = sidebarItemRegistrations.get();

      return getSidebarItemsHierarchy(registrations, null);
    });
  },
});

export default sidebarItemsInjectable;
