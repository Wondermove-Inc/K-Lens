/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Settings Dialog의 열림/닫힘 상태 관리
 *
 * MobX observable을 사용하여 Dialog의 상태를 전역적으로 관리합니다.
 * PreferencesDialog 패턴을 따릅니다.
 *
 * 📝 주의사항:
 * - sidebar.tsx, status-bar 등 여러 곳에서 다이얼로그를 열 수 있음
 * - clusterId가 없으면 다이얼로그가 렌더링되지 않음
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

export interface ClusterSettingsDialogState {
  /** Dialog 열림/닫힘 상태 */
  isOpen: boolean;
  /** 설정을 표시할 클러스터 ID */
  clusterId: string | undefined;
}

const clusterSettingsDialogStateInjectable = getInjectable({
  id: "cluster-settings-dialog-state",
  instantiate: (): ClusterSettingsDialogState =>
    observable({
      isOpen: false,
      clusterId: undefined,
    }),
  causesSideEffects: true,
});

export default clusterSettingsDialogStateInjectable;
