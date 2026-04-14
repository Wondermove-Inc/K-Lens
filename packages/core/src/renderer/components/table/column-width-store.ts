/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, computed, makeObservable, observable } from "mobx";

/**
 * 🎯 목적: 테이블 컬럼 너비 상태 관리 인터페이스
 */
export interface ColumnWidthConfig {
  /** 컬럼 ID */
  id: string;
  /** 기본 너비 (px) */
  defaultWidth: number;
  /** 최소 너비 (px) */
  minWidth: number;
  /** 최대 너비 (px) */
  maxWidth: number;
  /** 리사이즈 가능 여부 */
  resizable: boolean;
}

/**
 * 🎯 목적: 테이블별 컬럼 너비 데이터 저장 구조
 */
export interface TableColumnWidths {
  [columnId: string]: number;
}

/**
 * 🎯 목적: 전체 저장 데이터 구조
 */
export interface ColumnWidthStorageData {
  version: number;
  tables: {
    [tableId: string]: TableColumnWidths;
  };
}

/**
 * 🎯 목적: 테이블 가상화 환경에서 안정적인 컬럼 너비 관리를 위한 상태 저장소
 *
 * 🔧 핵심 기능:
 * - 테이블별 컬럼 너비 상태 관리
 * - localStorage 자동 저장/복원
 * - 가상화된 DOM 요소와 독립적인 상태 기반 너비 제어
 * - 드래그 리사이즈 시 실시간 동기화
 * - 배치 업데이트 및 debounced 저장으로 성능 최적화
 *
 * 📝 사용법:
 * const store = new ColumnWidthStore(storage);
 * store.setColumnWidth("pods-table", "name", 250);
 * const width = store.getColumnWidth("pods-table", "name");
 */
export class ColumnWidthStore {
  /**
   * 🗂️ 컬럼 설정 정보 (테이블별)
   * Key: tableId, Value: 컬럼 설정 배열
   */
  @observable
  private columnConfigs = new Map<string, Map<string, ColumnWidthConfig>>();

  /**
   * 🎯 사용자가 조정한 컬럼 너비 (테이블별)
   * Key: tableId, Value: {columnId: width}
   */
  @observable
  private userWidths = new Map<string, Map<string, number>>();

  /**
   * ⚡ 성능 최적화: 배치 업데이트를 위한 임시 저장소
   */
  private pendingUpdates = new Map<string, Map<string, number>>();

  /**
   * ⚡ 성능 최적화: debounced 저장을 위한 타이머
   */
  private saveTimer: NodeJS.Timeout | null = null;

  /**
   * 💾 localStorage 저장/불러오기를 위한 스토리지 서비스
   */
  private storage: {
    get: () => ColumnWidthStorageData | undefined;
    set: (data: ColumnWidthStorageData) => void;
  };

  constructor(storage: {
    get: () => ColumnWidthStorageData | undefined;
    set: (data: ColumnWidthStorageData) => void;
  }) {
    makeObservable(this);
    this.storage = storage;
    this.loadFromStorage();
  }

  /**
   * 🎯 목적: 테이블의 컬럼 설정 등록
   * @param tableId 테이블 식별자
   * @param configs 컬럼 설정 배열
   */
  @action
  registerTable(tableId: string, configs: ColumnWidthConfig[]): void {
    const columnConfigMap = new Map<string, ColumnWidthConfig>();
    configs.forEach((config) => {
      columnConfigMap.set(config.id, config);
    });
    this.columnConfigs.set(tableId, columnConfigMap);
  }

  /**
   * 🎯 목적: 컬럼 너비 설정 (사용자 드래그 조정) - 성능 최적화 버전
   * @param tableId 테이블 식별자
   * @param columnId 컬럼 식별자
   * @param width 새로운 너비 (px)
   */
  @action
  setColumnWidth(tableId: string, columnId: string, width: number): void {
    // 🛡️ 최소/최대 너비 제한 적용
    const config = this.getColumnConfig(tableId, columnId);
    const clampedWidth = Math.max(config?.minWidth || 50, Math.min(config?.maxWidth || 1000, width));

    // 🗂️ 테이블별 너비 맵 초기화 (필요시)
    if (!this.userWidths.has(tableId)) {
      this.userWidths.set(tableId, new Map());
    }

    // 🎯 즉시 상태 업데이트 (UI 반응성)
    this.userWidths.get(tableId)!.set(columnId, clampedWidth);

    // ⚡ debounced 저장 (성능 최적화)
    this.debouncedSave();
  }

  /**
   * ⚡ 목적: 배치 업데이트 - 여러 컬럼 너비를 한 번에 설정
   * @param tableId 테이블 식별자
   * @param updates 컬럼별 너비 업데이트 맵
   */
  @action
  setMultipleColumnWidths(tableId: string, updates: Map<string, number>): void {
    // 🗂️ 테이블별 너비 맵 초기화 (필요시)
    if (!this.userWidths.has(tableId)) {
      this.userWidths.set(tableId, new Map());
    }

    const tableWidths = this.userWidths.get(tableId)!;

    // 🛡️ 각 컬럼에 최소/최대 너비 제한 적용 후 배치 업데이트
    updates.forEach((width, columnId) => {
      const config = this.getColumnConfig(tableId, columnId);
      const clampedWidth = Math.max(config?.minWidth || 50, Math.min(config?.maxWidth || 1000, width));
      tableWidths.set(columnId, clampedWidth);
    });

    // ⚡ debounced 저장 (성능 최적화)
    this.debouncedSave();
  }

  /**
   * ⚡ 목적: debounced 저장 - 짧은 시간 내 여러 변경사항을 한 번에 저장
   */
  private debouncedSave(): void {
    // 🔄 기존 타이머 취소
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    // 🎯 새 타이머 설정 (500ms 후 저장)
    this.saveTimer = setTimeout(() => {
      this.saveToStorage();
      this.saveTimer = null;
    }, 500);
  }

  /**
   * 🎯 목적: 컬럼 너비 조회 (사용자 설정 또는 기본값)
   * @param tableId 테이블 식별자
   * @param columnId 컬럼 식별자
   * @returns 현재 컬럼 너비 (px)
   */
  getColumnWidth(tableId: string, columnId: string): number {
    // 🔍 사용자 설정 너비 확인
    const userWidth = this.userWidths.get(tableId)?.get(columnId);
    if (userWidth !== undefined) {
      return userWidth;
    }

    // 🔄 기본 너비 반환
    const config = this.getColumnConfig(tableId, columnId);
    return config?.defaultWidth || 120;
  }

  /**
   * 🎯 목적: 테이블 전체 컬럼 너비 조회
   * @param tableId 테이블 식별자
   * @returns 컬럼별 너비 맵
   */
  getTableColumnWidths(tableId: string): Map<string, number> {
    const result = new Map<string, number>();
    const configs = this.columnConfigs.get(tableId);

    if (configs) {
      configs.forEach((config, columnId) => {
        result.set(columnId, this.getColumnWidth(tableId, columnId));
      });
    }

    return result;
  }

  /**
   * 🎯 목적: 테이블의 모든 컬럼 설정 정보 조회
   * @param tableId 테이블 식별자
   * @returns 컬럼별 설정 정보 맵
   */
  getTableColumnConfigs(tableId: string): Map<string, ColumnWidthConfig> | undefined {
    return this.columnConfigs.get(tableId);
  }

  /**
   * 🎯 목적: 특정 컬럼이 사용자 커스텀 너비를 가지고 있는지 확인
   * @param tableId 테이블 식별자
   * @param columnId 컬럼 식별자
   * @returns 사용자 설정 너비 존재 여부
   */
  hasUserWidth(tableId: string, columnId: string): boolean {
    return this.userWidths.get(tableId)?.has(columnId) ?? false;
  }

  /**
   * ⚡ 목적: 저장소 통계 정보 조회 (메모리 사용량 모니터링)
   */
  @computed
  get storageStats(): { tableCount: number; columnCount: number; estimatedMemoryKB: number } {
    let totalColumns = 0;

    this.userWidths.forEach((columns) => {
      totalColumns += columns.size;
    });

    // 🔍 대략적인 메모리 사용량 계산 (문자열 + 숫자 + Map 오버헤드)
    const estimatedMemoryKB = Math.ceil((this.userWidths.size * 64 + totalColumns * 32) / 1024);

    return {
      tableCount: this.userWidths.size,
      columnCount: totalColumns,
      estimatedMemoryKB,
    };
  }

  /**
   * 🎯 목적: 컬럼 설정 정보 조회
   * @param tableId 테이블 식별자
   * @param columnId 컬럼 식별자
   * @returns 컬럼 설정 정보
   */
  private getColumnConfig(tableId: string, columnId: string): ColumnWidthConfig | undefined {
    return this.columnConfigs.get(tableId)?.get(columnId);
  }

  /**
   * 🎯 목적: 컬럼 너비 초기화 (기본값으로 복원)
   * @param tableId 테이블 식별자
   * @param columnId 컬럼 식별자 (생략 시 전체 테이블)
   */
  @action
  resetColumnWidth(tableId: string, columnId?: string): void {
    if (columnId) {
      // 🎯 특정 컬럼만 초기화
      this.userWidths.get(tableId)?.delete(columnId);
    } else {
      // 🔄 전체 테이블 초기화
      this.userWidths.delete(tableId);
    }
    this.saveToStorage();
  }

  /**
   * 🎯 목적: localStorage에서 저장된 데이터 불러오기
   */
  @action
  private loadFromStorage(): void {
    try {
      const data = this.storage.get();
      if (data && data.version === 1) {
        // 🔄 저장된 데이터 복원
        Object.entries(data.tables).forEach(([tableId, columnWidths]) => {
          const tableWidthMap = new Map<string, number>();
          Object.entries(columnWidths).forEach(([columnId, width]) => {
            tableWidthMap.set(columnId, width);
          });
          this.userWidths.set(tableId, tableWidthMap);
        });
      }
    } catch (error) {
      console.warn("컬럼 너비 데이터 불러오기 실패:", error);
    }
  }

  /**
   * 🎯 목적: 현재 상태를 localStorage에 저장
   */
  private saveToStorage(): void {
    try {
      const data: ColumnWidthStorageData = {
        version: 1,
        tables: {},
      };

      // 🔄 Map 형태를 일반 객체로 변환
      this.userWidths.forEach((columnWidths, tableId) => {
        const tableData: TableColumnWidths = {};
        columnWidths.forEach((width, columnId) => {
          tableData[columnId] = width;
        });
        data.tables[tableId] = tableData;
      });

      this.storage.set(data);
    } catch (error) {
      console.warn("❌ 컬럼 너비 데이터 저장 실패:", error);
    }
  }

  /**
   * 🎯 목적: 모든 데이터 초기화 (공장 초기화)
   */
  @action
  clearAllData(): void {
    this.userWidths.clear();
    this.pendingUpdates.clear();
    this.clearSaveTimer();
    this.saveToStorage();
  }

  /**
   * ⚡ 목적: 리소스 정리 (메모리 누수 방지)
   */
  destroy(): void {
    this.clearSaveTimer();
    this.userWidths.clear();
    this.columnConfigs.clear();
    this.pendingUpdates.clear();
  }

  /**
   * 🔄 목적: 저장 타이머 정리 (메모리 누수 방지)
   */
  private clearSaveTimer(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * ⚡ 목적: 즉시 저장 (debounce 무시하고 강제 저장)
   */
  @action
  flushSave(): void {
    this.clearSaveTimer();
    this.saveToStorage();
  }

  /**
   * 🧹 목적: 오래된 테이블 설정 정리 (메모리 최적화)
   * @param activeTableIds 현재 활성화된 테이블 ID 목록
   */
  @action
  cleanupInactiveTables(activeTableIds: Set<string>): void {
    const tablesToRemove: string[] = [];

    // 🔍 비활성 테이블 찾기
    this.userWidths.forEach((_, tableId) => {
      if (!activeTableIds.has(tableId)) {
        tablesToRemove.push(tableId);
      }
    });

    // 🗑️ 비활성 테이블 데이터 제거
    tablesToRemove.forEach((tableId) => {
      this.userWidths.delete(tableId);
      this.columnConfigs.delete(tableId);
      this.pendingUpdates.delete(tableId);
    });

    // 💾 변경사항이 있으면 저장
    if (tablesToRemove.length > 0) {
      this.debouncedSave();
    }
  }
}
