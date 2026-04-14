/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AddClusterDialog를 RootFrame의 전역 컴포넌트로 등록
 *
 * Welcome 화면뿐만 아니라 ClusterFrame(iframe)에서도 Dialog를 표시할 수 있도록
 * RootFrame에 전역으로 등록합니다.
 *
 * 📝 주요 기능:
 * - rootFrameChildComponentInjectionToken 사용하여 전역 등록
 * - Dialog의 open prop으로 표시/숨김 제어 (항상 DOM에 존재)
 * - ClusterFrame에서 메시지를 보내면 RootFrame의 Dialog가 반응
 *
 * 🔄 변경이력: 2025-11-20 - ClusterFrame에서 Dialog 표시 안 되는 버그 수정
 */

import { getInjectable } from "@ogre-tools/injectable";
import { rootFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed } from "mobx";
import { AddClusterDialog } from "./view";

const addClusterDialogRootFrameChildComponentInjectable = getInjectable({
  id: "add-cluster-dialog-root-frame-child-component",

  instantiate: () => ({
    id: "add-cluster-dialog",
    shouldRender: computed(() => true), // 항상 렌더링, Dialog open prop으로 표시 제어
    Component: AddClusterDialog,
  }),

  injectionToken: rootFrameChildComponentInjectionToken,
});

export default addClusterDialogRootFrameChildComponentInjectable;
