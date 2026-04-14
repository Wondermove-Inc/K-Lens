/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { afterApplicationIsLoadedInjectionToken } from "@skuberplus/application";
import { reaction } from "mobx";
import userShellSettingInjectable from "../../features/user-preferences/common/shell-setting.injectable";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import shellSessionEnvsInjectable from "./shell-envs.injectable";
import { ShellSession } from "./shell-session";

const shellEnvCacheInvalidatorInjectable = getInjectable({
  id: "shell-env-cache-invalidator",

  instantiate: (di) => ({
    run: () => {
      const userShellSetting = di.inject(userShellSettingInjectable);
      const state = di.inject(userPreferencesStateInjectable);
      const shellSessionEnvs = di.inject(shellSessionEnvsInjectable);

      const invalidateCache = () => {
        // 모든 클러스터의 쉘 환경 캐시 삭제
        shellSessionEnvs.clear();
        ShellSession.clearEnvCache();
      };

      // 쉘 설정 변경 감지
      reaction(() => userShellSetting.get(), invalidateCache);

      // WSL 설정 변경 감지 (wslEnabled, wslDistribution)
      reaction(() => state.wslEnabled, invalidateCache);
      reaction(() => state.wslDistribution, invalidateCache);
    },
  }),

  causesSideEffects: true,

  injectionToken: afterApplicationIsLoadedInjectionToken,
});

export default shellEnvCacheInvalidatorInjectable;
