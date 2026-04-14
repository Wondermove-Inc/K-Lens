/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Settings Dialog를 여는 함수 제공
 *
 * Status bar, Sidebar, Context menu 등에서 호출할 수 있습니다.
 * PreferencesDialog 패턴을 따릅니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import clusterSettingsDialogStateInjectable from "./cluster-settings-dialog-state.injectable";

export type OpenClusterSettingsDialog = (clusterId: string) => void;

const openClusterSettingsDialogInjectable = getInjectable({
  id: "open-cluster-settings-dialog",
  instantiate: (di): OpenClusterSettingsDialog => {
    const state = di.inject(clusterSettingsDialogStateInjectable);

    return (clusterId: string) => {
      state.clusterId = clusterId;
      state.isOpen = true;
    };
  },
});

export default openClusterSettingsDialogInjectable;
