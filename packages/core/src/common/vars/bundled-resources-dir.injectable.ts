/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import joinPathsInjectable from "../path/join-paths.injectable";
import isProductionInjectable from "./is-production.injectable";
import lensResourcesDirInjectable from "./lens-resources-dir.injectable";
import normalizedPlatformInjectable from "./normalized-platform.injectable";

/**
 * 🎯 목적: 번들된 리소스가 위치한 디렉토리 경로를 반환
 *
 * 개발 모드와 프로덕션 빌드에서 서로 다른 경로 구조를 사용합니다.
 *
 * @returns 번들된 리소스 디렉토리의 절대 경로
 *
 * 📝 주의사항:
 * - 개발 모드: lensResourcesDir + "/binaries/client/" + platform
 * - 프로덕션: lensResourcesDir (이미 Resources 디렉토리)
 */
const bundledResourcesDirectoryInjectable = getInjectable({
  id: "bundled-resources-directory",
  instantiate: (di) => {
    const isProduction = di.inject(isProductionInjectable);
    const normalizedPlatform = di.inject(normalizedPlatformInjectable);
    const joinPaths = di.inject(joinPathsInjectable);
    const lensResourcesDir = di.inject(lensResourcesDirInjectable);

    if (isProduction) {
      // 🎯 프로덕션: Resources 디렉토리를 직접 사용
      console.log(`[BUNDLED-RESOURCES-DIR] 프로덕션 모드, Resources 경로 사용: ${lensResourcesDir}`);
      return lensResourcesDir;
    }

    // 🔧 개발 모드: binaries/client/플랫폼 경로 추가
    const devPath = joinPaths(lensResourcesDir, "binaries", "client", normalizedPlatform);
    console.log(`[BUNDLED-RESOURCES-DIR] 개발 모드, 바이너리 경로: ${devPath}`);
    return devPath;
  },
});

export default bundledResourcesDirectoryInjectable;
