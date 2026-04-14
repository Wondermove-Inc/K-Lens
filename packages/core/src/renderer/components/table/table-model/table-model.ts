/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { StorageLayer } from "../../../utils/storage-helper";
import type { TableSortParams } from "../table";

export interface TableColumnWidths {
  [columnId: string]: number;
}

export interface TableStorageModel {
  sortParams: {
    [tableId: string]: Partial<TableSortParams>;
  };
  columnWidths: {
    [tableId: string]: TableColumnWidths;
  };
}

interface Dependencies {
  storage: StorageLayer<TableStorageModel>;
}

export class TableModel {
  constructor(private dependencies: Dependencies) {}

  getSortParams = (tableId: string): Partial<TableSortParams> => this.dependencies.storage.get().sortParams[tableId];

  setSortParams = (tableId: string, sortParams: Partial<TableSortParams>): void => {
    this.dependencies.storage.merge((draft) => {
      draft.sortParams[tableId] = sortParams;
    });
  };

  /**
   * 🎯 목적: 특정 테이블의 컬럼 너비 설정 가져오기
   * @param tableId 테이블 ID
   * @returns 컬럼별 너비 설정 객체
   */
  getColumnWidths = (tableId: string): TableColumnWidths => {
    return this.dependencies.storage.get().columnWidths?.[tableId] || {};
  };

  /**
   * 🎯 목적: 특정 컬럼의 너비 저장
   * @param tableId 테이블 ID
   * @param columnId 컬럼 ID
   * @param width 새로운 너비 (픽셀)
   */
  setColumnWidth = (tableId: string, columnId: string, width: number): void => {
    this.dependencies.storage.merge((draft) => {
      if (!draft.columnWidths) {
        draft.columnWidths = {};
      }
      if (!draft.columnWidths[tableId]) {
        draft.columnWidths[tableId] = {};
      }
      draft.columnWidths[tableId][columnId] = width;
    });
  };

  /**
   * 🎯 목적: 특정 테이블의 모든 컬럼 너비 초기화
   * @param tableId 테이블 ID
   */
  resetColumnWidths = (tableId: string): void => {
    this.dependencies.storage.merge((draft) => {
      if (draft.columnWidths?.[tableId]) {
        delete draft.columnWidths[tableId];
      }
    });
  };
}
