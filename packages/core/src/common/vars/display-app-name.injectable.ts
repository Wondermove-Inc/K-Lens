/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import displayProductNameInjectable from "./display-product-name.injectable";
import isDevelopmentInjectable from "./is-development.injectable";

/**
 * 🎯 목적: UI 표시용 앱 이름 생성 (윈도우 타이틀, About 다이얼로그 등)
 *
 * displayProductName 사용하여 UI에 "Skuber⁺ Client" 표시
 * 개발 모드에서는 "Skuber⁺ ClientDev" 표시
 *
 * ⚠️ 주의: 파일 시스템 경로에는 app-name.injectable.ts를 사용하세요.
 *
 * 🔄 변경이력:
 * - 2026-01-15: 초기 생성 (UI 브랜딩 위첨자 지원)
 */
const displayAppNameInjectable = getInjectable({
  id: "display-app-name",

  instantiate: (di) => {
    const isDevelopment = di.inject(isDevelopmentInjectable);
    const displayProductName = di.inject(displayProductNameInjectable);

    return `${displayProductName}${isDevelopment ? "Dev" : ""}`;
  },
});

export default displayAppNameInjectable;
