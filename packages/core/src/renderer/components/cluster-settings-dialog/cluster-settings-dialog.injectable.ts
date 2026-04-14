/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterSettingsDialog 컴포넌트 Injectable
 *
 * DI 시스템에 ClusterSettingsDialog 컴포넌트를 등록합니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ClusterSettingsDialog } from "./cluster-settings-dialog";

const clusterSettingsDialogInjectable = getInjectable({
  id: "cluster-settings-dialog",

  instantiate: () => ClusterSettingsDialog,

  causesSideEffects: true,
});

export default clusterSettingsDialogInjectable;
