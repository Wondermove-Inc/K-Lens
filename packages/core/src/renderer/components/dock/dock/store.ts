/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import autoBind from "auto-bind";
import throttle from "lodash/throttle";
import { action, comparer, computed, makeObservable, observable, reaction, runInAction } from "mobx";
import * as uuid from "uuid";

import type { StorageLayer } from "../../../utils/storage-helper";

export type TabId = string;

export enum TabKind {
  TERMINAL = "terminal",
  CREATE_RESOURCE = "create-resource",
  EDIT_RESOURCE = "edit-resource",
  INSTALL_CHART = "install-chart",
  UPGRADE_CHART = "upgrade-chart",
  POD_LOGS = "pod-logs",
}

/**
 * This is the storage model for dock tabs.
 *
 * All fields except clusterId are required.
 * clusterId는 선택사항으로, 터미널 탭이 특정 클러스터에 속할 때만 사용됨
 */
export type DockTab = Omit<Required<DockTabCreate>, "clusterId"> & {
  id: TabId; // 명시적으로 필수 필드 포함
  kind: TabKind; // 명시적으로 필수 필드 포함
  title: string; // 명시적으로 필수 필드 포함
  pinned: boolean; // 명시적으로 필수 필드 포함
  clusterId?: string; // 선택적 필드
};

/**
 * These are the arguments for creating a new Tab on the dock
 */
export interface DockTabCreate {
  /**
   * The ID of the tab for reference purposes.
   */
  id?: TabId;

  /**
   * What kind of dock tab it is
   */
  kind: TabKind;

  /**
   * The tab's title, defaults to `kind`
   */
  title?: string;

  /**
   * If true then the dock entry will take up the whole view and will not be
   * closable.
   */
  pinned?: boolean;

  /**
   * 🎨 클러스터 ID (터미널 탭이 속한 클러스터)
   */
  clusterId?: string;

  /**
   * Extra fields are supported.
   */
  [key: string]: any;
}

/**
 * This type is for function which specifically create a single type of dock tab.
 *
 * That way users should get a type error if they try and specify a `kind`
 * themselves.
 */
export type DockTabCreateSpecific = Omit<DockTabCreate, "kind">;

export interface DockStorageState {
  height: number;
  tabs: DockTab[];
  selectedTabId?: TabId;
  previousActiveTabId?: TabId; // 🎯 이전 활성 탭 ID 저장 (탭 닫기 시 복원용)
  isOpen: boolean;
}

export interface DockTabChangeEvent {
  tab: DockTab;
  tabId: TabId;
  prevTab?: DockTab;
}

export interface DockTabChangeEventOptions {
  /**
   * apply a callback right after initialization
   */
  fireImmediately?: boolean;
  /**
   * filter: by dockStore.selectedTab.kind == tabKind
   */
  tabKind?: TabKind;
  /**
   * filter: dock and selected tab should be visible (default: true)
   */
  dockIsVisible?: boolean;
}

export interface DockTabCloseEvent {
  tabId: TabId; // closed tab id
}

interface Dependencies {
  readonly storage: StorageLayer<DockStorageState>;
  readonly tabDataClearers: Record<TabKind, (tabId: TabId) => void>;
  readonly tabDataValidator: Partial<Record<TabKind, (tabId: TabId) => boolean>>;
}

export class DockStore implements DockStorageState {
  constructor(private readonly dependencies: Dependencies) {
    makeObservable(this);
    autoBind(this);

    // adjust terminal height if window size changes
    window.addEventListener("resize", throttle(this.adjustHeight, 250));

    for (const tab of this.tabs) {
      const tabDataIsValid = this.dependencies.tabDataValidator[tab.kind] ?? (() => true);

      if (!tabDataIsValid(tab.id)) {
        this.closeTab(tab.id);
      }
    }
  }

  readonly minHeight = 100;
  @observable fullSize = false;

  @computed
  get isOpen(): boolean {
    return this.dependencies.storage.get().isOpen;
  }

  set isOpen(isOpen: boolean) {
    this.dependencies.storage.merge({ isOpen });
  }

  @computed
  get height(): number {
    return this.dependencies.storage.get().height;
  }

  set height(height: number) {
    this.dependencies.storage.merge({
      height: Math.max(this.minHeight, Math.min(height || this.minHeight, this.maxHeight)),
    });
  }

  @computed
  get tabs(): DockTab[] {
    return this.dependencies.storage.get().tabs;
  }

  set tabs(tabs: DockTab[]) {
    this.dependencies.storage.merge({ tabs });
  }

  @computed
  get selectedTabId(): TabId | undefined {
    const storageData = this.dependencies.storage.get();

    return storageData.selectedTabId || (this.tabs.length > 0 ? this.tabs[0]?.id : undefined);
  }

  set selectedTabId(tabId: TabId | undefined) {
    if (tabId && !this.getTabById(tabId)) return; // skip invalid ids

    this.dependencies.storage.merge({ selectedTabId: tabId });
  }

  @computed get tabsNumber(): number {
    return this.tabs.length;
  }

  @computed get selectedTab() {
    return this.tabs.find((tab) => tab.id === this.selectedTabId);
  }

  get maxHeight() {
    // 🎯 목적: Dock의 최대 높이 계산 (ClusterManager 구조 기준)
    // ClusterManager 레이아웃: Header (40px) + #lens-views (flex-1) + StatusBar (24px)
    // 📝 2026-01-18: StatusBar 높이를 CSS 변수와 일치시킴 (--daive-status-bar-height: 24px)
    const clusterManagerHeader = 40; // Header 높이 (ClusterManager level)
    const statusBarHeight = 24; // StatusBar 높이 (--daive-status-bar-height와 일치)
    const mainLayoutTabs = 36; // MainTabContainer 높이 (실제: 36px)
    const mainLayoutMargin = 16; // 여백
    const dockTabs = 33; // DockTabs 높이
    const preferredMax =
      window.innerHeight - clusterManagerHeader - statusBarHeight - mainLayoutTabs - mainLayoutMargin - dockTabs;

    return Math.max(preferredMax, this.minHeight); // don't let max < min
  }

  protected adjustHeight() {
    if (this.height < this.minHeight) this.height = this.minHeight;
    if (this.height > this.maxHeight) this.height = this.maxHeight;
  }

  onResize(callback: () => void, opts: { fireImmediately?: boolean } = {}) {
    return reaction(() => [this.height, this.fullSize], callback, {
      fireImmediately: opts.fireImmediately,
    });
  }

  onTabClose(callback: (evt: DockTabCloseEvent) => void, opts: { fireImmediately?: boolean } = {}) {
    return reaction(
      () => this.tabs.map((tab) => tab.id),
      (tabs: TabId[], prevTabs?: TabId[]) => {
        if (!Array.isArray(prevTabs)) {
          return; // tabs not yet modified
        }

        const closedTabs: TabId[] = prevTabs.filter((id) => !tabs.includes(id));

        if (closedTabs.length > 0) {
          runInAction(() => {
            closedTabs.forEach((tabId) => callback({ tabId }));
          });
        }
      },
      {
        equals: comparer.structural,
        fireImmediately: opts.fireImmediately,
      },
    );
  }

  onTabChange(callback: (evt: DockTabChangeEvent) => void, options: DockTabChangeEventOptions = {}) {
    const { tabKind, dockIsVisible = true, ...reactionOpts } = options;

    return reaction(
      () => this.selectedTab,
      (tab, prevTab) => {
        if (!tab) return; // skip when dock is empty
        if (tabKind && tabKind !== tab.kind) return; // handle specific tab.kind only
        if (dockIsVisible && !this.isOpen) return;

        callback({
          tab,
          prevTab,
          tabId: tab.id,
        });
      },
      reactionOpts,
    );
  }

  hasTabs() {
    return this.tabs.length > 0;
  }

  @action
  open(fullSize?: boolean) {
    this.isOpen = true;

    if (typeof fullSize === "boolean") {
      this.fullSize = fullSize;
    }
  }

  @action
  close() {
    this.isOpen = false;
  }

  @action
  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  @action
  toggleFillSize() {
    if (!this.isOpen) this.open();
    this.fullSize = !this.fullSize;
  }

  getTabById(tabId: TabId) {
    return this.tabs.find((tab) => tab.id === tabId);
  }

  getTabIndex(tabId: TabId) {
    return this.tabs.findIndex((tab) => tab.id === tabId);
  }

  /**
   * 🎯 목적: 새 탭의 번호를 계산
   *
   * @param kind - 탭 종류 (TERMINAL, CREATE_RESOURCE 등)
   * @param baseTitle - 기본 제목 (숫자 제외). 제공되면 같은 제목끼리만 번호 부여
   * @returns 사용 가능한 다음 번호 (1부터 시작, 빈 번호 재사용)
   *
   * 📝 동작 방식:
   * - baseTitle이 없으면: 같은 kind 탭들 전체에서 번호 부여 (기존 동작)
   * - baseTitle이 있으면: 같은 kind + 같은 제목 탭들끼리만 번호 부여
   *   예: "cluster-a", "cluster-b" 각각 독립적으로 (1), (2), (3)...
   */
  protected getNewTabNumber(kind: TabKind, baseTitle?: string) {
    const tabNumbers = this.tabs
      .filter((tab) => {
        if (tab.kind !== kind) return false;

        // baseTitle이 주어지면 같은 기본 제목끼리만 그룹핑
        if (baseTitle) {
          // "cluster-a (2)" → "cluster-a" 추출하여 비교
          const tabBaseTitle = tab.title.replace(/\s*\(\d+\)$/, "");
          return tabBaseTitle === baseTitle;
        }

        return true;
      })
      .map((tab) => {
        // 제목 끝의 괄호 안 숫자만 추출: "cluster-a (2)" → 2
        const match = tab.title.match(/\((\d+)\)$/);
        const tabNumber = match ? Number(match[1]) : 1;

        return tabNumber; // 숫자가 없는 탭은 1번으로 간주
      });

    for (let i = 1; ; i++) {
      if (!tabNumbers.includes(i)) return i;
    }
  }

  createTab = action((rawTabDesc: DockTabCreate, addNumber = true): DockTab => {
    const { id = uuid.v4(), kind, pinned = false, ...restOfTabFields } = rawTabDesc;

    let { title = kind } = rawTabDesc;

    if (addNumber) {
      // 🎯 같은 제목(이름)끼리만 번호 부여하도록 title 전달
      // 예: cluster-a(1), cluster-b(1), cluster-a(2) - 각각 독립적인 번호
      const tabNumber = this.getNewTabNumber(kind, title);

      if (tabNumber > 1) {
        title += ` (${tabNumber})`;
      }
    }

    const tab: DockTab = {
      ...restOfTabFields,
      id,
      kind,
      pinned,
      title,
    };

    this.tabs.push(tab);
    this.selectTab(tab.id);
    this.open();

    return tab;
  });

  @action
  closeTab(tabId: TabId) {
    const tab = this.getTabById(tabId);
    const tabIndex = this.getTabIndex(tabId);
    const storageState = this.dependencies.storage.get();
    const previousActiveTabId = storageState.previousActiveTabId;
    const previousTabIndex = previousActiveTabId
      ? this.tabs.findIndex((currentTab) => currentTab.id === previousActiveTabId)
      : -1;

    if (!tab || tab.pinned) {
      return;
    }

    this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
    this.dependencies.tabDataClearers[tab.kind](tab.id);

    if (this.selectedTabId === tab.id) {
      if (this.tabs.length) {
        const previousTabExistsToRight =
          previousActiveTabId && previousTabIndex > tabIndex && this.getTabById(previousActiveTabId);

        if (previousTabExistsToRight) {
          // ✅ 이전 활성 탭이 존재하고 닫은 탭보다 오른쪽에 있었던 경우 복원
          this.selectTab(previousActiveTabId);
        } else {
          // ⚠️ 이전 활성 탭이 없으면 인접 탭 선택 (기존 로직)
          const newTab = tabIndex < this.tabsNumber ? this.tabs[tabIndex] : this.tabs[tabIndex - 1];
          this.selectTab(newTab.id);
        }
      } else {
        this.selectedTabId = undefined;
        this.close();
      }
    }
  }

  @action
  closeTabs(tabs: DockTab[]) {
    tabs.forEach((tab) => this.closeTab(tab.id));
  }

  closeAllTabs() {
    this.closeTabs([...this.tabs]);
  }

  closeOtherTabs(tabId: TabId) {
    const index = this.getTabIndex(tabId);
    const tabs = [...this.tabs.slice(0, index), ...this.tabs.slice(index + 1)];

    this.closeTabs(tabs);
  }

  closeTabsToTheRight(tabId: TabId) {
    const index = this.getTabIndex(tabId);
    const tabs = this.tabs.slice(index + 1);

    this.closeTabs(tabs);
  }

  renameTab(tabId: TabId, title: string) {
    const tab = this.getTabById(tabId);

    if (tab) {
      tab.title = title;
    }
  }

  @action
  selectTab(tabId: TabId) {
    // 🎯 현재 활성 탭이 있고, 다른 탭으로 전환하는 경우 previousActiveTabId 저장
    const currentActiveTabId = this.selectedTabId;
    const newTabId = this.getTabById(tabId)?.id;

    if (currentActiveTabId && newTabId && currentActiveTabId !== newTabId) {
      this.dependencies.storage.merge({ previousActiveTabId: currentActiveTabId });
    }

    this.selectedTabId = newTabId;
  }

  @action
  reset() {
    this.dependencies.storage?.reset();
  }
}
