/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { NamespaceSelectBadge } from "../../namespaces/namespace-select-badge";

import type { DaemonSet } from "@skuberplus/kube-object";

/**
 * 🎯 목적: DaemonSet의 네임스페이스를 Badge 형태로 표시
 *
 * @param daemonSet - DaemonSet 객체
 * @returns NamespaceSelectBadge 컴포넌트 (클릭 시 네임스페이스 필터 변경)
 *
 * 📝 주의사항:
 * - NamespaceSelectBadge는 기존 컴포넌트 재사용
 * - 클릭 시 네임스페이스 필터 변경 기능 내장
 */
export const NamespaceCell = ({ daemonSet }: { daemonSet: DaemonSet }) => {
  return <NamespaceSelectBadge namespace={daemonSet.getNs()} />;
};
