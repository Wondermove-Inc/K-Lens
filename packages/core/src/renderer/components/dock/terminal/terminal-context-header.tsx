/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";

interface TerminalContextHeaderProps {
  contextName: string;
}

/**
 * 🎯 목적: 터미널 상단에 쿠버네티스 컨텍스트를 표시하는 헤더 컴포넌트
 *
 * 📝 주요 기능:
 * - 터미널별로 독립적인 클러스터 컨텍스트 표시
 * - props를 통해 contextName을 받아서 표시
 * - 클러스터가 없을 때 "No Cluster" 표시
 *
 * 🎨 표시 형태:
 * - "● Kubernetes Context: my-cluster-context" (초록점)
 * - "● No Cluster Connected" (빨간점)
 *
 * 🔄 변경이력:
 * - 2025-09-29 - 터미널 컨텍스트 표시용 초기 생성
 * - 2025-09-30 - DI 의존성 제거, props 기반 단순 컴포넌트로 변경
 * - 2025-09-30 - 아이콘을 초록점/빨간점으로 변경 (연결상태 표시)
 */
export const TerminalContextHeader: React.FC<TerminalContextHeaderProps> = ({ contextName }) => {
  // 🎯 컨텍스트가 있는 경우와 없는 경우 다른 색상의 점과 메시지 표시
  const isConnected = contextName !== "No Cluster" && contextName !== "Unknown Cluster";
  const dotClass = isConnected ? "connected" : "disconnected";
  const message = isConnected ? `Kubernetes Context: ${contextName}` : "No Cluster Connected";

  return (
    <div className="TerminalContextHeader">
      <span className="context-info">
        <span className={`status-dot ${dotClass}`}>●</span> {message}
      </span>
    </div>
  );
};
