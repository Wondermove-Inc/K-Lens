/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

import type { ColumnWidthStorageData } from "./column-width-store";

/**
 * 🎯 목적: 컬럼 너비 설정을 localStorage에 저장/불러오기 하는 스토리지 서비스
 *
 * 🔧 기능:
 * - 브라우저 localStorage에 컬럼 너비 설정 영구 저장
 * - 애플리케이션 재시작 시 이전 설정 복원
 * - 에러 처리로 안정적인 저장/불러오기
 */
const columnWidthStorageInjectable = getInjectable({
  id: "column-width-storage",
  instantiate: () => {
    const STORAGE_KEY = "daive:column-widths";

    return {
      /**
       * 🎯 목적: localStorage에서 컬럼 너비 데이터 불러오기
       * @returns 저장된 컬럼 너비 데이터 또는 undefined
       */
      get(): ColumnWidthStorageData | undefined {
        try {
          const data = localStorage.getItem(STORAGE_KEY);
          return data ? JSON.parse(data) : undefined;
        } catch (error) {
          console.warn("컬럼 너비 데이터 불러오기 실패:", error);
          return undefined;
        }
      },

      /**
       * 🎯 목적: 컬럼 너비 데이터를 localStorage에 저장
       * @param data 저장할 컬럼 너비 데이터
       */
      set(data: ColumnWidthStorageData): void {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
          console.warn("컬럼 너비 데이터 저장 실패:", error);
        }
      },

      /**
       * 🎯 목적: 저장된 모든 컬럼 너비 데이터 삭제
       */
      clear(): void {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          console.warn("컬럼 너비 데이터 삭제 실패:", error);
        }
      },
    };
  },
});

export default columnWidthStorageInjectable;
