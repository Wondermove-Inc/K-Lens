/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Settings Dialog 메뉴 구조 타입 정의
 *
 * Storybook 템플릿 패턴을 따르는 메뉴 시스템을 위한 타입입니다.
 */

import type { LucideIcon } from "lucide-react";

/**
 * 클러스터 설정 메뉴 항목 인터페이스
 */
export interface ClusterMenuItem {
  /**
   * 메뉴 이름 (예: "General", "Proxy")
   */
  name: string;

  /**
   * Lucide React 아이콘 컴포넌트
   */
  icon: LucideIcon;
}

/**
 * 클러스터 설정 메뉴 데이터 구조
 */
export interface ClusterMenuData {
  /**
   * 네비게이션 메뉴 항목 배열
   */
  nav: ClusterMenuItem[];
}
