/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export const panelSyncChannels = {
  toggleSidebar: "panel-sync:toggle-sidebar",
  toggleDock: "panel-sync:toggle-dock",
  /** Cluster Frame → Root Frame: AI 채팅 패널 열기/토글 */
  toggleAiChat: "panel-sync:toggle-ai-chat",
  /** Root Frame → Cluster Frame: 그룹 상태 변경 (applied/reviewed) */
  groupStatusChanged: "panel-sync:group-status-changed",
  sidebarStateChanged: "panel-sync:sidebar-state-changed",
  dockStateChanged: "panel-sync:dock-state-changed",
  // 📝 2026-01-17: AI Chat Panel IPC 채널 제거 (Root Frame 마이그레이션)
  // aiChatStateChanged: "panel-sync:ai-chat-state-changed",
  navigateInCluster: "panel-sync:navigate-in-cluster", // 🎯 특정 클러스터 내 네비게이션
  saveExplorerUrl: "panel-sync:save-explorer-url", // 🎯 Observability 복귀용 URL 저장 (Cluster Frame → Root Frame)
  // 📝 2026-01-19: 사이드바 폭 전역 동기화 (Origin 격리 문제 해결)
  sidebarWidthChanged: "panel-sync:sidebar-width-changed", // 🎯 사이드바 폭 변경 브로드캐스트
  getSidebarWidth: "panel-sync:get-sidebar-width", // 🎯 초기 사이드바 폭 조회
  // 📝 2026-04-13: 네임스페이스 즐겨찾기 영속화 (Origin 격리로 인한 localStorage 유실 해결)
  getNamespaceFavorites: "panel-sync:get-namespace-favorites", // 🎯 클러스터별 즐겨찾기 조회
  setNamespaceFavorites: "panel-sync:set-namespace-favorites", // 🎯 클러스터별 즐겨찾기 저장
} as const;

export type PanelSyncAction = "toggle" | "open" | "close";

export interface PanelSyncPayload {
  clusterId: string;
  action: PanelSyncAction;
}

export interface PanelStatePayload {
  clusterId: string;
  isOpen: boolean;
  hasTabs?: boolean;
}

/**
 * 🎯 목적: 특정 클러스터 내 네비게이션 페이로드
 * Status Bar에서 클러스터 클릭 시 해당 클러스터의 특정 URL로 이동
 */
export interface NavigateInClusterPayload {
  clusterId: string;
  url: string;
}

/**
 * 🎯 목적: Explorer URL 저장 페이로드 (Observability 복귀용)
 * Cluster Frame에서 Observability로 이동 시 현재 클러스터 URL 저장
 *
 * @property url - 저장할 Explorer URL (예: "/cluster/{id}")
 *
 * 🔄 변경이력:
 * - 2026-01-19 - 초기 생성 (HotBar 화면 전환 복원 기능)
 */
export interface SaveExplorerUrlPayload {
  url: string;
}

/**
 * 🎯 목적: 사이드바 폭 동기화 페이로드
 * Root Frame에서 폭 조절 시 모든 Cluster Frame에 브로드캐스트
 *
 * 📝 배경: 각 프레임이 다른 origin을 가져 localStorage가 격리됨
 * - Root Frame: http://renderer.skuberplus.app
 * - Cluster Frame: http://{clusterId}.renderer.skuberplus.app
 *
 * 🔄 변경이력:
 * - 2026-01-19 - 초기 생성 (사이드바 폭 전역 유지 문제 해결)
 */
export interface SidebarWidthPayload {
  width: number;
}

/**
 * 🎯 목적: 네임스페이스 즐겨찾기 동기화 페이로드
 * Cluster Frame에서 즐겨찾기 변경 시 Main Process에 저장 요청
 *
 * 📝 배경: Cluster Frame의 localStorage는 Origin 격리로 앱 재시작 시 유실됨
 * Main Process에서 JSON 파일로 영속화하여 재시작 후에도 유지
 *
 * @property clusterId - 대상 클러스터 ID
 * @property favorites - digit(문자열) → namespace 이름 매핑
 *
 * 🔄 변경이력:
 * - 2026-04-13 - 초기 생성 (네임스페이스 즐겨찾기 영속화)
 */
export interface NamespaceFavoritesPayload {
  clusterId: string;
  favorites: Record<string, string>;
}
