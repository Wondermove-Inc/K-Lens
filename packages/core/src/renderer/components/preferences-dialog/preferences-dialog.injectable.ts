/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PreferencesDialog 컴포넌트의 DI 등록
 *
 * PreferencesDialog 컴포넌트를 DI 컨테이너에 등록합니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PreferencesDialog } from "./preferences-dialog";

const preferencesDialogInjectable = getInjectable({
  id: "preferences-dialog",
  instantiate: () => PreferencesDialog,
  causesSideEffects: true,
});

export default preferencesDialogInjectable;
