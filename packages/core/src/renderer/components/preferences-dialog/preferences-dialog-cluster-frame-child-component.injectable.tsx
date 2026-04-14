/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterFrame (iframe)에 PreferencesDialog 등록
 *
 * 📝 주의사항:
 * - ClusterFrame은 iframe으로 렌더링되어 메인 문서와 DI 컨테이너가 분리됨
 * - PreferencesDialog는 isOpen, onOpenChange props가 필요하므로 래핑 컴포넌트 필요
 * - ClusterFrame의 DI로 preferencesDialogState와 closePreferencesDialog 주입
 *
 * 🔄 변경이력:
 * - 2025-11-14 - ClusterFrame Hotbar 설정 버튼 작동을 위해 생성
 * - 2025-11-14 - 이중 withInjectables 래핑 제거 시도 (실패)
 * - 2025-11-14 - PreferencesDialog를 래핑해서 props 주입하는 방식으로 수정
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { clusterFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import closePreferencesDialogInjectable from "../../../features/preferences/renderer/close-preferences-dialog.injectable";
import preferencesDialogStateInjectable from "../../../features/preferences/renderer/preferences-dialog-state.injectable";
import { PreferencesDialog } from "./preferences-dialog";

import type { PreferencesDialogState } from "../../../features/preferences/renderer/preferences-dialog-state.injectable";

/**
 * 🎯 목적: PreferencesDialog를 래핑해서 ClusterFrame DI로 props 주입
 */
interface Dependencies {
  preferencesDialogState: PreferencesDialogState;
  closePreferencesDialog: () => void;
}

const NonInjectedPreferencesDialogWrapper = observer((props: Dependencies) => {
  return <PreferencesDialog isOpen={props.preferencesDialogState.isOpen} onOpenChange={props.closePreferencesDialog} />;
});

const PreferencesDialogWrapper = withInjectables<Dependencies>(NonInjectedPreferencesDialogWrapper, {
  getProps: (di) => ({
    preferencesDialogState: di.inject(preferencesDialogStateInjectable),
    closePreferencesDialog: di.inject(closePreferencesDialogInjectable),
  }),
});

/**
 * 🎯 목적: ClusterFrame childComponent로 등록
 */
const preferencesDialogClusterFrameChildComponentInjectable = getInjectable({
  id: "preferences-dialog-cluster-frame-child-component",

  instantiate: () => ({
    id: "preferences-dialog",
    shouldRender: computed(() => true),
    Component: PreferencesDialogWrapper, // 🎯 래핑된 컴포넌트 사용 (props 자동 주입)
  }),

  injectionToken: clusterFrameChildComponentInjectionToken,
});

export default preferencesDialogClusterFrameChildComponentInjectable;
