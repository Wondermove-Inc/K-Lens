/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: TanStack Table 컬럼 리사이징 상태를 관리하는 커스텀 훅
 *
 * @remarks
 * - 컬럼 크기 변경 시 상태 업데이트
 * - 세션 동안만 유지 (새로고침 시 초기화)
 *
 * 🔄 변경이력:
 * - 2025-10-29: 초기 생성
 * - 2025-12-17: localStorage 저장 로직 제거
 */

import { useCallback, useState } from "react";

import type { ColumnSizingState } from "./types";

/**
 * 🎯 목적: 컬럼 리사이징 상태 관리
 *
 * @returns 컬럼 크기 상태 및 핸들러
 *
 * 📝 주의사항:
 * - 컬럼 크기는 픽셀 단위로 관리
 * - 세션 동안만 유지됨 (새로고침 시 초기화)
 *
 * 🔄 사용 예시:
 * ```typescript
 * const { columnSizing, onColumnSizingChange } = useColumnResizing();
 *
 * const table = useReactTable({
 *   columnResizeMode: "onChange",
 *   state: { columnSizing },
 *   onColumnSizingChange,
 *   // ...
 * });
 * ```
 */
export function useColumnResizing() {
  // 🎯 컬럼 크기 상태 (초기값: 빈 객체 - 컬럼 정의의 size 사용)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // 🎯 컬럼 크기 변경 핸들러 (TanStack Table의 onColumnSizingChange에 전달)
  const onColumnSizingChange = useCallback(
    (updater: ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing((old) => {
        const newSizing = typeof updater === "function" ? updater(old) : updater;
        return newSizing;
      });
    },
    [],
  );

  return {
    columnSizing,
    onColumnSizingChange,
  };
}
