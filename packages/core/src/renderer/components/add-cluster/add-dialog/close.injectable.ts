/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog 닫기 액션 injectable
 *
 * Dialog를 닫고 상태를 리셋하는 함수를 제공합니다.
 *
 * 📝 주의사항:
 * - MobX action으로 상태 변경
 * - isOpen을 false로 설정하여 Dialog 숨김
 * - 모든 입력 상태를 초기화하여 다음 열기 시 깨끗한 상태 보장
 *
 * 🔄 변경이력:
 * - 2025-10-24: 초기 생성 (injectable 패턴 적용)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { action } from "mobx";
import addClusterDialogStateInjectable from "./state.injectable";

/**
 * 🎯 목적: AddClusterDialog 닫기 injectable 정의
 */
const closeAddClusterDialogInjectable = getInjectable({
  id: "close-add-cluster-dialog",
  instantiate: (di) => {
    const state = di.inject(addClusterDialogStateInjectable);

    return action(() => {
      state.isOpen.set(false);
      state.customConfig.set("");
      state.kubeContexts.clear();
      state.isWaiting.set(false);
      state.errors.clear();
    });
  },
});

export default closeAddClusterDialogInjectable;
