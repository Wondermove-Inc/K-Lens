/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { KubeObjectStatusIcon } from "../../kube-object-status-icon";

import type { DaemonSet } from "@skuberplus/kube-object";

/**
 * 🎯 목적: DaemonSet의 상태 아이콘 표시
 *
 * @param daemonSet - DaemonSet 객체
 * @returns KubeObjectStatusIcon 컴포넌트 (Warning/Error 상태 아이콘)
 *
 * 📝 주의사항:
 * - KubeObjectStatusIcon은 기존 컴포넌트 재사용
 * - EventStore는 내부적으로 DI 주입됨
 * - Warning/Error 상태만 아이콘 표시
 */
export const StatusCell = ({ daemonSet }: { daemonSet: DaemonSet }) => {
  return <KubeObjectStatusIcon object={daemonSet} />;
};
