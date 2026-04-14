/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: dock 탭 생성 없이 Pod 로그를 바로 독립 창으로 여는 함수
 *
 * 📝 주의사항:
 *   - createPodLogsTab과 달리 dock 탭을 생성하지 않음
 *   - LogTabData를 직접 구성하여 detachLogWindow 호출
 *   - 기존 IPC → Main Process → BrowserWindow 경로 그대로 재사용
 *
 * 🔄 변경이력:
 *   - 2026-02-10: 초기 생성
 */

import { getInjectable } from "@ogre-tools/injectable";
import detachLogWindowInjectable from "./detach-log-window.injectable";

import type { Pod } from "@skuberplus/kube-object";

import type { LogTabData } from "./tab-store";

export type OpenPodLogsInWindow = (pod: Pod) => void;

const openPodLogsInWindowInjectable = getInjectable({
  id: "open-pod-logs-in-window",

  instantiate: (di): OpenPodLogsInWindow => {
    const detachLogWindow = di.inject(detachLogWindowInjectable);

    return (pod: Pod) => {
      const containers = pod.getAllContainersWithType();

      if (containers.length === 0) {
        console.warn("[OpenPodLogsInWindow] No containers available for pod:", pod.getName());
        return;
      }

      const container = containers[0]!;

      // 🎯 dock 탭을 만들지 않고, LogTabData를 직접 구성하여 detachLogWindow 호출
      const logTabData: LogTabData = {
        owner: pod.getOwnerRefs()[0],
        namespace: pod.getNs(),
        selectedPodId: pod.getId(),
        selectedContainer: container.name,
        showTimestamps: false,
        showPrevious: false,
      };

      detachLogWindow(pod, logTabData);
    };
  },
});

export default openPodLogsInWindowInjectable;
