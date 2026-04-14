/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 상태바 경고 카운트 아이템의 기본 동작 테스트
 *
 * 📝 주의사항:
 * - 2025-12-10 리팩토링으로 state/tooltip/badge 속성이 제거됨
 * - 새 구조는 ClusterAlertsPopover 컴포넌트를 직접 렌더링함
 * - visible은 항상 true로 모든 클러스터 경고를 표시
 */

import navigateToClusterOverviewInjectable from "../../../../common/front-end-routing/routes/cluster/overview/navigate-to-cluster-overview.injectable";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import statusBarWarningCountItemInjectable from "./status-bar-warning-count-item.injectable";

describe("status-bar-warning-count-item.injectable", () => {
  it("should always be visible regardless of cluster connection", () => {
    const di = getDiForUnitTesting();

    di.override(navigateToClusterOverviewInjectable, () => () => undefined);

    const item = di.inject(statusBarWarningCountItemInjectable);

    // 🎯 새 구조: 항상 visible (모든 클러스터 경고를 Popover로 표시)
    expect(item.visible.get()).toBe(true);
  });

  it("should have component property for Popover rendering", () => {
    const di = getDiForUnitTesting();

    di.override(navigateToClusterOverviewInjectable, () => () => undefined);

    const item = di.inject(statusBarWarningCountItemInjectable);

    // 🎯 component가 존재해야 함 (ClusterAlertsPopover 렌더링용)
    expect(item.component).toBeDefined();
  });

  it("should be positioned on the right side of status bar", () => {
    const di = getDiForUnitTesting();

    di.override(navigateToClusterOverviewInjectable, () => () => undefined);

    const item = di.inject(statusBarWarningCountItemInjectable);

    // 🎯 상태바 우측에 배치
    expect(item.position).toBe("right");
  });
});
