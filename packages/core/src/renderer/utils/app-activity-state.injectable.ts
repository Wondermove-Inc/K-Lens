/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ipcRenderer } from "electron";
import { action, makeObservable, observable } from "mobx";

/**
 * Renderer-side app visibility tracker.
 *
 * Uses the Page Visibility API (`document.visibilitychange`) to detect
 * whether the app window is currently visible to the user. Consumers
 * can observe `isActive` (MobX observable) to pause expensive work
 * (polling, watch connections, etc.) while the app is in the background.
 */
class AppActivityState {
  isActive = !document.hidden;

  constructor() {
    makeObservable(this, {
      isActive: observable,
      setActive: action,
    });

    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // 절전 복귀 시 isActive 재활성화 (visibilitychange 미발생 보완)
    ipcRenderer.on("auth:system-resumed", () => {
      if (!this.isActive) {
        this.setActive(true);
      } else {
        // 이미 true → Reaction 미트리거 → 수동 toggle로 강제 트리거
        this.setActive(false);
        this.setActive(true);
      }
    });
  }

  setActive(active: boolean) {
    this.isActive = active;
  }

  private readonly handleVisibilityChange = () => {
    this.setActive(!document.hidden);
  };
}

export type { AppActivityState };

const appActivityStateInjectable = getInjectable({
  id: "app-activity-state",
  instantiate: () => new AppActivityState(),
  causesSideEffects: true,
});

export default appActivityStateInjectable;
