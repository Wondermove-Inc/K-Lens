/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import isDevelopmentInjectable from "./is-development.injectable";
import productNameInjectable from "./product-name.injectable";

/**
 * 🎯 목적: 앱 이름 생성 (파일 시스템 경로, 데이터 디렉토리용)
 *
 * ⚠️ 주의: 이 값은 사용자 데이터 디렉토리 경로에 사용됩니다.
 * 절대로 displayProductName을 사용하지 마세요! (폴더명이 바뀌어 데이터 유실됨)
 *
 * UI 표시용은 display-app-name.injectable.ts를 사용하세요.
 */
const appNameInjectable = getInjectable({
  id: "app-name",

  instantiate: (di) => {
    const isDevelopment = di.inject(isDevelopmentInjectable);
    const productName = di.inject(productNameInjectable);

    return `${productName}${isDevelopment ? "Dev" : ""}`;
  },
});

export default appNameInjectable;
