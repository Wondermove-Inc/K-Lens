/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import isProductionInjectable from "./is-production.injectable";

/**
 * 🎯 목적: Lens 앱의 Resources 디렉토리 경로를 반환
 *
 * 개발 모드와 프로덕션 빌드에서 올바른 Resources 경로를 제공합니다.
 * process.resourcesPath가 electron 개발 의존성을 가리키는 경우를 감지하여
 * 개발 모드로 폴백합니다.
 *
 * @returns Resources 디렉토리의 절대 경로
 *
 * 📝 주의사항:
 * - 개발 모드: process.cwd() 사용 (프로젝트 루트)
 * - 프로덕션: process.resourcesPath 사용 (SkuberPlus.app/Contents/Resources)
 * - process.resourcesPath에 'node_modules'가 포함되면 개발 모드로 간주
 */
const lensResourcesDirInjectable = getInjectable({
  id: "lens-resources-dir",

  instantiate: (di) => {
    const isProduction = di.inject(isProductionInjectable);

    // 🔍 프로덕션 모드에서도 process.resourcesPath가 올바른지 검증
    if (isProduction) {
      const resourcesPath = process.resourcesPath;

      // ⚠️ process.resourcesPath가 electron 개발 의존성을 가리키는지 확인
      if (resourcesPath && resourcesPath.includes("node_modules")) {
        return process.cwd();
      }

      return resourcesPath;
    }

    // 개발 모드
    return process.cwd();
  },

  causesSideEffects: true,
});

export default lensResourcesDirInjectable;
