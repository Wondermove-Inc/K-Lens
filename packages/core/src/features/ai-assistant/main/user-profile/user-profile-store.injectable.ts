/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: UserProfileStore DI 등록
 *
 * Main Process에서 UserProfileStore를 DI 컨테이너에 등록합니다.
 * Lazy init 패턴: 첫 접근 시 자동 초기화됩니다.
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 * - 2026-03-19: async instantiate → 동기 instantiate + lazy init 전환
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { UserProfileStore } from "./user-profile-store";

const userProfileStoreInjectable = getInjectable({
  id: "ai-assistant-user-profile-store",
  instantiate: (di) => {
    const userDataPath = di.inject(directoryForUserDataInjectable);

    return new UserProfileStore({
      appDataPath: userDataPath,
    });
  },
  lifecycle: lifecycleEnum.singleton,
});

export default userProfileStoreInjectable;
