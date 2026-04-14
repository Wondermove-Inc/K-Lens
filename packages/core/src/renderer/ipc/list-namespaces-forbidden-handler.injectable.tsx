/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 네임스페이스 목록 조회 권한 없음 시 알림 표시
 * 📝 주의사항: 동일 클러스터에 대해 최소 60초 간격으로 알림 표시
 * 🔄 변경이력:
 *   - 2025-11-25: Sonner 마이그레이션 (notificationsStore 제거)
 *   - 2026-01-26: FIX-037 - NotificationPanel 마이그레이션
 */

import { getInjectable } from "@ogre-tools/injectable";
import { getMillisecondsFromUnixEpoch } from "../../common/utils/date/get-current-date-time";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import { notificationPanelStore } from "../components/status-bar/items/notification-panel.store";

import type { IpcRendererEvent } from "electron";

import type { ListNamespaceForbiddenArgs } from "../../common/ipc/cluster";

const intervalBetweenNotifications = 1000 * 60; // 60s

const listNamespacesForbiddenHandlerInjectable = getInjectable({
  id: "list-namespaces-forbidden-handler",

  instantiate: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const notificationLastDisplayedAt = new Map<string, number>();

    return (event: IpcRendererEvent, ...[clusterId]: ListNamespaceForbiddenArgs): void => {
      const lastDisplayedAt = notificationLastDisplayedAt.get(clusterId);
      const now = getMillisecondsFromUnixEpoch();

      if (typeof lastDisplayedAt !== "number" || now - lastDisplayedAt > intervalBetweenNotifications) {
        notificationLastDisplayedAt.set(clusterId, now);
      } else {
        // 사용자를 너무 자주 방해하지 않음
        return;
      }

      const clusterName = getClusterById(clusterId)?.name.get() ?? "<unknown cluster>";

      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addWarning(
        "cluster",
        "Namespace Access",
        `Cluster "${clusterName}" does not have permissions to list namespaces. Please add the namespaces you have access to in Accessible Namespaces Settings.`,
        { clusterName },
      );
    };
  },
});

export default listNamespacesForbiddenHandlerInjectable;
