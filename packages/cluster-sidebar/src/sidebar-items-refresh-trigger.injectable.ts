/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { action, observable } from "mobx";

/**
 * 🎯 목적: sidebar-items computed 강제 재계산 트리거
 *
 * @description
 * @ogre-tools/injectable-extension-for-mobx 라이브러리의 타이밍 버그 우회:
 * - deregistrationCallbackToken이 실제 deregister 전에 atom.reportChanged() 호출
 * - 이로 인해 MobX computed가 아직 등록된 상태의 stale 데이터로 재계산
 * - 이 트리거를 통해 deregister 완료 후 강제로 재계산 유도
 *
 * 🔄 변경이력: 2025-01-26 - CRD 삭제 시 사이드바 미반영 버그 수정
 */
const sidebarItemsRefreshTriggerInjectable = getInjectable({
  id: "sidebar-items-refresh-trigger",
  instantiate: () => {
    const counter = observable.box(0);

    return {
      /**
       * computed에서 이 값을 읽어 의존성 생성
       */
      get: () => counter.get(),

      /**
       * deregister 완료 후 호출하여 강제 재계산 유도
       */
      trigger: action(() => {
        counter.set(counter.get() + 1);
      }),
    };
  },
});

export default sidebarItemsRefreshTriggerInjectable;
