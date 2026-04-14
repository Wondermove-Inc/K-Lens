/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import appPathsInjectable from "../app-paths/app-paths.injectable";
import pathExistsSyncInjectable from "../fs/path-exists-sync.injectable";
import joinPathsInjectable from "../path/join-paths.injectable";

/**
 * 🎯 목적: static 파일들이 위치한 디렉토리 경로를 반환
 *
 * 개발 모드와 프로덕션 빌드 모두에서 올바른 경로를 제공하기 위해
 * 경로 존재 여부를 검증하고 로깅합니다.
 *
 * @returns static 파일 디렉토리의 절대 경로
 *
 * 📝 주의사항:
 * - 개발 모드: /프로젝트루트/skuberplus/static
 * - 프로덕션: /App/Contents/Resources/app/static
 */
const staticFilesDirectoryInjectable = getInjectable({
  id: "static-files-directory",

  instantiate: (di) => {
    const joinPaths = di.inject(joinPathsInjectable);
    const pathExistsSync = di.inject(pathExistsSyncInjectable);
    const currentAppDir = di.inject(appPathsInjectable).currentApp;

    const staticDir = joinPaths(currentAppDir, "static");

    if (!pathExistsSync(staticDir)) {
      console.error(`[STATIC-FILES-DIR] Static 디렉토리 없음: ${staticDir}`);
      console.error(`[STATIC-FILES-DIR] currentAppDir: ${currentAppDir}`);
    }

    return staticDir;
  },
});

export default staticFilesDirectoryInjectable;
