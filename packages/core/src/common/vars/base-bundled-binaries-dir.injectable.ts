/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import joinPathsInjectable from "../path/join-paths.injectable";
import bundledResourcesDirectoryInjectable from "./bundled-resources-dir.injectable";
import normalizedPlatformArchitectureInjectable from "./normalized-platform-architecture.injectable";

/**
 * 🎯 목적: 플랫폼별 바이너리가 위치한 기본 디렉토리 경로를 반환
 *
 * bundledResourcesDirectory + 아키텍처(arm64/x64)를 조합하여
 * kubectl, skuberplus-k8s-proxy 등의 바이너리가 있는 경로를 생성합니다.
 *
 * @returns 바이너리 디렉토리의 절대 경로
 *
 * 📝 예시:
 * - 개발: /프로젝트루트/binaries/client/darwin/arm64
 * - 프로덕션: /SkuberPlus.app/Contents/Resources/arm64
 */
const baseBundledBinariesDirectoryInjectable = getInjectable({
  id: "base-bundled-binaries-directory",
  instantiate: (di) => {
    const bundledResourcesDirectory = di.inject(bundledResourcesDirectoryInjectable);
    const normalizedPlatformArchitecture = di.inject(normalizedPlatformArchitectureInjectable);
    const joinPaths = di.inject(joinPathsInjectable);

    const binariesPath = joinPaths(bundledResourcesDirectory, normalizedPlatformArchitecture);

    // 🔍 최종 바이너리 경로 로깅
    console.log(`[BASE-BUNDLED-BINARIES-DIR] 바이너리 기본 경로: ${binariesPath}`);

    return binariesPath;
  },
});

export default baseBundledBinariesDirectoryInjectable;
