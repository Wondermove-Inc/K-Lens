/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { onLoadOfApplicationInjectionToken } from "@skuberplus/application";
import { loggerInjectionToken } from "@skuberplus/logger";
import { unionPATHs } from "@skuberplus/utilities";
import { type IReactionDisposer, reaction } from "mobx";
import isSnapPackageInjectable from "../../../common/vars/is-snap-package.injectable";
import electronAppInjectable from "../../../main/electron-app/electron-app.injectable";
import userShellSettingInjectable from "../../user-preferences/common/shell-setting.injectable";
import computeShellEnvironmentInjectable, {
  clearComputeShellEnvironmentCache,
} from "./compute-shell-environment.injectable";
import emitShellSyncFailedInjectable from "./emit-failure.injectable";

const setupShellInjectable = getInjectable({
  id: "setup-shell",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const isSnapPackage = di.inject(isSnapPackageInjectable);
    const electronApp = di.inject(electronAppInjectable);
    const resolvedUserShellSetting = di.inject(userShellSettingInjectable);
    const computeShellEnvironment = di.inject(computeShellEnvironmentInjectable);
    const emitShellSyncFailed = di.inject(emitShellSyncFailedInjectable);
    let disposeShellSettingReaction: IReactionDisposer | undefined;

    const ensureShellSettingReaction = () => {
      if (disposeShellSettingReaction) {
        return;
      }

      disposeShellSettingReaction = reaction(
        () => resolvedUserShellSetting.get(),
        (newShell, previousShell) => {
          if (previousShell === undefined || newShell === previousShell) {
            return;
          }

          logger.info(`[COMPUTE-SHELL-ENV] ♻️ 사용자 셸 설정 변경 감지 - 캐시 초기화`, {
            previousShell,
            newShell,
          });
          clearComputeShellEnvironmentCache();
        },
      );
    };

    return {
      run: async () => {
        ensureShellSettingReaction();

        logger.info("🐚 Syncing shell environment");

        const result = await computeShellEnvironment(resolvedUserShellSetting.get());

        if (!result.callWasSuccessful) {
          logger.error(`[SHELL-SYNC]: ${result.error}`);
          emitShellSyncFailed(result.error);

          return;
        }

        const env = result.response;

        if (!env) {
          logger.debug("[SHELL-SYNC]: nothing to do, env not special in shells");

          return;
        }

        if (!env.LANG) {
          // the LANG env var expects an underscore instead of electron's dash
          env.LANG = `${electronApp.getLocale().replace("-", "_")}.UTF-8`;
        } else if (!env.LANG.endsWith(".UTF-8")) {
          env.LANG += ".UTF-8";
        }

        if (!isSnapPackage) {
          // Prefer the synced PATH over the initial one
          process.env.PATH = unionPATHs(env.PATH ?? "", process.env.PATH ?? "");
        }

        // The spread operator allows joining of objects. The precedence is last to first.
        process.env = {
          ...env,
          ...process.env,
        };

        logger.info(`[SHELL-SYNC]: Synced shell env`);
        logger.silly(
          `[SHELL-SYNC]: updated env`,
          Object.fromEntries(
            Object.keys(process.env)
              .sort()
              .map((key) => [key, process.env[key]]),
          ),
        );
      },
    };
  },

  injectionToken: onLoadOfApplicationInjectionToken,
});

export default setupShellInjectable;
