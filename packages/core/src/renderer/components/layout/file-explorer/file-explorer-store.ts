/**
 * 🎯 목적: 파일 탐색기 상태 관리 Store
 * 📝 기능:
 *   - 폴더 열기/닫기
 *   - 디렉토리 펼침/접기 (지연 로드)
 *   - 파일/폴더 선택
 *   - localStorage 경로 저장/복원
 *   - UserPreferences 연동 (기본 폴더, 숨김 파일 설정)
 *   - 파일 시스템 감시 (Chokidar 기반 자동 새로고침)
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-25: FIX-002 - MobX Observable 상태 관리 수정
 *     - loadingPaths Set 추가 (폴더 로딩 상태 별도 관리)
 *     - createObservableEntry로 Observable 엔트리 생성
 *     - 내부 엔트리 참조로 상태 변경 (외부 entry 직접 수정 제거)
 *   - 2026-01-26: FIX-038 - UserPreferences 연동
 *     - Settings 기본 폴더 경로 우선 사용
 *     - 숨김 파일 설정 동기화
 *     - 홈 디렉토리 자동 감지 (미설정 시)
 *   - 2026-01-30: FIX-041 - 파일 시스템 Watcher 연동
 *     - 열린 폴더 감시로 외부 파일 변경 자동 감지
 *     - Debounced 새로고침으로 성능 최적화
 * @module file-explorer/file-explorer-store
 */

import { ipcRenderer } from "electron";
import { action, computed, isObservable, makeObservable, observable, runInAction } from "mobx";

import type { Logger } from "@skuberplus/logger";

import type { UserPreferencesState } from "../../../../features/user-preferences/common/state.injectable";

/** localStorage 키 상수 (글로벌 - 클러스터 무관) */
/** 🆕 FIX-019: 클러스터별 키 제거 → 글로벌 상태로 변경 */
const STORAGE_KEY = "file-explorer-last-path";
const EXPANDED_PATHS_KEY = "file-explorer-expanded-paths";
const SHOW_HIDDEN_KEY = "file-explorer-show-hidden";

/**
 * 파일/폴더 엔트리 인터페이스
 */
export interface FileEntry {
  /** 파일/폴더 이름 */
  name: string;
  /** 전체 경로 */
  path: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
  /** 디렉토리 펼침 상태 (디렉토리만 해당) */
  isExpanded?: boolean;
  /** 하위 엔트리 목록 (디렉토리만 해당, 지연 로드) */
  children?: FileEntry[];
  /** 하위 엔트리 로딩 중 여부 */
  isLoading?: boolean;
  /** 파일 크기 (바이트) */
  size?: number;
  /** 수정 시간 (timestamp) */
  modifiedAt?: number;
}

/**
 * 🎯 FileExplorerStore
 * 📝 파일 탐색기의 상태를 관리하는 MobX Store
 */
export class FileExplorerStore {
  /** 열린 폴더의 루트 경로 */
  @observable rootPath: string | null = null;

  /** 루트 디렉토리의 파일/폴더 목록 */
  @observable rootEntries: FileEntry[] = [];

  /** 현재 선택된 파일/폴더 경로 */
  @observable selectedPath: string | null = null;

  /** 로딩 상태 */
  @observable isLoading = false;

  /** 에러 메시지 */
  @observable error: string | null = null;

  /** 숨김 파일 표시 여부 */
  @observable showHiddenFiles = false;

  /** 펼쳐진 디렉토리 경로 Set */
  @observable expandedPaths: Set<string> = new Set();

  /** 클립보드에 복사된 경로 (복사/붙여넣기용) */
  @observable clipboardPath: string | null = null;

  /** 클립보드 작업 타입 (copy/cut) */
  @observable clipboardAction: "copy" | "cut" | null = null;

  /** 🆕 FIX-019: 현재 클러스터 ID (참조용만, 상태 격리 제거) */
  @observable currentClusterId: string | null = null;

  /** 🆕 FIX-002: 로딩 중인 디렉토리 경로 Set (MobX Observable) */
  @observable loadingPaths: Set<string> = new Set();

  /** 🆕 FIX-015: 트리 버전 카운터 (강제 re-render용) */
  @observable treeVersion = 0;

  /** 🆕 FIX-027: 인라인 생성 상태 (VSCode 스타일) */
  @observable inlineCreateParentPath: string | null = null;
  @observable inlineCreateType: "file" | "folder" | null = null;

  /** 인라인 리네임 상태 (VSCode 스타일) */
  @observable renamingPath: string | null = null;

  /** 🆕 드래그 앤 드롭 상태 */
  @observable dragSourcePath: string | null = null;
  @observable dragOverPath: string | null = null;
  @observable isExternalDrag = false;

  /** 🆕 마지막 외부 DnD 경로 (OS 클립보드 잔류 데이터 필터용) */
  private lastExternalDropPaths: string[] = [];

  /** 🆕 FIX-002: 경로별 엔트리 맵 (빠른 조회용) */
  private entryMap: Map<string, FileEntry> = new Map();

  /** 🆕 refresh 재진입 방지 플래그 */
  private _isRefreshing = false;
  private _refreshPending = false;

  private logger: Logger;
  /** 🆕 FIX-038: UserPreferences 상태 (Settings 연동) */
  private userPreferencesState: UserPreferencesState | null;

  constructor(logger: Logger, userPreferencesState?: UserPreferencesState) {
    this.logger = logger;
    this.userPreferencesState = userPreferencesState ?? null;
    makeObservable(this);
    // localStorage에서 설정 복원 (Settings 값 우선)
    this.loadSettingsFromStorage();
  }

  /**
   * localStorage에서 설정 복원
   * 📝 FIX-019: 글로벌 키 사용 (클러스터 무관)
   * 📝 FIX-038: UserPreferences 값 우선 사용 (Settings 연동)
   */
  private loadSettingsFromStorage(): void {
    try {
      // 🎯 FIX-038: UserPreferences 값 우선 사용 (Settings에서 설정한 값)
      if (this.userPreferencesState) {
        const prefsShowHidden = this.userPreferencesState.fileExplorerShowHiddenFiles;
        if (prefsShowHidden !== undefined) {
          this.showHiddenFiles = prefsShowHidden;
          this.logger.debug(`[FileExplorerStore] Loaded showHiddenFiles from UserPreferences: ${prefsShowHidden}`);
        }
      }

      // UserPreferences에 값이 없으면 localStorage에서 복원
      if (!this.userPreferencesState?.fileExplorerShowHiddenFiles) {
        const showHidden = localStorage.getItem(SHOW_HIDDEN_KEY);
        if (showHidden !== null) {
          this.showHiddenFiles = showHidden === "true";
        }
      }

      // 펼쳐진 경로 복원
      // 📝 FIX-006: Set을 교체하지 않고 clear() + add() 사용하여 MobX 반응성 유지
      const expandedJson = localStorage.getItem(EXPANDED_PATHS_KEY);
      this.expandedPaths.clear();
      if (expandedJson) {
        const paths = JSON.parse(expandedJson) as string[];
        paths.forEach((p) => this.expandedPaths.add(p));
      }
    } catch (err) {
      this.logger.warn("[FileExplorerStore] Failed to load settings from localStorage", err);
    }
  }

  /**
   * 🆕 FIX-019: 클러스터 ID 설정 (상태 초기화 제거)
   * 📝 File Explorer는 클러스터와 무관한 로컬 파일 시스템 탐색 도구
   * 📝 클러스터 전환 시에도 열린 폴더, 펼침 상태 유지
   * @param clusterId - 클러스터 ID (null이면 홈 화면)
   */
  @action
  setClusterId(clusterId: string | null): void {
    // 클러스터 ID만 업데이트 (상태 초기화 없음)
    this.currentClusterId = clusterId;
    this.logger.debug(`[FileExplorerStore] Cluster ID set: ${clusterId ?? "home"} (state preserved)`);
  }

  /**
   * 폴더가 열려있는지 여부
   */
  @computed
  get hasOpenFolder(): boolean {
    return this.rootPath !== null;
  }

  /**
   * 🆕 FIX-002: 특정 경로가 로딩 중인지 확인
   * @param path - 확인할 경로
   */
  isLoadingPath(path: string): boolean {
    return this.loadingPaths.has(path);
  }

  /**
   * 🆕 FIX-002: 경로로 엔트리 찾기 (내부 참조 반환)
   * @param path - 찾을 경로
   */
  getEntryByPath(path: string): FileEntry | undefined {
    return this.entryMap.get(path);
  }

  /**
   * 🆕 FIX-012: Observable 엔트리 생성
   * observable.box 대신 일반 observable + runInAction으로 변경 감지
   * @param rawEntry - IPC에서 반환된 원본 엔트리
   */
  private createObservableEntry(rawEntry: FileEntry): FileEntry {
    // MobX observable()은 객체를 deep observable로 만듦
    // 배열 교체도 감지됨
    const entry: FileEntry = observable({
      name: rawEntry.name,
      path: rawEntry.path,
      isDirectory: rawEntry.isDirectory,
      isExpanded: rawEntry.isExpanded ?? false,
      isLoading: rawEntry.isLoading ?? false,
      children: undefined as FileEntry[] | undefined, // 초기값은 undefined
      size: rawEntry.size,
      modifiedAt: rawEntry.modifiedAt,
    });

    // 🔍 DEBUG: Observable 생성 확인
    this.logger.debug(`[FileExplorerStore] createObservableEntry: ${entry.path}, isObservable: ${isObservable(entry)}`);

    this.entryMap.set(entry.path, entry);
    return entry;
  }

  /**
   * 폴더 열기
   * @param path - 열 폴더의 경로
   */
  @action
  async openFolder(path: string): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const entries = await ipcRenderer.invoke("fs:readDir", path);

      runInAction(() => {
        this.rootPath = path;
        this.rootEntries = this.sortEntries(entries);
        this.isLoading = false;
      });

      // localStorage에 경로 저장
      this.savePathToStorage(path);

      // 🆕 FIX-041: 파일 시스템 감시 시작
      await this.startWatching(path);

      this.logger.info(`[FileExplorerStore] Opened folder: ${path}`);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to open folder";
        this.isLoading = false;
      });
      this.logger.error(`[FileExplorerStore] Failed to open folder: ${path}`, err);
    }
  }

  /**
   * 🆕 FIX-041: 파일 시스템 감시 시작
   * 📝 Main Process의 Chokidar watcher에게 폴더 감시 요청
   * @param folderPath - 감시할 폴더 경로
   */
  private async startWatching(folderPath: string): Promise<void> {
    try {
      const result = await ipcRenderer.invoke("fs:watch", folderPath);
      if (result.success) {
        this.logger.info(`[FileExplorerStore] Started watching: ${folderPath}`);
      } else {
        this.logger.warn(`[FileExplorerStore] Failed to start watching: ${result.error}`);
      }
    } catch (err) {
      this.logger.warn(`[FileExplorerStore] Error starting watch: ${err}`);
    }
  }

  /**
   * 🆕 FIX-041: 파일 시스템 감시 중지
   */
  private async stopWatching(): Promise<void> {
    try {
      await ipcRenderer.invoke("fs:unwatch");
      this.logger.info("[FileExplorerStore] Stopped watching");
    } catch (err) {
      this.logger.warn(`[FileExplorerStore] Error stopping watch: ${err}`);
    }
  }

  /**
   * 폴더 닫기
   */
  @action
  closeFolder(): void {
    // 🆕 FIX-041: 파일 시스템 감시 중지
    this.stopWatching();

    this.rootPath = null;
    this.rootEntries = [];
    this.selectedPath = null;
    this.error = null;
    // 🆕 FIX-002: 상태 초기화
    this.loadingPaths.clear();
    this.entryMap.clear();

    // localStorage에서 경로 제거
    this.removePathFromStorage();
    this.logger.info("[FileExplorerStore] Folder closed");
  }

  /**
   * 디렉토리 펼침/접기 토글
   * 📝 FIX-010: entry를 직접 수정하여 MobX 반응성 보장
   *    entryMap을 조회하지 않고, 전달받은 entry가 이미 Observable이므로 직접 사용
   * @param entry - 토글할 디렉토리 엔트리
   */
  @action
  async toggleDirectory(entry: FileEntry): Promise<void> {
    // 파일은 토글하지 않음
    if (!entry.isDirectory) {
      return;
    }

    this.logger.debug(
      `[FileExplorerStore] toggleDirectory called: ${entry.path}, isObservable: ${isObservable(entry)}`,
    );

    // 이미 로딩 중이면 무시
    if (this.loadingPaths.has(entry.path)) {
      this.logger.debug(`[FileExplorerStore] Already loading: ${entry.path}`);
      return;
    }

    // 이미 펼쳐져 있으면 접기만 함
    if (entry.isExpanded) {
      runInAction(() => {
        entry.isExpanded = false;
        this.expandedPaths.delete(entry.path);
      });
      this.saveExpandedPathsToStorage();
      return;
    }

    // 펼치기 - 하위 디렉토리 로드
    runInAction(() => {
      this.loadingPaths.add(entry.path);
      entry.isLoading = true;
    });

    try {
      this.logger.debug(`[FileExplorerStore] Fetching children for: ${entry.path}`);
      const children = await ipcRenderer.invoke("fs:readDir", entry.path);
      this.logger.debug(`[FileExplorerStore] Got ${children.length} children for: ${entry.path}`);

      runInAction(() => {
        // 🆕 FIX-014: entry를 직접 수정 (Observable 여부와 관계없이)
        // MobX는 observable 객체의 속성 변경을 감지함
        const sortedChildren = this.sortEntries(children);
        entry.children = sortedChildren;
        entry.isExpanded = true;
        entry.isLoading = false;
        this.loadingPaths.delete(entry.path);
        this.expandedPaths.add(entry.path);
        // 🆕 FIX-015: 트리 버전 증가하여 강제 re-render
        this.treeVersion++;
        this.logger.debug(
          `[FileExplorerStore] Directory expanded: ${entry.path}, children: ${entry.children?.length}, treeVersion: ${this.treeVersion}`,
        );
      });
      this.saveExpandedPathsToStorage();
    } catch (err) {
      runInAction(() => {
        entry.isLoading = false;
        this.loadingPaths.delete(entry.path);
      });
      this.logger.error(`[FileExplorerStore] Failed to load directory: ${entry.path}`, err);
    }
  }

  /**
   * 파일/폴더 선택
   * @param path - 선택할 경로 (null이면 선택 해제)
   */
  @action
  selectEntry(path: string | null): void {
    this.selectedPath = path;
  }

  /**
   * 숨김 파일 표시 토글
   */
  @action
  toggleHiddenFiles(): void {
    this.showHiddenFiles = !this.showHiddenFiles;
    // 설정 저장 (localStorage + UserPreferences 동기화)
    this.saveShowHiddenToStorage();
    // UserPreferences도 업데이트 (양방향 동기화)
    if (this.userPreferencesState) {
      this.userPreferencesState.fileExplorerShowHiddenFiles = this.showHiddenFiles;
    }
    // 현재 폴더 다시 로드
    if (this.rootPath) {
      this.openFolder(this.rootPath);
    }
  }

  /**
   * 🆕 FIX-038: 숨김 파일 설정 직접 설정 (Settings 연동용)
   * 📝 injectable의 reaction에서 호출됨
   * @param showHidden - 숨김 파일 표시 여부
   */
  @action
  setShowHiddenFiles(showHidden: boolean): void {
    if (this.showHiddenFiles !== showHidden) {
      this.showHiddenFiles = showHidden;
      this.saveShowHiddenToStorage();
      // 현재 폴더 다시 로드
      if (this.rootPath) {
        this.openFolder(this.rootPath);
      }
      this.logger.info(`[FileExplorerStore] Show hidden files set to: ${showHidden}`);
    }
  }

  /**
   * 현재 폴더 새로고침 (Shadow Refresh)
   * 📝 FIX-032: 확장된 디렉토리도 함께 새로고침
   * 📝 FIX-041: 일괄 처리 방식으로 상태 동기화 보장
   * 📝 Shadow buffer 방식 — 새 데이터를 먼저 로드 후 단일 runInAction으로 교체
   *   중간에 빈 상태가 노출되지 않아 UI 깜빡임 제거
   */
  @action
  async refresh(): Promise<void> {
    if (!this.rootPath) {
      return;
    }

    // 🎯 재진입 방지 가드
    if (this._isRefreshing) {
      this._refreshPending = true;
      this.logger.info("[FileExplorerStore] Refresh already in progress, marking pending");
      return;
    }

    this._isRefreshing = true;

    try {
      const currentRoot = this.rootPath;
      const previouslyExpandedPaths = new Set(this.expandedPaths);

      // 🎯 Shadow Phase 1: 새 데이터를 별도 구조에 로드 (observable 미변경)
      const shadowEntryMap = new Map<string, FileEntry>();

      const rawEntries = await ipcRenderer.invoke("fs:readDir", currentRoot);
      const newRootEntries = this.buildSortedEntries(rawEntries, shadowEntryMap);

      // Shadow Phase 2: 확장 디렉토리도 shadow로 로드
      const newExpandedPaths = new Set<string>();

      if (previouslyExpandedPaths.size > 0) {
        await this.loadExpandedIntoShadow(newRootEntries, previouslyExpandedPaths, shadowEntryMap, newExpandedPaths);
      }

      // 🎯 Shadow Phase 3: 단일 runInAction으로 원자적 교체 (1회 렌더링)
      runInAction(() => {
        this.entryMap.clear();
        for (const [key, entry] of shadowEntryMap) {
          this.entryMap.set(key, entry);
        }
        this.rootEntries = newRootEntries;
        this.expandedPaths.clear();
        for (const p of newExpandedPaths) {
          this.expandedPaths.add(p);
        }
        this.treeVersion++;
      });

      this.saveExpandedPathsToStorage();
      this.logger.info("[FileExplorerStore] Shadow refresh completed");
    } finally {
      this._isRefreshing = false;

      // 🎯 진행 중 쌓인 pending 요청이 있으면 1회 재실행
      if (this._refreshPending) {
        this._refreshPending = false;
        this.logger.info("[FileExplorerStore] Executing pending refresh");
        await this.refresh();
      }
    }
  }

  /**
   * 🆕 Shadow용 엔트리 빌드
   * observable 엔트리를 생성하되 this.entryMap에는 등록하지 않고 shadow map에 등록
   */
  private buildSortedEntries(entries: FileEntry[], targetMap: Map<string, FileEntry>): FileEntry[] {
    return [...entries]
      .filter((entry) => {
        if (this.showHiddenFiles) return true;
        return !entry.name.startsWith(".");
      })
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((rawEntry) => {
        const entry: FileEntry = observable({
          name: rawEntry.name,
          path: rawEntry.path,
          isDirectory: rawEntry.isDirectory,
          isExpanded: false,
          isLoading: false,
          children: undefined as FileEntry[] | undefined,
          size: rawEntry.size,
          modifiedAt: rawEntry.modifiedAt,
        });
        targetMap.set(entry.path, entry);
        return entry;
      });
  }

  /**
   * 🆕 Shadow용 확장 디렉토리 로드
   * 기존 확장 상태를 shadow 구조 안에서 재귀적으로 복원
   */
  private async loadExpandedIntoShadow(
    entries: FileEntry[],
    previouslyExpandedPaths: Set<string>,
    shadowEntryMap: Map<string, FileEntry>,
    newExpandedPaths: Set<string>,
  ): Promise<void> {
    for (const entry of entries) {
      if (entry.isDirectory && previouslyExpandedPaths.has(entry.path)) {
        try {
          const children = await ipcRenderer.invoke("fs:readDir", entry.path);
          const sortedChildren = this.buildSortedEntries(children, shadowEntryMap);
          entry.children = sortedChildren;
          entry.isExpanded = true;
          newExpandedPaths.add(entry.path);
          await this.loadExpandedIntoShadow(sortedChildren, previouslyExpandedPaths, shadowEntryMap, newExpandedPaths);
        } catch (err) {
          this.logger.warn(`[FileExplorerStore] Failed to load directory during shadow refresh: ${entry.path}`, err);
        }
      }
    }
  }

  /**
   * localStorage에서 마지막 경로 복원
   * 📝 싱글톤 store에서 이미 폴더가 열려있으면 복원 불필요
   * 📝 FIX-019: 글로벌 키 사용 (클러스터 무관)
   * 📝 FIX-038: Settings 기본 폴더 > localStorage > 홈 디렉토리 순으로 복원
   * 📝 FIX-038: fileExplorerAutoOpenOnConnect가 false면 자동 열기 비활성화
   */
  @action
  async restoreLastPath(): Promise<void> {
    // 이미 폴더가 열려있으면 복원 불필요 (싱글톤 store 상태 유지)
    if (this.hasOpenFolder) {
      this.logger.debug("[FileExplorerStore] Folder already open, skipping restore");
      return;
    }

    // 🎯 FIX-039: fileExplorerAutoOpenOnConnect가 false면 자동 열기 비활성화
    // 단, localStorage에 저장된 경로가 있으면 해당 경로는 복원 (사용자가 수동으로 열었던 폴더)
    // 📝 기본값: true (사용자 요청에 따라 변경)
    const autoOpenEnabled = this.userPreferencesState?.fileExplorerAutoOpenOnConnect ?? true;
    const savedPath = localStorage.getItem(STORAGE_KEY);

    if (!autoOpenEnabled && !savedPath) {
      this.logger.debug("[FileExplorerStore] Auto open disabled and no saved path, skipping restore");
      return;
    }

    // 🎯 FIX-038: 우선순위: Settings 기본 폴더 > localStorage > 홈 디렉토리
    let targetPath: string | null = null;

    // 1. Settings 기본 폴더 확인
    if (this.userPreferencesState?.fileExplorerDefaultPath) {
      const settingsPath = this.userPreferencesState.fileExplorerDefaultPath;
      try {
        const exists = await ipcRenderer.invoke("fs:exists", settingsPath);
        if (exists) {
          targetPath = settingsPath;
          this.logger.info(`[FileExplorerStore] Using Settings default path: ${settingsPath}`);
        } else {
          this.logger.warn(`[FileExplorerStore] Settings path no longer exists: ${settingsPath}`);
        }
      } catch (err) {
        this.logger.warn(`[FileExplorerStore] Failed to check Settings path: ${settingsPath}`, err);
      }
    }

    // 2. localStorage 저장 경로 확인 (savedPath는 위에서 이미 조회)
    if (!targetPath && savedPath) {
      try {
        const exists = await ipcRenderer.invoke("fs:exists", savedPath);
        if (exists) {
          targetPath = savedPath;
          this.logger.info(`[FileExplorerStore] Using localStorage saved path: ${savedPath}`);
        } else {
          // 존재하지 않는 경로는 localStorage에서 제거
          this.removePathFromStorage();
          this.logger.warn(`[FileExplorerStore] Saved path no longer exists: ${savedPath}`);
        }
      } catch (err) {
        this.logger.warn(`[FileExplorerStore] Failed to check localStorage path: ${savedPath}`, err);
      }
    }

    // 3. 홈 디렉토리 사용 (아무것도 설정되지 않은 경우)
    if (!targetPath) {
      try {
        const homePath = await ipcRenderer.invoke("fs:getHomePath");
        if (homePath) {
          const exists = await ipcRenderer.invoke("fs:exists", homePath);
          if (exists) {
            targetPath = homePath;
            this.logger.info(`[FileExplorerStore] Using home directory: ${homePath}`);
          }
        }
      } catch (err) {
        this.logger.warn("[FileExplorerStore] Failed to get home directory", err);
      }
    }

    // 경로가 결정되면 폴더 열기
    if (targetPath) {
      try {
        await this.openFolder(targetPath);
        // 저장된 펼침 상태 복원
        await this.restoreExpandedPaths();
        this.logger.info(`[FileExplorerStore] Restored path: ${targetPath}`);
      } catch (err) {
        this.logger.error(`[FileExplorerStore] Failed to restore path: ${targetPath}`, err);
      }
    }
  }

  /**
   * 엔트리 목록 정렬 (디렉토리 우선, 알파벳순)
   * 📝 FIX-002: 각 엔트리를 Observable로 생성
   * 📝 FIX-018: showHiddenFiles에 따라 숨김 파일 필터링
   */
  private sortEntries(entries: FileEntry[]): FileEntry[] {
    return (
      [...entries]
        // 🆕 FIX-018: 숨김 파일 필터링 (. 으로 시작하는 파일/폴더)
        .filter((entry) => {
          if (this.showHiddenFiles) return true;
          return !entry.name.startsWith(".");
        })
        .sort((a, b) => {
          // 디렉토리 우선
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // 알파벳순
          return a.name.localeCompare(b.name);
        })
        .map((entry) => this.createObservableEntry(entry))
    );
  }

  /**
   * localStorage에 경로 저장
   * 📝 FIX-019: 글로벌 키 사용 (클러스터 무관)
   */
  private savePathToStorage(path: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, path);
    } catch (err) {
      this.logger.warn("[FileExplorerStore] Failed to save path to localStorage", err);
    }
  }

  /**
   * localStorage에서 경로 제거
   * 📝 FIX-019: 글로벌 키 사용 (클러스터 무관)
   */
  private removePathFromStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      this.logger.warn("[FileExplorerStore] Failed to remove path from localStorage", err);
    }
  }

  /**
   * 펼쳐진 경로 저장
   * 📝 FIX-019: 글로벌 키 사용 (클러스터 무관)
   */
  private saveExpandedPathsToStorage(): void {
    try {
      const paths = Array.from(this.expandedPaths);
      localStorage.setItem(EXPANDED_PATHS_KEY, JSON.stringify(paths));
    } catch (err) {
      this.logger.warn("[FileExplorerStore] Failed to save expanded paths to localStorage", err);
    }
  }

  /**
   * 숨김 파일 설정 저장
   */
  private saveShowHiddenToStorage(): void {
    try {
      localStorage.setItem(SHOW_HIDDEN_KEY, String(this.showHiddenFiles));
    } catch (err) {
      this.logger.warn("[FileExplorerStore] Failed to save showHiddenFiles to localStorage", err);
    }
  }

  /**
   * 저장된 펼침 상태 복원 (재귀적)
   * 📝 FIX-002: 내부 Observable 엔트리 참조 사용
   */
  @action
  private async restoreExpandedPaths(): Promise<void> {
    if (this.expandedPaths.size === 0) {
      return;
    }

    // 루트부터 재귀적으로 펼치기
    const expandRecursively = async (entries: FileEntry[]): Promise<void> => {
      for (const entry of entries) {
        if (entry.isDirectory && this.expandedPaths.has(entry.path)) {
          // 🆕 FIX-002: 내부 Observable 엔트리 참조 사용
          const internalEntry = this.entryMap.get(entry.path);
          if (!internalEntry) {
            this.logger.warn(`[FileExplorerStore] Entry not found during restore: ${entry.path}`);
            continue;
          }

          try {
            const children = await ipcRenderer.invoke("fs:readDir", entry.path);
            runInAction(() => {
              internalEntry.children = this.sortEntries(children);
              internalEntry.isExpanded = true;
            });
            // 하위 디렉토리도 재귀적으로 펼치기
            if (internalEntry.children) {
              await expandRecursively(internalEntry.children);
            }
          } catch (err) {
            this.logger.warn(`[FileExplorerStore] Failed to expand: ${entry.path}`, err);
          }
        }
      }
    };

    await expandRecursively(this.rootEntries);
    this.logger.info(`[FileExplorerStore] Restored ${this.expandedPaths.size} expanded paths`);
  }

  // ========== 파일 조작 메서드 ==========

  /**
   * 새 파일 생성
   * @param parentPath - 부모 디렉토리 경로
   * @param fileName - 새 파일 이름
   */
  @action
  async createFile(parentPath: string, fileName: string): Promise<boolean> {
    try {
      const newPath = `${parentPath}/${fileName}`;
      const result = await ipcRenderer.invoke("fs:createFile", newPath);
      if (result.success) {
        await this.refresh();
        this.logger.info(`[FileExplorerStore] Created file: ${newPath}`);
        return true;
      }
      this.logger.error(`[FileExplorerStore] Failed to create file: ${result.error}`);
      return false;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to create file`, err);
      return false;
    }
  }

  /**
   * 새 폴더 생성
   * @param parentPath - 부모 디렉토리 경로
   * @param folderName - 새 폴더 이름
   */
  @action
  async createFolder(parentPath: string, folderName: string): Promise<boolean> {
    try {
      const newPath = `${parentPath}/${folderName}`;
      const result = await ipcRenderer.invoke("fs:createDir", newPath);
      if (result.success) {
        await this.refresh();
        this.logger.info(`[FileExplorerStore] Created folder: ${newPath}`);
        return true;
      }
      this.logger.error(`[FileExplorerStore] Failed to create folder: ${result.error}`);
      return false;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to create folder`, err);
      return false;
    }
  }

  /**
   * 파일/폴더 삭제
   * @param path - 삭제할 경로
   */
  @action
  async delete(path: string): Promise<boolean> {
    try {
      const result = await ipcRenderer.invoke("fs:delete", path);
      if (result.success) {
        await this.refresh();
        this.logger.info(`[FileExplorerStore] Deleted: ${path}`);
        return true;
      }
      this.logger.error(`[FileExplorerStore] Failed to delete: ${result.error}`);
      return false;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to delete`, err);
      return false;
    }
  }

  /**
   * 파일/폴더 이름 변경
   * @param oldPath - 기존 경로
   * @param newName - 새 이름
   */
  @action
  async rename(oldPath: string, newName: string): Promise<boolean> {
    try {
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${parentDir}/${newName}`;
      const result = await ipcRenderer.invoke("fs:rename", oldPath, newPath);
      if (result.success) {
        await this.refresh();
        this.logger.info(`[FileExplorerStore] Renamed: ${oldPath} -> ${newPath}`);
        return true;
      }
      this.logger.error(`[FileExplorerStore] Failed to rename: ${result.error}`);
      return false;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to rename`, err);
      return false;
    }
  }

  /**
   * 파일/폴더 복사 (내부 클립보드 + OS 클립보드에 동시 기록)
   * 🆕 OS 클립보드에도 기록하여 Internal → External 지원
   * 📝 동기 메서드 유지 — OS clipboard 쓰기는 fire-and-forget (main process 블로킹 방지)
   * @param path - 복사할 경로
   */
  @action
  copyToClipboard(path: string): void {
    this.clipboardPath = path;
    this.clipboardAction = "copy";
    this.lastExternalDropPaths = []; // DnD 잔류 데이터 초기화
    this.logger.info(`[FileExplorerStore] Copied to clipboard: ${path}`);
    // OS 클립보드에도 기록 (Internal → External 지원, fire-and-forget)
    ipcRenderer.invoke("fs:clipboard:writeFiles", [path]).catch((err) => {
      this.logger.warn(`[FileExplorerStore] Failed to write to OS clipboard`, err);
    });
  }

  /**
   * 파일/폴더 잘라내기 (클립보드에 저장)
   * 🆕 OS 클립보드에도 기록 (pasteFromOS 비교 로직 일관성)
   * @param path - 잘라낼 경로
   */
  @action
  cutToClipboard(path: string): void {
    this.clipboardPath = path;
    this.clipboardAction = "cut";
    this.lastExternalDropPaths = []; // DnD 잔류 데이터 초기화
    this.logger.info(`[FileExplorerStore] Cut to clipboard: ${path}`);
    // OS 클립보드에도 기록 (pasteFromOS에서 내부/외부 비교 시 필요)
    ipcRenderer.invoke("fs:clipboard:writeFiles", [path]).catch((err) => {
      this.logger.warn(`[FileExplorerStore] Failed to write to OS clipboard`, err);
    });
  }

  /**
   * 붙여넣기 전 충돌 여부 확인
   * @param targetDir - 붙여넣을 대상 디렉토리
   * @returns 충돌 파일 이름 (없으면 null)
   */
  async checkPasteConflict(targetDir: string): Promise<string | null> {
    if (!this.clipboardPath) return null;
    const fileName = this.clipboardPath.split("/").pop() || "";
    const destPath = `${targetDir}/${fileName}`;

    // 같은 위치에 붙여넣기 시 충돌 체크 생략 (자동 이름변경 처리)
    if (this.clipboardPath === destPath) return null;

    const exists = await ipcRenderer.invoke("fs:exists", destPath);
    return exists ? fileName : null;
  }

  /**
   * 클립보드에서 붙여넣기
   * @param targetDir - 붙여넣을 대상 디렉토리
   * @param overwrite - true: 덮어쓰기, false: 자동 이름변경 (_copy1)
   */
  @action
  async paste(targetDir: string, overwrite = true): Promise<boolean> {
    if (!this.clipboardPath || !this.clipboardAction) {
      return false;
    }

    try {
      const fileName = this.clipboardPath.split("/").pop() || "";
      let destPath = `${targetDir}/${fileName}`;

      // 같은 위치에 붙여넣기: 항상 자동 이름변경
      if (this.clipboardPath === destPath) {
        overwrite = false;
      }

      // 동일 이름 존재 시 자동 이름변경 (_copy1, _copy2, ...)
      if (!overwrite) {
        const exists = await ipcRenderer.invoke("fs:exists", destPath);
        if (exists) {
          const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
          const baseName = ext ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName;
          let counter = 1;
          const MAX_COPY_SUFFIX = 100;
          do {
            destPath = `${targetDir}/${baseName}_copy${counter}${ext}`;
            counter++;
          } while (counter <= MAX_COPY_SUFFIX && (await ipcRenderer.invoke("fs:exists", destPath)));
        }
      }

      if (this.clipboardAction === "copy") {
        const result = await ipcRenderer.invoke("fs:copy", this.clipboardPath, destPath);
        if (!result.success) {
          this.logger.error(`[FileExplorerStore] Failed to paste: ${result.error}`);
          return false;
        }
      } else {
        // cut = copy + delete
        const copyResult = await ipcRenderer.invoke("fs:copy", this.clipboardPath, destPath);
        if (!copyResult.success) {
          this.logger.error(`[FileExplorerStore] Failed to paste: ${copyResult.error}`);
          return false;
        }
        const deleteResult = await ipcRenderer.invoke("fs:delete", this.clipboardPath);
        if (!deleteResult.success) {
          this.logger.warn(`[FileExplorerStore] Failed to delete source after cut: ${deleteResult.error}`);
        }
        // 클립보드 초기화
        this.clipboardPath = null;
        this.clipboardAction = null;
      }

      await this.refresh();
      this.logger.info(`[FileExplorerStore] Pasted to: ${destPath}`);
      return true;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to paste`, err);
      return false;
    }
  }

  /**
   * 클립보드에 항목이 있는지 확인
   */
  @computed
  get hasClipboard(): boolean {
    return this.clipboardPath !== null;
  }

  /**
   * 🆕 OS 클립보드에서 파일 경로 읽기 (External → Internal)
   * 📝 항상 OS 클립보드를 먼저 확인하고, 내부 클립보드와 비교하여 소스 결정:
   *   - OS 클립보드 파일 경로가 내부와 다르면 → external (Finder에서 복사된 것)
   *   - OS 클립보드 파일 경로가 내부와 같으면 → internal (앱에서 복사된 것)
   *   - OS 클립보드가 비어있으면 → internal 폴백
   * @param _targetDir - 붙여넣을 대상 디렉토리 (예약)
   * @returns { source: 'internal' | 'external' | 'none', filePaths?: string[] }
   */
  async pasteFromOS(_targetDir: string): Promise<{
    source: "internal" | "external" | "none";
    filePaths?: string[];
  }> {
    // 1. OS 클립보드에서 파일 경로 읽기 (항상 먼저 확인)
    // 🆕 Windows 경로 정규화 안전장치 (IPC에서 이미 정규화하지만 방어적 처리)
    let osFilePaths: string[] = [];
    try {
      const result = await ipcRenderer.invoke("fs:clipboard:readFiles");
      if (result?.success && result?.filePaths?.length > 0) {
        osFilePaths =
          process.platform === "win32" ? result.filePaths.map((p: string) => p.replace(/\\/g, "/")) : result.filePaths;
      }
    } catch (err) {
      this.logger.warn(`[FileExplorerStore] Failed to read from OS clipboard`, err);
    }

    // 2. OS 클립보드에 파일이 있으면 내부 클립보드와 비교
    if (osFilePaths.length > 0) {
      const isSameAsInternal = this.clipboardPath && osFilePaths.length === 1 && osFilePaths[0] === this.clipboardPath;

      // 🆕 DnD 잔류 데이터 필터링
      // Windows OLE DnD 후 OS 클립보드에 드래그 파일 경로가 잔류할 수 있음
      const isDropResidue =
        this.lastExternalDropPaths.length > 0 &&
        osFilePaths.length === this.lastExternalDropPaths.length &&
        osFilePaths.every((p) => this.lastExternalDropPaths.includes(p));

      if (!isSameAsInternal && !isDropResidue) {
        this.logger.info(`[FileExplorerStore] OS clipboard has external files: ${osFilePaths.join(", ")}`);
        return { source: "external", filePaths: osFilePaths };
      }

      if (isDropResidue) {
        this.logger.info(`[FileExplorerStore] OS clipboard contains DnD residue, ignoring`);
      }
    }

    // 3. 내부 클립보드 사용 (OS 클립보드가 비어있거나 동일한 경로)
    if (this.clipboardPath && this.clipboardAction) {
      return { source: "internal" };
    }

    return { source: "none" };
  }

  // ========== 🆕 FIX-027: 인라인 생성 (VSCode 스타일) ==========

  /**
   * 인라인 생성 모드 시작
   * @param parentPath - 부모 디렉토리 경로
   * @param type - 생성 타입 (file/folder)
   */
  @action
  startInlineCreate(parentPath: string, type: "file" | "folder"): void {
    this.inlineCreateParentPath = parentPath;
    this.inlineCreateType = type;
    this.treeVersion++; // UI 업데이트 트리거
    this.logger.debug(`[FileExplorerStore] Started inline create: ${type} in ${parentPath}`);
  }

  /**
   * 인라인 생성 모드 취소
   */
  @action
  cancelInlineCreate(): void {
    this.inlineCreateParentPath = null;
    this.inlineCreateType = null;
    this.treeVersion++;
    this.logger.debug("[FileExplorerStore] Cancelled inline create");
  }

  /**
   * 인라인 생성 완료
   * @param name - 새 파일/폴더 이름
   */
  @action
  async confirmInlineCreate(name: string): Promise<boolean> {
    if (!this.inlineCreateParentPath || !this.inlineCreateType || !name.trim()) {
      this.cancelInlineCreate();
      return false;
    }

    const parentPath = this.inlineCreateParentPath;
    const type = this.inlineCreateType;
    const trimmedName = name.trim();

    // 상태 초기화 (먼저 초기화하여 UI가 빠르게 반응)
    this.inlineCreateParentPath = null;
    this.inlineCreateType = null;

    try {
      const newPath = `${parentPath}/${trimmedName}`;

      if (type === "file") {
        const result = await ipcRenderer.invoke("fs:createFile", newPath);
        if (result.success) {
          await this.refresh();
          this.selectEntry(newPath);
          this.logger.info(`[FileExplorerStore] Created file inline: ${newPath}`);
          return true;
        }
        this.logger.error(`[FileExplorerStore] Failed to create file inline: ${result.error}`);
      } else {
        const result = await ipcRenderer.invoke("fs:createDir", newPath);
        if (result.success) {
          await this.refresh();
          this.selectEntry(newPath);
          this.logger.info(`[FileExplorerStore] Created folder inline: ${newPath}`);
          return true;
        }
        this.logger.error(`[FileExplorerStore] Failed to create folder inline: ${result.error}`);
      }
      return false;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to create inline`, err);
      return false;
    }
  }

  // ========== 인라인 리네임 (VSCode 스타일) ==========

  /**
   * 인라인 리네임 모드 시작
   * @param path - 리네임할 파일/폴더 경로
   */
  @action
  startRename(path: string): void {
    this.renamingPath = path;
    this.treeVersion++;
    this.logger.debug(`[FileExplorerStore] Started inline rename: ${path}`);
  }

  /**
   * 인라인 리네임 모드 취소
   */
  @action
  cancelRename(): void {
    this.renamingPath = null;
    this.treeVersion++;
    this.logger.debug("[FileExplorerStore] Cancelled inline rename");
  }

  /**
   * 인라인 리네임 완료
   * @param newName - 새 파일/폴더 이름
   */
  @action
  async confirmRename(newName: string): Promise<boolean> {
    if (!this.renamingPath || !newName.trim()) {
      this.cancelRename();
      return false;
    }

    const oldPath = this.renamingPath;
    const trimmedName = newName.trim();

    // 상태 초기화 (먼저 초기화하여 UI가 빠르게 반응)
    this.renamingPath = null;

    const result = await this.rename(oldPath, trimmedName);
    if (!result) {
      this.logger.error(`[FileExplorerStore] Failed to confirm rename: ${oldPath} -> ${trimmedName}`);
    }
    return result;
  }

  // ========== 고급 파일 조작 메서드 ==========

  /**
   * 파일/폴더 복제
   * @param path - 복제할 경로
   * @returns 성공 시 새 경로, 실패 시 null
   */
  @action
  async duplicate(path: string): Promise<string | null> {
    try {
      const result = await ipcRenderer.invoke("fs:duplicate", path);
      if (result.success && result.newPath) {
        await this.refresh();
        this.logger.info(`[FileExplorerStore] Duplicated: ${path} -> ${result.newPath}`);
        return result.newPath;
      }
      this.logger.error(`[FileExplorerStore] Failed to duplicate: ${result.error}`);
      return null;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to duplicate`, err);
      return null;
    }
  }

  /**
   * 선택한 폴더를 루트로 설정
   * @param path - 새 루트 경로
   */
  @action
  async setAsRoot(path: string): Promise<boolean> {
    try {
      // 경로가 디렉토리인지 확인
      const stat = await ipcRenderer.invoke("fs:stat", path);
      if (!stat?.isDirectory) {
        this.logger.warn(`[FileExplorerStore] Cannot set file as root: ${path}`);
        return false;
      }

      // 펼쳐진 경로 초기화
      this.expandedPaths.clear();
      this.saveExpandedPathsToStorage();

      // 새 루트로 폴더 열기
      await this.openFolder(path);
      this.logger.info(`[FileExplorerStore] Set as root: ${path}`);
      return true;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to set as root`, err);
      return false;
    }
  }

  /**
   * 파일 상세 정보 조회
   * @param path - 파일 경로
   */
  async getFileInfo(path: string): Promise<{
    success: boolean;
    name?: string;
    path?: string;
    isDirectory?: boolean;
    size?: number;
    sizeFormatted?: string;
    createdAt?: string;
    modifiedAt?: string;
    permissions?: string;
    error?: string;
  }> {
    try {
      return await ipcRenderer.invoke("fs:getFileInfo", path);
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to get file info`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /**
   * 시스템 파일 탐색기에서 파일/폴더 표시
   * @param path - 표시할 경로
   */
  async revealInExplorer(path: string): Promise<boolean> {
    try {
      const result = await ipcRenderer.invoke("fs:revealInExplorer", path);
      if (result.success) {
        this.logger.info(`[FileExplorerStore] Revealed in explorer: ${path}`);
        return true;
      }
      this.logger.error(`[FileExplorerStore] Failed to reveal: ${result.error}`);
      return false;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to reveal in explorer`, err);
      return false;
    }
  }

  /**
   * YAML 파일 검증
   * @param path - YAML 파일 경로
   * @param validateK8sSchema - K8s 스키마 검증 여부
   */
  async validateYaml(
    path: string,
    validateK8sSchema = true,
  ): Promise<{
    success: boolean;
    isValid: boolean;
    errors: Array<{
      type: "syntax" | "schema";
      message: string;
      line?: number;
      column?: number;
      path?: string;
    }>;
    resourceKind?: string;
    apiVersion?: string;
    error?: string;
  }> {
    try {
      return await ipcRenderer.invoke("fs:validateYaml", {
        filePath: path,
        validateK8sSchema,
      });
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Failed to validate YAML`, err);
      return {
        success: false,
        isValid: false,
        errors: [],
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // ========== 🆕 드래그 앤 드롭 ==========

  /**
   * 드래그 소스 경로 설정
   */
  @action
  setDragSource(path: string | null): void {
    this.dragSourcePath = path;
  }

  /**
   * 드래그 오버 대상 경로 설정
   */
  @action
  setDragOver(path: string | null): void {
    this.dragOverPath = path;
  }

  /**
   * 외부 드래그 여부 설정
   */
  @action
  setExternalDrag(value: boolean): void {
    this.isExternalDrag = value;
  }

  /**
   * 드래그 상태 초기화
   */
  @action
  clearDragState(): void {
    this.dragSourcePath = null;
    this.dragOverPath = null;
    this.isExternalDrag = false;
  }

  /**
   * 파일/폴더 이동 (내부 DnD)
   * @param sourcePath - 이동할 소스 경로
   * @param targetDirPath - 이동 대상 디렉토리 경로
   * @param overwrite - 덮어쓰기 여부
   * @returns "success" | "dest_exists" | "error"
   */
  @action
  async moveEntry(
    sourcePath: string,
    targetDirPath: string,
    overwrite = false,
  ): Promise<"success" | "dest_exists" | "error"> {
    // 같은 위치로 이동 → 무시
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf("/"));
    if (sourceDir === targetDirPath) {
      this.logger.debug(`[FileExplorerStore] Move ignored: same directory`);
      return "success";
    }

    // 자기 자신에게 이동 → 무시
    if (sourcePath === targetDirPath) {
      this.logger.debug(`[FileExplorerStore] Move ignored: same path`);
      return "success";
    }

    // 순환 참조 방지 (폴더를 자기 하위로 이동)
    if (targetDirPath.startsWith(sourcePath + "/")) {
      this.logger.warn(`[FileExplorerStore] Move blocked: circular reference`);
      return "error";
    }

    try {
      const fileName = sourcePath.split("/").pop() || "";
      const destPath = `${targetDirPath}/${fileName}`;

      const result = await ipcRenderer.invoke("fs:move", sourcePath, destPath, overwrite);

      if (result.success) {
        await this.refresh();
        this.logger.info(`[FileExplorerStore] Moved: ${sourcePath} -> ${destPath}`);
        return "success";
      }

      if (result.error === "DEST_EXISTS") {
        return "dest_exists";
      }

      this.logger.error(`[FileExplorerStore] Move failed: ${result.error}`);
      return "error";
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Move error`, err);
      return "error";
    }
  }

  /**
   * 외부 파일 복사 시 충돌 파일명 확인
   * @param filePaths - 복사할 외부 파일 경로 목록
   * @param targetDirPath - 복사 대상 디렉토리 경로
   * @returns 충돌하는 파일명 목록 (빈 배열이면 충돌 없음)
   */
  async checkCopyConflicts(filePaths: string[], targetDirPath: string): Promise<string[]> {
    const conflicts: string[] = [];
    for (const sourcePath of filePaths) {
      const fileName = sourcePath.split("/").pop() || "";
      const destPath = `${targetDirPath}/${fileName}`;
      const exists = await ipcRenderer.invoke("fs:exists", destPath);
      if (exists) {
        conflicts.push(fileName);
      }
    }
    return conflicts;
  }

  /**
   * 외부 파일 복사 (외부→내부 DnD)
   * @param filePaths - 복사할 외부 파일 경로 목록
   * @param targetDirPath - 복사 대상 디렉토리 경로
   * @param overwrite - true: 덮어쓰기, false: 자동 이름변경 (_copy1)
   * @returns 성공 여부
   */
  @action
  async copyExternalFiles(filePaths: string[], targetDirPath: string, overwrite = false): Promise<boolean> {
    try {
      let hasFailure = false;

      for (const sourcePath of filePaths) {
        const fileName = sourcePath.split("/").pop() || "";
        let destPath = `${targetDirPath}/${fileName}`;

        if (!overwrite) {
          // 동일 이름 존재 시 _copy1, _copy2 접미사 자동 부여
          const exists = await ipcRenderer.invoke("fs:exists", destPath);
          if (exists) {
            const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
            const baseName = ext ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName;
            let counter = 1;
            const MAX_COPY_SUFFIX = 100;
            do {
              destPath = `${targetDirPath}/${baseName}_copy${counter}${ext}`;
              counter++;
            } while (counter <= MAX_COPY_SUFFIX && (await ipcRenderer.invoke("fs:exists", destPath)));
          }
        }

        const result = await ipcRenderer.invoke("fs:copy", sourcePath, destPath);
        if (!result.success) {
          this.logger.error(
            `[FileExplorerStore] Copy external file failed: ${sourcePath} → ${destPath}, error: ${result.error}`,
          );
          hasFailure = true;
        }
      }

      await this.refresh();

      // 🆕 DnD 잔류 경로 기록 (pasteFromOS에서 필터링용)
      this.lastExternalDropPaths = [...filePaths];

      this.logger.info(`[FileExplorerStore] Copied ${filePaths.length} external files to ${targetDirPath}`);
      return !hasFailure;
    } catch (err) {
      this.logger.error(`[FileExplorerStore] Copy external files error`, err);
      return false;
    }
  }

  /**
   * 네이티브 OS 드래그 시작 (내부→외부 DnD)
   * @param filePath - 드래그할 파일 경로
   */
  startNativeDrag(filePath: string): void {
    ipcRenderer.invoke("fs:startDrag", filePath).catch((err) => {
      this.logger.error(`[FileExplorerStore] Failed to start native drag`, err);
    });
  }
}
