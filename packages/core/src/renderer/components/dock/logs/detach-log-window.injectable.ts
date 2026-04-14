/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { v4 as uuid } from "uuid";
import { LOG_WINDOW_OPEN_CHANNEL } from "../../../../common/ipc/log-window-channel";
import hostedClusterIdInjectable from "../../../cluster-frame-context/hosted-cluster-id.injectable";
import ipcRendererInjectable from "../../../utils/channel/ipc-renderer.injectable";

import type { Pod } from "@skuberplus/kube-object";

import type { LogWindowOpenPayload } from "../../../../common/ipc/log-window-channel";
import type { LogTabData } from "./tab-store";

export type DetachLogWindow = (pod: Pod, logTabData: LogTabData) => void;

/**
 * 🎯 목적: 로그 탭을 독립 창으로 분리하는 함수
 *
 * 📝 동작:
 * 1. 현재 로그 탭 데이터와 Pod 정보 수집
 * 2. IPC로 Main Process에 창 생성 요청
 */
const detachLogWindowInjectable = getInjectable({
  id: "detach-log-window",

  instantiate: (di): DetachLogWindow => {
    const ipcRenderer = di.inject(ipcRendererInjectable);
    const clusterId = di.inject(hostedClusterIdInjectable);

    return (pod: Pod, logTabData: LogTabData) => {
      if (!clusterId) {
        console.error("[DetachLogWindow] No cluster ID available");

        return;
      }

      const allContainers = [
        ...pod.getContainers().map((c) => ({ name: c.name, isInit: false })),
        ...pod.getInitContainers().map((c) => ({ name: c.name, isInit: true })),
      ];

      const payload: LogWindowOpenPayload = {
        windowId: uuid(),
        clusterId,
        namespace: logTabData.namespace,
        podId: logTabData.selectedPodId,
        podName: pod.getName(),
        container: logTabData.selectedContainer,
        showTimestamps: logTabData.showTimestamps,
        showPrevious: logTabData.showPrevious,
        timestampFormat: logTabData.timestampFormat ?? "iso",
        visibleLevels: logTabData.visibleLevels ?? [],
        allContainers,
        owner: logTabData.owner
          ? { uid: logTabData.owner.uid, name: logTabData.owner.name, kind: logTabData.owner.kind }
          : undefined,
      };

      console.log("[DetachLogWindow] Sending open request:", payload);
      ipcRenderer.invoke(LOG_WINDOW_OPEN_CHANNEL, payload);
    };
  },
});

export default detachLogWindowInjectable;
