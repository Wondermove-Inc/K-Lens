/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Settings Dialog 메뉴 데이터 정의
 *
 * Storybook 템플릿에서 사용하는 6개 메뉴 구조를 그대로 적용합니다.
 *
 * 📝 메뉴 구성:
 * - General: 일반 설정
 * - Proxy: 프록시 설정
 * - Terminal: 터미널 설정
 * - Namespace: 네임스페이스 설정
 * - Metrics: 메트릭 수집 설정
 * - Node Shell: 노드 셸 설정
 */

import { BarChart3, Hexagon, Layers, Network, Settings, Terminal } from "lucide-react";

import type { ClusterMenuData } from "./types";

/**
 * 클러스터 설정 메뉴 데이터
 *
 * Storybook 템플릿 패턴과 동일한 구조를 유지합니다.
 */
export const clusterMenuData: ClusterMenuData = {
  nav: [
    { name: "General", icon: Settings },
    { name: "Proxy", icon: Network },
    { name: "Terminal", icon: Terminal },
    { name: "Namespace", icon: Layers },
    { name: "Metrics", icon: BarChart3 },
    { name: "Node Shell", icon: Hexagon },
  ],
};
