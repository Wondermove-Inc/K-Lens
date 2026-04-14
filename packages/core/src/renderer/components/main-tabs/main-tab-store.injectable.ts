/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import mainTabStorageInjectable from "./main-tab-storage.injectable";
import { MainTabStore } from "./main-tab-store";

/**
 * 🎯 목적: 메인 탭 스토어의 의존성 주입 설정
 *
 * @description
 * - MainTabStore 인스턴스를 싱글톤으로 관리
 * - 스토리지와 연결하여 탭 상태 영구 보존
 * - 앱 전역에서 동일한 탭 상태 공유
 *
 * 📝 주의사항:
 * - 싱글톤 패턴으로 구현되므로 앱 전체에서 하나의 인스턴스만 존재
 * - 탭 상태는 앱 종료 후에도 localStorage에 보존됨
 * - ⚠️ 각 Cluster Frame은 자체 MainTabStore를 가져야 함 (크로스 프레임 공유 금지)
 *
 * 🔄 변경이력:
 * - 2025-09-25 - 초기 생성 (탭 스토어 의존성 주입 설정)
 */

const mainTabStoreInjectable = getInjectable({
  id: "main-tab-store",

  instantiate: (di) => {
    const storage = di.inject(mainTabStorageInjectable);

    return new MainTabStore(storage);
  },

  causesSideEffects: true,
  lifecycle: lifecycleEnum.singleton,
});

export default mainTabStoreInjectable;
