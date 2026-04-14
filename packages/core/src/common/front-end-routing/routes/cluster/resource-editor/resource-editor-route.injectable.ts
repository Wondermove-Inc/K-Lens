/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { frontEndRouteInjectionToken } from "../../../front-end-route-injection-token";

/**
 * 🎯 목적: 리소스 편집 전용 메인 탭 라우트 정의
 *
 * @description
 * - Dock 대신 메인 탭에서 YAML 편집기를 표시하기 위한 비표준 경로
 * - 실 데이터는 탭 ID를 통해 EditResourceTabStore에서 조회
 */
const resourceEditorRouteInjectable = getInjectable({
  id: "resource-editor-route",
  instantiate: () => ({
    path: "/resource-editor",
    clusterFrame: true,
    isEnabled: computed(() => true),
  }),
  injectionToken: frontEndRouteInjectionToken,
});

export default resourceEditorRouteInjectable;
