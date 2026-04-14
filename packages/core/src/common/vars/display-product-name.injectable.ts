/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: UI 표시용 제품명 Injectable
 *
 * displayProductName이 있으면 사용, 없으면 productName 폴백
 * - displayProductName: "Skuber⁺ Client" (위첨자 +, UI 표시용)
 * - productName: "Skuber+ Client" (일반 +, 폴더명/파일명용)
 *
 * 🔄 변경이력:
 * - 2026-01-15: 초기 생성 (UI 브랜딩 위첨자 지원)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { applicationInformationToken } from "@skuberplus/application";

const displayProductNameInjectable = getInjectable({
  id: "display-product-name",
  instantiate: (di) => {
    const appInfo = di.inject(applicationInformationToken);

    // displayProductName이 있으면 사용, 없으면 productName 폴백
    return appInfo.displayProductName ?? appInfo.productName;
  },
});

export default displayProductNameInjectable;
