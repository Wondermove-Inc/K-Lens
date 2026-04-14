/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import columnWidthStorageInjectable from "./column-width-storage.injectable";
import { ColumnWidthStore } from "./column-width-store";

/**
 * 🎯 목적: 테이블 컬럼 너비 상태 관리 스토어 DI 등록
 *
 * 🔧 의존성:
 * - columnWidthStorageInjectable: localStorage 저장/불러오기 서비스
 *
 * 📝 사용법:
 * const columnWidthStore = di.inject(columnWidthStoreInjectable);
 * columnWidthStore.setColumnWidth("pods-table", "name", 250);
 */
const columnWidthStoreInjectable = getInjectable({
  id: "column-width-store",
  instantiate: (di) => {
    const storage = di.inject(columnWidthStorageInjectable);
    return new ColumnWidthStore(storage);
  },
  causesSideEffects: true, // localStorage 접근으로 인한 사이드 이펙트
});

export default columnWidthStoreInjectable;
