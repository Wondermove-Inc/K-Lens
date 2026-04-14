/**
 * 🎯 목적: WSL IPC 핸들러 설정
 * 📝 기능:
 *   - WSL 상태 확인 핸들러
 *   - WSL 배포판 목록 조회 핸들러
 * 🔄 변경이력:
 *   - 2026-02-03: WSL UX 개선 - 초기 구현
 * @module main/wsl/setup-wsl-handlers
 */

import { getInjectable } from "@ogre-tools/injectable";
import { afterApplicationIsLoadedInjectionToken } from "@skuberplus/application";
import { ipcMainHandle } from "../../common/ipc";
import { wslChannels } from "../../common/ipc/wsl";
import wslServiceInjectable from "./wsl-service.injectable";

const setupWslHandlersInjectable = getInjectable({
  id: "setup-wsl-handlers",

  instantiate: (di) => ({
    run: () => {
      const wslService = di.inject(wslServiceInjectable);

      // WSL 설치 상태 확인
      ipcMainHandle(wslChannels.getStatus, () => {
        return wslService.checkInstalled();
      });

      // WSL 배포판 목록 조회
      ipcMainHandle(wslChannels.getDistros, async () => {
        return await wslService.getDistributions();
      });
    },
  }),

  causesSideEffects: true,

  injectionToken: afterApplicationIsLoadedInjectionToken,
});

export default setupWslHandlersInjectable;
