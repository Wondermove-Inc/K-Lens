/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ipcRenderer } from "electron";
import {
  Bell,
  Box,
  Briefcase,
  Calendar,
  Cog,
  Copy,
  Cpu,
  Crown,
  Database,
  FileIcon,
  FolderTree,
  Forward,
  Gauge,
  Grid3x3,
  HardDrive,
  KeyRound,
  Layers,
  Layers2,
  LayoutDashboard,
  Link,
  Link2,
  MapPin,
  Network,
  PenSquare,
  PieChart,
  Rocket,
  ScrollText,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SquareChartGantt,
  Timer,
  UserCog,
  Users,
  Waypoints,
  Workflow,
} from "lucide-react";
import { action, computed, makeObservable, observable, reaction, runInAction } from "mobx";
import React from "react";
import * as uuid from "uuid";
import { fileSystemChannels, type ReadFileResponse, type WriteFileResponse } from "../../../common/ipc/filesystem";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { SPLIT_CONSTANTS } from "./split-types";

import type { StorageLayer } from "../../utils/storage-helper";
import type { SaveConfirmResult } from "../file-editor/save-confirm-dialog";
import type {
  CreateFileTabOptions,
  CreateMainTabOptions,
  EditorGroup,
  EditorGroupId,
  MainTab,
  MainTabId,
  MainTabStorageStateV1,
  MainTabStorageStateV2,
} from "./main-tab.model";
import type { SplitDirection, SplitLayout } from "./split-types";

/**
 * 🔄 Material Design → lucide-react Icon 매핑 테이블 (레거시 지원)
 *
 * @description
 * - localStorage에 저장된 레거시 Material Design icon names를 lucide-react icons로 자동 변환
 * - create-main-tab.injectable.tsx의 MD_TO_LUCIDE_ICON_MAP과 동일한 매핑
 */
const MD_TO_LUCIDE_ICON_MAP: Record<string, string> = {
  key: "KeyRound",
  view_module: "Grid3x3",
  place: "MapPin",
  security: "ShieldCheck",
  forward: "Forward",
  router: "Network",
  request_page: "ScrollText",
  storage: "HardDrive",
  rocket_launch: "Rocket",
  work: "Briefcase",
  widgets: "Box",
  settings: "Settings",
  data_object: "Database",
  content_copy: "Copy",
  shield: "Shield",
  schedule: "Calendar",
};

/**
 * 🎨 lucide-react Icon Component Map (Production Build 안정성)
 *
 * @description
 * - Named import한 icon component들을 이름으로 lookup할 수 있도록 매핑
 * - create-main-tab.injectable.tsx의 ICON_COMPONENT_MAP과 동일
 */
const ICON_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  Bell,
  Box,
  Briefcase,
  Calendar,
  Cog,
  Copy,
  Cpu,
  Crown,
  Database,
  FileIcon,
  FolderTree,
  Forward,
  Gauge,
  Grid3x3,
  HardDrive,
  KeyRound,
  Layers,
  Layers2,
  LayoutDashboard,
  Link,
  Link2,
  MapPin,
  Network,
  PenSquare,
  PieChart,
  Rocket,
  ScrollText,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SquareChartGantt,
  Timer,
  UserCog,
  Users,
  Waypoints,
  Workflow,
};

/**
 * 🆕 파일 확장자 → Monaco 언어 ID 매핑
 */
const FILE_EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // YAML
  yaml: "yaml",
  yml: "yaml",
  // JSON
  json: "json",
  // Markdown
  md: "markdown",
  markdown: "markdown",
  // TypeScript/JavaScript
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  // Python
  py: "python",
  // Go
  go: "go",
  // Rust
  rs: "rust",
  // Shell
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  // Docker
  dockerfile: "dockerfile",
  // HTML/CSS
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  // Config
  toml: "toml",
  ini: "ini",
  conf: "plaintext",
  // XML
  xml: "xml",
  svg: "xml",
  // SQL
  sql: "sql",
};

/**
 * 🆕 파일 경로에서 언어 감지
 * @param filePath - 파일 경로
 * @returns Monaco 언어 ID
 */
function detectLanguageFromPath(filePath: string): string {
  const fileName = filePath.split("/").pop() || filePath;

  // Dockerfile 특수 처리
  if (fileName.toLowerCase() === "dockerfile" || fileName.toLowerCase().startsWith("dockerfile.")) {
    return "dockerfile";
  }

  // 확장자 추출
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  return FILE_EXTENSION_TO_LANGUAGE[extension] || "plaintext";
}

/**
 * 🎯 목적: 메인 콘텐츠 탭 시스템의 중앙 상태 관리자
 *
 * @description
 * - MobX를 사용한 반응형 탭 상태 관리
 * - Split pane 지원 (최대 2개 그룹)
 * - 탭 생성, 삭제, 활성화, 순서 변경 등 모든 탭 관련 작업 처리
 * - localStorage와 연동하여 탭 상태 영구 보존
 * - 라우터와 연동하여 URL과 탭 상태 동기화
 *
 * 📝 주의사항:
 * - 같은 라우트의 중복 탭 생성 방지
 * - 최대 탭 개수 제한 (기본 10개)
 * - 메모리 누수 방지를 위한 적절한 정리 작업 필요
 * - Split 활성화 시 groups 배열 사용, 비활성 시 단일 left 그룹만 사용
 *
 * 🔄 변경이력:
 * - 2025-09-25: 초기 생성 (MobX 기반 탭 관리 시스템)
 * - 2025-10-29: Split 기능 추가 (groups, splitLayout)
 */
export class MainTabStore {
  /** 📂 에디터 그룹 목록 (Phase 2: 최대 2개) */
  @observable groups: EditorGroup[] = [];

  /** 📐 Split layout 설정 */
  @observable splitLayout: SplitLayout = {
    enabled: false,
    leftRatio: SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO,
    activeGroupId: undefined,
    orientation: SPLIT_CONSTANTS.DEFAULT_ORIENTATION,
  };

  /** 🎯 현재 활성화된 탭 ID (전역, URL 라우팅용) */
  @observable activeTabId?: MainTabId;

  /** 🔒 닫기 확인 대기 중인 탭 ID (다이얼로그 트리거용) */
  @observable pendingCloseTabId: MainTabId | null = null;

  /** 📝 닫기 확인 다이얼로그에 표시할 파일명 */
  @observable pendingCloseFileName = "";

  /** 📂 닫기 확인 다이얼로그에 표시할 파일 경로 */
  @observable pendingCloseFilePath = "";

  /**
   * 🔒 탭별 저장 핸들러 레지스트리
   * - 파일 탭이 아닌 탭(resource-edit 등)의 저장 로직을 등록
   * - 키: 탭 ID, 값: 저장 함수 (성공 시 true 반환)
   */
  private saveHandlers = new Map<MainTabId, () => Promise<boolean>>();

  /** 🔧 최대 허용 탭 개수 */
  private readonly maxTabs = 10;

  /**
   * 🎯 목적: MainTabStore 생성자
   *
   * @param storage - V1/V2 형식 모두 지원하는 스토리지 레이어
   *
   * 📝 주의사항:
   * - V1 형식은 자동으로 V2로 마이그레이션됨
   * - MobX observable 설정 및 스토리지 로드 자동 수행
   * - 상태 변경 시 스토리지에 자동 저장 (reaction)
   *
   * 🔄 변경이력: 2025-10-29 - V1/V2 union type으로 변경
   */
  constructor(private readonly storage: StorageLayer<MainTabStorageStateV1 | MainTabStorageStateV2>) {
    makeObservable(this);

    // 🔄 스토리지에서 초기 상태 로드
    this.loadFromStorage();

    // 🔄 상태 변경 시 스토리지에 자동 저장
    reaction(
      () => this.storageState,
      (state) => {
        this.storage.merge(state);
      },
    );
  }

  /**
   * 🎯 목적: 좌측 그룹 접근자
   */
  @computed get leftGroup(): EditorGroup | undefined {
    return this.groups.find((g) => g.id === "left");
  }

  /**
   * 🎯 목적: 우측 그룹 접근자
   */
  @computed get rightGroup(): EditorGroup | undefined {
    return this.groups.find((g) => g.id === "right");
  }

  /**
   * 🎯 목적: 현재 활성 그룹 접근자
   */
  @computed get activeGroup(): EditorGroup | undefined {
    if (!this.splitLayout.activeGroupId) {
      return this.leftGroup;
    }
    return this.groups.find((g) => g.id === this.splitLayout.activeGroupId);
  }

  /**
   * 🎯 목적: Split 활성화 여부 확인
   */
  @computed get isSplitActive(): boolean {
    return this.groups.length === 2 && this.splitLayout.enabled;
  }

  /**
   * 🎯 목적: 모든 그룹의 탭을 flat 배열로 반환
   *
   * 📝 주의사항: 중복 제거 로직 포함
   */
  @computed get allTabs(): MainTab[] {
    const tabMap = new Map<MainTabId, MainTab>();

    this.groups.forEach((group) => {
      group.tabs.forEach((tab) => {
        tabMap.set(tab.id, tab);
      });
    });

    return Array.from(tabMap.values());
  }

  /**
   * 🎯 목적: 현재 탭 목록 (하위 호환성용)
   *
   * @deprecated groups 배열 사용 권장. Split 비활성 시 left 그룹의 탭 반환.
   */
  @computed get tabs(): MainTab[] {
    // Split 비활성 시: left 그룹의 탭만 반환
    if (!this.isSplitActive) {
      return this.leftGroup?.tabs || [];
    }
    // Split 활성 시: 모든 그룹의 탭 반환 (중복 제거)
    return this.allTabs;
  }

  /**
   * 🎯 목적: 현재 활성화된 탭 반환
   */
  @computed get activeTab(): MainTab | undefined {
    return this.allTabs.find((tab) => tab.id === this.activeTabId);
  }

  /**
   * 🎯 목적: 탭 개수 반환
   */
  @computed get tabCount(): number {
    return this.allTabs.length;
  }

  /**
   * 🎯 목적: 탭이 있는지 확인
   */
  @computed get hasTabs(): boolean {
    return this.allTabs.length > 0;
  }

  /**
   * 🎯 목적: 닫기 확인 다이얼로그 열림 상태
   */
  @computed get isCloseConfirmOpen(): boolean {
    return this.pendingCloseTabId !== null;
  }

  /**
   * 🎯 목적: 스토리지 저장용 상태 객체 (V2 형식)
   *
   * 📝 주의사항:
   * - iconComponent (React element)는 직렬화 불가능하므로 제외
   * - icon (string)만 저장하여 복원 시 React element로 변환
   * - V2 형식: version, groups, splitLayout 포함
   *
   * 🔄 변경이력: 2025-10-29 - V2 형식으로 변경 (groups, splitLayout 저장)
   */
  @computed private get storageState(): MainTabStorageStateV2 {
    return {
      version: 2,
      groups: this.groups.map((group) => ({
        ...group,
        tabs: group.tabs.map((tab) => ({
          ...tab,
          iconComponent: undefined, // 🔥 React element 제외 (직렬화 불가)
        })),
      })),
      splitLayout: this.splitLayout,
      activeTabId: this.activeTabId,
    };
  }

  /**
   * 🎯 목적: 새로운 탭 생성 또는 기존 탭 활성화
   *
   * @param options - 탭 생성 옵션
   * @param targetGroupId - 대상 그룹 ID (기본값: "left")
   * @returns 생성되거나 활성화된 탭
   *
   * 📝 주의사항:
   * - 같은 라우트의 탭이 이미 있으면 해당 탭을 활성화
   * - 최대 탭 개수 초과 시 가장 오래된 비활성 탭 제거
   * - Split 비활성 시 항상 left 그룹에 탭 추가
   *
   * 🔄 변경이력: 2025-10-29 - groups 기반으로 변경, targetGroupId 파라미터 추가
   */
  @action createTab(options: CreateMainTabOptions, targetGroupId: EditorGroupId = "left"): MainTab {
    const { title, route, icon, iconComponent, id: customId, clusterId, allowDuplicateRoute } = options;

    // 🛡️ Left 그룹이 없으면 생성 (초기화 안전장치)
    if (!this.leftGroup) {
      const now = new Date();
      this.groups.push({
        id: "left",
        tabs: [],
        activeTabId: undefined,
        createdAt: now,
        lastActiveAt: now,
      });
      this.splitLayout.activeGroupId = "left";
    }

    // 🔍 기존 탭 중복 확인 (모든 그룹에서 검색)
    const existingTab = allowDuplicateRoute ? undefined : this.allTabs.find((tab) => tab.route === route);
    if (existingTab) {
      // 🎯 기존 탭 활성화 및 마지막 활성 시간 업데이트
      this.activateTab(existingTab.id);
      existingTab.lastActiveAt = new Date();

      // 🔄 기존 탭에 clusterId가 없으면 업데이트
      if (!existingTab.clusterId && clusterId) {
        existingTab.clusterId = clusterId;
      }

      // 🎨 기존 탭에 iconComponent가 없으면 업데이트
      if (!existingTab.iconComponent && iconComponent) {
        existingTab.iconComponent = iconComponent;
      }

      return existingTab;
    }

    // 🔥 최대 탭 개수 초과 시 가장 오래된 탭 제거
    if (this.allTabs.length >= this.maxTabs) {
      this.removeOldestInactiveTab();
    }

    // 🆕 새 탭 생성
    const now = new Date();
    const newTab: MainTab = {
      id: customId || `main-tab-${uuid.v4()}`,
      title,
      route,
      icon,
      iconComponent, // 🎨 lucide-react 아이콘 컴포넌트 저장
      createdAt: now,
      lastActiveAt: now,
      clusterId, // 🎨 클러스터 ID 저장
    };

    // 📋 대상 그룹에 탭 추가
    const targetGroup = this.groups.find((g) => g.id === targetGroupId) || this.leftGroup;
    if (targetGroup) {
      targetGroup.tabs.push(newTab);
      targetGroup.activeTabId = newTab.id;
      targetGroup.lastActiveAt = now;

      // 🎯 전역 활성 탭 설정 (실제 추가된 그룹 ID 사용)
      this.activeTabId = newTab.id;
      this.splitLayout.activeGroupId = targetGroup.id;
    }

    return newTab;
  }

  /**
   * 🎯 목적: 탭 활성화
   *
   * @param tabId - 활성화할 탭 ID
   *
   * 🔄 변경이력: 2025-10-29 - 그룹 인식 로직 추가
   */
  @action activateTab(tabId: MainTabId): void {
    // 🔍 탭이 속한 그룹 찾기
    let targetGroup: EditorGroup | undefined;
    let targetTab: MainTab | undefined;

    for (const group of this.groups) {
      const tab = group.tabs.find((t) => t.id === tabId);
      if (tab) {
        targetGroup = group;
        targetTab = tab;
        break;
      }
    }

    if (!targetTab || !targetGroup) {
      console.warn(`🚨 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    // 🎯 활성 탭 변경 및 마지막 활성 시간 업데이트
    const now = new Date();
    this.activeTabId = tabId;
    targetTab.lastActiveAt = now;

    // 📂 그룹 상태 업데이트
    targetGroup.activeTabId = tabId;
    targetGroup.lastActiveAt = now;
    this.splitLayout.activeGroupId = targetGroup.id;
  }

  /**
   * 🎯 목적: 탭 제거
   *
   * @param tabId - 제거할 탭 ID
   * @returns 제거된 탭의 활성 상태 여부와 다음 활성 탭 정보
   *
   * 📝 주의사항:
   * - 현재 활성 탭 제거 시: 자동으로 다음 탭 활성화 및 라우팅
   * - 비활성 탭 제거 시: 현재 활성 탭 유지
   * - 마지막 탭 제거 시: 빈 화면으로 전환
   *
   * 🔄 변경이력:
   * - 2025-09-26: 라우팅 연동 및 UX 개선
   * - 2025-10-29: groups 기반으로 변경
   */
  @action removeTab(tabId: MainTabId): { wasActive: boolean; nextActiveTab?: MainTab } {
    // 🔍 탭이 속한 그룹 찾기
    let targetGroup: EditorGroup | undefined;
    let tabIndex = -1;

    for (const group of this.groups) {
      const index = group.tabs.findIndex((t) => t.id === tabId);
      if (index !== -1) {
        targetGroup = group;
        tabIndex = index;
        break;
      }
    }

    if (!targetGroup || tabIndex === -1) {
      console.warn(`🚨 제거할 탭을 찾을 수 없습니다: ${tabId}`);
      return { wasActive: false };
    }

    const wasActive = this.activeTabId === tabId;
    const wasGroupActive = targetGroup.activeTabId === tabId;

    // 📋 그룹의 탭 배열에서 제거 - MobX observable 배열 직접 조작으로 즉시 반영
    targetGroup.tabs.splice(tabIndex, 1);
    // 🔄 MobX 반응성 보강: 상위 groups 배열 레퍼런스를 갱신하여 즉시 리렌더 유도
    this.groups = [...this.groups];

    let nextActiveTab: MainTab | undefined;

    // 🎯 활성 탭이 제거된 경우에만 다음 탭 활성화
    if (wasActive || wasGroupActive) {
      nextActiveTab = this.activateNextTab(tabIndex, targetGroup);
    }

    return { wasActive, nextActiveTab };
  }

  /**
   * 🎯 목적: 지정한 탭을 제외한 모든 탭 닫기
   *
   * @param targetTabId - 유지할 탭 ID
   *
   * 📝 주의사항:
   * - Split 모드에 관계없이 전체 탭 대상으로 동작
   * - 대상 탭이 없으면 경고 후 아무 작업도 하지 않음
   */
  @action closeOtherTabs(targetTabId: MainTabId): void {
    const tabIds = this.allTabs.map((tab) => tab.id);

    if (!tabIds.includes(targetTabId)) {
      console.warn(`🚨 Close Others 대상 탭을 찾을 수 없습니다: ${targetTabId}`);
      return;
    }

    tabIds
      .filter((tabId) => tabId !== targetTabId)
      .forEach((tabId) => {
        this.removeTab(tabId);
      });
  }

  /**
   * 🎯 목적: 모든 탭 제거
   *
   * 🔄 변경이력: 2025-10-29 - groups 기반으로 변경
   */
  @action clearAllTabs(): void {
    // 🗑️ 모든 그룹의 탭 배열 클리어
    this.groups.forEach((group) => {
      group.tabs.splice(0, group.tabs.length);
      group.activeTabId = undefined;
    });

    this.activeTabId = undefined;
  }

  /**
   * 🎯 목적: 라우트로 탭 찾기
   *
   * @param route - 찾을 라우트 경로
   * @returns 해당 라우트의 탭 (없으면 undefined)
   */
  getTabByRoute(route: string): MainTab | undefined {
    return this.tabs.find((tab) => tab.route === route);
  }

  /**
   * 🎯 목적: 탭 순서 변경 (드래그 앤 드롭용)
   *
   * @param sourceIndex - 드래그한 탭의 현재 인덱스
   * @param destinationIndex - 드롭할 위치의 인덱스
   * @param groupId - 대상 그룹 ID (기본값: 현재 활성 그룹)
   *
   * 📝 주의사항:
   * - 인덱스는 0부터 시작
   * - 유효하지 않은 인덱스는 무시
   * - 같은 위치로 드래그하는 경우 무시
   * - 같은 그룹 내에서만 재정렬 가능
   *
   * 🔄 변경이력:
   * - 2025-09-26: 드래그 앤 드롭 기능 추가
   * - 2025-10-29: groups 기반으로 변경, groupId 파라미터 추가
   */
  @action reorderTabs(sourceIndex: number, destinationIndex: number, groupId?: EditorGroupId): void {
    // 🎯 대상 그룹 결정
    const targetGroup = groupId ? this.groups.find((g) => g.id === groupId) : this.activeGroup || this.leftGroup;

    if (!targetGroup) {
      console.warn("🚨 탭 재정렬 대상 그룹을 찾을 수 없습니다");
      return;
    }

    // 🛡️ 유효성 검사
    if (
      sourceIndex < 0 ||
      destinationIndex < 0 ||
      sourceIndex >= targetGroup.tabs.length ||
      destinationIndex >= targetGroup.tabs.length ||
      sourceIndex === destinationIndex
    ) {
      return;
    }

    // 🔄 그룹 내 배열에서 요소 이동
    const [movedTab] = targetGroup.tabs.splice(sourceIndex, 1);
    targetGroup.tabs.splice(destinationIndex, 0, movedTab);

    // ⏰ 이동된 탭의 마지막 활성 시간 업데이트
    movedTab.lastActiveAt = new Date();
    targetGroup.lastActiveAt = new Date();
  }

  /**
   * 🔄 탭 제거 후 다음 활성 탭 결정 로직
   *
   * @param removedIndex - 제거된 탭의 인덱스
   * @param group - 탭이 제거된 그룹
   * @returns 다음 활성화된 탭 (없으면 undefined)
   *
   * 🔄 변경이력: 2025-10-29 - groups 기반으로 변경
   */
  private activateNextTab(removedIndex: number, group: EditorGroup): MainTab | undefined {
    if (group.tabs.length === 0) {
      // 📭 그룹의 모든 탭이 제거된 경우
      group.activeTabId = undefined;

      // 🔥 Split 활성 시: 빈 그룹 자동 닫기
      if (this.isSplitActive) {
        try {
          this.closeGroup(group.id);
        } catch (error) {
          // 마지막 그룹인 경우 에러 무시 (closeGroup이 throw함)
          console.warn("Cannot close last group:", error);
        }
        return undefined;
      }

      // 🔍 다른 그룹에 탭이 있는지 확인 (Split 비활성 시)
      const otherGroup = this.groups.find((g) => g.id !== group.id && g.tabs.length > 0);
      if (otherGroup && otherGroup.activeTabId) {
        // 🎯 다른 그룹의 활성 탭으로 전환
        const otherActiveTab = otherGroup.tabs.find((t) => t.id === otherGroup.activeTabId);
        if (otherActiveTab) {
          this.activeTabId = otherActiveTab.id;
          this.splitLayout.activeGroupId = otherGroup.id;
          return otherActiveTab;
        }
      }

      // 📭 모든 그룹이 비어있으면 빈 화면으로 전환
      this.activeTabId = undefined;
      return undefined;
    }

    // 🎯 같은 그룹 내에서 다음 탭 선택: 제거된 위치의 다음 탭 또는 이전 탭
    const nextIndex = Math.min(removedIndex, group.tabs.length - 1);
    const nextTab = group.tabs[nextIndex];

    group.activeTabId = nextTab.id;
    this.activeTabId = nextTab.id;
    this.splitLayout.activeGroupId = group.id;
    nextTab.lastActiveAt = new Date();

    return nextTab;
  }

  /**
   * 🗑️ 가장 오래된 비활성 탭 제거
   *
   * 🔄 변경이력: 2025-10-29 - allTabs 기반으로 변경
   */
  private removeOldestInactiveTab(): void {
    const inactiveTabs = this.allTabs.filter((tab) => tab.id !== this.activeTabId);

    if (inactiveTabs.length === 0) {
      // 🚨 모든 탭이 활성 상태인 경우 가장 오래된 탭 제거
      const oldestTab = this.allTabs.reduce((oldest, tab) => (tab.lastActiveAt < oldest.lastActiveAt ? tab : oldest));
      this.removeTab(oldestTab.id);
      return;
    }

    // 🗑️ 가장 오래된 비활성 탭 제거
    const oldestInactiveTab = inactiveTabs.reduce((oldest, tab) =>
      tab.lastActiveAt < oldest.lastActiveAt ? tab : oldest,
    );
    this.removeTab(oldestInactiveTab.id);
  }

  /**
   * 🎯 목적: Split 관련 메서드 - 그룹 활성화
   *
   * @param groupId - 활성화할 그룹 ID
   *
   * 📝 주의사항:
   * - 해당 그룹의 활성 탭으로 전역 activeTabId 설정
   * - 그룹에 탭이 없으면 아무 동작 안 함
   *
   * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
   */
  @action activateGroup(groupId: EditorGroupId): void {
    const group = this.groups.find((g) => g.id === groupId);

    if (!group) {
      console.warn(`🚨 그룹을 찾을 수 없습니다: ${groupId}`);
      return;
    }

    // 🎯 splitLayout의 activeGroupId 변경
    this.splitLayout.activeGroupId = groupId;

    // 📂 그룹의 활성 탭이 있으면 전역 activeTabId로 설정
    if (group.activeTabId) {
      this.activeTabId = group.activeTabId;
      const activeTab = group.tabs.find((t) => t.id === group.activeTabId);
      if (activeTab) {
        activeTab.lastActiveAt = new Date();
      }
    }

    group.lastActiveAt = new Date();
  }

  /**
   * 🎯 목적: Split 비율 설정
   *
   * @param ratio - 좌측 pane 비율 (0.3 ~ 0.7)
   *
   * 📝 주의사항:
   * - 자동으로 MIN_LEFT_RATIO ~ MAX_LEFT_RATIO 범위로 제한
   *
   * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
   */
  @action setSplitRatio(ratio: number): void {
    // 🛡️ 비율 제약 적용
    const clampedRatio = this.clampSplitRatio(ratio);

    this.splitLayout.leftRatio = clampedRatio;
  }

  /**
   * 🎯 목적: Split 방향 변경
   *
   * @param orientation - horizontal(좌/우) 또는 vertical(상/하)
   */
  @action setSplitOrientation(orientation: SplitDirection): void {
    if (this.splitLayout.orientation === orientation) {
      return;
    }

    this.splitLayout.orientation = orientation;
  }

  /**
   * 🎯 목적: 새 에디터 그룹 생성
   *
   * @param id - 그룹 ID ("left" | "right")
   * @returns 생성된 그룹
   *
   * 📝 주의사항:
   * - 이미 같은 ID의 그룹이 있으면 에러
   * - 최대 그룹 개수(2개) 초과 시 에러
   * - 그룹 생성 시 split enabled 자동 활성화
   *
   * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
   */
  @action createGroup(id: EditorGroupId): EditorGroup {
    // 🛡️ 중복 확인
    if (this.groups.some((g) => g.id === id)) {
      throw new Error(`Group with id "${id}" already exists`);
    }

    // 🛡️ 최대 그룹 개수 확인
    if (this.groups.length >= SPLIT_CONSTANTS.MAX_GROUPS) {
      throw new Error(`Maximum number of groups (${SPLIT_CONSTANTS.MAX_GROUPS}) exceeded`);
    }

    // 🆕 그룹 생성
    const now = new Date();
    const newGroup: EditorGroup = {
      id,
      tabs: [],
      activeTabId: undefined,
      createdAt: now,
      lastActiveAt: now,
    };

    this.groups.push(newGroup);

    // ✅ Split 활성화 (2개 그룹이 되면 자동 활성화)
    if (this.groups.length === 2) {
      this.splitLayout.enabled = true;
    }

    return newGroup;
  }

  /**
   * 🎯 목적: 기존 탭 객체를 특정 그룹에 추가
   *
   * @param tab - 추가할 탭 객체
   * @param groupId - 대상 그룹 ID
   *
   * 📝 주의사항:
   * - createTab과 다르게 이미 생성된 탭 객체를 받음
   * - 주로 탭 이동이나 복사에 사용
   *
   * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
   */
  @action addTabToGroup(tab: MainTab, groupId: EditorGroupId): void {
    const group = this.groups.find((g) => g.id === groupId);

    if (!group) {
      console.warn(`🚨 그룹을 찾을 수 없습니다: ${groupId}`);
      return;
    }

    // 📋 그룹에 탭 추가
    group.tabs.push(tab);
    group.activeTabId = tab.id;
    group.lastActiveAt = new Date();

    // 🎯 전역 활성 탭 설정
    this.activeTabId = tab.id;
    this.splitLayout.activeGroupId = groupId;
  }

  /**
   * 🎯 목적: 그룹 닫기 (탭들을 다른 그룹으로 merge)
   *
   * @param groupId - 닫을 그룹 ID
   *
   * 📝 주의사항:
   * - 마지막 그룹은 닫을 수 없음 (에러)
   * - 닫힌 그룹의 탭들은 남은 그룹으로 이동
   * - 중복 탭은 자동 제거
   * - split 비활성화
   *
   * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
   */
  @action closeGroup(groupId: EditorGroupId): void {
    // 🛡️ 마지막 그룹은 닫을 수 없음
    if (this.groups.length <= 1) {
      throw new Error("Cannot close the last group");
    }

    const groupIndex = this.groups.findIndex((g) => g.id === groupId);

    if (groupIndex === -1) {
      console.warn(`🚨 닫을 그룹을 찾을 수 없습니다: ${groupId}`);
      return;
    }

    const closingGroup = this.groups[groupIndex];
    const remainingGroup = this.groups.find((g) => g.id !== groupId);

    if (!remainingGroup) {
      throw new Error("No remaining group found");
    }

    // 🔄 닫히는 그룹의 탭들을 남은 그룹으로 merge (중복 제거)
    closingGroup.tabs.forEach((tab) => {
      const isDuplicate = remainingGroup.tabs.some((t) => t.route === tab.route);
      if (!isDuplicate) {
        remainingGroup.tabs.push(tab);
      }
    });

    // 🗑️ 그룹 제거
    this.groups.splice(groupIndex, 1);

    // 🔴 Split 비활성화
    this.splitLayout.enabled = false;
    this.splitLayout.activeGroupId = remainingGroup.id;
    this.splitLayout.orientation = SPLIT_CONSTANTS.DEFAULT_ORIENTATION;

    // 🎯 남은 그룹의 활성 탭으로 전환
    if (remainingGroup.activeTabId) {
      this.activeTabId = remainingGroup.activeTabId;
    } else if (remainingGroup.tabs.length > 0) {
      // 활성 탭이 없으면 첫 번째 탭 활성화
      const firstTab = remainingGroup.tabs[0];
      remainingGroup.activeTabId = firstTab.id;
      this.activeTabId = firstTab.id;
    }
  }

  /**
   * 🎯 목적: 탭을 다른 그룹으로 이동
   *
   * @param tabId - 이동할 탭 ID
   * @param targetGroupId - 대상 그룹 ID
   *
   * 📝 주의사항:
   * - 소스 그룹에서 제거 → 대상 그룹에 추가
   * - 대상 그룹 활성화
   *
   * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
   */
  @action moveTabToGroup(tabId: MainTabId, targetGroupId: EditorGroupId, targetIndex?: number): void {
    // 🔍 소스 그룹 찾기
    let sourceGroup: EditorGroup | undefined;
    let tabIndex = -1;

    for (const group of this.groups) {
      const index = group.tabs.findIndex((t) => t.id === tabId);
      if (index !== -1) {
        sourceGroup = group;
        tabIndex = index;
        break;
      }
    }

    if (!sourceGroup || tabIndex === -1) {
      console.warn(`🚨 이동할 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    // 🔍 대상 그룹 찾기
    const targetGroup = this.groups.find((g) => g.id === targetGroupId);

    if (!targetGroup) {
      console.warn(`🚨 대상 그룹을 찾을 수 없습니다: ${targetGroupId}`);
      return;
    }

    // 🛡️ 같은 그룹으로 이동 시도 무시
    if (sourceGroup.id === targetGroup.id) {
      console.warn("🚨 같은 그룹으로 이동할 수 없습니다");
      return;
    }

    // 🔄 탭 이동
    const [movedTab] = sourceGroup.tabs.splice(tabIndex, 1);
    const insertionIndex =
      typeof targetIndex === "number"
        ? Math.max(0, Math.min(targetIndex, targetGroup.tabs.length))
        : targetGroup.tabs.length;
    targetGroup.tabs.splice(insertionIndex, 0, movedTab);

    // 🎯 대상 그룹 활성화
    targetGroup.activeTabId = movedTab.id;
    targetGroup.lastActiveAt = new Date();
    this.activeTabId = movedTab.id;
    this.splitLayout.activeGroupId = targetGroupId;

    // 📭 소스 그룹의 활성 탭 조정
    if (sourceGroup.activeTabId === tabId) {
      if (sourceGroup.tabs.length > 0) {
        sourceGroup.activeTabId = sourceGroup.tabs[0].id;
      } else {
        sourceGroup.activeTabId = undefined;
      }
    }

    // 🔄 MobX 반응성 강화를 위해 groups 레퍼런스 갱신
    this.groups = [...this.groups];

    // 🧹 소스 그룹이 비어 있으면 분할 해제
    if (sourceGroup.tabs.length === 0 && this.groups.length > 1) {
      try {
        this.closeGroup(sourceGroup.id);
      } catch (error) {
        console.warn("Cannot close source group after move:", error);
      }
    }
  }

  /**
   * 🎯 목적: 탭별 저장 핸들러 등록
   *
   * @param tabId - 탭 ID
   * @param handler - 저장 함수 (성공 시 true 반환)
   * @returns 등록 해제 함수 (컴포넌트 unmount 시 호출)
   *
   * 📝 주의사항:
   * - 파일 탭은 IPC writeFile로 자체 처리하므로 등록 불필요
   * - resource-edit 탭 등 외부 저장 로직이 필요한 탭에서 사용
   */
  registerSaveHandler(tabId: MainTabId, handler: () => Promise<boolean>): () => void {
    this.saveHandlers.set(tabId, handler);

    return () => {
      this.saveHandlers.delete(tabId);
    };
  }

  /**
   * 🎯 목적: 탭 닫기 요청 (dirty 확인 포함)
   *
   * @param tabId - 닫을 탭 ID
   * @returns closed=true이면 즉시 닫힘, false이면 다이얼로그 표시 중
   *
   * 📝 주의사항:
   * - dirty가 아닌 탭 → removeTab() 직접 호출 (즉시 닫기)
   * - dirty 탭 (파일/리소스 무관) → pendingCloseTabId 설정 (다이얼로그 표시)
   * - 다이얼로그가 이미 열려있으면 무시
   */
  @action requestCloseTab(tabId: MainTabId): { closed: boolean; wasActive?: boolean; nextActiveTab?: MainTab } {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab) {
      return { closed: false };
    }

    // dirty가 아닌 탭 → 즉시 닫기 (탭 타입 무관)
    if (!tab.isDirty) {
      const result = this.removeTab(tabId);

      return { closed: true, ...result };
    }

    // 다이얼로그가 이미 열려있으면 무시
    if (this.pendingCloseTabId) {
      return { closed: false };
    }

    // dirty 탭 → 다이얼로그 표시
    this.pendingCloseTabId = tabId;
    this.pendingCloseFileName = tab.title;
    this.pendingCloseFilePath = tab.filePath || "";

    return { closed: false };
  }

  /**
   * 🎯 목적: 닫기 확인 다이얼로그 결과 처리
   *
   * @param result - "save" | "discard" | "cancel"
   * @returns 탭이 닫힌 경우 다음 활성 탭 정보, 아니면 null
   *
   * 📝 주의사항:
   * - "save" → IPC로 파일 저장 → markFileSaved → removeTab
   * - "discard" → removeTab 직접 호출
   * - "cancel" → pendingCloseTabId = null (다이얼로그 닫기)
   * - 저장 실패 시 탭을 닫지 않음 (다이얼로그만 닫기)
   */
  async handleCloseConfirmResult(
    result: SaveConfirmResult,
  ): Promise<{ wasActive: boolean; nextActiveTab?: MainTab } | null> {
    const tabId = this.pendingCloseTabId;

    if (!tabId) {
      return null;
    }

    if (result === "cancel") {
      runInAction(() => {
        this.pendingCloseTabId = null;
      });

      return null;
    }

    if (result === "save") {
      const tab = this.allTabs.find((t) => t.id === tabId);

      // 1. 등록된 저장 핸들러 사용 (resource-edit 탭 등)
      const saveHandler = this.saveHandlers.get(tabId);

      if (saveHandler) {
        try {
          const success = await saveHandler();

          if (!success) {
            runInAction(() => {
              this.pendingCloseTabId = null;
            });

            return null;
          }
        } catch (error) {
          console.error("[MainTabStore] Save handler error:", error);
          runInAction(() => {
            this.pendingCloseTabId = null;
          });

          return null;
        }
      } else if (tab?.type === "file" && tab.filePath && tab.currentContent !== undefined) {
        // 2. 파일 탭 → IPC writeFile
        try {
          const response = (await ipcRenderer.invoke(
            fileSystemChannels.writeFile,
            tab.filePath,
            tab.currentContent,
            "utf-8",
          )) as WriteFileResponse;

          if (!response.success) {
            console.error(`[MainTabStore] Save failed: ${response.error}`);
            notificationPanelStore.addError("file", "Save Failed", response.error || "Unknown error");
            runInAction(() => {
              this.pendingCloseTabId = null;
            });

            return null;
          }

          runInAction(() => {
            this.markFileSaved(tabId);
          });
        } catch (error) {
          console.error("[MainTabStore] Save error:", error);
          notificationPanelStore.addError(
            "file",
            "Save Error",
            error instanceof Error ? error.message : "Unknown error",
          );
          runInAction(() => {
            this.pendingCloseTabId = null;
          });

          return null;
        }
      } else {
        // 3. 저장 핸들러도 없고 파일 탭도 아닌 dirty 탭 → 저장 불가, 다이얼로그만 닫기
        console.warn(`[MainTabStore] No save handler for dirty tab: ${tabId}`);
        runInAction(() => {
          this.pendingCloseTabId = null;
        });

        return null;
      }
    }

    // "save" (저장 성공 후) 또는 "discard" → 탭 닫기
    let removeResult: { wasActive: boolean; nextActiveTab?: MainTab } = { wasActive: false };

    runInAction(() => {
      removeResult = this.removeTab(tabId);
      this.pendingCloseTabId = null;
    });

    return removeResult;
  }

  // ========== 🆕 파일 탭 관련 메서드 ==========

  /**
   * 🎯 목적: 파일 탭 열기 (파일 에디터 전용)
   *
   * @param options - 파일 탭 생성 옵션
   * @param targetGroupId - 대상 그룹 ID (기본값: "left")
   * @returns 생성되거나 활성화된 탭
   *
   * 📝 주의사항:
   * - 같은 파일이 이미 열려있으면 해당 탭을 활성화
   * - route 형식: file://{filePath}
   * - 언어 자동 감지 (미제공 시)
   */
  @action openFileTab(options: CreateFileTabOptions, targetGroupId: EditorGroupId = "left"): MainTab {
    const { filePath, content, language, readOnly = false, clusterId } = options;

    // 🔍 파일 경로로 기존 탭 검색
    const existingTab = this.findTabByFilePath(filePath);
    if (existingTab) {
      // 🎯 기존 탭 활성화
      this.activateTab(existingTab.id);
      return existingTab;
    }

    // 📝 파일 이름 추출
    const fileName = filePath.split("/").pop() || filePath;

    // 🔍 언어 감지
    const detectedLanguage = language || detectLanguageFromPath(filePath);

    // 🆕 파일 탭 생성
    const now = new Date();
    const newTab: MainTab = {
      id: `file-tab-${uuid.v4()}`,
      title: fileName,
      route: `file://${filePath}`,
      icon: "FileIcon",
      iconComponent: React.createElement(FileIcon, { className: "h-4 w-4" }),
      createdAt: now,
      lastActiveAt: now,
      clusterId,
      // 파일 탭 전용 필드
      type: "file",
      filePath,
      language: detectedLanguage,
      originalContent: content,
      currentContent: content,
      isDirty: false,
      readOnly,
    };

    // 🛡️ Left 그룹이 없으면 생성
    if (!this.leftGroup) {
      this.groups.push({
        id: "left",
        tabs: [],
        activeTabId: undefined,
        createdAt: now,
        lastActiveAt: now,
      });
      this.splitLayout.activeGroupId = "left";
    }

    // 📋 대상 그룹에 탭 추가
    const targetGroup = this.groups.find((g) => g.id === targetGroupId) || this.leftGroup;
    if (targetGroup) {
      targetGroup.tabs.push(newTab);
      targetGroup.activeTabId = newTab.id;
      targetGroup.lastActiveAt = now;

      this.activeTabId = newTab.id;
      this.splitLayout.activeGroupId = targetGroup.id;
    }

    return newTab;
  }

  /**
   * 🎯 목적: 파일 경로로 탭 찾기
   *
   * @param filePath - 파일 경로
   * @returns 해당 파일의 탭 (없으면 undefined)
   */
  findTabByFilePath(filePath: string): MainTab | undefined {
    return this.allTabs.find((tab) => tab.type === "file" && tab.filePath === filePath);
  }

  /**
   * 🎯 목적: 파일 탭 내용 업데이트
   *
   * @param tabId - 탭 ID
   * @param content - 새로운 내용
   *
   * 📝 주의사항:
   * - isDirty 자동 계산 (originalContent와 비교)
   * - 파일 탭이 아니면 무시
   */
  @action updateFileContent(tabId: MainTabId, content: string): void {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab || tab.type !== "file") {
      console.warn(`🚨 파일 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    tab.currentContent = content;
    tab.isDirty = tab.originalContent !== content;
    tab.lastActiveAt = new Date();

    // 🔄 MobX 반응성 강화
    this.groups = [...this.groups];
  }

  /**
   * 🎯 목적: 마크다운 뷰 모드 업데이트
   *
   * @param tabId - 탭 ID
   * @param viewMode - 새로운 뷰 모드 ('edit' | 'preview' | 'split')
   *
   * 📝 주의사항:
   * - 파일 탭이 아니면 무시
   * - 탭 전환 시에도 상태 유지됨
   */
  @action updateMarkdownViewMode(tabId: MainTabId, viewMode: import("./main-tab.model").MarkdownViewMode): void {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab || tab.type !== "file") {
      console.warn(`🚨 파일 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    tab.markdownViewMode = viewMode;
    tab.lastActiveAt = new Date();

    // 🔄 MobX 반응성 강화
    this.groups = [...this.groups];
  }

  /**
   * 🎯 목적: 파일 저장 완료 처리
   *
   * @param tabId - 탭 ID
   * @param savedContent - 저장된 내용 (선택, 미제공 시 currentContent 사용)
   *
   * 📝 주의사항:
   * - originalContent를 현재 내용으로 업데이트
   * - isDirty를 false로 설정
   */
  @action markFileSaved(tabId: MainTabId, savedContent?: string): void {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab || tab.type !== "file") {
      console.warn(`🚨 파일 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    const content = savedContent ?? tab.currentContent;
    tab.originalContent = content;
    tab.currentContent = content;
    tab.isDirty = false;
    tab.lastActiveAt = new Date();

    // 🔄 MobX 반응성 강화
    this.groups = [...this.groups];
  }

  /**
   * 🎯 목적: 디스크에서 파일 다시 읽기 (Refresh)
   *
   * @param tabId - 탭 ID
   *
   * 📝 주의사항:
   * - 디스크에서 파일을 다시 읽어와서 내용 업데이트
   * - isDirty가 true인 경우에도 덮어쓰기 (사용자 확인 없이)
   * - 외부에서 파일이 변경되었을 때 최신 내용 반영
   */
  async refreshFileFromDisk(tabId: MainTabId): Promise<void> {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab || tab.type !== "file" || !tab.filePath) {
      console.warn(`🚨 파일 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    try {
      const response = (await ipcRenderer.invoke(
        fileSystemChannels.readFile,
        tab.filePath,
        "utf-8",
      )) as ReadFileResponse;

      if (response.success && response.content !== undefined) {
        runInAction(() => {
          tab.originalContent = response.content;
          tab.currentContent = response.content;
          tab.isDirty = false;
          tab.lastActiveAt = new Date();

          // 🔄 MobX 반응성 강화
          this.groups = [...this.groups];
        });
      } else {
        console.error(`❌ 파일 읽기 실패: ${response.error}`);
      }
    } catch (error) {
      console.error(`❌ 파일 새로고침 에러:`, error);
    }
  }

  /**
   * 🎯 목적: 파일 변경 사항 되돌리기
   *
   * @param tabId - 탭 ID
   *
   * 📝 주의사항:
   * - currentContent를 originalContent로 복원
   * - isDirty를 false로 설정
   */
  @action revertFileChanges(tabId: MainTabId): void {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab || tab.type !== "file") {
      console.warn(`🚨 파일 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    tab.currentContent = tab.originalContent;
    tab.isDirty = false;
    tab.lastActiveAt = new Date();

    // 🔄 MobX 반응성 강화
    this.groups = [...this.groups];
  }

  /**
   * 🎯 목적: 외부 파일 변경 시 내용 다시 로드
   *
   * @param tabId - 탭 ID
   * @param newContent - 새로운 파일 내용
   *
   * 📝 주의사항:
   * - isDirty가 true인 경우 사용자 확인 필요 (호출자가 처리)
   * - originalContent와 currentContent 모두 업데이트
   */
  @action reloadFileContent(tabId: MainTabId, newContent: string): void {
    const tab = this.allTabs.find((t) => t.id === tabId);

    if (!tab || tab.type !== "file") {
      console.warn(`🚨 파일 탭을 찾을 수 없습니다: ${tabId}`);
      return;
    }

    tab.originalContent = newContent;
    tab.currentContent = newContent;
    tab.isDirty = false;
    tab.lastActiveAt = new Date();

    // 🔄 MobX 반응성 강화
    this.groups = [...this.groups];
  }

  /**
   * 🎯 목적: 모든 dirty 파일 탭 조회
   *
   * @returns isDirty가 true인 파일 탭 배열
   */
  @computed get dirtyFileTabs(): MainTab[] {
    return this.allTabs.filter((tab) => tab.type === "file" && tab.isDirty);
  }

  /**
   * 🎯 목적: dirty 파일 탭 존재 여부
   *
   * @returns dirty 파일 탭이 있으면 true
   */
  @computed get hasDirtyFiles(): boolean {
    return this.dirtyFileTabs.length > 0;
  }

  /**
   * 🎨 목적: icon name (string)으로 React element 생성
   *
   * @param iconName - lucide-react icon name
   * @returns React element 또는 기본 Server icon
   */
  private createIconFromName(iconName?: string): React.ReactNode {
    if (!iconName || iconName === "Server") {
      return React.createElement(Server, { className: "h-4 w-4" });
    }

    // 🔄 Material Design → lucide-react 자동 변환 (레거시 지원)
    let convertedIconName = iconName;
    if (MD_TO_LUCIDE_ICON_MAP[iconName]) {
      convertedIconName = MD_TO_LUCIDE_ICON_MAP[iconName];
    }

    // 🎨 Icon Component Map에서 icon component 가져오기 (Production Build 안정성)
    const IconComponent = ICON_COMPONENT_MAP[convertedIconName];
    if (IconComponent) {
      return React.createElement(IconComponent, { className: "h-4 w-4" });
    }

    // 🚫 최종 fallback: Server icon
    console.warn(`[Tab Store] Icon component not found, using Server fallback. Icon name: ${convertedIconName}`);
    return React.createElement(Server, { className: "h-4 w-4" });
  }

  /**
   * 🔄 스토리지에서 상태 로드 (V1/V2 마이그레이션 지원)
   *
   * 📝 주의사항:
   * - iconComponent는 저장되지 않으므로 icon name으로 재생성
   * - V1 형식(tabs 배열)은 자동으로 V2(groups 배열)로 변환
   * - Date 문자열(ISO 8601)을 Date 객체로 변환 (JSON 역직렬화 처리)
   * - 앱 재시작 시에도 올바른 아이콘 표시
   *
   * 🔄 변경이력:
   * - 2025-10-29: V1/V2 마이그레이션 로직 추가
   * - 2025-10-29: 타입 캐스팅 개선 (MainTabStorageStateV2 명시)
   * - 2025-10-29: Date 직렬화 문제 수정 (문자열 → Date 객체 변환)
   */
  private loadFromStorage(): void {
    const stored = this.storage.get();

    runInAction(() => {
      // 🔍 V1/V2 형식 판단
      const isV2 = "version" in stored && (stored as MainTabStorageStateV2).version === 2;

      if (isV2) {
        // ✅ V2 형식: groups 배열 직접 로드
        const v2Data = stored as MainTabStorageStateV2;
        this.groups = (v2Data.groups || []).map((group: EditorGroup) => ({
          ...group,
          createdAt: new Date(group.createdAt),
          lastActiveAt: new Date(group.lastActiveAt),
          tabs: group.tabs.map((tab) => ({
            ...tab,
            createdAt: new Date(tab.createdAt),
            lastActiveAt: new Date(tab.lastActiveAt),
            iconComponent: this.createIconFromName(tab.icon),
          })),
        }));
        const sanitizedSplitLayout = v2Data.splitLayout || {
          enabled: false,
          leftRatio: SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO,
          activeGroupId: undefined,
          orientation: SPLIT_CONSTANTS.DEFAULT_ORIENTATION,
        };
        const fallbackActiveGroupId = sanitizedSplitLayout.activeGroupId ?? "left";

        this.splitLayout = {
          enabled: Boolean(sanitizedSplitLayout.enabled),
          leftRatio: this.clampSplitRatio(sanitizedSplitLayout.leftRatio),
          activeGroupId: fallbackActiveGroupId,
          orientation: sanitizedSplitLayout.orientation ?? SPLIT_CONSTANTS.DEFAULT_ORIENTATION,
        };
      } else {
        // 🔄 V1 형식: tabs 배열을 left 그룹으로 마이그레이션
        const v1Data = stored as MainTabStorageStateV1;
        const tabs = (v1Data.tabs || []).map((tab) => ({
          ...tab,
          createdAt: new Date(tab.createdAt),
          lastActiveAt: new Date(tab.lastActiveAt),
          iconComponent: this.createIconFromName(tab.icon),
        }));

        // 🆕 Left 그룹 생성 및 기존 탭 이동
        const now = new Date();
        this.groups = [
          {
            id: "left",
            tabs,
            activeTabId: v1Data.activeTabId,
            createdAt: now,
            lastActiveAt: now,
          },
        ];
        this.splitLayout = {
          enabled: false,
          leftRatio: this.clampSplitRatio(SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO),
          activeGroupId: "left",
          orientation: SPLIT_CONSTANTS.DEFAULT_ORIENTATION,
        };
      }

      this.activeTabId = stored.activeTabId;
    });
  }

  /**
   * 🎯 목적: Split 레이아웃 비율을 허용 범위 내로 보정합니다.
   *
   * @param ratio 저장소 또는 런타임에서 전달된 비율 값
   * @returns 허용 범위를 벗어나면 기본값(50%)으로 되돌린 비율
   */
  private clampSplitRatio(ratio: number | undefined): number {
    if (typeof ratio !== "number" || Number.isNaN(ratio)) {
      return SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO;
    }

    if (ratio < SPLIT_CONSTANTS.MIN_LEFT_RATIO || ratio > SPLIT_CONSTANTS.MAX_LEFT_RATIO) {
      return SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO;
    }

    return ratio;
  }
}
