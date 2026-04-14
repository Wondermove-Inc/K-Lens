/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { onQuitOfBackEndInjectionToken } from "../../../../main/start-main-application/runnable-tokens/phases";
import userPreferencesStateInjectable from "../../../user-preferences/common/state.injectable";
import monitorSupervisorInjectable from "./monitor-supervisor.injectable";

/**
 * 목적: 앱 종료 시 모니터 정리 — supervisor 중지 + preference enabled=false 저장
 *
 * Running 상태에서 앱을 닫아도 다음 시작 시 UI가 "Stopped"으로 표시되도록 보장.
 */
const monitorQuitCleanupInjectable = getInjectable({
  id: "ai-assistant-monitor-quit-cleanup",
  instantiate: (di) => ({
    run: async () => {
      const monitorSupervisor = di.inject(monitorSupervisorInjectable);
      const userPreferencesState = di.inject(userPreferencesStateInjectable) as any;

      if (monitorSupervisor.isRunning()) {
        console.log("[MonitorQuitCleanup] Stopping monitor and resetting preference");
        monitorSupervisor.stop();
      }

      if (userPreferencesState.monitorConfig?.enabled) {
        userPreferencesState.monitorConfig = {
          ...userPreferencesState.monitorConfig,
          enabled: false,
        };
      }
    },
  }),
  injectionToken: onQuitOfBackEndInjectionToken,
});

export default monitorQuitCleanupInjectable;
